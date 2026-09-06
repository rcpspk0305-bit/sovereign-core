"""Controlled Inspection-Analysis Agent implementing BaseAgent."""

import datetime
import json
import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.core.interfaces.agents import (
    AgentResult,
    AgentStep,
    BaseAgent,
)
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient, ChatMessage, ChatRole
from app.core.interfaces.tools import BaseToolRegistry, ToolResult

logger = logging.getLogger("sovereign.agents.inspection")


class InspectionAnalysisAgent(BaseAgent):
    """Single controlled agent for inspection, document verification, calculation, and report generation.

    Boundaries enforced:
    - Only explicitly registered tools: document retrieval, calculator, document generation.
    - Strictly no unrestricted shell access or autonomous internet access.
    - Configurable maximum step count ceiling.
    - Structured tool call parsing and schema validation.
    - Comprehensive audit logging for all steps and tool executions.
    """

    ALLOWED_TOOLS = {
        "document_retrieval",
        "calculator",
        "document_generation",
    }

    def __init__(
        self,
        llm_client: BaseLLMClient,
        tool_registry: BaseToolRegistry,
        audit_logger: Optional[BaseAuditLogger] = None,
        name: str = "inspection_analysis_agent",
        description: str = "Controlled agent specialized in document inspection, data verification, and report generation.",
        max_allowed_steps: int = 10,
    ) -> None:
        self._name = name
        self._description = description
        self.llm_client = llm_client
        self.tool_registry = tool_registry
        self.audit_logger = audit_logger
        self.max_allowed_steps = max_allowed_steps

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    def _parse_tool_call(self, text: str) -> Tuple[Optional[str], Optional[str], Optional[Dict[str, Any]], Optional[str]]:
        """Extract thought, tool_name, tool_arguments, and final_answer from LLM output.

        Supports:
        1. JSON block: {"thought": "...", "tool": "...", "arguments": {...}}
        2. Format: TOOL: <name> | ARGS: <json>
        3. FINAL_ANSWER: <response>
        """
        trimmed = text.strip()

        # Check for FINAL_ANSWER indicator
        if "FINAL_ANSWER:" in trimmed:
            parts = trimmed.split("FINAL_ANSWER:", 1)
            thought = parts[0].strip() if parts[0].strip() else None
            final_answer = parts[1].strip()
            return thought, None, None, final_answer

        # Try parsing markdown JSON block ```json { ... } ```
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", trimmed, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                if isinstance(data, dict):
                    tool = data.get("tool")
                    args = data.get("arguments", {})
                    thought = data.get("thought")
                    final_ans = data.get("final_answer")
                    if tool:
                        return thought, str(tool).strip(), args if isinstance(args, dict) else {}, None
                    if final_ans:
                        return thought, None, None, str(final_ans).strip()
            except Exception:
                pass

        # Try raw JSON
        if trimmed.startswith("{") and trimmed.endswith("}"):
            try:
                data = json.loads(trimmed)
                if isinstance(data, dict):
                    tool = data.get("tool")
                    args = data.get("arguments", {})
                    thought = data.get("thought")
                    final_ans = data.get("final_answer")
                    if tool:
                        return thought, str(tool).strip(), args if isinstance(args, dict) else {}, None
                    if final_ans:
                        return thought, None, None, str(final_ans).strip()
            except Exception:
                pass

        # Check standard pipe format: TOOL: <name> | ARGS: <json>
        if "TOOL:" in trimmed and "|" in trimmed:
            lines = trimmed.split("\n")
            thought_lines: List[str] = []
            tool_line = ""
            for line in lines:
                if "TOOL:" in line and "|" in line:
                    tool_line = line
                    break
                else:
                    thought_lines.append(line)

            thought = "\n".join(thought_lines).strip() if thought_lines else None
            parts = tool_line.split("|", 1)
            tool_name = parts[0].replace("TOOL:", "").strip()
            args_raw = parts[1].replace("ARGS:", "").strip()

            try:
                args = json.loads(args_raw)
                if not isinstance(args, dict):
                    args = {"input": args}
            except Exception:
                args = {}

            return thought, tool_name, args, None

        # No tool call detected, treat entire text as final answer
        return None, None, None, trimmed

    async def run(
        self,
        prompt: str,
        session_id: Optional[str] = None,
        max_steps: int = 5,
        **kwargs: Any,
    ) -> AgentResult:
        """Execute a strictly bounded, controlled reasoning and inspection loop."""
        start_time = time.perf_counter()
        session = session_id or str(uuid.uuid4())
        bounded_steps = max(1, min(self.max_allowed_steps, max_steps))
        steps: List[AgentStep] = []

        # Build schema definitions of permitted tools
        tool_defs = self.tool_registry.list_tools()
        tools_summary = "\n".join(
            f"- {t.name}: {t.description}\n  Parameters: {json.dumps(t.parameters)}"
            for t in tool_defs
        )

        system_prompt = (
            "You are Sovereign-Core's Inspection-Analysis Agent, a single controlled, privacy-first reasoning agent.\n"
            "SECURITY POLICY & BOUNDARIES:\n"
            "- You have access ONLY to the explicitly registered tools listed below.\n"
            "- You do NOT have access to shell commands, code execution, or autonomous internet access.\n"
            "- Never attempt to run shell scripts, terminal commands, or external network requests.\n\n"
            f"AVAILABLE CONTROLLED TOOLS:\n{tools_summary}\n\n"
            "TOOL CALLING PROTOCOL:\n"
            "To invoke a tool, respond with:\n"
            "TOOL: <tool_name> | ARGS: <valid_json_object>\n"
            "Or JSON:\n"
            '```json\n{"thought": "reason for call", "tool": "<tool_name>", "arguments": { ... }}\n```\n\n'
            "When you have collected all required information to complete the user's objective, respond with:\n"
            "FINAL_ANSWER: <your complete, detailed inspection and analysis report with citations>"
        )

        messages: List[ChatMessage] = [
            ChatMessage(role=ChatRole.SYSTEM, content=system_prompt),
            ChatMessage(role=ChatRole.USER, content=prompt),
        ]

        step_counter = 1
        final_answer: Optional[str] = None

        while step_counter <= bounded_steps:
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            try:
                llm_res = await self.llm_client.complete(messages=messages, **kwargs)
                raw_text = llm_res.content.strip()
            except Exception as exc:
                elapsed = (time.perf_counter() - start_time) * 1000.0
                error_msg = f"LLM inference error at step {step_counter}: {str(exc)}"
                logger.error(error_msg)
                return AgentResult(
                    session_id=session,
                    final_response=error_msg,
                    steps=steps,
                    success=False,
                    error=error_msg,
                    total_latency_ms=round(elapsed, 2),
                    metadata={"controlled": True, "stopped_at_step": step_counter},
                )

            thought, tool_name, tool_args, answer = self._parse_tool_call(raw_text)

            # Case 1: Model finished and provided a final answer
            if answer is not None:
                steps.append(
                    AgentStep(
                        step_number=step_counter,
                        thought=thought or "Final synthesis reached.",
                        observation="Task completed.",
                        timestamp=now_iso,
                    )
                )
                final_answer = answer
                break

            # Case 2: Model requested a tool invocation
            if tool_name:
                step_thought = thought or f"Invoking tool '{tool_name}'"

                # Security check: verify against allowed tools
                if tool_name not in self.ALLOWED_TOOLS or not self.tool_registry.get(tool_name):
                    violation_msg = (
                        f"Security policy violation: Tool '{tool_name}' is not authorized. "
                        "Unrestricted shell access, autonomous internet access, and unregistered tools are strictly prohibited. "
                        f"Permitted tools: {sorted(list(self.ALLOWED_TOOLS))}"
                    )
                    logger.warning("Rejected unauthorized tool call '%s' in session %s", tool_name, session)

                    tool_result = ToolResult(
                        success=False,
                        output=None,
                        error=violation_msg,
                        execution_time_ms=0.0,
                    )

                    steps.append(
                        AgentStep(
                            step_number=step_counter,
                            thought=step_thought,
                            tool_name=tool_name,
                            tool_arguments=tool_args or {},
                            tool_result=tool_result,
                            observation=violation_msg,
                            timestamp=now_iso,
                        )
                    )

                    # Feed violation back to LLM to allow correction
                    messages.append(ChatMessage(role=ChatRole.ASSISTANT, content=raw_text))
                    messages.append(
                        ChatMessage(
                            role=ChatRole.TOOL,
                            content=f"Error: {violation_msg}. Please choose from the permitted tools or provide FINAL_ANSWER.",
                        )
                    )
                    step_counter += 1
                    continue

                # Execute authorized tool
                t_start = time.perf_counter()
                tool_result = await self.tool_registry.execute_tool(tool_name, tool_args or {})
                t_elapsed = (time.perf_counter() - t_start) * 1000.0

                # Audit logging for tool execution
                if self.audit_logger:
                    await self.audit_logger.log(
                        AuditEvent(
                            id=str(uuid.uuid4()),
                            timestamp=now_iso,
                            event_type=AuditEventType.TOOL_EXECUTION,
                            session_id=session,
                            prompt_preview=f"Tool: {tool_name}",
                            response_preview=str(tool_result.output)[:120] if tool_result.success else str(tool_result.error)[:120],
                            latency_ms=round(t_elapsed, 2),
                            status="success" if tool_result.success else "failed",
                            error=tool_result.error,
                            payload={
                                "tool_name": tool_name,
                                "arguments": tool_args,
                                "step": step_counter,
                            },
                        )
                    )

                obs_str = json.dumps(tool_result.output) if tool_result.success else f"Error: {tool_result.error}"

                steps.append(
                    AgentStep(
                        step_number=step_counter,
                        thought=step_thought,
                        tool_name=tool_name,
                        tool_arguments=tool_args or {},
                        tool_result=tool_result,
                        observation=obs_str[:1500],  # Bound observation size in state
                        timestamp=now_iso,
                    )
                )

                messages.append(ChatMessage(role=ChatRole.ASSISTANT, content=raw_text))
                messages.append(
                    ChatMessage(
                        role=ChatRole.TOOL,
                        content=f"Observation from '{tool_name}': {obs_str}",
                    )
                )

                step_counter += 1
            else:
                # If neither a tool nor an explicit FINAL_ANSWER was matched, accept raw_text as final answer
                steps.append(
                    AgentStep(
                        step_number=step_counter,
                        thought="Direct reasoning completed.",
                        observation="Final answer generated directly.",
                        timestamp=now_iso,
                    )
                )
                final_answer = raw_text
                break

        # If step budget exhausted without explicit final answer, synthesize from collected observations
        if final_answer is None:
            synth_prompt = (
                "Maximum reasoning step limit reached. Based on all tools and observations collected above, "
                "synthesize your final inspection analysis and report now."
            )
            messages.append(ChatMessage(role=ChatRole.USER, content=synth_prompt))
            try:
                final_res = await self.llm_client.complete(messages=messages, **kwargs)
                _, _, _, final_answer = self._parse_tool_call(final_res.content.strip())
                if not final_answer:
                    final_answer = final_res.content.strip()
            except Exception:
                final_answer = (
                    f"Inspection halted after reaching the maximum step budget ({bounded_steps} steps). "
                    f"Executed {len(steps)} steps across authorized tools."
                )

        total_elapsed = (time.perf_counter() - start_time) * 1000.0

        result = AgentResult(
            session_id=session,
            final_response=final_answer,
            steps=steps,
            success=True,
            total_latency_ms=round(total_elapsed, 2),
            metadata={
                "agent": self.name,
                "controlled": True,
                "max_steps": bounded_steps,
                "steps_taken": len(steps),
                "allowed_tools": sorted(list(self.ALLOWED_TOOLS)),
            },
        )

        # Audit log for entire agent run
        if self.audit_logger:
            await self.audit_logger.log(
                AuditEvent(
                    id=str(uuid.uuid4()),
                    timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    event_type=AuditEventType.AGENT_RUN,
                    session_id=session,
                    prompt_preview=prompt[:120],
                    response_preview=final_answer[:120],
                    latency_ms=round(total_elapsed, 2),
                    status="success",
                    payload={
                        "agent": self.name,
                        "steps_count": len(steps),
                        "max_steps": bounded_steps,
                    },
                )
            )

        return result
