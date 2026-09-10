"""OpenTelemetry lifecycle management, provider initialization, and local exporters."""

import logging
from typing import Any, Optional

from app.config import settings
from app.integrations.base import validate_local_endpoint

logger = logging.getLogger("sovereign.telemetry.otel")

_tracer_provider: Any = None
_meter_provider: Any = None
_in_memory_span_exporter: Any = None
_in_memory_metric_reader: Any = None
_is_initialized: bool = False


def is_telemetry_enabled() -> bool:
    """Check if OpenTelemetry is explicitly enabled via configuration."""
    return bool(getattr(settings, "OTEL_ENABLED", False) or getattr(settings, "ENABLE_OPENTELEMETRY", False))


def get_in_memory_span_exporter() -> Any:
    """Retrieve the active InMemorySpanExporter for testing/inspection, if configured."""
    return _in_memory_span_exporter


def get_in_memory_metric_reader() -> Any:
    """Retrieve the active InMemoryMetricReader for testing/inspection, if configured."""
    return _in_memory_metric_reader


def init_telemetry(
    force_reinit: bool = False,
    service_name: Optional[str] = None,
    exporter_type: Optional[str] = None,
) -> None:
    """Initialize OpenTelemetry TracerProvider and MeterProvider locally."""
    global _tracer_provider, _meter_provider, _in_memory_span_exporter, _in_memory_metric_reader, _is_initialized

    if _is_initialized and not force_reinit:
        return

    if not is_telemetry_enabled():
        logger.debug("OpenTelemetry is disabled in configuration.")
        _is_initialized = True
        return

    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import (
            BatchSpanProcessor,
            SimpleSpanProcessor,
            ConsoleSpanExporter,
        )
        from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import InMemoryMetricReader

        svc_name = service_name or getattr(settings, "OTEL_SERVICE_NAME", "sovereign-core")
        resource = Resource.create({"service.name": svc_name})

        # 1. Initialize TracerProvider
        provider = TracerProvider(resource=resource)
        exp_type = (exporter_type or getattr(settings, "OTEL_EXPORTER", "console")).lower()

        if exp_type == "in_memory":
            _in_memory_span_exporter = InMemorySpanExporter()
            provider.add_span_processor(SimpleSpanProcessor(_in_memory_span_exporter))
        elif exp_type == "console":
            provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
        elif exp_type == "otlp":
            endpoint = getattr(settings, "OTEL_ENDPOINT", None) or getattr(
                settings, "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"
            )
            validate_local_endpoint(endpoint)
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

            otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

        trace.set_tracer_provider(provider)
        _tracer_provider = provider

        # 2. Initialize MeterProvider
        _in_memory_metric_reader = InMemoryMetricReader()
        meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[_in_memory_metric_reader],
        )
        metrics.set_meter_provider(meter_provider)
        _meter_provider = meter_provider

        _is_initialized = True
        logger.info(
            "OpenTelemetry initialized successfully with exporter=%s, service_name=%s",
            exp_type,
            svc_name,
        )
    except Exception as e:
        logger.warning("Failed to initialize OpenTelemetry: %s", e)
        _is_initialized = True


def get_tracer(name: Optional[str] = None) -> Any:
    """Get an OpenTelemetry Tracer or NoOpTracer."""
    if not is_telemetry_enabled():
        from opentelemetry.trace import NoOpTracer
        return NoOpTracer()

    try:
        from opentelemetry import trace
        service_name = name or getattr(settings, "OTEL_SERVICE_NAME", "sovereign-core")
        if _tracer_provider:
            return _tracer_provider.get_tracer(service_name)
        return trace.get_tracer(service_name)
    except Exception:
        from opentelemetry.trace import NoOpTracer
        return NoOpTracer()


def get_meter(name: Optional[str] = None) -> Any:
    """Get an OpenTelemetry Meter or NoOpMeter."""
    if not is_telemetry_enabled():
        from opentelemetry.metrics import NoOpMeter
        return NoOpMeter("noop")

    try:
        from opentelemetry import metrics
        service_name = name or getattr(settings, "OTEL_SERVICE_NAME", "sovereign-core")
        if _meter_provider:
            return _meter_provider.get_meter(service_name)
        return metrics.get_meter(service_name)
    except Exception:
        from opentelemetry.metrics import NoOpMeter
        return NoOpMeter("noop")


def shutdown_telemetry() -> None:
    """Shutdown providers and flush spans."""
    global _tracer_provider, _meter_provider, _is_initialized
    if _tracer_provider and hasattr(_tracer_provider, "shutdown"):
        try:
            _tracer_provider.shutdown()
        except Exception:
            pass
    if _meter_provider and hasattr(_meter_provider, "shutdown"):
        try:
            _meter_provider.shutdown()
        except Exception:
            pass
    _is_initialized = False
