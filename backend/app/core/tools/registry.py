"""Tool Registry and reference tools implementing BaseTool and BaseToolRegistry."""

import ast
import datetime
import math
import operator
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
from app.core.telemetry import record_tool_call, trace_tool


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


_ALLOWED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

_ALLOWED_MATH_FUNCS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "pow": math.pow,
    "min": min,
    "max": max,
    "floor": math.floor,
    "ceil": math.ceil,
}


def _safe_eval_ast(node: ast.AST) -> float:
    """Recursively evaluate an AST expression with strict whitelisting."""
    if isinstance(node, ast.Expression):
        return _safe_eval_ast(node.body)
    elif isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError("Invalid constant type in expression")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _ALLOWED_OPERATORS:
            raise ValueError(f"Operator {op_type.__name__} is not allowed")
        left = _safe_eval_ast(node.left)
        right = _safe_eval_ast(node.right)
        if op_type == ast.Div and right == 0:
            raise ZeroDivisionError("Division by zero is undefined.")
        return float(_ALLOWED_OPERATORS[op_type](left, right))
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _ALLOWED_OPERATORS:
            raise ValueError(f"Unary operator {op_type.__name__} is not allowed")
        operand = _safe_eval_ast(node.operand)
        return float(_ALLOWED_OPERATORS[op_type](operand))
    elif isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Security Violation: Only whitelisted math functions are permitted")
        fn_name = node.func.id
        if fn_name not in _ALLOWED_MATH_FUNCS:
            raise ValueError(f"Security Violation: Function '{fn_name}' is not authorized")
        args = [_safe_eval_ast(arg) for arg in node.args]
        return float(_ALLOWED_MATH_FUNCS[fn_name](*args))
    else:
        raise ValueError(f"Security Violation: Unsupported or unsafe expression node: {type(node).__name__}")


class CalculatorTool(BaseTool):
    """Reference tool providing deterministic arithmetic operations and safe expression evaluation."""

    @property
    def name(self) -> str:
        return "calculator"

    @property
    def description(self) -> str:
        return "Performs safe arithmetic operations and evaluated mathematical expressions: add, subtract, multiply, divide, sqrt."

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Safe math expression to evaluate, e.g. '2 + 2', '100 / 4', 'sqrt(144)'.",
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["add", "subtract", "multiply", "divide"],
                        "description": "The math operation to perform (alternative to expression).",
                    },
                    "a": {"type": "number", "description": "First operand."},
                    "b": {"type": "number", "description": "Second operand."},
                },
            },
        )

    async def execute(self, **kwargs: Any) -> ToolResult:
        start = time.perf_counter()
        expr = kwargs.get("expression")
        op = kwargs.get("operation")
        a = kwargs.get("a")
        b = kwargs.get("b")

        # 1. Expression-based evaluation
        if expr is not None and isinstance(expr, str) and expr.strip():
            clean_expr = expr.strip()
            # Fast reject obvious malicious keywords
            lower_expr = clean_expr.lower()
            if any(bad in lower_expr for bad in ("__", "import", "open", "exec", "eval", "os", "sys", "system", "builtins")):
                return ToolResult(
                    success=False,
                    output=None,
                    error=f"Security Violation: Invalid or unsafe expression '{clean_expr}'",
                    execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
                )

            try:
                parsed = ast.parse(clean_expr, mode="eval")
                val = _safe_eval_ast(parsed)
                elapsed = (time.perf_counter() - start) * 1000.0
                return ToolResult(
                    success=True,
                    output={"result": val, "expression": clean_expr},
                    execution_time_ms=round(elapsed, 2),
                )
            except Exception as exc:
                elapsed = (time.perf_counter() - start) * 1000.0
                return ToolResult(
                    success=False,
                    output=None,
                    error=f"Invalid or unsafe expression: {str(exc)}",
                    execution_time_ms=round(elapsed, 2),
                )

        # 2. Parameter-based evaluation (add, subtract, multiply, divide)
        if None in (op, a, b):
            missing_calc = [k for k in ("operation", "a", "b") if kwargs.get(k) is None]
            return ToolResult(
                success=False,
                output=None,
                error=f"Validation failed for tool 'calculator'. Missing required parameters: {', '.join(missing_calc)}",
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


class ControlledToolRegistry(BaseToolRegistry):
    """Strictly bounded tool registry that only permits explicitly whitelisted tools.

    Explicitly blocks shell commands, arbitrary code execution, autonomous internet access,
    and any unregistered tools.
    """

    DEFAULT_ALLOWED_TOOLS = {
        "document_retrieval",
        "calculator",
        "document_generation",
        "approval_note_generator",
    }

    def __init__(self, allowed_tools: Optional[List[str]] = None) -> None:
        self._allowed_names = (
            set(allowed_tools) if allowed_tools is not None else set(self.DEFAULT_ALLOWED_TOOLS)
        )
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        """Register a tool only if it is explicitly allowed."""
        if tool.name not in self._allowed_names:
            raise ValueError(
                f"Security policy violation: Tool '{tool.name}' is not authorized for controlled execution. "
                f"Permitted tools: {sorted(list(self._allowed_names))}"
            )
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[BaseTool]:
        """Retrieve tool only if whitelisted and registered."""
        if name not in self._allowed_names:
            return None
        return self._tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        """Return schema definitions of registered controlled tools."""
        return [tool.get_definition() for tool in self._tools.values()]

    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Validate permissions and arguments before executing tool."""
        if name not in self._allowed_names:
            return ToolResult(
                success=False,
                output=None,
                error=(
                    f"Security policy violation: Tool '{name}' is not permitted. "
                    "Unrestricted shell access, autonomous internet access, and unregistered tools are strictly prohibited. "
                    f"Authorized tools: {sorted(list(self._allowed_names))}"
                ),
            )

        tool = self._tools.get(name)
        if not tool:
            return ToolResult(
                success=False,
                output=None,
                error=f"Authorized tool '{name}' is not active in this registry.",
            )

        # Validate required arguments against tool schema
        schema = tool.get_definition().parameters
        required_keys = list(schema.get("required", []))
        if name == "calculator":
            if "expression" in arguments:
                required_keys = []
            else:
                required_keys = ["operation", "a", "b"]

        missing_keys = [k for k in required_keys if k not in arguments]
        if missing_keys:
            return ToolResult(
                success=False,
                output=None,
                error=f"Validation failed for tool '{name}'. Missing required parameters: {', '.join(missing_keys)}",
            )

        with trace_tool(tool_name=name, arguments=arguments):
            try:
                res = await tool.execute(**arguments)
                record_tool_call(tool_name=name, success=res.success)
                return res
            except Exception as exc:
                record_tool_call(tool_name=name, success=False)
                return ToolResult(
                    success=False,
                    output=None,
                    error=f"Tool '{name}' execution failure: {str(exc)}",
                )

