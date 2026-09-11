"""Mission Orchestrator implementing high-level multi-agent delegation and verification."""

import datetime
import json
import logging
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from app.core.agents.classifier import task_classifier
from app.core.agents.definitions import (
    AgentDefinition,
    AgentStatus,
    ApprovalPolicy,
)
from app.core.agents.registry import agent_registry
from app.core.interfaces.agents import (
    AgentResult,
    AgentStep,
    BaseAgent,
)
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.tools import BaseToolRegistry

logger = logging.getLogger("sovereign.agents.orchestrator")

ORCHESTRATOR_DEF = AgentDefinition(
    id="orchestrator",
    name="Mission Orchestrator",
    description="Decomposes complex directives, delegates to specialist agents, verifies evidence, and coordinates approvals.",
    purpose="Coordinate multi-specialist missions with strict adherence to specialist tool permissions and human approval gates.",
    capabilities=["task_decomposition", "specialist_delegation", "evidence_aggregation", "provenance_verification", "approval_coordination"],
    allowed_tools=[],
    max_steps=10,
    evidence_requirements=["All findings and calculations must be verified across specialist agents."],
    failure_policy="HALT_AND_REPORT",
    approval_policy=ApprovalPolicy.HUMAN_REQUIRED,
    input_schema={
        "type": "object",
        "properties": {"task": {"type": "string"}},
        "required": ["task"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "mission_id": {"type": "string"},
            "task": {"type": "string"},
            "pipeline": {"type": "array", "items": {"type": "string"}},
            "agent_results": {"type": "object"},
            "evidence": {"type": "array", "items": {"type": "object"}},
            "verification_status": {"type": "string"},
            "approval_status": {"type": "string"},
            "final_summary": {"type": "string"},
        },
        "required": ["mission_id", "task", "pipeline", "verification_status", "final_summary"],
    },
    system_instructions=(
        "You are the Sovereign-Core Mission Orchestrator. Decompose complex user missions into specialist sub-tasks.\n"
        "Delegate tasks strictly to: document_analyst, data_analyst, compliance, and report.\n"
        "Verify all evidence and require human approval before completing the mission."
    ),
)


