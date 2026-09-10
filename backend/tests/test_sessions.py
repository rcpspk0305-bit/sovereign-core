import asyncio
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.config import settings

def test_sessions_endpoints():
    async def _run():
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
            session_id = created["session_id"]
            assert created["title"] == "Test Radar Mission Session"
            assert session_id.startswith("SES-")
            assert created["status"] == "active"

            # 4. Get created session
            res_get = await client.get(f"/api/v1/sessions/{session_id}")
            assert res_get.status_code == 200
            assert res_get.json()["session_id"] == session_id

            # 5. Append turns to session
            res_turn1 = await client.post(
                f"/api/v1/sessions/{session_id}/turns",
                json={
                    "role": "user",
                    "type": "user_input",
                    "content": "Verify radar telemetry SNR baseline and orbital parameters.",
                    "tokens": 42
                }
            )
            assert res_turn1.status_code == 200
            turn1_data = res_turn1.json()
            assert turn1_data["turns_count"] >= 2
            assert any(t["content"] == "Verify radar telemetry SNR baseline and orbital parameters." for t in turn1_data["recent_turns"])
            assert turn1_data["memory_breakdown"]["user_input_tokens"] >= 42

            # 6. Append assistant turn
            res_turn2 = await client.post(
                f"/api/v1/sessions/{session_id}/turns",
                json={
                    "role": "assistant",
                    "type": "internal_chatter",
                    "content": "Telemetry SNR is nominal at 28dB with zero cloud egress.",
                    "tokens": 58
                }
            )
            assert res_turn2.status_code == 200
            turn2_data = res_turn2.json()
            assert any("nominal at 28dB" in t["content"] for t in turn2_data["recent_turns"])

            # 7. Activate session
            res_act = await client.post(f"/api/v1/sessions/{session_id}/activate")
            assert res_act.status_code == 200
            assert res_act.json()["session_id"] == session_id

            res_check_cur = await client.get("/api/v1/sessions/current")
            assert res_check_cur.status_code == 200
            assert res_check_cur.json()["session_id"] == session_id

            # 8. Update session title
            res_update = await client.put(
                f"/api/v1/sessions/{session_id}",
                json={"title": "Updated Telemetry Inspection Mission", "status": "completed"}
            )
            assert res_update.status_code == 200
            assert res_update.json()["title"] == "Updated Telemetry Inspection Mission"
            assert res_update.json()["status"] == "completed"

            # 9. Verify disk persistence
            persisted_file = settings.SESSIONS_DIR / f"{session_id}.json"
            assert persisted_file.exists()

            # 10. Security: path traversal rejection
            res_invalid = await client.post("/api/v1/sessions/../../etc/passwd/activate")
            assert res_invalid.status_code in [400, 404]

            # 11. Delete session
            res_del = await client.delete(f"/api/v1/sessions/{session_id}")
            assert res_del.status_code == 200
            assert not persisted_file.exists()

    asyncio.run(_run())
