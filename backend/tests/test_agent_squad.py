"""Automated unit and integration tests for Sovereign-Core Agent Squad."""

import json
from typing import Any, List, Optional
import pytest

from app.core.agents.classifier import task_classifier
from app.core.agents.definitions import (
    AgentDefinition,
    AgentStatus,
    ApprovalPolicy,
)
from app.core.agents.mission_orchestrator import MissionOrchestrator
from app.core.agents.registry import agent_registry
from app.core.agents.specialists import (
    ComplianceAgent,
    DataAnalyst,
    DocumentAnalyst,
    ReportAgent,
    ResearchAgent,
)
from app.core.interfaces.audit import AuditEvent, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient, ChatMessage, LLMConnectionError, LLMResponse, LLMUsage
from app.core.interfaces.rag import BaseRetriever, Document, SearchResult
from app.core.tools.document_generation import DocumentGenerationTool
from app.core.tools.document_retrieval import DocumentRetrievalTool
from app.core.tools.registry import CalculatorTool, ControlledToolRegistry


from tests.conftest import MockLLMClient


class OfflineLLMClient(MockLLMClient):
    """Simulates local LLM daemon offline, triggering Sovereign Autonomous Fallback."""

    async def complete(self, messages: List[ChatMessage], **kwargs: Any) -> LLMResponse:
        raise LLMConnectionError("Connection refused: local Ollama daemon offline at 127.0.0.1:11434")


class ScriptedLLMClient(MockLLMClient):
    """Scripted LLM returning predetermined tool calls and responses for tests."""

    def __init__(self, responses: List[str]) -> None:
        super().__init__()
        self.responses = list(responses)

    async def complete(self, messages: List[ChatMessage], **kwargs: Any) -> LLMResponse:
        content = self.responses.pop(0) if self.responses else "FINAL_ANSWER: {}"
        return LLMResponse(
            content=content,
            model="mock_model",
            finish_reason="stop",
            usage=LLMUsage(prompt_tokens=10, completion_tokens=10, total_tokens=20),
        )


class MockRetriever(BaseRetriever):
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
        q_lower = query.lower()
        matched = []
        for d in self.docs:
            if any(term in d.content.lower() for term in q_lower.split() if len(term) > 3):
                matched.append(SearchResult(document=d, score=0.92))
        if not matched:
            matched = [SearchResult(document=d, score=0.85) for d in self.docs[:top_k]]
        return matched[:top_k]

    async def delete(self, document_ids: List[str]) -> bool:
        return True

    async def count(self) -> int:
        return len(self.docs)

    async def clear(self) -> bool:
        self.docs.clear()
        return True


class RecordingAuditLogger(BaseAuditLogger):
    def __init__(self) -> None:
        self.events: List[AuditEvent] = []

    async def log(self, event: AuditEvent) -> None:
        self.events.append(event)

    async def query(self, limit: int = 50, event_type: Optional[Any] = None, session_id: Optional[str] = None) -> List[AuditEvent]:
        return self.events[:limit]

    async def flush(self) -> None:
        pass


@pytest.fixture
def mock_retriever() -> MockRetriever:
    return MockRetriever(
        docs=[
            Document(
                id="doc_reactor",
                content="Reactor telemetry specs: Steady-state thermal efficiency is nominal at 94.6% under normal load.",
                metadata={"document_name": "reactor_manual.pdf", "page_number": 1},
            ),
            Document(
                id="doc_p2",
                content="Page 2: Core cooling pressure must not exceed 120 bar during nominal operations.",
                metadata={"document_name": "cooling_specs.pdf", "page_number": 2},
            ),
            Document(
                id="doc_p5",
                content="Page 5: Core cooling pressure upper threshold is specified as 150 bar.",
                metadata={"document_name": "cooling_specs.pdf", "page_number": 5},
            ),
            Document(
                id="doc_revenue",
                content="Financial Statements: Q1 Revenue = 100 lakh. Q2 Revenue = 125 lakh.",
                metadata={"document_name": "quarterly_financials.pdf", "page_number": 1},
            ),
            Document(
                id="doc_compliance",
                content=(
                    "Corporate governance record:\n"
                    "Company name: Sovereign Technologies.\n"
                    "Approval date: 10 September 2026.\n"
                    "Authorized signatory: Present.\n"
                    "Security classification: CONFIDENTIAL.\n"
                    "Retention period: 7 years."
                ),
                metadata={"document_name": "compliance_manifest.pdf", "page_number": 2},
            ),
        ]
    )


