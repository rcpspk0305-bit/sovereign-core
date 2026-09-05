"""Tests for audit logger interface and audit API query endpoint."""

import datetime
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.core.interfaces.audit import AuditEvent, AuditEventType
from app.core.audit.logger import FileAndMemoryAuditLogger


@pytest.mark.asyncio
async def test_audit_logger_memory_and_file(tmp_path: Path):
    logger = FileAndMemoryAuditLogger(
        log_dir=tmp_path,
        log_file="audit_test.jsonl",
        enabled=True,
    )

    ev1 = AuditEvent(
        id="evt-1",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        event_type=AuditEventType.LLM_REQUEST,
        session_id="sess-100",
        prompt_preview="Hello world",
    )
    ev2 = AuditEvent(
        id="evt-2",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        event_type=AuditEventType.TOOL_EXECUTION,
        session_id="sess-200",
        payload={"tool": "calculator"},
    )

    await logger.log(ev1)
    await logger.log(ev2)

    # Query all
    all_events = await logger.query(limit=10)
    assert len(all_events) == 2

    # Query filtered by event_type
    tool_events = await logger.query(event_type=AuditEventType.TOOL_EXECUTION)
    assert len(tool_events) == 1
    assert tool_events[0].id == "evt-2"

    # Query filtered by session_id
    sess_events = await logger.query(session_id="sess-100")
    assert len(sess_events) == 1
    assert sess_events[0].id == "evt-1"

    # Check disk persistence
    log_file = tmp_path / "audit_test.jsonl"
    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8")
    assert "evt-1" in content
    assert "evt-2" in content


def test_audit_api_endpoint(test_client: TestClient):
    # Trigger a request that writes an audit event
    test_client.get("/api/v1/health")

    # Query audit logs endpoint
    response = test_client.get("/api/v1/audit?limit=10")
    assert response.status_code == 200
    events = response.json()
    assert isinstance(events, list)
