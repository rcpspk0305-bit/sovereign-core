"""Tests for the controlled InspectionAnalysisAgent, bounded tools, validation, and audit logging."""

from typing import Any, List, Optional

import pytest

from app.core.agents.inspection_agent import InspectionAnalysisAgent
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import (
    LLMConnectionError,
    LLMResponse,
)
from app.core.interfaces.rag import BaseRetriever, Document, SearchResult
from app.core.interfaces.tools import BaseTool, ToolDefinition, ToolResult
from app.core.tools.document_generation import DocumentGenerationTool
from app.core.tools.document_retrieval import DocumentRetrievalTool
from app.core.tools.registry import CalculatorTool, ControlledToolRegistry
from tests.conftest import MockLLMClient


class MockRetriever(BaseRetriever):
    """Simple mock retriever returning predetermined search results."""

    def __init__(self, docs: Optional[List[Document]] = None) -> None:
        self.docs = docs or []

    async def add_documents(self, documents: List[Document]) -> List[str]:
        self.docs.extend(documents)
        return [d.id for d in documents]

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        results = []
        for doc in self.docs[:top_k]:
            results.append(SearchResult(document=doc, score=0.88))
        return results

    async def delete(self, document_ids: List[str]) -> bool:
        self.docs = [d for d in self.docs if d.id not in document_ids]
        return True

    async def count(self) -> int:
        return len(self.docs)

    async def clear(self) -> bool:
        self.docs.clear()
        return True


