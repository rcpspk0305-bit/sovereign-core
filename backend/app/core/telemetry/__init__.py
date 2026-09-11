"""Telemetry implementation package."""

from app.core.telemetry.bridge import (
    attach_trace_to_record,
    get_active_trace_context,
    span_to_flight_event,
)
from app.core.telemetry.broadcaster import NativeTelemetryBroadcaster
from app.core.telemetry.metrics import (
    record_agent_mission,
    record_llm_request,
    record_rag_query,
    record_tool_call,
    record_workflow_execution,
)
from app.core.telemetry.otel import (
    get_in_memory_metric_reader,
    get_in_memory_span_exporter,
    get_meter,
    get_tracer,
    init_telemetry,
    is_telemetry_enabled,
    shutdown_telemetry,
)
from app.core.telemetry.redaction import sanitize_attributes
from app.core.telemetry.sink import CompositeTelemetrySink, InMemoryTelemetrySink
from app.core.telemetry.tracer import (
    async_trace_span,
    trace_agent,
    trace_approval,
    trace_artifact,
    trace_document_ingestion,
    trace_embedding,
    trace_llm,
    trace_mission,
    trace_rag,
    trace_span,
    trace_tool,
    trace_vector_search,
    trace_verification,
    trace_workflow,
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