@pytest.fixture
def tool_registry(mock_retriever: MockRetriever) -> ControlledToolRegistry:
    reg = ControlledToolRegistry()
    reg.register(DocumentRetrievalTool(retriever=mock_retriever))
    reg.register(CalculatorTool())
    reg.register(DocumentGenerationTool())
    return reg


@pytest.fixture
def audit_logger() -> RecordingAuditLogger:
    return RecordingAuditLogger()


@pytest.mark.asyncio
async def test_task_classifier():
    """Verify task classifier routes directives deterministically."""
    res1 = task_classifier.classify("Find the reactor efficiency in the uploaded document.")
    assert res1.target_agent_id == "research"

    res2 = task_classifier.classify("Identify contradictions between page 2 and page 5.")
    assert res2.target_agent_id == "document_analyst"

    res3 = task_classifier.classify("Calculate the percentage increase between two values in the document.")
    assert res3.target_agent_id == "data_analyst"

    res4 = task_classifier.classify("Check whether the document satisfies the five supplied compliance rules.")
    assert res4.target_agent_id == "compliance"

    res5 = task_classifier.classify("Generate executive report from verified findings.")
    assert res5.target_agent_id == "report"

    res6 = task_classifier.classify(
        "Analyze the document, calculate the requested metric, check compliance, and produce a final report."
    )
    assert res6.target_agent_id == "orchestrator"
    assert "document_analyst" in res6.suggested_pipeline
    assert "data_analyst" in res6.suggested_pipeline
    assert "compliance" in res6.suggested_pipeline
    assert "report" in res6.suggested_pipeline


