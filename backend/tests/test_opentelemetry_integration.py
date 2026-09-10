"""Comprehensive test suite for OpenTelemetry integration in Sovereign-Core."""

import pytest
import asyncio
from unittest.mock import MagicMock, patch

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from app.config import settings
from app.core.telemetry.redaction import (
    sanitize_attributes,
    is_sensitive_key,
    truncate_preview,
    REDACTED_VALUE,
    TRUNCATED_SUFFIX,
)
from app.core.telemetry.otel import (
    init_telemetry,
    get_tracer,
    get_meter,
    get_in_memory_span_exporter,
    get_in_memory_metric_reader,
    shutdown_telemetry,
)
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
from app.core.flight_recorder.models import (
    FlightRecord,
    FlightEvent,
    StepRecord,
    ToolExecutionRecord,
    NetworkMode,
    ApprovalStatus,
)


@pytest.fixture(autouse=True)
def setup_test_telemetry():
    """Ensure in-memory telemetry is initialized for isolated testing."""
    original_enabled = settings.OTEL_ENABLED
    original_exporter = settings.OTEL_EXPORTER
    settings.OTEL_ENABLED = True
    settings.OTEL_EXPORTER = "in_memory"

    init_telemetry(force_reinit=True, service_name="sovereign-core-test", exporter_type="in_memory")
    yield

    settings.OTEL_ENABLED = original_enabled
    settings.OTEL_EXPORTER = original_exporter


class TestTelemetryRedaction:
    """Tests for redaction of secrets, credentials, and payload truncation."""

    def test_sensitive_key_detection(self):
        assert is_sensitive_key("api_key") is True
        assert is_sensitive_key("authorization") is True
        assert is_sensitive_key("db_password") is True
        assert is_sensitive_key("client_secret") is True
        assert is_sensitive_key("mission_id") is False
        assert is_sensitive_key("model_name") is False

    def test_sanitize_attributes_masks_passwords_and_tokens(self):
        raw = {
            "mission_id": "m-1234",
            "api_key": "sk-local-test-token-12345",
            "password": "SuperSecretPassword!",
            "auth_header": "Bearer eyJhbGciOi...",
            "normal_attr": "normal_value",
        }
        sanitized = sanitize_attributes(raw)
        assert sanitized["mission_id"] == "m-1234"
        assert sanitized["normal_attr"] == "normal_value"
        assert sanitized["api_key"] == REDACTED_VALUE
        assert sanitized["password"] == REDACTED_VALUE
        assert sanitized["auth_header"] == REDACTED_VALUE

    def test_sanitize_attributes_truncates_long_prompts_and_documents(self):
        long_prompt = "A" * 300
        raw = {
            "prompt": long_prompt,
            "document_content": "B" * 250,
            "code": "print('hello')",
        }
        sanitized = sanitize_attributes(raw, max_length=100)
        assert sanitized["prompt"].startswith("A" * 100)
        assert TRUNCATED_SUFFIX in sanitized["prompt"]
        assert TRUNCATED_SUFFIX in sanitized["document_content"]
        assert sanitized["code"] == "print('hello')"


class TestDistributedTracingHierarchy:
    """Tests for nested OpenTelemetry traces and span relationships."""

    def test_sync_nested_spans(self):
        exporter = get_in_memory_span_exporter()
        if exporter:
            exporter.clear()

        with trace_mission(mission_id="test-miss-001", model_name="gemma4"):
            ctx_mission = get_active_trace_context()
            assert ctx_mission["trace_id"] is not None
            assert len(ctx_mission["trace_id"]) == 32

            with trace_rag(query="orbital mechanics", top_k=5):
                with trace_embedding(model="nomic-embed-text", input_count=1):
                    pass
                with trace_vector_search(collection="sovereign_docs", top_k=5):
                    pass

            with trace_tool(tool_name="calculator"):
                pass

            with trace_verification(verifier="provenance_check"):
                pass

        if exporter:
            spans = exporter.get_finished_spans()
            span_names = [s.name for s in spans]
            assert "embedding" in span_names
            assert "vector.search" in span_names
            assert "rag.retrieve" in span_names
            assert "tool.calculator" in span_names
            assert "verification" in span_names
            assert "mission" in span_names

            # Verify all spans share the same trace ID
            trace_ids = {f"{s.context.trace_id:032x}" for s in spans}
            assert len(trace_ids) == 1

    @pytest.mark.asyncio
    async def test_async_nested_spans_and_error_handling(self):
        exporter = get_in_memory_span_exporter()
        if exporter:
            exporter.clear()

        with pytest.raises(ValueError, match="Simulated agent failure"):
            async with async_trace_span("agent.execution", {"agent.id": "agent-research"}):
                async with async_trace_span("llm.call", {"model": "gemma4"}):
                    await asyncio.sleep(0.01)
                    raise ValueError("Simulated agent failure")

        if exporter:
            spans = exporter.get_finished_spans()
            llm_span = next(s for s in spans if s.name == "llm.call")
            agent_span = next(s for s in spans if s.name == "agent.execution")

            assert not llm_span.status.is_ok
            assert not agent_span.status.is_ok
            # Exception event should be recorded
            events = [e.name for e in llm_span.events]
            assert "exception" in events


