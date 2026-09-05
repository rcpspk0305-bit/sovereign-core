"""Tests for agent interface, reasoning steps, and agent API endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.core.agents.orchestrator import SimpleOrchestratorAgent
from app.core.interfaces.agents import AgentResult
from app.core.tools.registry import ToolRegistry
from tests.conftest import MockLLMClient


@pytest.mark.asyncio
async def test_agent_direct_response():
    llm = MockLLMClient(response_text="Paris is the capital of France.")
    tools = ToolRegistry()
    agent = SimpleOrchestratorAgent(llm_client=llm, tool_registry=tools)

    result: AgentResult = await agent.run(prompt="What is the capital of France?")
    assert result.success is True
    assert "Paris" in result.final_response
    assert len(result.steps) == 1
    assert result.steps[0].tool_name is None


@pytest.mark.asyncio
async def test_agent_tool_calling_loop():
    # Mock LLM returns tool instruction on first prompt, then synthesizes final answer
    class ToolCallingMockLLM(MockLLMClient):
        def __init__(self):
            super().__init__()
            self.turn = 0

        async def complete(self, messages, **kwargs):
            self.turn += 1
            if self.turn == 1:
                return await super().complete(
                    messages,
                    **kwargs,
                )
            # Second turn synthesis
            from app.core.interfaces.llm import LLMResponse
            return LLMResponse(
                content="The sum of 10 and 20 is 30.",
                model="mock-model",
            )

    llm = ToolCallingMockLLM()
    llm.response_text = 'TOOL: calculator | ARGS: {"operation": "add", "a": 10, "b": 20}'
    tools = ToolRegistry()
    agent = SimpleOrchestratorAgent(llm_client=llm, tool_registry=tools)

    result = await agent.run(prompt="Calculate 10 + 20")
    assert result.success is True
    assert len(result.steps) == 1
    assert result.steps[0].tool_name == "calculator"
    assert result.steps[0].tool_result.output["result"] == 30.0
    assert "30" in result.final_response


def test_agent_api_run(test_client: TestClient):
    payload = {
        "prompt": "Tell me a short joke",
        "max_steps": 3,
    }
    response = test_client.post("/api/v1/agents/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "final_response" in data
    assert "steps" in data
    assert len(data["steps"]) >= 1