@pytest.mark.asyncio
async def test_research_agent(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test Research Agent: finds reactor efficiency and generates grounded findings."""
    llm = OfflineLLMClient()
    agent = ResearchAgent(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    result = await agent.run(prompt="Find the reactor efficiency in the uploaded document.")
    assert result.success is True
    assert len(result.steps) >= 1
    assert result.metadata["allowed_tools"] == ["document_retrieval"]

    data = json.loads(result.final_response)
    assert "findings" in data
    assert "evidence" in data
    assert len(data["evidence"]) > 0


@pytest.mark.asyncio
async def test_document_analyst(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test Document Analyst: identifies contradictions between page 2 and page 5."""
    llm = OfflineLLMClient()
    agent = DocumentAnalyst(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    result = await agent.run(prompt="Identify contradictions between page 2 and page 5.")
    assert result.success is True
    assert result.metadata["allowed_tools"] == ["document_retrieval"]

    data = json.loads(result.final_response)
    assert "inconsistencies" in data
    assert "document_summary" in data
    assert len(data["inconsistencies"]) > 0
    assert any("contradiction" in inc.lower() or "page 2" in inc.lower() for inc in data["inconsistencies"])


@pytest.mark.asyncio
async def test_data_analyst(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test Data Analyst: calculates percentage increase via calculator tool."""
    llm = OfflineLLMClient()
    agent = DataAnalyst(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    result = await agent.run(prompt="Calculate the percentage increase between Q1 100 lakh and Q2 125 lakh in the document.")
    assert result.success is True
    assert "calculator" in result.metadata["allowed_tools"]

    # Verify calculator was invoked in steps
    calculator_steps = [s for s in result.steps if s.tool_name == "calculator"]
    assert len(calculator_steps) > 0

    data = json.loads(result.final_response)
    assert data["result"] == 25.0
    assert "25" in data["result_formatted"]


@pytest.mark.asyncio
async def test_compliance_agent(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test Compliance Agent: evaluates five rules with evidence grounding."""
    llm = OfflineLLMClient()
    agent = ComplianceAgent(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    prompt = (
        "Check whether this document satisfies the five compliance rules:\n"
        "1. Required company name: Sovereign Technologies\n"
        "2. Approval date: 10 September 2026\n"
        "3. Authorized signatory: Present\n"
        "4. Security classification: CONFIDENTIAL\n"
        "5. Retention period: 7 years"
    )
    result = await agent.run(prompt=prompt)
    assert result.success is True
    assert result.metadata["approval_policy"] == "HUMAN_REQUIRED"

    data = json.loads(result.final_response)
    assert data["status"] == "COMPLIANT"
    assert len(data["checks"]) == 5
    for c in data["checks"]:
        assert c["status"] == "COMPLIANT"
        assert len(c["evidence"]) > 0


@pytest.mark.asyncio
async def test_report_agent(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test Report Agent: compiles verified findings into report artifact."""
    llm = OfflineLLMClient()
    agent = ReportAgent(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    prompt = "Create a report from verified findings: Reactor efficiency is 94.6% and revenue grew by 25%."
    result = await agent.run(prompt=prompt)
    assert result.success is True
    assert "document_generation" in result.metadata["allowed_tools"]

    # Verify document_generation was invoked
    doc_steps = [s for s in result.steps if s.tool_name == "document_generation"]
    assert len(doc_steps) > 0

    data = json.loads(result.final_response)
    assert data["approval_required"] is True
    assert "artifact_id" in data


@pytest.mark.asyncio
async def test_specialist_with_scripted_llm(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test that specialist agents correctly parse LLM tool protocol and final answer."""
    scripted_responses = [
        'TOOL: document_retrieval | ARGS: {"query": "reactor specs"}',
        'FINAL_ANSWER: {"summary": "Reactor operates at 94.6% nominal efficiency.", "findings": ["94.6% efficiency"], "evidence": [{"source": "manual.pdf"}], "confidence": 0.95, "unverified_claims": []}',
    ]
    llm = ScriptedLLMClient(scripted_responses)
    agent = ResearchAgent(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    result = await agent.run(prompt="What is the reactor efficiency?")
    assert result.success is True
    assert len(result.steps) == 2
    assert result.steps[0].tool_name == "document_retrieval"
    assert "94.6%" in result.final_response


@pytest.mark.asyncio
async def test_mission_orchestrator(tool_registry: ControlledToolRegistry, audit_logger: RecordingAuditLogger):
    """Test Mission Orchestrator: decomposes mission and coordinates specialists."""
    llm = OfflineLLMClient()
    orchestrator = MissionOrchestrator(llm_client=llm, tool_registry=tool_registry, audit_logger=audit_logger)

    telemetry_events = []

    async def capture_event(ev: dict):
        telemetry_events.append(ev)

    prompt = (
        "Analyze the document, calculate the requested metric (100 to 125 lakh), "
        "check compliance (Sovereign Technologies, 10 September 2026, Present, CONFIDENTIAL, 7 years), "
        "and produce a final report."
    )
    result = await orchestrator.run(prompt=prompt, event_callback=capture_event)
    assert result.success is True
    assert result.metadata["agent_id"] == "orchestrator"
    assert len(result.metadata["pipeline"]) >= 3
    assert result.metadata["verification_status"] == "VERIFIED"

    # Verify telemetry events emitted
    event_types = [e["type"] for e in telemetry_events]
    assert "mission.created" in event_types
    assert "agent.selected" in event_types
    assert "verification.completed" in event_types
    assert "approval.requested" in event_types
    assert "mission.completed" in event_types
