"""Session management and memory state endpoints with durable persistence."""

import datetime
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger("sovereign.api.sessions")

router = APIRouter(prefix="/sessions", tags=["Sessions & Memory"])

_SESSION_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]+$")


def _validate_session_id(session_id: str) -> None:
    """Ensure session_id is alphanumeric with hyphens/underscores to prevent directory traversal."""
    if not _SESSION_ID_REGEX.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id format.")


class MemoryBreakdown(BaseModel):
    user_input_tokens: int = 380
    tools_tokens: int = 1150
    user_facts_tokens: int = 240
    internal_chatter_tokens: int = 320
    retrieved_facts_tokens: int = 1860
    total_tokens: int = 3950
    max_context_window: int = 8192


class SessionTurn(BaseModel):
    turn_id: str
    role: str  # "user" | "assistant" | "tool" | "system"
    type: str  # "user_input" | "tool_schema" | "user_fact" | "internal_chatter" | "retrieved_fact"
    content: str
    timestamp: str
    tokens: int = 0


class SessionItem(BaseModel):
    session_id: str
    title: str
    created_at: str
    updated_at: str
    date_formatted: str
    time_formatted: str
    status: str = "active"  # "active" | "archived" | "completed"
    model: str = "gemma4:e2b"
    turns_count: int = 4
    memory_breakdown: MemoryBreakdown = Field(default_factory=MemoryBreakdown)
    recent_turns: List[SessionTurn] = Field(default_factory=list)


class CreateSessionRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = "gemma4:e2b"


class AppendTurnRequest(BaseModel):
    role: str = "user"
    type: str = "user_input"
    content: str
    tokens: Optional[int] = None


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    model: Optional[str] = None


# Storage Directory and Persistence
def _get_storage_dir() -> Path:
    storage_dir = settings.SESSIONS_DIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def _save_session_to_disk(session: SessionItem) -> None:
    try:
        storage_dir = _get_storage_dir()
        file_path = storage_dir / f"{session.session_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(session.model_dump_json(indent=2))
    except Exception as exc:
        logger.warning("Failed to persist session %s to disk: %s", session.session_id, exc)


def _save_active_id_to_disk(active_id: str) -> None:
    try:
        storage_dir = _get_storage_dir()
        active_file = storage_dir / "active_session_id.txt"
        with open(active_file, "w", encoding="utf-8") as f:
            f.write(active_id.strip())
    except Exception as exc:
        logger.warning("Failed to save active session ID: %s", exc)


