"""Unit and integration tests for AI Flight Recorder backend and WebSocket stream."""

import pytest
from fastapi.testclient import TestClient

from app.api.v1.agents import get_agent
from app.main import create_application
from tests.conftest import MockLLMClient


@pytest.fixture
def test_app():
    """Create a test application instance with mocked dependencies."""
    from app.core.llm.service import get_llm_provider
    app = create_application()
    app.dependency_overrides[get_llm_provider] = lambda: MockLLMClient(
        response_text='{"tool": "calculator", "arguments": {"expression": "25 - 20"}, "thought": "Calculating delta."}'
    )
    return app


@pytest.fixture
def client(test_app):
    """TestClient instance."""
    with TestClient(test_app) as c:
        yield c


def test_list_flight_records_empty_or_valid(client):
    response = client.get("/api/v1/flight-recorder/records")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_run_flight_mission_and_record(client):
    payload = {
        "prompt": "Inspect Apollo99 system status and calculate temperature differential.",
        "model": "gemma4:e2b",
        "network_mode": "AIR_GAPPED_LOCAL",
        "max_steps": 3,
    }
    response = client.post("/api/v1/flight-recorder/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    assert data["model"] == "gemma4:e2b"
    assert data["network_mode"] == "AIR_GAPPED_LOCAL"
    assert "approval_status" in data
    assert "steps" in data
    assert "tools_called" in data
    assert "retrieved_sources" in data
    assert "artifacts_generated" in data
    assert "errors" in data
    assert "total_latency_ms" in data
    assert data["total_latency_ms"] is not None

    # Fetch by task ID
    task_id = data["task_id"]
    get_res = client.get(f"/api/v1/flight-recorder/records/{task_id}")
    assert get_res.status_code == 200
    record = get_res.json()
    assert record["task_id"] == task_id


def test_update_approval_status(client):
    # First run a mission
    payload = {
        "prompt": "Test approval status mission.",
        "model": "gemma4:e2b",
        "network_mode": "NO_EGRESS",
        "max_steps": 2,
    }
    run_res = client.post("/api/v1/flight-recorder/run", json=payload)
    assert run_res.status_code == 200
    task_id = run_res.json()["task_id"]

    # Update approval
    patch_res = client.patch(
        f"/api/v1/flight-recorder/records/{task_id}/approval",
        json={"approval_status": "APPROVED", "notes": "Verified by human auditor."},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["approval_status"] == "APPROVED"
    assert updated["metadata"].get("approval_notes") == "Verified by human auditor."


def test_websocket_flight_telemetry(test_app):
    with TestClient(test_app) as client:
        with client.websocket_connect("/api/v1/flight-recorder/ws") as ws:
            # 1. First frame is connected event
            init_frame = ws.receive_json()
            assert init_frame["event_type"] == "connected"
            assert "timestamp" in init_frame

            # 2. Ping / Pong test
            ws.send_json({"action": "ping"})
            pong_frame = ws.receive_json()
            assert pong_frame["event_type"] == "pong"


def test_websocket_flight_telemetry_task_specific(test_app):
    """Verify task-specific WebSocket route (/ws/{task_id}) and initial handshake."""
    from app.core.flight_recorder.manager import get_flight_recorder_manager
    manager = get_flight_recorder_manager()
    initial_conn_count = len(manager.active_connections)

    with TestClient(test_app) as client:
        with client.websocket_connect("/api/v1/flight-recorder/ws/test_task_777") as ws:
            init_frame = ws.receive_json()
            assert init_frame["event_type"] == "connected"
            assert init_frame["task_id"] == "test_task_777"

            # Connection should be registered
            assert len(manager.active_connections) == initial_conn_count + 1
            assert "test_task_777" in manager.task_connections

            ws.send_json({"action": "ping"})
            pong = ws.receive_json()
            assert pong["event_type"] == "pong"

    # After exit, connections must be cleaned up (no leak)
    assert len(manager.active_connections) == initial_conn_count
    assert "test_task_777" not in manager.task_connections


@pytest.mark.asyncio
async def test_manager_broadcast_ignores_unconnected_websockets():
    """Verify broadcast_event safely handles closed or non-connected sockets without crashing."""
    from app.core.flight_recorder.manager import FlightRecorderManager
    from app.core.flight_recorder.models import FlightEvent, FlightEventType
    import datetime

    manager = FlightRecorderManager()
    
    # Broadcast with no targets
    ev = FlightEvent(
        event_type=FlightEventType.STEP_STARTED,
        task_id="t1",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        data={"step": 1},
    )
    await manager.broadcast_event(ev)  # Should not raise



def test_run_flight_mission_fallback_approval_pending(test_app):
    """Verify that missions executed via offline fallback remain PENDING approval, not AUTO_VERIFIED."""
    from app.core.interfaces.agents import AgentResult, AgentStep, BaseAgent

    class FallbackAgent(BaseAgent):
        @property
        def name(self) -> str:
            return "fallback_test_agent"

        @property
        def description(self) -> str:
            return "Test agent reporting fallback"

        async def run(self, *args, **kwargs) -> AgentResult:
            return AgentResult(
                session_id="fallback_sess",
                final_response="Synthesized offline response.",
                steps=[AgentStep(step_number=1, thought="Offline fallback step.")],
                success=True,
                total_latency_ms=10.0,
                metadata={"used_fallback": True},
            )

    test_app.dependency_overrides[get_agent] = lambda: FallbackAgent()
    with TestClient(test_app) as c:
        res = c.post(
            "/api/v1/flight-recorder/run",
            json={"prompt": "Test fallback policy"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["approval_status"] == "PENDING"
        assert data["status"] == "completed"
