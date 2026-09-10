"""OpenTelemetry tracing context managers and nested span helpers."""

import contextlib
import time
from typing import Any, AsyncIterator, Dict, Iterator, Optional

from app.core.telemetry.otel import get_tracer, is_telemetry_enabled
from app.core.telemetry.redaction import sanitize_attributes


class SpanContextWrapper:
    """Wrapper around an OpenTelemetry Span providing safe attribute and status updates."""

    def __init__(self, span: Any, trace_id: str, span_id: str) -> None:
        self.raw_span = span
        self.trace_id = trace_id
        self.span_id = span_id

    def set_attribute(self, key: str, value: Any) -> None:
        if self.raw_span and hasattr(self.raw_span, "set_attribute"):
            clean = sanitize_attributes({key: value})
            for k, v in clean.items():
                self.raw_span.set_attribute(k, v)

    def set_attributes(self, attributes: Dict[str, Any]) -> None:
        if self.raw_span and hasattr(self.raw_span, "set_attributes"):
            clean = sanitize_attributes(attributes)
            self.raw_span.set_attributes(clean)

    def record_exception(self, exception: BaseException) -> None:
        if self.raw_span and hasattr(self.raw_span, "record_exception"):
            try:
                self.raw_span.record_exception(exception)
            except Exception:
                pass

    def set_error(self, message: str) -> None:
        if self.raw_span and hasattr(self.raw_span, "set_status"):
            try:
                from opentelemetry.trace import Status, StatusCode
                self.raw_span.set_status(Status(StatusCode.ERROR, description=message))
            except Exception:
                pass


@contextlib.contextmanager
def trace_span(
    name: str,
    attributes: Optional[Dict[str, Any]] = None,
) -> Iterator[SpanContextWrapper]:
    """Synchronous context manager creating a nested OpenTelemetry span."""
    if not is_telemetry_enabled():
        yield SpanContextWrapper(None, "0" * 32, "0" * 16)
        return

    tracer = get_tracer()
    clean_attrs = sanitize_attributes(attributes or {})
    start_time = time.perf_counter()

    with tracer.start_as_current_span(name, attributes=clean_attrs) as span:
        ctx = span.get_span_context()
        trace_id = format(ctx.trace_id, "032x") if ctx and ctx.trace_id else "0" * 32
        span_id = format(ctx.span_id, "016x") if ctx and ctx.span_id else "0" * 16
        wrapper = SpanContextWrapper(span, trace_id, span_id)

        try:
            yield wrapper
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            wrapper.set_attribute("duration_ms", round(duration_ms, 2))
            wrapper.set_attribute("status", "success")
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            wrapper.set_attribute("duration_ms", round(duration_ms, 2))
            wrapper.set_attribute("status", "error")
            wrapper.record_exception(e)
            wrapper.set_error(str(e))
            raise


class AsyncTraceSpan:
    """Asynchronous context manager for OpenTelemetry spans."""

    def __init__(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        self._sync_mgr = trace_span(name, attributes)
        self._wrapper: Optional[SpanContextWrapper] = None

    async def __aenter__(self) -> SpanContextWrapper:
        self._wrapper = self._sync_mgr.__enter__()
        return self._wrapper

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> Any:
        return self._sync_mgr.__exit__(exc_type, exc_val, exc_tb)


def async_trace_span(
    name: str,
    attributes: Optional[Dict[str, Any]] = None,
) -> AsyncTraceSpan:
    """Asynchronous context manager creating a nested OpenTelemetry span."""
    return AsyncTraceSpan(name, attributes)


# Specialized helpers for standard Sovereign-Core traces

def trace_mission(
    mission_id: str,
    prompt: Optional[str] = None,
    model: Optional[str] = None,
    model_name: Optional[str] = None,
    **kwargs: Any,
):
    selected_model = model or model_name or kwargs.get("model") or "default"
    return trace_span("mission", {
        "mission.id": mission_id,
        "model.name": selected_model,
        "prompt": prompt or "",
        **kwargs,
    })


def trace_agent(
    agent_id: str,
    step_number: Optional[int] = None,
    mission_id: Optional[str] = None,
    **kwargs: Any,
):
    attrs: Dict[str, Any] = {"agent.id": agent_id, **kwargs}
    if step_number is not None:
        attrs["step.number"] = step_number
    if mission_id:
        attrs["mission.id"] = mission_id
    return trace_span("agent.execution", attrs)


def trace_llm(model: str = "default", stream: bool = False, **kwargs: Any):
    return trace_span("llm.call", {
        "model.name": model,
        "llm.stream": stream,
        **kwargs,
    })


def trace_rag(
    collection: str = "default",
    top_k: Optional[int] = None,
    query: Optional[str] = None,
    **kwargs: Any,
):
    attrs: Dict[str, Any] = {"rag.collection": collection, **kwargs}
    if top_k is not None:
        attrs["rag.top_k"] = top_k
    if query:
        attrs["rag.query"] = query
    return trace_span("rag.retrieve", attrs)


def trace_embedding(
    model: str = "default",
    chunk_count: int = 1,
    input_count: Optional[int] = None,
    **kwargs: Any,
):
    count = input_count if input_count is not None else chunk_count
    return trace_span("embedding", {
        "model.name": model,
        "embedding.chunk_count": count,
        **kwargs,
    })


def trace_vector_search(collection: str = "default", top_k: int = 4, **kwargs: Any):
    return trace_span("vector.search", {
        "rag.collection": collection,
        "rag.top_k": top_k,
        **kwargs,
    })


def trace_tool(tool_name: str, arguments: Optional[Dict[str, Any]] = None, **kwargs: Any):
    attrs: Dict[str, Any] = {"tool.name": tool_name, **kwargs}
    if arguments:
        attrs["tool.arguments"] = arguments
    return trace_span(f"tool.{tool_name}", attrs)


def trace_document_ingestion(filename: str, total_pages: int = 0, **kwargs: Any):
    return trace_span("document.ingestion", {
        "document.filename": filename,
        "document.pages": total_pages,
        **kwargs,
    })


def trace_verification(
    claim: Optional[str] = None,
    evidence_count: int = 0,
    verifier: Optional[str] = None,
    **kwargs: Any,
):
    attrs: Dict[str, Any] = {
        "verification.evidence_count": evidence_count,
        "verification.claim_preview": (claim or "")[:80],
        **kwargs,
    }
    if verifier:
        attrs["verifier"] = verifier
    return trace_span("verification", attrs)


def trace_approval(mission_id: str, approval_status: str):
    return trace_span("approval", {
        "mission.id": mission_id,
        "approval.status": approval_status,
    })


def trace_artifact(artifact_id: str, title: str, artifact_type: str = "report"):
    return trace_span("artifact.generate", {
        "artifact.id": artifact_id,
        "artifact.title": title,
        "artifact.type": artifact_type,
    })


def trace_workflow(workflow_id: str, step_count: int = 0):
    return trace_span("workflow.execution", {
        "workflow.id": workflow_id,
        "workflow.steps": step_count,
    })