class TestMetricsRecording:
    """Tests for OpenTelemetry counters and latency histograms."""

    def test_metrics_helpers_do_not_crash(self):
        # Verify calling helpers records metrics safely
        record_llm_request(model="gemma4", latency_seconds=0.35, tokens=128, success=True)
        record_llm_request(model="gemma4", latency_seconds=0.15, tokens=0, success=False)
        record_rag_query(latency_seconds=0.045, results_count=3, success=True)
        record_tool_call(tool_name="calculator", latency_seconds=0.005, success=True)
        record_agent_mission(status="completed", latency_seconds=1.2, steps=3)
        record_workflow_execution(workflow_id="wf-01", status="completed", latency_seconds=2.4)

        reader = get_in_memory_metric_reader()
        if reader:
            data = reader.get_metrics_data()
            assert data is not None
            metric_names = [m.name for scope in data.resource_metrics for s in scope.scope_metrics for m in s.metrics]
            assert "llm_requests_total" in metric_names
            assert "llm_latency_seconds" in metric_names
            assert "rag_queries_total" in metric_names
            assert "tool_calls_total" in metric_names
            assert "agent_missions_total" in metric_names


class TestFlightRecorderBridge:
    """Tests bridging OpenTelemetry context to Flight Recorder events and records."""

    def test_attach_trace_to_record_populates_active_trace(self):
        record = FlightRecord(
            task_id="task-bridge-01",
            model="gemma4",
            prompt="Investigate telemetry bridge",
            network_mode=NetworkMode.AIR_GAPPED_LOCAL,
            approval_status=ApprovalStatus.PENDING,
            status="running",
            start_time="2026-09-10T00:00:00Z",
            steps=[],
            tools_called=[],
            retrieved_sources=[],
            artifacts_generated=[],
            errors=[],
            metadata={},
        )

        with trace_mission(mission_id="task-bridge-01", model_name="gemma4"):
            updated = attach_trace_to_record(record)
            assert updated.trace_id is not None
            assert len(updated.trace_id) == 32
            assert updated.span_id is not None
            assert len(updated.span_id) == 16
            assert updated.metadata["trace_id"] == updated.trace_id

    def test_span_to_flight_event_includes_trace_context(self):
        with trace_tool(tool_name="sandbox_calc"):
            event = span_to_flight_event(
                event_type="tool_called",
                task_id="task-002",
                data={"tool": "sandbox_calc", "arg": "2+2"},
            )
            assert event.trace_id is not None
            assert event.span_id is not None
            assert event.data["tool"] == "sandbox_calc"


class TestAirGappedDisabledMode:
    """Tests ensuring disabled OpenTelemetry mode acts as safe zero-overhead no-op."""

    def test_disabled_telemetry_acts_as_noop(self):
        settings.OTEL_ENABLED = False
        init_telemetry(force_reinit=True)

        # Should not raise any error
        with trace_mission(mission_id="noop-01", model_name="none"):
            with trace_tool(tool_name="noop_tool"):
                record_tool_call("noop_tool", latency_seconds=0.01, success=True)

        ctx = get_active_trace_context()
        assert ctx["trace_id"] is None
        assert ctx["span_id"] is None
