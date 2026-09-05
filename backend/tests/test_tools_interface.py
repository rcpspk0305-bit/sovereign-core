"""Tests for tool interfaces, tool registry, and tool execution."""

import pytest
from fastapi.testclient import TestClient
from app.core.interfaces.tools import BaseTool, ToolDefinition, ToolResult
from app.core.tools.registry import CalculatorTool, SystemInfoTool, ToolRegistry


@pytest.mark.asyncio
async def test_calculator_tool():
    tool = CalculatorTool()
    assert tool.name == "calculator"
    assert "operation" in tool.get_definition().parameters["properties"]

    # Test Add
    res_add = await tool.execute(operation="add", a=10, b=5)
    assert res_add.success is True
    assert res_add.output["result"] == 15.0

    # Test Multiply
    res_mul = await tool.execute(operation="multiply", a=3, b=7)
    assert res_mul.success is True
    assert res_mul.output["result"] == 21.0

    # Test Divide by zero
    res_div_zero = await tool.execute(operation="divide", a=10, b=0)
    assert res_div_zero.success is False
    assert "zero" in res_div_zero.error.lower()


@pytest.mark.asyncio
async def test_system_info_tool():
    tool = SystemInfoTool()
    assert tool.name == "system_info"
    res = await tool.execute()
    assert res.success is True
    assert "os" in res.output
    assert "python_version" in res.output


@pytest.mark.asyncio
async def test_tool_registry():
    registry = ToolRegistry()
    tools = registry.list_tools()
    tool_names = [t.name for t in tools]
    assert "calculator" in tool_names
    assert "system_info" in tool_names

    # Valid execution
    res = await registry.execute_tool("calculator", {"operation": "subtract", "a": 20, "b": 8})
    assert res.success is True
    assert res.output["result"] == 12.0

    # Unknown tool
    unknown_res = await registry.execute_tool("non_existent_tool", {})
    assert unknown_res.success is False
    assert "not found" in unknown_res.error.lower()

    # Missing argument
    bad_res = await registry.execute_tool("calculator", {"operation": "add", "a": 5})
    assert bad_res.success is False
    assert "missing" in bad_res.error.lower()


def test_tools_api_endpoints(test_client: TestClient):
    # List tools
    list_res = test_client.get("/api/v1/tools")
    assert list_res.status_code == 200
    tools = list_res.json()
    assert len(tools) >= 2

    # Execute tool
    exec_payload = {
        "name": "calculator",
        "arguments": {"operation": "multiply", "a": 6, "b": 7},
    }
    exec_res = test_client.post("/api/v1/tools/execute", json=exec_payload)
    assert exec_res.status_code == 200
    data = exec_res.json()
    assert data["success"] is True
    assert data["output"]["result"] == 42.0
