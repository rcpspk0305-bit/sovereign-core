"""Strongly typed internal state schema for LangGraph agent orchestration."""

from typing import Any, Dict, List, TypedDict


class GraphAgentState(TypedDict, total=False):
    """Internal typed state for controlled graph-based agent orchestration.

    Preserves air-gap boundaries, step budget accounting, provenance metadata,
    and auditor verification status without leaking framework-specific objects.
    """
    mission_id: str
    task: str
    messages: List[Dict[str, Any]]
    current_step: int
    max_steps: int
    selected_model: str
    tool_calls: List[Dict[str, Any]]
    tool_results: List[Dict[str, Any]]
    evidence: List[Dict[str, Any]]
    citations: List[Dict[str, Any]]
    provenance: Dict[str, Any]
    verification_status: str  # "PENDING", "VERIFIED", "UNVERIFIED", "FAILED"
    approval_required: bool
    approval_status: str      # "PENDING", "APPROVED", "REJECTED", "AUTO_VERIFIED"
    errors: List[str]
    final_output: str
    cancelled: bool
    current_node: str
    planned_tools: List[Dict[str, Any]]
