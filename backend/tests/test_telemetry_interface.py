"""Unit tests for telemetry interfaces, sinks, and broadcasters."""

import pytest
from app.core.interfaces.telemetry import (
    TelemetryEvent,
    TelemetryMetric,
    TelemetrySeverity,
    TelemetrySpan,
)
from app.core.telemetry.broadcaster import NativeTelemetryBroadcaster
from app.core.telemetry.sink import CompositeTelemetrySink, InMemoryTelemetrySink


@pytest.mark.asyncio
async def test_in_memory_telemetry_sink():
    sink = InMemoryTelemetrySink(max_items=3)

    event1 = TelemetryEvent(event_id="e1", timestamp="2026-09-10T00:00:00Z", name="test.event")
    event2 = TelemetryEvent(event_id="e2", timestamp="2026-09-10T00:00:01Z", name="test.event")
    span = TelemetrySpan(trace_id="t1", span_id="s1", name="llm.call", start_time_ms=100.0)
    metric = TelemetryMetric(name="tokens", value=42.0, unit="count", timestamp="2026-09-10T00:00:00Z")

    await sink.emit_event(event1)
    await sink.emit_event(event2)
    await sink.record_span(span)
    await sink.record_metric(metric)

    assert len(sink.events) == 2
    assert len(sink.spans) == 1
    assert len(sink.metrics) == 1

    await sink.flush()
    await sink.clear()
    assert len(sink.events) == 0


@pytest.mark.asyncio
async def test_composite_telemetry_sink():
    sink_a = InMemoryTelemetrySink()
    sink_b = InMemoryTelemetrySink()
    composite = CompositeTelemetrySink([sink_a, sink_b])

    event = TelemetryEvent(
        event_id="comp1",
        timestamp="2026-09-10T00:00:00Z",
        name="composite.test",
        severity=TelemetrySeverity.INFO,
    )
    await composite.emit_event(event)

    assert len(sink_a.events) == 1
    assert len(sink_b.events) == 1
    assert sink_a.events[0].event_id == "comp1"


@pytest.mark.asyncio
async def test_native_telemetry_broadcaster():
    broadcaster = NativeTelemetryBroadcaster()
    received = []

    def on_telemetry(msg):
        received.append(msg)

    await broadcaster.subscribe("missions", on_telemetry)
    reached = await broadcaster.broadcast("missions", {"task_id": "test-123", "status": "running"})

    assert reached == 1
    assert len(received) == 1
    assert received[0]["task_id"] == "test-123"

    await broadcaster.unsubscribe("missions", on_telemetry)
    reached_after = await broadcaster.broadcast("missions", {"task_id": "test-456"})
    assert reached_after == 0
    assert len(received) == 1
