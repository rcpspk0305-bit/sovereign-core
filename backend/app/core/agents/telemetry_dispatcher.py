"""Telemetry Dispatcher connecting Agent Squad execution to Flight Recorder and WebSocket streaming."""

import datetime
import logging
from typing import Any, Callable, Coroutine, Dict, Optional

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
    RecordedError,
    RetrievedSource,
    StepRecord,
    ToolExecutionRecord,
)

logger = logging.getLogger("sovereign.agents.telemetry")


class AgentTelemetryDispatcher:
    """Dispatches real-time agent squad events to Flight Recorder and connected WebSocket clients."""

    def __init__(self, manager: Optional[FlightRecorderManager] = None) -> None:
        self._manager = manager

    @property
    def manager(self) -> FlightRecorderManager:
        if self._manager is None:
            self._manager = get_flight_recorder_manager()
        return self._manager

    async def dispatch(self, event_dict: Dict[str, Any]) -> None:
        """Normalize, record, and broadcast an agent lifecycle event."""
        task_id = str(
            event_dict.get("mission_id")
            or event_dict.get("task_id")
            or event_dict.get("session_id")
            or "global"
        )
        ev_type = str(event_dict.get("type") or event_dict.get("event_type") or "unknown")
        now_iso = event_dict.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Build normalized FlightEvent
        flight_event = FlightEvent(
            event_type=ev_type,
            task_id=task_id,
            timestamp=now_iso,
            data=event_dict,
        )

        # Broadcast over WebSocket via FlightRecorderManager
        try:
            await self.manager.broadcast_event(flight_event)
        except Exception as exc:
            logger.warning("Failed to broadcast agent event over WebSocket: %s", exc)

        # Update FlightRecord tracking if valid task_id
        if task_id and task_id != "global":
            try:
                self._update_flight_record(task_id, ev_type, event_dict, now_iso)
            except Exception as ex:
                logger.warning("Failed to update flight record for mission %s: %s", task_id, ex)

    def _update_flight_record(
        self,
        task_id: str,
        event_type: str,
        data: Dict[str, Any],
        timestamp: str,
    ) -> None:
        """Reflect squad lifecycle events into the authoritative FlightRecord."""
        record = self.manager.get_record(task_id)

        if record is None and event_type in ("mission.created", "agent.started"):
            # Initialize record if not created yet
            record = FlightRecord(
                task_id=task_id,
                prompt=data.get("task") or data.get("prompt") or "Specialist Mission",
                model="sovereign-agent-squad",
                network_mode=NetworkMode.AIR_GAPPED_LOCAL,
                approval_status=ApprovalStatus.PENDING,
                start_time=timestamp,
                metadata={
                    "mission_type": "agent_squad",
                    "agent_id": data.get("agent_id", "orchestrator"),
                },
            )
            self.manager._persist_record(record)
            return

        if not record:
            return

        # Handle specific events
        if event_type == "agent.step.started":
            step_num = int(data.get("step", len(record.steps) + 1))
            record.steps.append(
                StepRecord(
                    step_number=step_num,
                    thought=f"Agent '{data.get('agent_id')}' started step {step_num}",
                    timestamp=timestamp,
                    status="running",
                )
            )
        elif event_type == "agent.step.completed":
            step_num = int(data.get("step", len(record.steps)))
            for s in record.steps:
                if s.step_number == step_num:
                    s.status = "completed"
                    if data.get("final_answer"):
                        s.observation = str(data.get("final_answer"))[:200]
                    break
        elif event_type == "tool.started":
            tool_name = str(data.get("tool_name", "unknown"))
            tool_args = data.get("arguments", {})
            step_num = int(data.get("step", len(record.steps)))
            record.tool_executions.append(
                ToolExecutionRecord(
                    step_number=step_num,
                    tool_name=tool_name,
                    tool_arguments=tool_args if isinstance(tool_args, dict) else {},
                    success=True,
                )
            )
        elif event_type == "tool.completed":
            tool_name = str(data.get("tool_name", "unknown"))
            step_num = int(data.get("step", len(record.steps)))
            for te in reversed(record.tool_executions):
                if te.tool_name == tool_name and te.step_number == step_num:
                    te.success = bool(data.get("success", True))
                    te.output_preview = str(data.get("output", ""))[:300]
                    break
        elif event_type == "evidence.found":
            evidence_items = data.get("evidence", [])
            if isinstance(evidence_items, list):
                for ev in evidence_items:
                    if isinstance(ev, dict):
                        record.retrieved_sources.append(
                            RetrievedSource(
                                document_name=ev.get("source", "Document"),
                                page_number=ev.get("page"),
                                similarity_score=float(ev.get("confidence", 0.95)),
                                chunk_preview=str(ev.get("snippet") or ev.get("finding") or "")[:200],
                            )
                        )
        elif event_type == "approval.requested":
            record.approval_status = ApprovalStatus.PENDING
            record.metadata["approval_required"] = True
            record.metadata["approval_details"] = data
        elif event_type == "mission.completed":
            record.end_time = timestamp
            if data.get("final_summary"):
                record.final_response = str(data.get("final_summary"))
            if record.approval_status == ApprovalStatus.PENDING and not data.get("requires_approval"):
                record.approval_status = ApprovalStatus.AUTO_VERIFIED
        elif event_type == "agent.failed":
            err_msg = str(data.get("error", "Agent execution error"))
            record.errors.append(
                RecordedError(
                    step_number=int(data.get("step", len(record.steps))),
                    error_message=err_msg,
                    severity="error",
                    timestamp=timestamp,
                )
            )

        self.manager._persist_record(record)

    def get_event_callback(self, mission_id: Optional[str] = None) -> Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]:
        """Produce an async callback suitable for agent.run(event_callback=...)."""
        async def _callback(event: Dict[str, Any]) -> None:
            if mission_id and "mission_id" not in event:
                event["mission_id"] = mission_id
            await self.dispatch(event)

        return _callback


_GLOBAL_TELEMETRY_DISPATCHER: Optional[AgentTelemetryDispatcher] = None


def get_telemetry_dispatcher() -> AgentTelemetryDispatcher:
    """Singleton getter for AgentTelemetryDispatcher."""
    global _GLOBAL_TELEMETRY_DISPATCHER
    if _GLOBAL_TELEMETRY_DISPATCHER is None:
        _GLOBAL_TELEMETRY_DISPATCHER = AgentTelemetryDispatcher()
    return _GLOBAL_TELEMETRY_DISPATCHER


agent_telemetry_dispatcher = get_telemetry_dispatcher()
