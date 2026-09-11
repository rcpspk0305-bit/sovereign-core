"""Missions API router for Sovereign-Core Agent Squad.

Provides controlled endpoints:
POST /api/v1/missions
GET  /api/v1/missions/{mission_id}
POST /api/v1/missions/{mission_id}/cancel
POST /api/v1/missions/{mission_id}/approve
POST /api/v1/missions/{mission_id}/reject
"""

import datetime
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.v1.agents import get_controlled_tool_registry
from app.api.v1.chat import get_audit_logger
from app.config import settings
from app.core.agents.classifier import task_classifier
from app.core.agents.definitions import AgentStatus, ApprovalPolicy
from app.core.agents.mission_orchestrator import MissionOrchestrator
from app.core.agents.registry import agent_registry
from app.core.flight_recorder.manager import (
    FlightRecorderManager,
    get_flight_recorder_manager,
)
from app.core.flight_recorder.models import (
    ApprovalStatus,
    FlightEvent,
    FlightEventType,
    FlightRecord,
    NetworkMode,
    StepRecord,
    ToolExecutionRecord,
)
from app.core.interfaces.audit import BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.tools import BaseToolRegistry
from app.core.llm.service import get_llm_provider

logger = logging.getLogger("sovereign.api.missions")

router = APIRouter(prefix="/missions", tags=["Missions"])

# Active missions in-memory cache
_active_missions: Dict[str, Dict[str, Any]] = {}
_cancellation_tokens: Dict[str, bool] = {}


class CreateMissionRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Mission directive or prompt.")
    agent_id: Optional[str] = Field(default=None, description="Explicit agent ID (e.g. research, data_analyst). If omitted, TaskClassifier selects.")
    mission_id: Optional[str] = Field(default=None, description="Optional custom mission ID.")
    model: Optional[str] = None
    max_steps: Optional[int] = Field(default=None, ge=1, le=10)
    document_context: Optional[str] = Field(default=None, description="Direct text of document for deterministic evaluation.")
    rules: Optional[List[str]] = Field(default=None, description="Optional compliance rules.")


class MissionDecisionRequest(BaseModel):
    notes: Optional[str] = None