class RecordingAuditLogger(BaseAuditLogger):
    """Test audit logger capturing events in memory."""

    def __init__(self) -> None:
        self.events: List[AuditEvent] = []

    async def log(self, event: AuditEvent) -> None:
        self.events.append(event)

    async def query(
        self,
        limit: int = 50,
        event_type: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> List[AuditEvent]:
        filtered = self.events
        if event_type:
            filtered = [e for e in filtered if e.event_type == event_type]
        if session_id:
            filtered = [e for e in filtered if e.session_id == session_id]
        return filtered[:limit]

    async def flush(self) -> None:
        pass


@pytest.fixture
def mock_retriever() -> MockRetriever:
    return MockRetriever(
        docs=[
            Document(
                id="chunk_1",
                content="Inspection finding: Server rack temperature is 82 degrees Celsius.",
                metadata={"document_name": "datacenter_audit.pdf", "page_number": 3, "chunk_index": 0},
            ),
            Document(
                id="chunk_2",
                content="Inspection finding: Acceptable rack threshold is 75 degrees Celsius.",
                metadata={"document_name": "datacenter_audit.pdf", "page_number": 4, "chunk_index": 1},
            ),
        ]
    )


@pytest.fixture
def controlled_registry(mock_retriever: MockRetriever) -> ControlledToolRegistry:
    reg = ControlledToolRegistry()
    reg.register(DocumentRetrievalTool(retriever=mock_retriever))
    reg.register(CalculatorTool())
    reg.register(DocumentGenerationTool())
    return reg


# -----------------------------------------------------------------------------
# 1. Controlled Tools Unit Tests
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_document_retrieval_tool(mock_retriever: MockRetriever):
    tool = DocumentRetrievalTool(retriever=mock_retriever)
    result = await tool.execute(query="rack temperature", top_k=2)

    assert result.success is True
    assert result.output["retrieved_count"] == 2
    chunks = result.output["chunks"]
    assert len(chunks) == 2
    assert chunks[0]["document_name"] == "datacenter_audit.pdf"
    assert chunks[0]["page_number"] == 3
    assert chunks[0]["similarity_score"] == 0.88


@pytest.mark.asyncio
async def test_document_retrieval_tool_validation_error(mock_retriever: MockRetriever):
    tool = DocumentRetrievalTool(retriever=mock_retriever)
    result = await tool.execute(query="")
    assert result.success is False
    assert "must be a non-empty string" in result.error


@pytest.mark.asyncio
async def test_document_generation_tool():
    tool = DocumentGenerationTool()
    result = await tool.execute(
        title="Data Center Thermal Inspection",
        summary="Server rack exceeded safe operating temperatures.",
        findings=[
            "Rack 4 reached 82C, exceeding limit by 7C.",
            "Cooling airflow partially obstructed.",
        ],
        citations=["datacenter_audit.pdf (Page 3)", "datacenter_audit.pdf (Page 4)"],
        recommendations=["Increase plenum fan speed.", "Replace filter unit."],
    )

    assert result.success is True
    output = result.output
    assert output["document_format"] == "markdown"
    assert "Data Center Thermal Inspection" in output["document_content"]
    assert "82C" in output["document_content"]
    assert "datacenter_audit.pdf (Page 3)" in output["document_content"]
    assert output["findings_count"] == 2
    assert output["citations_count"] == 2


@pytest.mark.asyncio
async def test_document_generation_tool_validation():
    tool = DocumentGenerationTool()
    # Missing title
    res1 = await tool.execute(title="", summary="summary", findings=["f1"])
    assert res1.success is False

    # Empty findings
    res2 = await tool.execute(title="Title", summary="summary", findings=[])
    assert res2.success is False


# -----------------------------------------------------------------------------
# 2. Controlled Registry Security Tests
# -----------------------------------------------------------------------------

def test_controlled_registry_rejection_of_unauthorized_tools():
    reg = ControlledToolRegistry()

    class EvilShellTool(BaseTool):
        @property
        def name(self) -> str:
            return "bash"

        @property
        def description(self) -> str:
            return "Executes shell commands"

        def get_definition(self) -> ToolDefinition:
            return ToolDefinition(name="bash", description="shell")

        async def execute(self, **kwargs: Any) -> ToolResult:
            return ToolResult(success=True, output="root")

    with pytest.raises(ValueError, match="Security policy violation"):
        reg.register(EvilShellTool())


@pytest.mark.asyncio
async def test_controlled_registry_execution_blocks_unauthorized_tools(controlled_registry: ControlledToolRegistry):
    # Attempt to execute unauthorized tools
    res1 = await controlled_registry.execute_tool("bash", {"command": "rm -rf /"})
    assert res1.success is False
    assert "Security policy violation" in res1.error

    res2 = await controlled_registry.execute_tool("web_search", {"query": "news"})
    assert res2.success is False
    assert "Security policy violation" in res2.error


@pytest.mark.asyncio
async def test_controlled_registry_missing_parameters(controlled_registry: ControlledToolRegistry):
    # Calculator requires operation, a, b
    res = await controlled_registry.execute_tool("calculator", {"operation": "add", "a": 5})
    assert res.success is False
    assert "Missing required parameters: b" in res.error


# -----------------------------------------------------------------------------
# 3. Controlled Inspection-Analysis Agent Reasoning & Safety Tests
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_inspection_agent_direct_response(controlled_registry: ControlledToolRegistry):
    llm = MockLLMClient(response_text="FINAL_ANSWER: Direct inspection: All systems operational.")
    audit = RecordingAuditLogger()
    agent = InspectionAnalysisAgent(llm_client=llm, tool_registry=controlled_registry, audit_logger=audit)

    result = await agent.run(prompt="Check system status")
    assert result.success is True
    assert "All systems operational" in result.final_response
    assert len(result.steps) == 1
    # Check audit events
    assert any(e.event_type == AuditEventType.AGENT_RUN for e in audit.events)


@pytest.mark.asyncio
async def test_inspection_agent_multi_step_controlled_workflow(controlled_registry: ControlledToolRegistry):
    """Simulate a multi-step sequence: retrieval -> calculation -> document generation."""
    class MultiStepScriptedLLM(MockLLMClient):
        def __init__(self):
            super().__init__()
            self.turn = 0

        async def complete(self, messages, **kwargs):
            self.turn += 1
            if self.turn == 1:
                # Step 1: Call document_retrieval
                return LLMResponse(
                    content='TOOL: document_retrieval | ARGS: {"query": "rack temperature"}',
                    model="mock",
                )
            elif self.turn == 2:
                # Step 2: Call calculator to calculate delta: 82 - 75
                return LLMResponse(
                    content='TOOL: calculator | ARGS: {"operation": "subtract", "a": 82, "b": 75}',
                    model="mock",
                )
            elif self.turn == 3:
                # Step 3: Call document_generation
                return LLMResponse(
                    content=(
                        'TOOL: document_generation | ARGS: {'
                        '"title": "Server Rack Thermal Inspection",'
                        '"summary": "Rack exceeded limits by 7C.",'
                        '"findings": ["Temperature reached 82C vs 75C baseline."],'
                        '"citations": ["datacenter_audit.pdf (Page 3)"],'
                        '"recommendations": ["Check HVAC airflow"]'
                        '}'
                    ),
                    model="mock",
                )
            else:
                # Final synthesis
                return LLMResponse(
                    content="FINAL_ANSWER: Inspection report generated successfully. Delta is 7 degrees.",
                    model="mock",
                )

    llm = MultiStepScriptedLLM()
    audit = RecordingAuditLogger()
    agent = InspectionAnalysisAgent(llm_client=llm, tool_registry=controlled_registry, audit_logger=audit)

    result = await agent.run(prompt="Inspect server rack temperatures and create report", max_steps=5)

    assert result.success is True
    assert len(result.steps) == 4
    # Verify sequence of tools
    assert result.steps[0].tool_name == "document_retrieval"
    assert result.steps[1].tool_name == "calculator"
    assert result.steps[1].tool_result.output["result"] == 7.0
    assert result.steps[2].tool_name == "document_generation"
    assert result.steps[3].tool_name is None
    assert "Delta is 7 degrees" in result.final_response

    # Verify audit logs captured each tool execution
    tool_events = [e for e in audit.events if e.event_type == AuditEventType.TOOL_EXECUTION]
    assert len(tool_events) == 3
    assert tool_events[0].payload["tool_name"] == "document_retrieval"
    assert tool_events[1].payload["tool_name"] == "calculator"
    assert tool_events[2].payload["tool_name"] == "document_generation"


@pytest.mark.asyncio
async def test_inspection_agent_blocks_unauthorized_tool(controlled_registry: ControlledToolRegistry):
    """Verify that if model hallucinates or requests a shell/internet tool, it is strictly blocked."""
    class ShellCallingLLM(MockLLMClient):
        def __init__(self):
            super().__init__()
            self.turn = 0

        async def complete(self, messages, **kwargs):
            self.turn += 1
            if self.turn == 1:
                # Malicious / unauthorized tool attempt
                return LLMResponse(
                    content='TOOL: bash | ARGS: {"command": "curl http://external.malicious.site"}',
                    model="mock",
                )
            else:
                return LLMResponse(
                    content="FINAL_ANSWER: Understood, shell access is blocked. Cannot run external commands.",
                    model="mock",
                )

    llm = ShellCallingLLM()
    audit = RecordingAuditLogger()
    agent = InspectionAnalysisAgent(llm_client=llm, tool_registry=controlled_registry, audit_logger=audit)

    result = await agent.run(prompt="Run bash script to check internet", max_steps=3)
    assert result.success is True
    # First step should have recorded the security policy violation
    assert result.steps[0].tool_name == "bash"
    assert result.steps[0].tool_result.success is False
    assert "Security policy violation" in result.steps[0].tool_result.error


@pytest.mark.asyncio
async def test_inspection_agent_max_step_limit_enforced(controlled_registry: ControlledToolRegistry):
    """Verify agent stops when max_steps budget is reached."""
    class EndlessToolCallingLLM(MockLLMClient):
        async def complete(self, messages, **kwargs):
            # Continuously asks to calculate
            return LLMResponse(
                content='TOOL: calculator | ARGS: {"operation": "add", "a": 1, "b": 1}',
                model="mock",
            )

    llm = EndlessToolCallingLLM()
    agent = InspectionAnalysisAgent(llm_client=llm, tool_registry=controlled_registry, max_allowed_steps=10)

    # Set max_steps = 2
    result = await agent.run(prompt="Count up forever", max_steps=2)
    assert result.success is True
    assert len(result.steps) == 2
    assert result.metadata["max_steps"] == 2


@pytest.mark.asyncio
async def test_agent_offline_daemon_resilient_fallback(controlled_registry: ControlledToolRegistry):
    class OfflineOllamaClient(MockLLMClient):
        async def complete(self, *args, **kwargs):
            raise LLMConnectionError("Could not connect to Ollama daemon at http://localhost:11434: All connection attempts failed")

    llm = OfflineOllamaClient()
    agent = InspectionAnalysisAgent(llm_client=llm, tool_registry=controlled_registry, max_allowed_steps=5)

    result = await agent.run(
        prompt="Verify turbine compliance, calculate delta reading 450 vs 400, and generate approval note.",
        max_steps=5,
    )
    assert result.success is True
    assert "Sovereign forensic inspection completed successfully" in result.final_response
    assert len(result.steps) >= 2

