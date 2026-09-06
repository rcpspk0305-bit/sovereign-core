"""Lightweight demonstration agent orchestrator implementing BaseAgent.

Note: For production and forensic inspection missions, use InspectionAnalysisAgent
in app.core.agents.inspection_agent, which enforces bounded tools, strict schema
validation, and fine-grained audit logging.
"""

import json
import time
import uuid
from typing import Any, List, Optional

from app.core.interfaces.agents import (
    AgentResult,
    AgentStep,
    BaseAgent,
)
from app.core.interfaces.llm import BaseLLMClient, ChatMessage, ChatRole
from app.core.interfaces.tools import BaseToolRegistry


class SimpleOrchestratorAgent(BaseAgent):
    """Deterministic, step-aware demonstration agent orchestrator with tool dispatching."""

    def __init__(
        self,
        llm_client: BaseLLMClient,
        tool_registry: BaseToolRegistry,
        name: str = "sovereign_agent",
        description: str = "Local agent coordinating reasoning and tool execution.",
    ) -> None:
        self._name = name
        self._description = description
        self.llm_client = llm_client
        self.tool_registry = tool_registry

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    async def run(
        self,
        prompt: str,
        session_id: Optional[str] = None,
        max_steps: int = 5,
        **kwargs: Any,
    ) -> AgentResult:
        start_time = time.perf_counter()
        session = session_id or str(uuid.uuid4())
        steps: List[AgentStep] = []

        # Step 1: Analyze prompt & determine if a tool call is appropriate
        tool_defs = self.tool_registry.list_tools()
        system_prompt = (
            "You are Sovereign-Core Agent, a privacy-first assistant with access to local tools.\n"
            f"Available tools: {[t.name for t in tool_defs]}\n"
            "If a tool is needed, respond with: TOOL: <tool_name> | ARGS: <json_arguments>\n"
            "If no tool is needed, respond directly to the user."
        )

        messages = [
            ChatMessage(role=ChatRole.SYSTEM, content=system_prompt),
            ChatMessage(role=ChatRole.USER, content=prompt),
        ]

        step_counter = 1

        try:
            llm_res = await self.llm_client.complete(messages=messages, **kwargs)
            raw_content = llm_res.content.strip()

            # Check if LLM requested a tool execution
            if raw_content.startswith("TOOL:") and "|" in raw_content:
                parts = raw_content.split("|", 1)
                tool_name = parts[0].replace("TOOL:", "").strip()
                args_str = parts[1].replace("ARGS:", "").strip()

                try:
                    tool_args = json.loads(args_str)
                except Exception:
                    tool_args = {}

                tool_result = await self.tool_registry.execute_tool(tool_name, tool_args)

                steps.append(
                    AgentStep(
                        step_number=step_counter,
                        thought=f"Requested execution of tool '{tool_name}'",
                        tool_name=tool_name,
                        tool_arguments=tool_args,
                        tool_result=tool_result,
                        observation=str(tool_result.output if tool_result.success else tool_result.error),
                    )
                )

                # Follow-up synthesis step
                step_counter += 1
                synthesis_messages = messages + [
                    ChatMessage(role=ChatRole.ASSISTANT, content=raw_content),
                    ChatMessage(
                        role=ChatRole.TOOL,
                        content=f"Tool '{tool_name}' result: {tool_result.output if tool_result.success else tool_result.error}",
                    ),
                ]
                synth_res = await self.llm_client.complete(messages=synthesis_messages, **kwargs)
                final_answer = synth_res.content
            else:
                steps.append(
                    AgentStep(
                        step_number=step_counter,
                        thought="Direct synthesis without requiring external tools.",
                        response=raw_content,
                    )
                )
                final_answer = raw_content

            total_elapsed = (time.perf_counter() - start_time) * 1000.0

            return AgentResult(
                session_id=session,
                final_response=final_answer,
                steps=steps,
                success=True,
                total_latency_ms=round(total_elapsed, 2),
            )

        except Exception as err:
            total_elapsed = (time.perf_counter() - start_time) * 1000.0
            return AgentResult(
                session_id=session,
                final_response=f"Agent execution encountered an error: {str(err)}",
                steps=steps,
                success=False,
                error=str(err),
                total_latency_ms=round(total_elapsed, 2),
            )