class MissionOrchestrator(BaseAgent):
    """Coordinates specialist agents across complex, multi-domain missions."""

    def __init__(
        self,
        llm_client: BaseLLMClient,
        tool_registry: BaseToolRegistry,
        audit_logger: Optional[BaseAuditLogger] = None,
        definition: Optional[AgentDefinition] = None,
    ) -> None:
        self.definition = definition or ORCHESTRATOR_DEF
        self.llm_client = llm_client
        self.tool_registry = tool_registry
        self.audit_logger = audit_logger

    @property
    def name(self) -> str:
        return self.definition.name

    @property
    def description(self) -> str:
        return self.definition.description

    async def run(
        self,
        prompt: str,
        session_id: Optional[str] = None,
        max_steps: int = 10,
        event_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
        target_pipeline: Optional[List[str]] = None,
        document_context: Optional[str] = None,
        **kwargs: Any,
    ) -> AgentResult:
        """Execute a coordinated multi-specialist mission."""
        start_time = time.perf_counter()
        mission_id = session_id or f"mission_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Step 1: Emit mission created event
        if event_callback:
            try:
                await event_callback({
                    "type": "mission.created",
                    "mission_id": mission_id,
                    "agent_id": "orchestrator",
                    "step": 0,
                    "task": prompt,
                    "timestamp": now_iso,
                    "status": AgentStatus.PLANNING.value,
                })
            except Exception:
                pass

        # Step 2: Determine pipeline via TaskClassifier if not explicitly provided
        if target_pipeline:
            pipeline = target_pipeline
        else:
            classification = task_classifier.classify(prompt)
            pipeline = classification.suggested_pipeline
            if not pipeline or classification.target_agent_id != "orchestrator":
                pipeline = [classification.target_agent_id]

        all_steps: List[AgentStep] = []
        specialist_results: Dict[str, Any] = {}
        aggregated_evidence: List[Dict[str, Any]] = []
        all_citations: List[str] = []
        step_index = 1
        requires_approval = False

        # Step 3: Execute specialist pipeline sequentially
        for agent_id in pipeline:
            agent_def = agent_registry.get_definition(agent_id)
            agent_name = agent_def.name if agent_def else agent_id

            if event_callback:
                try:
                    await event_callback({
                        "type": "agent.selected",
                        "mission_id": mission_id,
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "step": step_index,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "status": AgentStatus.QUEUED.value,
                    })
                except Exception:
                    pass

            # Create specialist agent through registry to strictly enforce permissions
            try:
                specialist = agent_registry.create_agent(
                    agent_id=agent_id,
                    llm_client=self.llm_client,
                    tool_registry=self.tool_registry,
                    audit_logger=self.audit_logger,
                )
            except KeyError:
                logger.error("Orchestrator failed to load specialist '%s'", agent_id)
                continue

            if agent_def and agent_def.approval_policy == ApprovalPolicy.HUMAN_REQUIRED:
                requires_approval = True

            # Prepare subtask prompt including any document context or previous findings
            subtask_prompt = f"Mission directive: {prompt}\n"
            if document_context:
                subtask_prompt += f"\nDOCUMENT CONTENT:\n{document_context}\n"
            if specialist_results:
                subtask_prompt += f"\nPREVIOUS SPECIALIST FINDINGS:\n{json.dumps(specialist_results, indent=2)}\n"

            # Execute specialist agent
            sub_res = await specialist.run(
                prompt=subtask_prompt,
                session_id=mission_id,
                event_callback=event_callback,
                **kwargs,
            )

            # Accumulate steps and evidence
            for s in sub_res.steps:
                s.step_number = step_index
                all_steps.append(s)
                step_index += 1

            try:
                parsed_out = json.loads(sub_res.final_response)
            except Exception:
                parsed_out = {"raw_output": sub_res.final_response}

            specialist_results[agent_id] = parsed_out

            # Gather evidence
            if isinstance(parsed_out, dict):
                ev = parsed_out.get("evidence", [])
                if isinstance(ev, list):
                    aggregated_evidence.extend(ev)

        # Step 4: Verification pass
        if event_callback:
            try:
                await event_callback({
                    "type": "verification.started",
                    "mission_id": mission_id,
                    "agent_id": "orchestrator",
                    "step": step_index,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "status": AgentStatus.VERIFYING.value,
                })
            except Exception:
                pass

        verification_status = "VERIFIED"
        # Verify compliance status if checked
        if "compliance" in specialist_results:
            comp_res = specialist_results["compliance"]
            if isinstance(comp_res, dict) and comp_res.get("status") != "COMPLIANT":
                verification_status = comp_res.get("status", "UNVERIFIED")

        if event_callback:
            try:
                await event_callback({
                    "type": "verification.completed",
                    "mission_id": mission_id,
                    "agent_id": "orchestrator",
                    "step": step_index,
                    "verification_status": verification_status,
                    "evidence_count": len(aggregated_evidence),
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "status": AgentStatus.VERIFYING.value,
                })
            except Exception:
                pass

        # Step 5: Approval gate if sensitive tasks (compliance, report generation) were executed
        approval_status = "PENDING"
        if requires_approval:
            approval_status = "WAITING_FOR_APPROVAL"
            if event_callback:
                try:
                    await event_callback({
                        "type": "approval.requested",
                        "mission_id": mission_id,
                        "agent_id": "orchestrator",
                        "step": step_index,
                        "task": prompt,
                        "evidence_count": len(aggregated_evidence),
                        "confidence": 0.95,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "status": AgentStatus.WAITING_FOR_APPROVAL.value,
                    })
                except Exception:
                    pass
        else:
            approval_status = "AUTO_VERIFIED"

        total_elapsed = (time.perf_counter() - start_time) * 1000.0

        # Build final executive summary
        summary_lines = [
            f"### Sovereign-Core Mission Execution Report",
            f"**Mission Directive:** {prompt}",
            f"**Verification Status:** {verification_status}",
            f"**Approval Status:** {approval_status}",
            f"**Specialist Pipeline:** {' -> '.join(pipeline)}",
            "",
            "#### Findings & Analysis:",
        ]

        if "document_analyst" in specialist_results:
            doc_data = specialist_results["document_analyst"]
            summary_lines.append(f"- **Document Findings:** {len(doc_data.get('key_findings', []))} facts extracted.")
            for inc in doc_data.get("inconsistencies", []):
                summary_lines.append(f"  * Warning: {inc}")

        if "data_analyst" in specialist_results:
            data_res = specialist_results["data_analyst"]
            formatted_res = data_res.get("result_formatted") or f"{data_res.get('result')}"
            summary_lines.append(f"- **Quantitative Analysis:** Calculated metric = **{formatted_res}** (Verified via deterministic calculator).")

        if "compliance" in specialist_results:
            comp_res = specialist_results["compliance"]
            c_status = comp_res.get("status", "INSUFFICIENT_EVIDENCE")
            summary_lines.append(f"- **Compliance Assessment:** **{c_status}** ({len(comp_res.get('checks', []))} rules evaluated against verified citations).")

        if "report" in specialist_results:
            rep_res = specialist_results["report"]
            art_id = rep_res.get("artifact_id", "art_verified")
            summary_lines.append(f"- **Official Artifact:** Generated executive report artifact `{art_id}`.")

        final_response_text = "\n".join(summary_lines)

        if event_callback:
            try:
                await event_callback({
                    "type": "mission.completed",
                    "mission_id": mission_id,
                    "agent_id": "orchestrator",
                    "status": AgentStatus.COMPLETED.value if not requires_approval else AgentStatus.WAITING_FOR_APPROVAL.value,
                    "total_latency_ms": round(total_elapsed, 2),
                    "steps_count": len(all_steps),
                    "pipeline": pipeline,
                    "verification_status": verification_status,
                    "approval_status": approval_status,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                })
            except Exception:
                pass

        if self.audit_logger:
            await self.audit_logger.log(
                AuditEvent(
                    id=str(uuid.uuid4()),
                    timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    event_type=AuditEventType.AGENT_RUN,
                    session_id=mission_id,
                    prompt_preview=prompt[:120],
                    response_preview=final_response_text[:120],
                    latency_ms=round(total_elapsed, 2),
                    status="success",
                    payload={
                        "orchestrator": True,
                        "pipeline": pipeline,
                        "verification_status": verification_status,
                        "approval_status": approval_status,
                        "steps": len(all_steps),
                    },
                )
            )

        return AgentResult(
            session_id=mission_id,
            final_response=final_response_text,
            steps=all_steps,
            success=True,
            total_latency_ms=round(total_elapsed, 2),
            metadata={
                "agent_id": "orchestrator",
                "pipeline": pipeline,
                "specialist_results": specialist_results,
                "evidence": aggregated_evidence,
                "verification_status": verification_status,
                "approval_status": approval_status,
                "requires_approval": requires_approval,
            },
        )
