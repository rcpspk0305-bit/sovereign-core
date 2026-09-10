"""Telemetry implementation package."""

from app.core.telemetry.broadcaster import NativeTelemetryBroadcaster
from app.core.telemetry.sink import CompositeTelemetrySink, InMemoryTelemetrySink
from app.core.telemetry.otel import (
    init_telemetry,
    shutdown_telemetry,
    is_telemetry_enabled,
    get_tracer,
    get_meter,
    get_in_memory_span_exporter,
    get_in_memory_metric_reader,
)
from app.core.telemetry.redaction import sanitize_attributes
from app.core.telemetry.tracer import (
    trace_span,
    async_trace_span,
    trace_mission,
    trace_agent,
    trace_llm,
    trace_rag,
    trace_embedding,
    trace_vector_search,
    trace_tool,
    trace_document_ingestion,
    trace_verification,
    trace_approval,
    trace_artifact,
    trace_workflow,
)
from app.core.telemetry.metrics import (
    record_llm_request,
    record_rag_query,
    record_tool_call,
    record_agent_mission,
    record_workflow_execution,
)
from app.core.telemetry.bridge import (
    get_active_trace_context,
    span_to_flight_event,
    attach_trace_to_record,
)

__all__ = [
    "InMemoryTelemetrySink",
    "CompositeTelemetrySink",
    "NativeTelemetryBroadcaster",
    "init_telemetry",
    "shutdown_telemetry",
    "is_telemetry_enabled",
    "get_tracer",
    "get_meter",
    "get_in_memory_span_exporter",
    "get_in_memory_metric_reader",
    "sanitize_attributes",
    "trace_span",
    "async_trace_span",
    "trace_mission",
    "trace_agent",
    "trace_llm",
    "trace_rag",
    "trace_embedding",
    "trace_vector_search",
    "trace_tool",
    "trace_document_ingestion",
    "trace_verification",
    "trace_approval",
    "trace_artifact",
    "trace_workflow",
    "record_llm_request",
    "record_rag_query",
    "record_tool_call",
    "record_agent_mission",
    "record_workflow_execution",
    "get_active_trace_context",
    "span_to_flight_event",
    "attach_trace_to_record",
]
