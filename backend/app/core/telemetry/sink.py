"""Telemetry sinks for in-memory buffering and multi-sink fanout."""

import asyncio
from typing import List, Optional
from app.core.interfaces.telemetry import (
    BaseTelemetrySink,
    TelemetryEvent,
    TelemetryMetric,
    TelemetrySpan,
)


class InMemoryTelemetrySink(BaseTelemetrySink):
    """In-memory telemetry sink for testing, inspection, and local buffering."""

    def __init__(self, max_items: int = 1000) -> None:
        self.max_items = max_items
        self.events: List[TelemetryEvent] = []
        self.spans: List[TelemetrySpan] = []
        self.metrics: List[TelemetryMetric] = []
        self._lock = asyncio.Lock()

    async def emit_event(self, event: TelemetryEvent) -> None:
        async with self._lock:
            self.events.append(event)
            if len(self.events) > self.max_items:
                self.events.pop(0)

    async def record_span(self, span: TelemetrySpan) -> None:
        async with self._lock:
            self.spans.append(span)
            if len(self.spans) > self.max_items:
                self.spans.pop(0)

    async def record_metric(self, metric: TelemetryMetric) -> None:
        async with self._lock:
            self.metrics.append(metric)
            if len(self.metrics) > self.max_items:
                self.metrics.pop(0)

    async def flush(self) -> None:
        # In-memory buffer does not require disk flush
        pass

    async def clear(self) -> None:
        async with self._lock:
            self.events.clear()
            self.spans.clear()
            self.metrics.clear()


class CompositeTelemetrySink(BaseTelemetrySink):
    """Fan-out composite sink dispatching telemetry to multiple sinks simultaneously."""

    def __init__(self, sinks: Optional[List[BaseTelemetrySink]] = None) -> None:
        self.sinks: List[BaseTelemetrySink] = sinks or []

    def add_sink(self, sink: BaseTelemetrySink) -> None:
        self.sinks.append(sink)

    async def emit_event(self, event: TelemetryEvent) -> None:
        for sink in self.sinks:
            try:
                await sink.emit_event(event)
            except Exception:
                pass

    async def record_span(self, span: TelemetrySpan) -> None:
        for sink in self.sinks:
            try:
                await sink.record_span(span)
            except Exception:
                pass

    async def record_metric(self, metric: TelemetryMetric) -> None:
        for sink in self.sinks:
            try:
                await sink.record_metric(metric)
            except Exception:
                pass

    async def flush(self) -> None:
        for sink in self.sinks:
            try:
                await sink.flush()
            except Exception:
                pass
