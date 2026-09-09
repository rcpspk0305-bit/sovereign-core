"""Session management and memory state endpoints."""

import datetime
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/sessions", tags=["Sessions & Memory"])


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
    tokens: int


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


# Initial in-memory session store
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

_SESSIONS_STORE: Dict[str, SessionItem] = {
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
    "SES-20260907-012": SessionItem(
        session_id="SES-20260907-012",
        title="Cryptographic SHA-256 Approval Verification",
        created_at=(_now - datetime.timedelta(days=2)).isoformat(),
        updated_at=(_now - datetime.timedelta(days=2)).isoformat(),
        date_formatted=(_now - datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
        time_formatted="10:15:00 UTC",
        status="archived",
        model="gemma4:e4b-it-qat",
        turns_count=4,
        memory_breakdown=MemoryBreakdown(
            user_input_tokens=280,
            tools_tokens=980,
            user_facts_tokens=120,
            internal_chatter_tokens=210,
            retrieved_facts_tokens=1420,
            total_tokens=3010,
            max_context_window=8192,
        ),
        recent_turns=[],
    ),
}

_CURRENT_ACTIVE_ID = "SES-20260909-001"


@router.get("", response_model=List[SessionItem])
async def list_sessions() -> List[SessionItem]:
    """List all recorded agent sessions ordered by creation date."""
    return sorted(_SESSIONS_STORE.values(), key=lambda s: s.created_at, reverse=True)


@router.get("/current", response_model=SessionItem)
async def get_current_session() -> SessionItem:
    """Retrieve the current active session and its live memory allocation."""
    session = _SESSIONS_STORE.get(_CURRENT_ACTIVE_ID)
    if not session:
        # Fallback to first
        first = next(iter(_SESSIONS_STORE.values()))
        return first
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
    return new_session


@router.get("/{session_id}", response_model=SessionItem)
async def get_session(session_id: str) -> SessionItem:
    """Retrieve a specific session by ID."""
    session = _SESSIONS_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session


@router.delete("/{session_id}")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """Delete or archive a session."""
    if session_id in _SESSIONS_STORE:
        del _SESSIONS_STORE[session_id]
        return {"status": "deleted", "session_id": session_id}
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
