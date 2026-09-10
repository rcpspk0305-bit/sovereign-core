"""Sovereign Tool Adapter bridging LangGraph to Sovereign-Core Tool Registry."""

import time
from typing import Any, Dict, Optional, Set

from app.core.interfaces.tools import BaseToolRegistry, ToolResult
from app.integrations.base import SecurityPolicyViolationError


class SovereignToolAdapter:
    """Invokes Sovereign-Core registered tools within LangGraph execution boundaries.

    Guarantees:
    - Enforces hard tool allowlist.
    - Zero arbitrary shell, code, or external network access.
    - Captures latency, tool errors, and output previews for telemetry.
    """

    DEFAULT_ALLOWED_TOOLS: Set[str] = {
        "document_retrieval",
        "calculator",
        "document_generation",
        "approval_note_generator",
    }

    def __init__(
        self,
        tool_registry: BaseToolRegistry,
        allowed_tools: Optional[Set[str]] = None,
    ) -> None:
        self.tool_registry = tool_registry
        self.allowed_tools = allowed_tools or set(self.DEFAULT_ALLOWED_TOOLS)

    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is permitted by the air-gap allowlist."""
        return tool_name in self.allowed_tools

    async def execute(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Validate allowlist and execute tool via the underlying tool registry."""
        if not self.is_tool_allowed(tool_name):
            raise SecurityPolicyViolationError(
                f"Unauthorized tool execution attempt: '{tool_name}'. "
                f"Allowed tools: {sorted(list(self.allowed_tools))}"
            )

        # Normalize calculator arguments if expression format is passed
        import re
        if tool_name == "calculator" and "expression" in arguments and "operation" not in arguments:
            expr = str(arguments["expression"])
            op = "add"
            if "*" in expr:
                op = "multiply"
            elif "/" in expr:
                op = "divide"
            elif "-" in expr:
                op = "subtract"
            elif "+" in expr:
                op = "add"
            numbers = [float(n) for n in re.findall(r"[-+]?(?:\d*\.\d+|\d+)", expr)]
            a = numbers[0] if len(numbers) > 0 else 0.0
            b = numbers[1] if len(numbers) > 1 else 0.0
            arguments = {"operation": op, "a": a, "b": b}

        start_time = time.perf_counter()
        try:
            result = await self.tool_registry.execute_tool(tool_name, arguments)
            if result.execution_time_ms is None or result.execution_time_ms == 0.0:
                result.execution_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            return result
        except Exception as ex:
            elapsed = round((time.perf_counter() - start_time) * 1000.0, 2)
            return ToolResult(
                success=False,
                output=None,
                error=f"Tool execution exception: {str(ex)}",
                execution_time_ms=elapsed,
            )
