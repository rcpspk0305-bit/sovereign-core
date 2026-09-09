import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_sessions_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List sessions
        res = await client.get("/api/v1/sessions")
        assert res.status_code == 200
        sessions = res.json()
        assert isinstance(sessions, list)
        assert len(sessions) >= 1
        first_session = sessions[0]
        assert "session_id" in first_session
        assert "date_formatted" in first_session
        assert "time_formatted" in first_session
        assert "memory_breakdown" in first_session

        # 2. Get current session
        res_cur = await client.get("/api/v1/sessions/current")
        assert res_cur.status_code == 200
        cur_session = res_cur.json()
        assert cur_session["session_id"].startswith("SES-")
        assert cur_session["memory_breakdown"]["total_tokens"] > 0

        # 3. Create a new session
        res_create = await client.post(
            "/api/v1/sessions",
            json={"title": "Test Radar Mission Session", "model": "gemma4:e2b"}
        )
        assert res_create.status_code == 200
        created = res_create.json()
        assert created["title"] == "Test Radar Mission Session"
        assert created["session_id"].startswith("SES-")
        assert created["status"] == "active"

        # 4. Get created session
        res_get = await client.get(f"/api/v1/sessions/{created['session_id']}")
        assert res_get.status_code == 200
        assert res_get.json()["session_id"] == created["session_id"]
