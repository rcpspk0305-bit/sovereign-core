"""Tool Registry and reference tools implementing BaseTool and BaseToolRegistry."""

import datetime
import platform
import sys
import time
from typing import Any, Dict, List, Optional

from app.core.interfaces.tools import (
    BaseTool,
    BaseToolRegistry,
    ToolDefinition,
    ToolResult,
)


class SystemInfoTool(BaseTool):
    """Reference tool providing local system diagnostics."""

    @property
    def name(self) -> str:
        return "system_info"

    @property
    def description(self) -> str:
        return "Provides operating system, architecture, and Python runtime details."

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters={
                "type": "object",
                "properties": {},
                "required": [],
            },
        )

    async def execute(self, **kwargs: Any) -> ToolResult:
        start = time.perf_counter()
        info = {
            "os": platform.system(),
            "release": platform.release(),
            "arch": platform.machine(),
            "python_version": sys.version.split()[0],
            "server_time_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        elapsed = (time.perf_counter() - start) * 1000.0
        return ToolResult(
            success=True,
            output=info,
            execution_time_ms=round(elapsed, 2),
        )


class CalculatorTool(BaseTool):
    """Reference tool providing deterministic arithmetic operations."""

    @property
    def name(self) -> str:
        return "calculator"

    @property
    def description(self) -> str:
        return "Performs safe arithmetic operations: add, subtract, multiply, divide."

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters={
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "enum": ["add", "subtract", "multiply", "divide"],
                        "description": "The math operation to perform.",
                    },
                    "a": {"type": "number", "description": "First operand."},
                    "b": {"type": "number", "description": "Second operand."},
                },
                "required": ["operation", "a", "b"],
            },
        )

    async def execute(self, **kwargs: Any) -> ToolResult:
        start = time.perf_counter()
        op = kwargs.get("operation")
        a = kwargs.get("a")
        b = kwargs.get("b")

        if None in (op, a, b):
            return ToolResult(
                success=False,
                output=None,
                error="Missing required parameters: 'operation', 'a', 'b'",
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )

        try:
            val_a = float(a)
            val_b = float(b)
            if op == "add":
                res = val_a + val_b
            elif op == "subtract":
                res = val_a - val_b
            elif op == "multiply":
                res = val_a * val_b
            elif op == "divide":
                if val_b == 0:
                    return ToolResult(
                        success=False,
                        output=None,
                        error="Division by zero is undefined.",
                        execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
                    )
                res = val_a / val_b
            else:
                return ToolResult(
                    success=False,
                    output=None,
                    error=f"Unsupported operation: '{op}'",
                    execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
                )

            elapsed = (time.perf_counter() - start) * 1000.0
            return ToolResult(
                success=True,
                output={"result": res},
                execution_time_ms=round(elapsed, 2),
            )
        except Exception as err:
            return ToolResult(
                success=False,
                output=None,
                error=str(err),
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )


class ToolRegistry(BaseToolRegistry):
    """In-memory registry managing registered tools with schema validation."""

    def __init__(self) -> None:
        self._tools: Dict[str, BaseTool] = {}
        # Register standard built-in tools
        self.register(SystemInfoTool())
        self.register(CalculatorTool())

    def register(self, tool: BaseTool) -> None:
        """Register a new tool instance."""
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[BaseTool]:
        """Retrieve tool by identifier."""
        return self._tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        """Return definitions for all registered tools."""
        return [tool.get_definition() for tool in self._tools.values()]

    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Find tool and execute with arguments."""
        tool = self.get(name)
        if not tool:
            return ToolResult(
                success=False,
                output=None,
                error=f"Tool '{name}' not found in registry.",
            )

        # Validate required parameters
        schema = tool.get_definition().parameters
        required_keys = schema.get("required", [])
        missing_keys = [k for k in required_keys if k not in arguments]
        if missing_keys:
            return ToolResult(
                success=False,
                output=None,
                error=f"Missing required arguments: {', '.join(missing_keys)}",
            )

        try:
            return await tool.execute(**arguments)
        except Exception as exc:
            return ToolResult(
                success=False,
                output=None,
                error=f"Tool execution exception: {str(exc)}",
            )