def _load_active_id_from_disk() -> Optional[str]:
    try:
        storage_dir = _get_storage_dir()
        active_file = storage_dir / "active_session_id.txt"
        if active_file.exists():
            with open(active_file, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if val:
                    return val
    except Exception:
        pass
    return None


_now = datetime.datetime.now(datetime.timezone.utc)
_DATE_STR = _now.strftime("%Y-%m-%d")
_TIME_STR = _now.strftime("%H:%M:%S UTC")

DEFAULT_TURNS_SAMPLE = [
    SessionTurn(
        turn_id="turn-1",
        role="system",
        type="user_fact",
        content="User constraint: Air-gapped deployment, strictly zero cloud egress, military radar telemetry focus.",
        timestamp=(_now - datetime.timedelta(minutes=18)).strftime("%H:%M:%S"),
        tokens=240,
    ),
    SessionTurn(
        turn_id="turn-2",
        role="system",
        type="tool_schema",
        content="Registered local schemas: sandbox_calculator, radar_telemetry_analyzer, sha256_verifier.",
        timestamp=(_now - datetime.timedelta(minutes=15)).strftime("%H:%M:%S"),
        tokens=1150,
    ),
    SessionTurn(
        turn_id="turn-3",
        role="user",
        type="user_input",
        content="Analyze defense radar manual for subsystem telemetry anomalies and fuel budget.",
        timestamp=(_now - datetime.timedelta(minutes=10)).strftime("%H:%M:%S"),
        tokens=380,
    ),
    SessionTurn(
        turn_id="turn-4",
        role="system",
        type="retrieved_fact",
        content="ChromaDB HNSW Chunk #18: Radar Subsystem Manual v4.2 Section 7: Nominal operating frequency 9.4 GHz, baseline SNR 28dB.",
        timestamp=(_now - datetime.timedelta(minutes=8)).strftime("%H:%M:%S"),
        tokens=1860,
    ),
    SessionTurn(
        turn_id="turn-5",
        role="assistant",
        type="internal_chatter",
        content="[THINKING] Cross-verifying retrieved frequency against zero-egress hardware constraints. Math check verifies SNR margin nominal.",
        timestamp=(_now - datetime.timedelta(minutes=5)).strftime("%H:%M:%S"),
        tokens=320,
    ),
]

_DEFAULT_SESSIONS: Dict[str, SessionItem] = {
    "SES-20260909-001": SessionItem(
        session_id="SES-20260909-001",
        title="Primary Orbital Radar Telemetry Mission",
        created_at=(_now - datetime.timedelta(minutes=25)).isoformat(),
        updated_at=_now.isoformat(),
        date_formatted=_DATE_STR,
        time_formatted=_TIME_STR,
        status="active",
        model="gemma4:e2b",
        turns_count=5,
        memory_breakdown=MemoryBreakdown(
            user_input_tokens=380,
            tools_tokens=1150,
            user_facts_tokens=240,
            internal_chatter_tokens=320,
            retrieved_facts_tokens=1860,
            total_tokens=3950,
            max_context_window=8192,
        ),
        recent_turns=DEFAULT_TURNS_SAMPLE,
    ),
    "SES-20260908-084": SessionItem(
        session_id="SES-20260908-084",
        title="Air-Gapped Egress Boundary Audit",
        created_at=(_now - datetime.timedelta(days=1, hours=2)).isoformat(),
        updated_at=(_now - datetime.timedelta(days=1, hours=1)).isoformat(),
        date_formatted=(_now - datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
        time_formatted="14:30:15 UTC",
        status="completed",
        model="gemma4:e2b",
        turns_count=8,
        memory_breakdown=MemoryBreakdown(
            user_input_tokens=520,
            tools_tokens=1150,
            user_facts_tokens=180,
            internal_chatter_tokens=440,
            retrieved_facts_tokens=2100,
            total_tokens=4390,
            max_context_window=8192,
        ),
        recent_turns=[],
    ),
}

_SESSIONS_STORE: Dict[str, SessionItem] = {}
_CURRENT_ACTIVE_ID = "SES-20260909-001"


def _initialize_sessions() -> None:
    """Load persisted sessions from disk or seed defaults."""
    global _CURRENT_ACTIVE_ID
    try:
        storage_dir = _get_storage_dir()
        for f in storage_dir.glob("*.json"):
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
                    item = SessionItem(**data)
                    _SESSIONS_STORE[item.session_id] = item
            except Exception as e:
                logger.warning("Failed to load session file %s: %s", f, e)
    except Exception as exc:
        logger.warning("Could not initialize sessions from disk: %s", exc)

    # If empty, populate with default sessions and write to disk
    if not _SESSIONS_STORE:
        for sid, sitem in _DEFAULT_SESSIONS.items():
            _SESSIONS_STORE[sid] = sitem
            _save_session_to_disk(sitem)

    # Restore active ID if present
    saved_active = _load_active_id_from_disk()
    if saved_active and saved_active in _SESSIONS_STORE:
        _CURRENT_ACTIVE_ID = saved_active
    elif _SESSIONS_STORE:
        _CURRENT_ACTIVE_ID = next(iter(_SESSIONS_STORE.keys()))


# Run initialization on module load
_initialize_sessions()


@router.get("", response_model=List[SessionItem])
async def list_sessions() -> List[SessionItem]:
    """List all recorded agent sessions ordered by creation date."""
    return sorted(_SESSIONS_STORE.values(), key=lambda s: s.created_at, reverse=True)


@router.get("/current", response_model=SessionItem)
async def get_current_session() -> SessionItem:
    """Retrieve the current active session and its live memory allocation."""
    session = _SESSIONS_STORE.get(_CURRENT_ACTIVE_ID)
    if not session:
        if _SESSIONS_STORE:
            first = next(iter(_SESSIONS_STORE.values()))
            return first
        raise HTTPException(status_code=404, detail="No active session found.")
    return session


@router.post("/current/activate", response_model=SessionItem)
async def set_active_session_legacy(body: Dict[str, str]) -> SessionItem:
    """Activate session by session_id in payload."""
    sid = body.get("session_id")
    if not sid:
        raise HTTPException(status_code=400, detail="session_id is required.")
    return await activate_session(sid)


@router.post("/{session_id}/activate", response_model=SessionItem)
async def activate_session(session_id: str) -> SessionItem:
    """Set the specified session as current active session."""
    global _CURRENT_ACTIVE_ID
    _validate_session_id(session_id)
    session = _SESSIONS_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    _CURRENT_ACTIVE_ID = session_id
    _save_active_id_to_disk(session_id)
    return session


@router.post("", response_model=SessionItem)
async def create_session(request: CreateSessionRequest) -> SessionItem:
    """Initialize a brand new session with current date, time, and fresh memory state."""
    global _CURRENT_ACTIVE_ID
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    new_id = f"SES-{now_dt.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    title = request.title or f"Autonomous Mission {now_dt.strftime('%H:%M')}"
    new_session = SessionItem(
        session_id=new_id,
        title=title,
        created_at=now_dt.isoformat(),
        updated_at=now_dt.isoformat(),
        date_formatted=now_dt.strftime("%Y-%m-%d"),
        time_formatted=now_dt.strftime("%H:%M:%S UTC"),
        status="active",
        model=request.model or "gemma4:e2b",
        turns_count=1,
        memory_breakdown=MemoryBreakdown(
            user_input_tokens=150,
            tools_tokens=1150,
            user_facts_tokens=120,
            internal_chatter_tokens=80,
            retrieved_facts_tokens=0,
            total_tokens=1500,
            max_context_window=8192,
        ),
        recent_turns=[
            SessionTurn(
                turn_id=f"turn-{uuid.uuid4().hex[:4]}",
                role="system",
                type="tool_schema",
                content="Initialized session with registered sovereign tool schemas.",
                timestamp=now_dt.strftime("%H:%M:%S"),
                tokens=1150,
            )
        ],
    )

    _SESSIONS_STORE[new_id] = new_session
    _CURRENT_ACTIVE_ID = new_id
    _save_session_to_disk(new_session)
    _save_active_id_to_disk(new_id)
    return new_session


@router.get("/{session_id}", response_model=SessionItem)
async def get_session(session_id: str) -> SessionItem:
    """Retrieve a specific session by ID."""
    _validate_session_id(session_id)
    session = _SESSIONS_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session


@router.post("/{session_id}/turns", response_model=SessionItem)
async def append_session_turn(session_id: str, turn_req: AppendTurnRequest) -> SessionItem:
    """Append a conversational turn to the session, update token counts, and persist."""
    _validate_session_id(session_id)
    session = _SESSIONS_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    tokens = turn_req.tokens
    if tokens is None or tokens <= 0:
        tokens = max(1, len(turn_req.content) // 4)

    new_turn = SessionTurn(
        turn_id=f"turn-{uuid.uuid4().hex[:6]}",
        role=turn_req.role,
        type=turn_req.type,
        content=turn_req.content,
        timestamp=now_dt.strftime("%H:%M:%S"),
        tokens=tokens,
    )

    session.recent_turns.append(new_turn)
    session.turns_count = len(session.recent_turns)
    session.updated_at = now_dt.isoformat()
    session.time_formatted = now_dt.strftime("%H:%M:%S UTC")

    # Update memory breakdown
    mb = session.memory_breakdown
    if turn_req.role == "user":
        mb.user_input_tokens += tokens
    elif turn_req.role == "tool":
        mb.tools_tokens += tokens
    elif turn_req.type == "retrieved_fact":
        mb.retrieved_facts_tokens += tokens
    elif turn_req.type == "user_fact":
        mb.user_facts_tokens += tokens
    else:
        mb.internal_chatter_tokens += tokens

    mb.total_tokens = (
        mb.user_input_tokens
        + mb.tools_tokens
        + mb.user_facts_tokens
        + mb.internal_chatter_tokens
        + mb.retrieved_facts_tokens
    )

    _SESSIONS_STORE[session_id] = session
    _save_session_to_disk(session)
    return session


@router.put("/{session_id}", response_model=SessionItem)
async def update_session(session_id: str, req: UpdateSessionRequest) -> SessionItem:
    """Update title, status, or model for an existing session."""
    _validate_session_id(session_id)
    session = _SESSIONS_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    if req.title is not None:
        session.title = req.title
    if req.status is not None:
        session.status = req.status
    if req.model is not None:
        session.model = req.model
    session.updated_at = now_dt.isoformat()

    _SESSIONS_STORE[session_id] = session
    _save_session_to_disk(session)
    return session


@router.delete("/{session_id}")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """Delete or archive a session and remove its persistent file."""
    _validate_session_id(session_id)
    if session_id in _SESSIONS_STORE:
        del _SESSIONS_STORE[session_id]
        try:
            storage_dir = _get_storage_dir()
            file_path = storage_dir / f"{session_id}.json"
            if file_path.exists():
                file_path.unlink()
        except Exception as exc:
            logger.warning("Failed to delete session file for %s: %s", session_id, exc)

        return {"status": "deleted", "session_id": session_id}
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
