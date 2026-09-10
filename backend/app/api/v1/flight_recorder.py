"""FastAPI routes and WebSocket handlers for AI Flight Recorder."""

import asyncio
import datetime
import json
import logging
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel, Field

from app.api.v1.agents import get_agent
from app.core.flight_recorder.manager import (
    FlightRecorderManager,
    get_flight_recorder_manager,
)
from app.core.flight_recorder.models import (
    ApprovalStatus,
    FlightRecord,
    NetworkMode,
)
from app.core.interfaces.agents import BaseAgent

logger = logging.getLogger("sovereign.api.flight_recorder")

router = APIRouter(prefix="/flight-recorder", tags=["Flight Recorder"])


class FlightMissionRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    network_mode: NetworkMode = NetworkMode.AIR_GAPPED_LOCAL
    task_id: Optional[str] = None
    max_steps: int = Field(default=5, ge=1, le=10)


class ApprovalUpdateRequest(BaseModel):
    approval_status: ApprovalStatus
    notes: Optional[str] = None


async def _handle_flight_recorder_ws(
    websocket: WebSocket,
    task_id: Optional[str],
    manager: FlightRecorderManager,
    agent: BaseAgent,
) -> None:
    """Real-time bi-directional telemetry streaming handler with robust lifecycle management."""
    try:
        await manager.connect(websocket, task_id=task_id)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Send initial connection acknowledgment safely inside try block
        await websocket.send_text(
            json.dumps({
                "event_type": "connected",
                "task_id": task_id or "global",
                "timestamp": now_iso,
                "data": {"message": "Sovereign-Core Flight Recorder Telemetry Stream Active"},
            })
        )

        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except Exception:
                await websocket.send_text(
                    json.dumps({"event_type": "error", "message": "Invalid JSON format"})
                )
                continue

            action = msg.get("action")
            if action == "ping":
                await websocket.send_text(
                    json.dumps({
                        "event_type": "pong",
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    })
                )
            elif action == "subscribe" and msg.get("task_id"):
                tid = str(msg.get("task_id"))
                manager.subscribe(websocket, tid)
                await websocket.send_text(
                    json.dumps({
                        "event_type": "subscribed",
                        "task_id": tid,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    })
                )
            elif action == "run_mission":
                prompt = msg.get("prompt")
                if not prompt:
                    await websocket.send_text(
                        json.dumps({"event_type": "error", "message": "Field 'prompt' is required"})
                    )
                    continue

                req_model = msg.get("model")
                mode_str = msg.get("network_mode", NetworkMode.AIR_GAPPED_LOCAL.value)
                try:
                    mode = NetworkMode(mode_str)
                except ValueError:
                    mode = NetworkMode.AIR_GAPPED_LOCAL

                m_tid = msg.get("task_id") or task_id
                max_s = min(10, max(1, int(msg.get("max_steps", 5))))

                # Execute in background task to not block socket receive loop
                asyncio.create_task(
                    manager.run_mission(
                        prompt=prompt,
                        agent=agent,
                        model=req_model,
                        network_mode=mode,
                        task_id=m_tid,
                        max_steps=max_s,
                    )
                )
            elif action == "update_approval":
                app_tid = msg.get("task_id") or task_id
                status_str = msg.get("approval_status")
                notes = msg.get("notes")
                if app_tid and status_str:
                    try:
                        st = ApprovalStatus(status_str)
                        await manager.update_approval(app_tid, st, notes=notes)
                    except Exception as e:
                        await websocket.send_text(
                            json.dumps({"event_type": "error", "message": str(e)})
                        )

    except (WebSocketDisconnect, RuntimeError) as exc:
        logger.debug("WebSocket client disconnected or transport closing: %s", exc)
    except Exception as exc:
        logger.warning("WebSocket exception: %s", exc)
    finally:
        manager.disconnect(websocket, task_id=task_id)


@router.websocket("/ws")
async def websocket_flight_telemetry(
    websocket: WebSocket,
    task_id: Optional[str] = Query(default=None),
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
    agent: BaseAgent = Depends(get_agent),
):
    """Global real-time telemetry WebSocket endpoint."""
    await _handle_flight_recorder_ws(websocket, task_id, manager, agent)


@router.websocket("/ws/{task_id}")
async def websocket_flight_telemetry_task(
    websocket: WebSocket,
    task_id: str,
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
    agent: BaseAgent = Depends(get_agent),
):
    """Task-specific real-time telemetry WebSocket endpoint."""
    await _handle_flight_recorder_ws(websocket, task_id, manager, agent)



@router.post("/run", response_model=FlightRecord)
async def run_flight_mission(
    request: FlightMissionRequest,
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
    agent: BaseAgent = Depends(get_agent),
) -> FlightRecord:
    """Trigger a forensic agent mission and record complete telemetry."""
    record = await manager.run_mission(
        prompt=request.prompt,
        agent=agent,
        model=request.model,
        network_mode=request.network_mode,
        task_id=request.task_id,
        max_steps=request.max_steps,
    )
    return record


@router.get("/records", response_model=List[FlightRecord])
async def list_flight_records(
    limit: int = Query(default=20, ge=1, le=100),
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> List[FlightRecord]:
    """Retrieve historical flight recordings."""
    records = manager.list_records()
    return records[:limit]


@router.delete("/records")
async def clear_flight_records(
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> dict:
    """Clear all historical flight recordings."""
    count = manager.clear_records()
    return {"status": "success", "cleared_count": count}


@router.get("/records/{task_id}", response_model=FlightRecord)
async def get_flight_record(
    task_id: str,
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> FlightRecord:
    """Retrieve a complete blackbox flight record by task ID."""
    record = manager.get_record(task_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Flight record with task ID '{task_id}' not found.")
    return record


@router.patch("/records/{task_id}/approval", response_model=FlightRecord)
async def update_record_approval(
    task_id: str,
    request: ApprovalUpdateRequest,
    manager: FlightRecorderManager = Depends(get_flight_recorder_manager),
) -> FlightRecord:
    """Update approval status (e.g. human-in-the-loop review) for a mission record."""
    record = await manager.update_approval(
        task_id=task_id,
        approval_status=request.approval_status,
        notes=request.notes,
    )
    if not record:
        raise HTTPException(status_code=404, detail=f"Flight record with task ID '{task_id}' not found.")
    return record
