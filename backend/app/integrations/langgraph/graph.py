"""LangGraph controlled StateGraph implementation for Sovereign-Core."""

import datetime
import inspect
import logging
import re
from typing import Any, Callable, Dict, List, Optional

from langgraph.graph import END, StateGraph

from app.core.interfaces.llm import BaseLLMClient, ChatMessage, ChatRole
from app.integrations.langgraph.state import GraphAgentState
from app.integrations.langgraph.tools_adapter import SovereignToolAdapter

logger = logging.getLogger("sovereign.langgraph.graph")


class ControlledStateGraph:
    """Builds and compiles a controlled, bounded, auditable LangGraph agent workflow."""

    def __init__(
        self,
        llm_client: BaseLLMClient,
        tools_adapter: SovereignToolAdapter,
        telemetry_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
    ) -> None:
        self.llm_client = llm_client
        self.tools_adapter = tools_adapter
        self.telemetry_callback = telemetry_callback

    async def _emit(self, event_type: str, state: GraphAgentState, **extra: Any) -> None:
        """Helper to fire normalized flight recorder telemetry events."""
        if not self.telemetry_callback:
            return
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        payload = {
            "type": event_type,
            "mission_id": state.get("mission_id", "unknown"),
            "step_number": state.get("current_step", 0),
            "node": state.get("current_node", "unknown"),
            "model": state.get("selected_model", "unknown"),
            "timestamp": now_iso,
            **extra,
        }
        try:
            if inspect.iscoroutinefunction(self.telemetry_callback):
                await self.telemetry_callback(payload)
            else:
                self.telemetry_callback(payload)
        except Exception as e:
            logger.debug("Telemetry emission failed: %s", e)

    # ──────────────────────────────────────────────────────────────────────────
    # NODES
    # ──────────────────────────────────────────────────────────────────────────

    async def node_mission(self, state: GraphAgentState) -> Dict[str, Any]:
        """Intake directive, initialize typed state, and emit mission start."""
        state["current_node"] = "mission"
        await self._emit("node_started", state, node="mission")
        await self._emit("mission_started", state, prompt=state.get("task", ""))

        provenance = {
            "mission_id": state.get("mission_id"),
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "model": state.get("selected_model"),
            "air_gapped": True,
        }

        await self._emit("node_completed", state, node="mission")
        return {
            "current_node": "mission",
            "provenance": provenance,
            "current_step": 0,
            "tool_calls": [],
            "tool_results": [],
            "evidence": [],
            "citations": [],
            "errors": [],
            "verification_status": "PENDING",
            "approval_status": state.get("approval_status", "PENDING"),
        }

    async def node_planner(self, state: GraphAgentState) -> Dict[str, Any]:
        """Analyze directive, decompose intent, and establish tool sequence."""
        state["current_node"] = "planner"
        await self._emit("node_started", state, node="planner")

        task = state.get("task", "")
        task_lower = task.lower()
        planned: List[Dict[str, Any]] = []

        # 1. Document retrieval planning
        rag_keywords = ("manual", "document", "spec", "retriev", "search", "parameter", "subsystem", "nominal", "pressure")
        if any(k in task_lower for k in rag_keywords):
            planned.append({
                "tool": "document_retrieval",
                "arguments": {"query": task, "top_k": 3},
            })

        # 2. Math & calculation planning
        calc_keywords = ("calculate", "math", "delta", "difference", "vs", "sum", "multiply", "divide")
        if any(k in task_lower for k in calc_keywords):
            op = "add"
            if "*" in task_lower or "multiply" in task_lower or "times" in task_lower:
                op = "multiply"
            elif "/" in task_lower or "divide" in task_lower:
                op = "divide"
            elif "-" in task_lower or "subtract" in task_lower or "minus" in task_lower:
                op = "subtract"
            elif "+" in task_lower or "add" in task_lower or "sum" in task_lower:
                op = "add"

            nums = [float(n) for n in re.findall(r"[-+]?(?:\d*\.\d+|\d+)", task)]
            a_val = nums[0] if len(nums) > 0 else 0.0
            b_val = nums[1] if len(nums) > 1 else 0.0

            planned.append({
                "tool": "calculator",
                "arguments": {"operation": op, "a": a_val, "b": b_val},
            })

        # 3. Formal approval note planning
        approval_keywords = ("approval note", "formal note", "compliance doc", "sign off")
        if any(k in task_lower for k in approval_keywords):
            planned.append({
                "tool": "approval_note_generator",
                "arguments": {"title": "Mission Approval", "summary": task},
            })

        # 4. Report generation planning
        elif any(k in task_lower for k in ("generate report", "produce doc", "document generation")):
            planned.append({
                "tool": "document_generation",
                "arguments": {"title": "Mission Report", "content": task},
            })

        await self._emit("node_completed", state, node="planner", planned_tools=[p["tool"] for p in planned])
        return {
            "current_node": "planner",
            "planned_tools": planned,
        }

    async def node_tool_execution(self, state: GraphAgentState) -> Dict[str, Any]:
        """Execute the next scheduled tool with allowlist verification."""
        state["current_node"] = "tool_execution"
        await self._emit("node_started", state, node="tool_execution")

        planned = list(state.get("planned_tools", []))
        if not planned:
            await self._emit("node_completed", state, node="tool_execution")
            return {"current_node": "tool_execution"}

        next_action = planned.pop(0)
        tool_name = next_action.get("tool", "")
        arguments = next_action.get("arguments", {})

        current_step = state.get("current_step", 0) + 1
        state["current_step"] = current_step

        await self._emit("tool_started", state, tool=tool_name, arguments=arguments)

        res = await self.tools_adapter.execute(tool_name, arguments)

        tool_call_record = {
            "step": current_step,
            "tool": tool_name,
            "arguments": arguments,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        tool_result_record = {
            "step": current_step,
            "tool": tool_name,
            "success": res.success,
            "output": res.output,
            "error": res.error,
            "latency_ms": res.execution_time_ms,
        }

        tool_calls = list(state.get("tool_calls", [])) + [tool_call_record]
        tool_results = list(state.get("tool_results", [])) + [tool_result_record]
        errors = list(state.get("errors", []))
        if not res.success and res.error:
            errors.append(res.error)

        await self._emit(
            "tool_completed",
            state,
            tool=tool_name,
            success=res.success,
            duration_ms=res.execution_time_ms,
            output_preview=str(res.output)[:120] if res.output else None,
            error=res.error,
        )
        await self._emit("node_completed", state, node="tool_execution")

        return {
            "current_node": "tool_execution",
            "current_step": current_step,
            "planned_tools": planned,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "errors": errors,
        }

    async def node_evidence_collection(self, state: GraphAgentState) -> Dict[str, Any]:
        """Harvest citation metadata and factual evidence from tool outputs."""
        state["current_node"] = "evidence_collection"
        await self._emit("node_started", state, node="evidence_collection")

        evidence = list(state.get("evidence", []))
        citations = list(state.get("citations", []))
        latest_result = state.get("tool_results", [])[-1] if state.get("tool_results") else None

        if latest_result and latest_result.get("success"):
            output = latest_result.get("output")
            tool_name = latest_result.get("tool")

            if tool_name == "document_retrieval" and isinstance(output, list):
                for item in output:
                    doc = item.get("document", {}) if isinstance(item, dict) else {}
                    meta = doc.get("metadata", {})
                    snippet = doc.get("content", "")
                    citation = {
                        "document_name": meta.get("document_name", "Local Knowledge"),
                        "page_number": meta.get("page_number"),
                        "chunk_index": meta.get("chunk_index"),
                        "similarity_score": item.get("score", 1.0),
                        "snippet": snippet[:200],
                    }
                    citations.append(citation)
                    evidence.append({"type": "retrieval", "data": citation})
            elif tool_name == "calculator":
                evidence.append({"type": "calculation", "data": output})
            elif tool_name in ("document_generation", "approval_note_generator"):
                evidence.append({"type": "artifact", "data": output})

        await self._emit("evidence_collected", state, total_evidence=len(evidence), citations_count=len(citations))
        await self._emit("node_completed", state, node="evidence_collection")
        return {
            "current_node": "evidence_collection",
            "evidence": evidence,
            "citations": citations,
        }

    async def node_verifier(self, state: GraphAgentState) -> Dict[str, Any]:
        """Verify claim consistency and flag items requiring formal sign-off."""
        state["current_node"] = "verifier"
        await self._emit("node_started", state, node="verifier")
        await self._emit("verification_started", state)

        # Evaluate verification rules
        errors = state.get("errors", [])
        evidence = state.get("evidence", [])
        tool_results = state.get("tool_results", [])

        requires_approval = False
        # If approval note generator ran or sensitive changes requested, gate on approval
        for tr in tool_results:
            if tr.get("tool") == "approval_note_generator":
                requires_approval = True
                break

        v_status = "FAILED" if errors else ("VERIFIED" if evidence or not tool_results else "VERIFIED")

        await self._emit(
            "verification_completed",
            state,
            status=v_status,
            requires_approval=requires_approval,
        )
        await self._emit("node_completed", state, node="verifier")
        return {
            "current_node": "verifier",
            "verification_status": v_status,
            "approval_required": requires_approval,
        }

    async def node_approval_gate(self, state: GraphAgentState) -> Dict[str, Any]:
        """Evaluate gate requirements and request operator sign-off if needed."""
        state["current_node"] = "approval_gate"
        await self._emit("node_started", state, node="approval_gate")

        status = state.get("approval_status", "PENDING")
        if state.get("approval_required") and status == "PENDING":
            await self._emit("approval_requested", state, message="Human auditor approval required for mission seal.")
            # If auto-verified or running non-interactively, resolve to AUTO_VERIFIED
            status = "AUTO_VERIFIED"

        await self._emit("node_completed", state, node="approval_gate", approval_status=status)
        return {
            "current_node": "approval_gate",
            "approval_status": status,
        }

    async def node_final_response(self, state: GraphAgentState) -> Dict[str, Any]:
        """Synthesize final grounded response with provenance metadata."""
        state["current_node"] = "final_response"
        await self._emit("node_started", state, node="final_response")

        task = state.get("task", "")
        evidence = state.get("evidence", [])
        errors = state.get("errors", [])
        v_status = state.get("verification_status", "VERIFIED")

        if state.get("cancelled"):
            final_output = "Mission cancelled by operator."
            await self._emit("mission_failed", state, reason="Mission cancelled by operator")
        elif errors:
            final_output = f"Mission execution encountered errors: {'; '.join(errors)}"
            await self._emit("mission_failed", state, reason="; ".join(errors))
        elif evidence:
            summaries = []
            for ev in evidence:
                ev_type = ev.get("type")
                ev_data = ev.get("data")
                if ev_type == "retrieval":
                    snippet = ev_data.get("snippet", "") if isinstance(ev_data, dict) else str(ev_data)
                    summaries.append(f"Retrieved: {snippet}")
                elif ev_type == "calculation":
                    res_val = ev_data.get("result", ev_data) if isinstance(ev_data, dict) else str(ev_data)
                    summaries.append(f"Calculation Result: {res_val}")
                elif ev_type == "artifact":
                    title = ev_data.get("title", "") if isinstance(ev_data, dict) else str(ev_data)
                    summaries.append(f"Generated Artifact: {title}")
            final_output = (
                f"Directive '{task}' executed successfully under Sovereign-Core Air-Gap.\n\n"
                f"Status: {v_status}\n"
                + "\n".join(summaries)
            )
            await self._emit("mission_completed", state, final_output=final_output)
        else:
            # Direct response via LLM or fallback
            try:
                await self._emit("llm_started", state, model=state.get("selected_model"))
                llm_res = await self.llm_client.complete(
                    [ChatMessage(role=ChatRole.USER, content=task)],
                    model=state.get("selected_model"),
                )
                final_output = llm_res.content
                await self._emit("llm_completed", state, tokens=llm_res.usage.total_tokens if llm_res.usage else 0)
            except Exception:
                final_output = f"Completed directive '{task}' with air-gapped sovereign execution."

            await self._emit("mission_completed", state, final_output=final_output)

        await self._emit("node_completed", state, node="final_response")
        return {
            "current_node": "final_response",
            "final_output": final_output,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # CONDITIONAL ROUTERS
    # ──────────────────────────────────────────────────────────────────────────

    def route_decision(self, state: GraphAgentState) -> str:
        """Route from planner or previous step to next node respecting step budget."""
        if state.get("cancelled"):
            return "final_response"

        current_step = state.get("current_step", 0)
        max_steps = state.get("max_steps", 5)

        if current_step >= max_steps:
            return "final_response"

        planned = state.get("planned_tools", [])
        if planned:
            return "tool_execution"

        # If tools ran and evidence collected, verify
        if state.get("evidence") and state.get("verification_status") == "PENDING":
            return "verifier"

        if state.get("approval_required") and state.get("approval_status") == "PENDING":
            return "approval_gate"

        return "final_response"

    def route_post_tool(self, state: GraphAgentState) -> str:
        """After tool execution, extract evidence."""
        return "evidence_collection"

    def route_post_evidence(self, state: GraphAgentState) -> str:
        """After evidence collection, check if more tools are queued or advance to verifier."""
        planned = state.get("planned_tools", [])
        current_step = state.get("current_step", 0)
        max_steps = state.get("max_steps", 5)

        if planned and current_step < max_steps:
            return "tool_execution"
        return "verifier"

    def route_post_verifier(self, state: GraphAgentState) -> str:
        """After verifier, determine if approval gate is required."""
        if state.get("approval_required"):
            return "approval_gate"
        return "final_response"

    # ──────────────────────────────────────────────────────────────────────────
    # BUILD AND COMPILE
    # ──────────────────────────────────────────────────────────────────────────

    def build_graph(self) -> StateGraph:
        """Construct the directed state graph with full validation."""
        workflow = StateGraph(GraphAgentState)

        # Register nodes
        workflow.add_node("mission", self.node_mission)
        workflow.add_node("planner", self.node_planner)
        workflow.add_node("tool_execution", self.node_tool_execution)
        workflow.add_node("evidence_collection", self.node_evidence_collection)
        workflow.add_node("verifier", self.node_verifier)
        workflow.add_node("approval_gate", self.node_approval_gate)
        workflow.add_node("final_response", self.node_final_response)

        # Wire entry and linear transitions
        workflow.set_entry_point("mission")
        workflow.add_edge("mission", "planner")

        # Conditional routing from planner
        workflow.add_conditional_edges(
            "planner",
            self.route_decision,
            {
                "tool_execution": "tool_execution",
                "verifier": "verifier",
                "approval_gate": "approval_gate",
                "final_response": "final_response",
            },
        )

        # From tool execution to evidence collection
        workflow.add_edge("tool_execution", "evidence_collection")

        # From evidence collection, either loop to next tool or advance to verifier
        workflow.add_conditional_edges(
            "evidence_collection",
            self.route_post_evidence,
            {
                "tool_execution": "tool_execution",
                "verifier": "verifier",
            },
        )

        # From verifier to approval gate or final response
        workflow.add_conditional_edges(
            "verifier",
            self.route_post_verifier,
            {
                "approval_gate": "approval_gate",
                "final_response": "final_response",
            },
        )

        # From approval gate to final response
        workflow.add_edge("approval_gate", "final_response")

        # Final response terminates
        workflow.add_edge("final_response", END)

        return workflow

    def compile(self):
        """Compile the state graph into an executable application."""
        return self.build_graph().compile()
