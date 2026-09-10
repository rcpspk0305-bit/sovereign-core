"""Bridge connecting OpenTelemetry Spans to Flight Recorder blackbox events."""

import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from app.core.telemetry.otel import is_telemetry_enabled
from app.core.telemetry.redaction import sanitize_attributes

if TYPE_CHECKING:
    from app.core.flight_recorder.models import FlightEvent, FlightEventType


def get_active_trace_context() -> Dict[str, Optional[str]]:
    """Extract trace_id and span_id from the current OpenTelemetry context."""
    if not is_telemetry_enabled():
        return {"trace_id": None, "span_id": None}

    try:
        from opentelemetry import trace
        current_span = trace.get_current_span()
        if not current_span:
            return {"trace_id": None, "span_id": None}

        ctx = current_span.get_span_context()
        if not ctx or not ctx.is_valid:
            return {"trace_id": None, "span_id": None}

        return {
            "trace_id": format(ctx.trace_id, "032x"),
            "span_id": format(ctx.span_id, "016x"),
        }
    except Exception:
        return {"trace_id": None, "span_id": None}


def span_to_flight_event(
    span_name: Optional[str] = None,
    task_id: str = "",
    attributes: Optional[Dict[str, Any]] = None,
    status: str = "completed",
    timestamp: Optional[str] = None,
    event_type: Optional[Any] = None,
    data: Optional[Dict[str, Any]] = None,
    **kwargs: Any,
) -> "FlightEvent":
    """Map an OpenTelemetry span event to a Flight Recorder FlightEvent."""
    from app.core.flight_recorder.models import FlightEvent, FlightEventType

    trace_ctx = get_active_trace_context()
    now_iso = timestamp or datetime.datetime.now(datetime.timezone.utc).isoformat()
    clean_attrs = sanitize_attributes(attributes or data or kwargs or {})

    name = span_name or (str(event_type) if event_type else "span")

    # Determine mapped FlightEventType
    resolved_event_type = FlightEventType.STEP_STARTED
    if event_type:
        if isinstance(event_type, FlightEventType):
            resolved_event_type = event_type
        else:
            try:
                resolved_event_type = FlightEventType(str(event_type).lower())
            except ValueError:
                resolved_event_type = FlightEventType.STEP_STARTED
    else:
        lower_name = name.lower()
        if "mission" in lower_name:
            resolved_event_type = FlightEventType.TASK_STARTED if status == "running" else FlightEventType.TASK_COMPLETED
        elif "tool" in lower_name:
            resolved_event_type = FlightEventType.TOOL_CALLED if status == "running" else FlightEventType.TOOL_COMPLETED
        elif "rag" in lower_name or "vector" in lower_name:
            resolved_event_type = FlightEventType.SOURCES_RETRIEVED
        elif "artifact" in lower_name:
            resolved_event_type = FlightEventType.ARTIFACT_GENERATED
        elif "approval" in lower_name:
            resolved_event_type = FlightEventType.APPROVAL_UPDATED

    payload: Dict[str, Any] = {
        "span_name": name,
        "status": status,
        "trace_id": trace_ctx["trace_id"],
        "span_id": trace_ctx["span_id"],
        **clean_attrs,
    }

    return FlightEvent(
        event_type=resolved_event_type,
        task_id=task_id,
        timestamp=now_iso,
        data=payload,
        trace_id=trace_ctx["trace_id"],
        span_id=trace_ctx["span_id"],
    )


def attach_trace_to_record(record: Any) -> Any:
    """Ensure trace_id and span_id are populated on a record payload or FlightRecord model."""
    ctx = get_active_trace_context()
    trace_id = ctx.get("trace_id")
    span_id = ctx.get("span_id")

    if not trace_id:
        return record

    if isinstance(record, dict):
        if not record.get("trace_id"):
            record["trace_id"] = trace_id
        if not record.get("span_id"):
            record["span_id"] = span_id
        if "metadata" in record and isinstance(record["metadata"], dict):
            record["metadata"]["trace_id"] = trace_id
            record["metadata"]["span_id"] = span_id
    else:
        if hasattr(record, "trace_id") and not getattr(record, "trace_id", None):
            setattr(record, "trace_id", trace_id)
        if hasattr(record, "span_id") and not getattr(record, "span_id", None):
            setattr(record, "span_id", span_id)
        if hasattr(record, "metadata") and isinstance(record.metadata, dict):
            record.metadata["trace_id"] = trace_id
            record.metadata["span_id"] = span_id

    return record

