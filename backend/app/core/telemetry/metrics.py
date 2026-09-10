"""Standardized OpenTelemetry metrics for Sovereign-Core backend."""

from typing import Any, Dict, Optional

from app.core.telemetry.otel import get_meter, is_telemetry_enabled

_meter: Any = None
_instruments: Dict[str, Any] = {}


def _get_instruments() -> Dict[str, Any]:
    """Lazy initialize metric instruments."""
    global _meter, _instruments
    current_meter = get_meter("sovereign-core")
    if _instruments and _meter is current_meter:
        return _instruments

    _meter = current_meter
    _instruments = {}

    # 1. LLM metrics
    _instruments["llm_requests_total"] = _meter.create_counter(
        name="llm_requests_total",
        description="Total number of local LLM completion and streaming requests",
        unit="1",
    )
    _instruments["llm_latency_seconds"] = _meter.create_histogram(
        name="llm_latency_seconds",
        description="Duration of LLM requests in seconds",
        unit="s",
    )
    _instruments["llm_errors_total"] = _meter.create_counter(
        name="llm_errors_total",
        description="Total number of LLM errors, timeouts, or connection failures",
        unit="1",
    )

    # 2. RAG metrics
    _instruments["rag_queries_total"] = _meter.create_counter(
        name="rag_queries_total",
        description="Total number of semantic RAG vector retrieval queries",
        unit="1",
    )
    _instruments["rag_latency_seconds"] = _meter.create_histogram(
        name="rag_latency_seconds",
        description="Duration of RAG retrieval queries in seconds",
        unit="s",
    )

    # 3. Tool metrics
    _instruments["tool_calls_total"] = _meter.create_counter(
        name="tool_calls_total",
        description="Total number of tool calls executed by agents",
        unit="1",
    )

    # 4. Agent mission metrics
    _instruments["agent_missions_total"] = _meter.create_counter(
        name="agent_missions_total",
        description="Total number of agent mission executions initiated",
        unit="1",
    )
    _instruments["agent_failures_total"] = _meter.create_counter(
        name="agent_failures_total",
        description="Total number of agent missions ending in failure or policy violation",
        unit="1",
    )

    # 5. Workflow metrics
    _instruments["workflow_executions_total"] = _meter.create_counter(
        name="workflow_executions_total",
        description="Total number of directed workflow graph runs",
        unit="1",
    )
    _instruments["workflow_failures_total"] = _meter.create_counter(
        name="workflow_failures_total",
        description="Total number of directed workflow runs ending in error",
        unit="1",
    )

    return _instruments


def record_llm_request(
    model: str = "default",
    latency_seconds: float = 0.0,
    success: bool = True,
    error_type: Optional[str] = None,
    tokens: Optional[int] = None,
    **kwargs: Any,
) -> None:
    """Record telemetry metrics for an LLM invocation."""
    if not is_telemetry_enabled():
        return
    try:
        inst = _get_instruments()
        tags = {"model.name": model, "status": "success" if success else "error"}
        inst["llm_requests_total"].add(1, tags)
        if latency_seconds > 0:
            inst["llm_latency_seconds"].record(latency_seconds, {"model.name": model})
        if not success:
            inst["llm_errors_total"].add(1, {"model.name": model, "error.type": error_type or "unknown"})
    except Exception:
        pass


def record_rag_query(
    collection: str = "default",
    latency_seconds: float = 0.0,
    success: bool = True,
    results_count: Optional[int] = None,
    **kwargs: Any,
) -> None:
    """Record telemetry metrics for a RAG retrieval query."""
    if not is_telemetry_enabled():
        return
    try:
        inst = _get_instruments()
        inst["rag_queries_total"].add(1, {"rag.collection": collection, "status": "success" if success else "error"})
        if latency_seconds > 0:
            inst["rag_latency_seconds"].record(latency_seconds, {"rag.collection": collection})
    except Exception:
        pass


def record_tool_call(
    tool_name: str,
    latency_seconds: float = 0.0,
    success: bool = True,
    **kwargs: Any,
) -> None:
    """Record telemetry metrics for an individual tool execution."""
    if not is_telemetry_enabled():
        return
    try:
        inst = _get_instruments()
        inst["tool_calls_total"].add(1, {"tool.name": tool_name, "status": "success" if success else "error"})
    except Exception:
        pass


def record_agent_mission(
    agent_name: Optional[str] = None,
    success: bool = True,
    status: Optional[str] = None,
    latency_seconds: float = 0.0,
    steps: int = 0,
    **kwargs: Any,
) -> None:
    """Record telemetry metrics for an agent mission."""
    if not is_telemetry_enabled():
        return
    try:
        agent_id = agent_name or kwargs.get("agent_id") or "default"
        is_success = success if status is None else (status == "completed")
        inst = _get_instruments()
        inst["agent_missions_total"].add(1, {"agent.id": agent_id, "status": "success" if is_success else "error"})
        if not is_success:
            inst["agent_failures_total"].add(1, {"agent.id": agent_id})
    except Exception:
        pass


def record_workflow_execution(
    workflow_id: str,
    success: bool = True,
    status: Optional[str] = None,
    latency_seconds: float = 0.0,
    **kwargs: Any,
) -> None:
    """Record telemetry metrics for a workflow execution."""
    if not is_telemetry_enabled():
        return
    try:
        is_success = success if status is None else (status == "completed")
        inst = _get_instruments()
        inst["workflow_executions_total"].add(1, {"workflow.id": workflow_id, "status": "success" if is_success else "error"})
        if not is_success:
            inst["workflow_failures_total"].add(1, {"workflow.id": workflow_id})
    except Exception:
        pass