@router.post("", response_model=Dict[str, Any])
async def create_and_run_mission(
    request: CreateMissionRequest,
    llm_client: BaseLLMClient = Depends(get_llm_provider),
    tool_registry: BaseToolRegistry = Depends(get_controlled_tool_registry),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
    flight_recorder: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> Dict[str, Any]:
    """Execute a mission via the designated specialist agent or Mission Orchestrator."""
    start_time = datetime.datetime.now(datetime.timezone.utc)
    mission_id = request.mission_id or f"mission_{uuid.uuid4().hex[:10]}"
    resolved_model = request.model or settings.DEFAULT_MODEL

    # Classify task if agent not explicitly provided
    if request.agent_id:
        target_agent_id = request.agent_id
        classification = None
        pipeline = [target_agent_id]
    else:
        classification = task_classifier.classify(request.prompt)
        target_agent_id = classification.target_agent_id
        pipeline = classification.suggested_pipeline or [target_agent_id]

    agent_def = agent_registry.get_definition(target_agent_id)
    if not agent_def:
        raise HTTPException(
            status_code=400,
            detail=f"Agent '{target_agent_id}' is not registered. Registered agents: {[d.id for d in agent_registry.list_definitions()]}",
        )

    # Initialize mission state
    mission_state: Dict[str, Any] = {
        "mission_id": mission_id,
        "task": request.prompt,
        "agent_id": target_agent_id,
        "agent_name": agent_def.name,
        "model": resolved_model,
        "status": AgentStatus.RUNNING.value,
        "pipeline": pipeline,
        "current_step": 0,
        "max_steps": request.max_steps or agent_def.max_steps,
        "steps": [],
        "tools_called": [],
        "evidence": [],
        "citations": [],
        "verification_status": "PENDING",
        "approval_status": "PENDING",
        "requires_approval": agent_def.approval_policy == ApprovalPolicy.HUMAN_REQUIRED or target_agent_id == "orchestrator",
        "errors": [],
        "final_output": None,
        "started_at": start_time.isoformat(),
        "completed_at": None,
    }
    _active_missions[mission_id] = mission_state
    _cancellation_tokens[mission_id] = False

    # Broadcast task started on WebSocket
    await flight_recorder.broadcast_event(
        FlightEvent(
            event_type=FlightEventType.TASK_STARTED,
            task_id=mission_id,
            timestamp=start_time.isoformat(),
            data={
                "model": resolved_model,
                "prompt": request.prompt,
                "agent_id": target_agent_id,
                "pipeline": pipeline,
                "network_mode": NetworkMode.AIR_GAPPED_LOCAL.value,
                "approval_status": mission_state["approval_status"],
            },
        )
    )

    # Telemetry bridge callback
    async def telemetry_callback(event_data: Dict[str, Any]) -> None:
        ev_type = event_data.get("type", "")
        ts = event_data.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat()
        step_num = event_data.get("step", event_data.get("step_number", mission_state["current_step"]))
        mission_state["current_step"] = step_num

        # Forward directly to WebSocket
        mapped_type = FlightEventType.STEP_STARTED
        if "tool" in ev_type:
            mapped_type = FlightEventType.TOOL_CALLED if "start" in ev_type else FlightEventType.TOOL_COMPLETED
            if mapped_type == FlightEventType.TOOL_COMPLETED and event_data.get("tool_name"):
                mission_state["tools_called"].append(event_data)
        elif "evidence" in ev_type:
            mapped_type = FlightEventType.SOURCES_RETRIEVED
            if "evidence" in event_data:
                mission_state["evidence"].append(event_data["evidence"])
        elif "approval" in ev_type:
            mapped_type = FlightEventType.APPROVAL_UPDATED
            mission_state["approval_status"] = "WAITING_FOR_APPROVAL"
        elif "failed" in ev_type:
            mapped_type = FlightEventType.ERROR_RECORDED
            mission_state["errors"].append(event_data.get("error", "Agent failed"))

        await flight_recorder.broadcast_event(
            FlightEvent(
                event_type=mapped_type,
                task_id=mission_id,
                timestamp=ts,
                data=event_data,
            )
        )

    # Instantiate and run agent
    try:
        if target_agent_id == "orchestrator":
            orchestrator = MissionOrchestrator(
                llm_client=llm_client,
                tool_registry=tool_registry,
                audit_logger=audit_logger,
                definition=agent_def,
            )
            result = await orchestrator.run(
                prompt=request.prompt,
                session_id=mission_id,
                max_steps=mission_state["max_steps"],
                event_callback=telemetry_callback,
                target_pipeline=pipeline,
                document_context=request.document_context,
            )
        else:
            agent = agent_registry.create_agent(
                agent_id=target_agent_id,
                llm_client=llm_client,
                tool_registry=tool_registry,
                audit_logger=audit_logger,
            )
            # Prepend document context if supplied
            run_prompt = request.prompt
            if request.document_context:
                run_prompt = f"{request.prompt}\n\nDOCUMENT TEXT:\n{request.document_context}"
            if request.rules:
                run_prompt += f"\n\nRULES TO CHECK:\n" + "\n".join(f"- {r}" for r in request.rules)

            result = await agent.run(
                prompt=run_prompt,
                session_id=mission_id,
                max_steps=mission_state["max_steps"],
                event_callback=telemetry_callback,
            )

        end_time = datetime.datetime.now(datetime.timezone.utc)
        mission_state["completed_at"] = end_time.isoformat()
        mission_state["final_output"] = result.final_response
        mission_state["steps"] = [s.model_dump() for s in result.steps]
        mission_state["verification_status"] = result.metadata.get("verification_status", "VERIFIED")
        
        # Approval determination
        req_approval = result.metadata.get("requires_approval", agent_def.approval_policy == ApprovalPolicy.HUMAN_REQUIRED)
        mission_state["requires_approval"] = req_approval

        if req_approval and mission_state["approval_status"] != "APPROVED":
            mission_state["status"] = AgentStatus.WAITING_FOR_APPROVAL.value
            mission_state["approval_status"] = "PENDING"
        else:
            mission_state["status"] = AgentStatus.COMPLETED.value
            mission_state["approval_status"] = "AUTO_VERIFIED"

        # If evidence in metadata, sync
        if result.metadata.get("evidence"):
            for ev in result.metadata["evidence"]:
                if ev not in mission_state["evidence"]:
                    mission_state["evidence"].append(ev)

        # Save to flight recorder for permanent blackbox provenance
        flight_rec = FlightRecord(
            task_id=mission_id,
            model=resolved_model,
            prompt=request.prompt,
            network_mode=NetworkMode.AIR_GAPPED_LOCAL,
            approval_status=ApprovalStatus.PENDING if req_approval else ApprovalStatus.AUTO_VERIFIED,
            status="completed",
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            total_latency_ms=result.total_latency_ms,
            steps=[
                StepRecord(
                    step_number=s.step_number,
                    thought=s.thought,
                    tool_name=s.tool_name,
                    tool_arguments=s.tool_arguments or {},
                    observation=s.observation,
                    timestamp=s.timestamp,
                    status="completed",
                )
                for s in result.steps
            ],
            tools_called=[],
            retrieved_sources=[],
            artifacts_generated=[],
            errors=[],
            final_response=result.final_response,
            metadata=result.metadata,
        )
        flight_recorder._persist_record(flight_rec)

        # Broadcast completion
        await flight_recorder.broadcast_event(
            FlightEvent(
                event_type=FlightEventType.TASK_COMPLETED,
                task_id=mission_id,
                timestamp=end_time.isoformat(),
                data={
                    "status": mission_state["status"],
                    "approval_status": mission_state["approval_status"],
                    "final_output": result.final_response,
                    "steps_count": len(result.steps),
                },
            )
        )

        return mission_state

    except Exception as exc:
        logger.exception("Mission failed: %s", exc)
        end_time = datetime.datetime.now(datetime.timezone.utc)
        mission_state["status"] = AgentStatus.FAILED.value
        mission_state["errors"].append(str(exc))
        mission_state["completed_at"] = end_time.isoformat()
        return mission_state


@router.get("/{mission_id}", response_model=Dict[str, Any])
async def get_mission(
    mission_id: str,
    flight_recorder: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> Dict[str, Any]:
    """Retrieve full execution state, subagent steps, evidence, and disposition for a mission."""
    if mission_id in _active_missions:
        return _active_missions[mission_id]

    rec = flight_recorder.get_record(mission_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")

    return {
        "mission_id": rec.task_id,
        "task": rec.prompt,
        "model": rec.model,
        "status": rec.status,
        "approval_status": rec.approval_status.value,
        "steps": [s.model_dump() for s in rec.steps],
        "final_output": rec.final_response,
        "started_at": rec.start_time,
        "completed_at": rec.end_time,
        "total_latency_ms": rec.total_latency_ms,
        "metadata": rec.metadata,
    }


@router.post("/{mission_id}/approve", response_model=Dict[str, Any])
async def approve_mission(
    mission_id: str,
    body: Optional[MissionDecisionRequest] = None,
    flight_recorder: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> Dict[str, Any]:
    """Record human approval for a pending mission."""
    notes = body.notes if body else None
    if mission_id in _active_missions:
        _active_missions[mission_id]["approval_status"] = "APPROVED"
        _active_missions[mission_id]["status"] = AgentStatus.COMPLETED.value
        if notes:
            _active_missions[mission_id]["approval_notes"] = notes

    await flight_recorder.update_approval(mission_id, ApprovalStatus.APPROVED, notes=notes)
    return {
        "mission_id": mission_id,
        "approval_status": "APPROVED",
        "status": "COMPLETED",
        "notes": notes,
    }


@router.post("/{mission_id}/reject", response_model=Dict[str, Any])
async def reject_mission(
    mission_id: str,
    body: Optional[MissionDecisionRequest] = None,
    flight_recorder: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> Dict[str, Any]:
    """Record human rejection of a mission."""
    notes = body.notes if body else None
    if mission_id in _active_missions:
        _active_missions[mission_id]["approval_status"] = "REJECTED"
        _active_missions[mission_id]["status"] = AgentStatus.COMPLETED.value
        if notes:
            _active_missions[mission_id]["approval_notes"] = notes

    await flight_recorder.update_approval(mission_id, ApprovalStatus.REJECTED, notes=notes)
    return {
        "mission_id": mission_id,
        "approval_status": "REJECTED",
        "status": "COMPLETED",
        "notes": notes,
    }


@router.post("/{mission_id}/cancel", response_model=Dict[str, Any])
async def cancel_mission(
    mission_id: str,
    flight_recorder: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> Dict[str, Any]:
    """Cancel an active mission safely at the current step boundary."""
    _cancellation_tokens[mission_id] = True
    cancelled = False
    if mission_id in _active_missions:
        _active_missions[mission_id]["status"] = AgentStatus.CANCELLED.value
        cancelled = True

    await flight_recorder.broadcast_event(
        FlightEvent(
            event_type=FlightEventType.TASK_COMPLETED,
            task_id=mission_id,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            data={"status": "CANCELLED", "reason": "Cancelled by operator"},
        )
    )

    return {
        "mission_id": mission_id,
        "cancelled": cancelled,
        "status": "CANCELLED" if cancelled else "NOT_FOUND",
    }
