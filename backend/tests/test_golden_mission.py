"""Deterministic Golden Demo Mission end-to-end test for Sovereign-Core Agent Squad."""

import json
from typing import Any, List, Optional
import pytest
from fastapi.testclient import TestClient

from app.core.agents.definitions import AgentStatus
from app.core.agents.mission_orchestrator import MissionOrchestrator
from app.core.agents.registry import agent_registry
from app.core.flight_recorder.manager import get_flight_recorder_manager
from app.core.flight_recorder.models import ApprovalStatus
from app.core.interfaces.audit import BaseAuditLogger
from app.core.interfaces.rag import BaseRetriever, Document, SearchResult
from app.core.tools.document_generation import DocumentGenerationTool
from app.core.tools.document_retrieval import DocumentRetrievalTool
from app.core.tools.registry import CalculatorTool, ControlledToolRegistry
from app.main import create_application
from tests.test_agent_squad import OfflineLLMClient, RecordingAuditLogger


GOLDEN_DOCUMENT_PAGES = [
    Document(
        id="golden_page_1",
        content="Quarterly Financial Results:\nRevenue Q1 = ₹100 lakh\nRevenue Q2 = ₹125 lakh",
        metadata={"document_name": "annual_financial_report.pdf", "page_number": 1},
    ),
    Document(
        id="golden_page_2",
        content=(
            "Corporate Attestation & Governance:\n"
            "Required company name: Sovereign Technologies\n"
            "Approval date: 10 September 2026\n"
            "Authorized signatory: Present"
        ),
        metadata={"document_name": "annual_financial_report.pdf", "page_number": 2},
    ),
    Document(
        id="golden_page_3",
        content=(
            "Information Security & Compliance:\n"
            "Security classification: CONFIDENTIAL\n"
            "Retention period: 7 years"
        ),
        metadata={"document_name": "annual_financial_report.pdf", "page_number": 3},
    ),
]


class GoldenDocRetriever(BaseRetriever):
    def __init__(self) -> None:
        self.docs = GOLDEN_DOCUMENT_PAGES

    async def add_documents(self, documents: List[Document]) -> List[str]:
        return [d.id for d in documents]

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        # Return all 3 pages so all specialists have access to full document context
        return [SearchResult(document=d, score=0.98) for d in self.docs]

    async def delete(self, document_ids: List[str]) -> bool:
        return True

    async def count(self) -> int:
        return len(self.docs)

    async def clear(self) -> bool:
        return True


@pytest.fixture
def golden_tools() -> ControlledToolRegistry:
    reg = ControlledToolRegistry()
    reg.register(DocumentRetrievalTool(retriever=GoldenDocRetriever()))
    reg.register(CalculatorTool())
    reg.register(DocumentGenerationTool())
    return reg


