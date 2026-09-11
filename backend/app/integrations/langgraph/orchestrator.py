"""LangGraph Agent Orchestrator implementing Sovereign-Core BaseAgent."""

import datetime
import importlib.util
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from app.config import settings
from app.core.interfaces.agents import (
    AgentResult,
    AgentStep,
    BaseAgent,
)
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.tools import BaseToolRegistry, ToolResult
from app.integrations.base import (
    BaseIntegrationAdapter,
)
from app.integrations.langgraph.graph import ControlledStateGraph
from app.integrations.langgraph.state import GraphAgentState
from app.integrations.langgraph.tools_adapter import SovereignToolAdapter


class LangGraphAgentOrchestrator(BaseAgent, BaseIntegrationAdapter):
    """Controlled graph-based agent orchestrator powered by LangGraph.

    Maintains full compatibility with Sovereign-Core BaseAgent interface,
    enforcing local air-gapped security, step bounds, and fine-grained telemetry.
    """

    def __init__(
        self,
        llm_client: BaseLLMClient,
        tool_registry: BaseToolRegistry,
        audit_logger: Optional[BaseAuditLogger] = None,
        name: str = "langgraph_orchestrator",
        description: str = "Controlled graph-based agent orchestrator with verification and approval gates.",
        max_allowed_steps: int = 10,
    ) -> None:
        self._name = name
        self._description = description
        self.llm_client = llm_client
        self.tool_registry = tool_registry
        self.tools_adapter = SovereignToolAdapter(tool_registry)
        self.audit_logger = audit_logger
        self.max_allowed_steps = min(max(1, max_allowed_steps), 10)
        self._active_missions: Dict[str, GraphAgentState] = {}
        self._cancellation_tokens: Dict[str, bool] = {}

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    def is_enabled(self) -> bool:
        return bool(settings.ENABLE_LANGGRAPH)

    def is_available(self) -> bool:
        return importlib.util.find_spec("langgraph") is not None

    def cancel_mission(self, mission_id: str) -> bool:
        """Flag a running mission for safe termination at the next node."""
        self._cancellation_tokens[mission_id] = True
        if mission_id in self._active_missions:
            self._active_missions[mission_id]["cancelled"] = True
            return True
        return False

    def approve_mission(self, mission_id: str, status: str = "APPROVED", notes: Optional[str] = None) -> bool:
        """Record human sign-off on an active or pending mission."""
        if mission_id in self._active_missions:
            self._active_missions[mission_id]["approval_status"] = status
            return True
        return False

    def get_mission_state(self, mission_id: str) -> Optional[GraphAgentState]:
        """Inspect the current internal state of a mission."""
        return self._active_missions.get(mission_id)

    async def run(
        self,
        prompt: str,
        session_id: Optional[str] = None,
        max_steps: int = 5,
        model: Optional[str] = None,
        event_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
        telemetry_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
        **kwargs: Any,
    ) -> AgentResult:
        """Execute a controlled graph orchestration run."""
        start_time = time.perf_counter()
        bounded_steps = min(max(1, max_steps), self.max_allowed_steps)
        mission_id = session_id or f"mission_{uuid.uuid4().hex[:10]}"
        selected_model = model or settings.DEFAULT_MODEL
        callback = telemetry_callback or event_callback

        # Initial graph state
        state: GraphAgentState = {
            "mission_id": mission_id,
            "task": prompt,
            "messages": [{"role": "user", "content": prompt}],
            "current_step": 0,
            "max_steps": bounded_steps,
            "selected_model": selected_model,
            "tool_calls": [],
            "tool_results": [],
            "evidence": [],
            "citations": [],
            "provenance": {
                "mission_id": mission_id,
                "model": selected_model,
                "air_gapped": True,
            },
            "verification_status": "PENDING",
            "approval_required": False,
            "approval_status": "PENDING",
            "errors": [],
            "final_output": "",
            "cancelled": self._cancellation_tokens.get(mission_id, False),
            "current_node": "init",
            "planned_tools": [],
        }
        self._active_missions[mission_id] = state

        # Audit start
        if self.audit_logger:
            await self.audit_logger.log(
                AuditEvent(
                    id=str(uuid.uuid4()),
                    timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    event_type=AuditEventType.AGENT_RUN,
                    session_id=mission_id,
                    model=selected_model,
                    prompt_preview=prompt[:200],
                    status="started",
                    payload={"orchestrator": "langgraph", "max_steps": bounded_steps},
                )
            )

        # Build and execute state graph
        try:
            graph_builder = ControlledStateGraph(
                llm_client=self.llm_client,
                tools_adapter=self.tools_adapter,
                telemetry_callback=callback,
            )
            app = graph_builder.compile()
            final_state = await app.ainvoke(state)
            self._active_missions[mission_id] = final_state
        except Exception as ex:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            error_msg = f"LangGraph execution exception: {str(ex)}"
            if callback:
                try:
                    await callback({
                        "type": "mission_failed",
                        "mission_id": mission_id,
                        "error": error_msg,
                    })
                except Exception:
                    pass
            return AgentResult(
                session_id=mission_id,
                final_response=error_msg,
                steps=[],
                success=False,
                error=error_msg,
                total_latency_ms=round(elapsed, 2),
                metadata={"orchestrator": "langgraph", "error": error_msg},
            )

        elapsed = (time.perf_counter() - start_time) * 1000.0

        # Map internal graph steps into Sovereign-Core AgentStep format
        steps: List[AgentStep] = []
        for tr in final_state.get("tool_results", []):
            tool_name = tr.get("tool")
            args = next(
                (tc.get("arguments", {}) for tc in final_state.get("tool_calls", []) if tc.get("tool") == tool_name),
                {},
            )
            steps.append(
                AgentStep(
                    step_number=tr.get("step", len(steps) + 1),
                    thought=f"Executed {tool_name} to verify mission directive.",
                    tool_name=tool_name,
                    tool_arguments=args,
                    tool_result=ToolResult(
                        success=tr.get("success", True),
                        output=tr.get("output"),
                        error=tr.get("error"),
                        execution_time_ms=tr.get("latency_ms"),
                    ),
                    observation=str(tr.get("output"))[:200] if tr.get("output") else None,
                    timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                )
            )

        success = len(final_state.get("errors", [])) == 0 and not final_state.get("cancelled", False)
        final_output = final_state.get("final_output", "")

        # Audit completion
        if self.audit_logger:
            await self.audit_logger.log(
                AuditEvent(
                    id=str(uuid.uuid4()),
                    timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    event_type=AuditEventType.AGENT_RUN,
                    session_id=mission_id,
                    model=selected_model,
                    response_preview=final_output[:200],
                    latency_ms=round(elapsed, 2),
                    status="success" if success else "failed",
                    payload={
                        "orchestrator": "langgraph",
                        "verification_status": final_state.get("verification_status"),
                        "approval_status": final_state.get("approval_status"),
                        "evidence_count": len(final_state.get("evidence", [])),
                        "citations_count": len(final_state.get("citations", [])),
                        "provenance": final_state.get("provenance", {}),
                    },
                )
            )

        return AgentResult(
            session_id=mission_id,
            final_response=final_output,
            steps=steps,
            success=success,
            error=final_state.get("errors", [None])[0] if not success and final_state.get("errors") else None,
            total_latency_ms=round(elapsed, 2),
            metadata={
                "orchestrator": "langgraph",
                "verification_status": final_state.get("verification_status"),
                "approval_status": final_state.get("approval_status"),
                "citations": final_state.get("citations", []),
                "provenance": final_state.get("provenance", {}),
            },
        )
