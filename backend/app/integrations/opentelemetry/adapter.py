"""OpenTelemetry Adapter implementing BaseTelemetrySink."""

import importlib.util
from typing import Any, Optional

from app.config import settings
from app.core.interfaces.telemetry import (
    BaseTelemetrySink,
    TelemetryEvent,
    TelemetryMetric,
    TelemetrySpan,
)
from app.integrations.base import (
    BaseIntegrationAdapter,
    validate_local_endpoint,
)


class OpenTelemetrySinkAdapter(BaseTelemetrySink, BaseIntegrationAdapter):
    """Adapter forwarding Sovereign-Core telemetry to a local OTLP collector."""

    def __init__(
        self,
        endpoint: Optional[str] = None,
        service_name: Optional[str] = None,
    ) -> None:
        self.endpoint = endpoint or getattr(settings, "OTEL_ENDPOINT", "") or getattr(settings, "OTEL_EXPORTER_OTLP_ENDPOINT", "")
        self.service_name = service_name or settings.OTEL_SERVICE_NAME
        if self.endpoint:
            validate_local_endpoint(self.endpoint)
        self._tracer: Any = None
        self._meter: Any = None

    @property
    def name(self) -> str:
        return "opentelemetry"

    def is_enabled(self) -> bool:
        return bool(getattr(settings, "OTEL_ENABLED", False) or getattr(settings, "ENABLE_OPENTELEMETRY", False))

    def is_available(self) -> bool:
        return importlib.util.find_spec("opentelemetry") is not None

    async def emit_event(self, event: TelemetryEvent) -> None:
        self.check_ready()
        from app.core.telemetry.redaction import sanitize_attributes
        from opentelemetry import trace  # type: ignore
        tracer = trace.get_tracer(self.service_name)
        sanitized = sanitize_attributes(event.attributes)
        with tracer.start_as_current_span(f"event.{event.name}") as span:
            span.set_attributes({
                "sovereign.event_id": event.event_id,
                "sovereign.severity": event.severity.value,
                **{f"sovereign.{k}": str(v) for k, v in sanitized.items()},
            })

    async def record_span(self, span: TelemetrySpan) -> None:
        self.check_ready()
        from app.core.telemetry.redaction import sanitize_attributes
        from opentelemetry import trace  # type: ignore
        tracer = trace.get_tracer(self.service_name)
        sanitized = sanitize_attributes(span.attributes)
        with tracer.start_as_current_span(span.name) as otel_span:
            otel_span.set_attributes({
                "sovereign.trace_id": span.trace_id,
                "sovereign.span_id": span.span_id,
                **{f"sovereign.{k}": str(v) for k, v in sanitized.items()},
            })

    async def record_metric(self, metric: TelemetryMetric) -> None:
        self.check_ready()
        from app.core.telemetry.metrics import get_meter
        meter = get_meter(self.service_name)
        counter = meter.create_counter(f"sovereign.{metric.name}")
        counter.add(metric.value, metric.tags)

    async def flush(self) -> None:
        if self.is_enabled() and self.is_available():
            from app.core.telemetry.otel import shutdown_telemetry
            pass