@pytest.mark.asyncio
async def test_golden_demo_mission_end_to_end(golden_tools: ControlledToolRegistry):
    """Execute the canonical Golden Demo Mission and verify the full specialist sequence."""
    llm = OfflineLLMClient()
    audit = RecordingAuditLogger()
    orchestrator = MissionOrchestrator(llm_client=llm, tool_registry=golden_tools, audit_logger=audit)

    telemetry_events = []

    async def on_telemetry(event: dict):
        telemetry_events.append(event)

    golden_prompt = (
        "Analyze the document. Calculate the revenue growth from Q1 to Q2. "
        "Check whether all five compliance requirements are present. "
        "Produce a verified executive summary."
    )

    doc_full_text = "\n\n".join(
        f"--- Page {p.metadata['page_number']} ---\n{p.content}" for p in GOLDEN_DOCUMENT_PAGES
    )

    result = await orchestrator.run(
        prompt=golden_prompt,
        event_callback=on_telemetry,
        document_context=doc_full_text,
    )

    # 1. Mission level assertions
    assert result.success is True
    meta = result.metadata
    assert meta["agent_id"] == "orchestrator"
    pipeline = meta["pipeline"]
    assert "document_analyst" in pipeline
    assert "data_analyst" in pipeline
    assert "compliance" in pipeline
    assert "report" in pipeline

    # 2. Specialist Results Assertions
    spec_results = meta["specialist_results"]

    # Document Analyst
    doc_res = spec_results["document_analyst"]
    assert len(doc_res.get("key_findings", [])) >= 1

    # Data Analyst -> Calculator ((125 - 100) / 100) * 100 = 25%
    data_res = spec_results["data_analyst"]
    assert data_res["result"] == 25.0
    assert "25" in data_res["result_formatted"]

    # Compliance Agent -> All 5 rules satisfied with evidence
    comp_res = spec_results["compliance"]
    assert comp_res["status"] == "COMPLIANT"
    assert len(comp_res["checks"]) == 5
    for check in comp_res["checks"]:
        assert check["status"] == "COMPLIANT"
        assert len(check["evidence"]) > 0

    # Report Agent -> Generated verified report artifact
    rep_res = spec_results["report"]
    assert rep_res["approval_required"] is True
    assert "artifact_id" in rep_res

    # 3. Verification status
    assert meta["verification_status"] == "VERIFIED"

    # 4. Human Approval Gate requirement
    assert meta["requires_approval"] is True
    assert meta["approval_status"] == "WAITING_FOR_APPROVAL"

    # 5. Telemetry Timeline
    event_types = [e["type"] for e in telemetry_events]
    assert "mission.created" in event_types
    assert "agent.selected" in event_types
    assert "verification.started" in event_types
    assert "verification.completed" in event_types
    assert "approval.requested" in event_types
    assert "mission.completed" in event_types


def test_golden_mission_via_api():
    """Verify Golden Demo Mission execution through the REST API with approval sign-off."""
    from app.api.v1.agents import get_controlled_tool_registry
    from app.core.llm.service import get_llm_provider

    app = create_application()

    # Override retriever to use the 3-page Golden Document
    golden_reg = ControlledToolRegistry()
    golden_reg.register(DocumentRetrievalTool(retriever=GoldenDocRetriever()))
    golden_reg.register(CalculatorTool())
    golden_reg.register(DocumentGenerationTool())

    app.dependency_overrides[get_llm_provider] = lambda: OfflineLLMClient()
    app.dependency_overrides[get_controlled_tool_registry] = lambda: golden_reg

    client = TestClient(app)

    golden_prompt = (
        "Analyze the document. Calculate the revenue growth from Q1 to Q2. "
        "Check whether all five compliance requirements are present. "
        "Produce a verified executive summary."
    )
    doc_full_text = "\n\n".join(
        f"--- Page {p.metadata['page_number']} ---\n{p.content}" for p in GOLDEN_DOCUMENT_PAGES
    )

    # 1. Post mission
    res = client.post(
        "/api/v1/missions",
        json={
            "prompt": golden_prompt,
            "document_context": doc_full_text,
        },
    )
    assert res.status_code == 200
    mission_data = res.json()
    mid = mission_data["mission_id"]

    assert mission_data["status"] == AgentStatus.WAITING_FOR_APPROVAL.value
    assert mission_data["verification_status"] == "VERIFIED"
    assert "25" in mission_data["final_output"]
    assert "COMPLIANT" in mission_data["final_output"]

    # 2. Human Approval Gate
    approve_res = client.post(
        f"/api/v1/missions/{mid}/approve",
        json={"notes": "Human Safety Officer approved after inspecting 3-page evidence."},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["approval_status"] == "APPROVED"
    assert approve_res.json()["status"] == "COMPLETED"

    # 3. Final verification of flight record
    mgr = get_flight_recorder_manager()
    record = mgr.get_record(mid)
    assert record is not None
    assert record.approval_status == ApprovalStatus.APPROVED
    assert record.status == "completed"
