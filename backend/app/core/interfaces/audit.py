"""Abstract Base Interface for Enterprise Audit Logging and Observability."""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AuditEventType(str, Enum):
    LLM_REQUEST = "llm_request"
    LLM_RESPONSE = "llm_response"
    LLM_ERROR = "llm_error"
    RAG_INGEST = "rag_ingest"
    RAG_QUERY = "rag_query"
    TOOL_EXECUTION = "tool_execution"
    AGENT_RUN = "agent_run"
    SYSTEM_EVENT = "system_event"


class AuditEvent(BaseModel):
    """Immutable audit record representing an action, prompt, or tool call."""
    id: str
    timestamp: str
    event_type: AuditEventType
    session_id: Optional[str] = None
    model: Optional[str] = None
    prompt_preview: Optional[str] = None
    response_preview: Optional[str] = None
    tokens: Optional[Dict[str, int]] = None
    latency_ms: Optional[float] = None
    status: str = "success"
    error: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class BaseAuditLogger(ABC):
    """Abstract interface for recording and querying structured audit trails."""

    @abstractmethod
    async def log(self, event: AuditEvent) -> None:
        """Persist an audit event safely."""
        pass

    @abstractmethod
    async def query(
        self,
        limit: int = 50,
        event_type: Optional[AuditEventType] = None,
        session_id: Optional[str] = None,
    ) -> List[AuditEvent]:
        """Query recent audit events matching optional filters."""
        pass

    @abstractmethod
    async def flush(self) -> None:
        """Flush any pending buffered events to durable storage."""
        pass
