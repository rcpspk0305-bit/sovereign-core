"""Abstract Base Interface for Telemetry, Distributed Tracing, and Event Sinks."""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TelemetrySeverity(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class TelemetryEvent(BaseModel):
    """Normalized telemetry event for sinks and exporters."""
    event_id: str
    timestamp: str
    name: str
    severity: TelemetrySeverity = TelemetrySeverity.INFO
    task_id: Optional[str] = None
    session_id: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class TelemetrySpan(BaseModel):
    """Representation of an execution span for distributed tracing."""
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    name: str
    start_time_ms: float
    end_time_ms: Optional[float] = None
    status: str = "ok"  # ok, error
    attributes: Dict[str, Any] = Field(default_factory=dict)


class TelemetryMetric(BaseModel):
    """Numerical telemetry metric recording latency, tokens, steps, etc."""
    name: str
    value: float
    unit: str
    timestamp: str
    tags: Dict[str, str] = Field(default_factory=dict)


class BaseTelemetrySink(ABC):
    """Abstract interface for receiving and persisting or forwarding telemetry."""

    @abstractmethod
    async def emit_event(self, event: TelemetryEvent) -> None:
        """Process or forward a single telemetry event."""
        pass

    @abstractmethod
    async def record_span(self, span: TelemetrySpan) -> None:
        """Process or forward a trace span."""
        pass

    @abstractmethod
    async def record_metric(self, metric: TelemetryMetric) -> None:
        """Record a numerical metric."""
        pass

    @abstractmethod
    async def flush(self) -> None:
        """Flush any pending buffered telemetry."""
        pass


class BaseTelemetryBroadcaster(ABC):
    """Abstract interface for real-time live telemetry fanout (e.g. WebSockets)."""

    @abstractmethod
    async def broadcast(self, channel: str, message: Dict[str, Any]) -> int:
        """Broadcast a message to active subscribers on a channel. Returns number of clients reached."""
        pass
