"""Strongly typed definitions and state models for Sovereign-Core Agent Squad."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    """Authoritative agent lifecycle status."""
    IDLE = "IDLE"
    QUEUED = "QUEUED"
    PLANNING = "PLANNING"
    RUNNING = "RUNNING"
    WAITING_FOR_TOOL = "WAITING_FOR_TOOL"
    VERIFYING = "VERIFYING"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    POLICY_BLOCKED = "POLICY_BLOCKED"


class ApprovalPolicy(str, Enum):
    """Approval gating policy."""
    AUTOMATIC = "AUTOMATIC"
    HUMAN_REQUIRED = "HUMAN_REQUIRED"


class AgentDefinition(BaseModel):
    """Authoritative specification of an agent's identity, permissions, and boundaries."""
    id: str = Field(..., description="Unique agent identifier (e.g. research, document_analyst).")
    name: str = Field(..., description="Display name of the agent.")
    description: str = Field(..., description="High-level description.")
    purpose: str = Field(..., description="Core operational purpose.")
    capabilities: List[str] = Field(default_factory=list, description="Explicit capabilities.")
    allowed_tools: List[str] = Field(..., description="Deterministic tool whitelist.")
    input_schema: Dict[str, Any] = Field(default_factory=dict, description="JSON schema for expected inputs.")
    output_schema: Dict[str, Any] = Field(default_factory=dict, description="JSON schema for expected outputs.")
    system_instructions: str = Field(..., description="System instructions framing the agent persona and boundaries.")
    max_steps: int = Field(default=5, ge=1, le=10, description="Strict execution step ceiling.")
    evidence_requirements: List[str] = Field(default_factory=list, description="Grounding and citation requirements.")
    failure_policy: str = Field(default="HALT_AND_REPORT", description="Policy when errors or violations occur.")
    approval_policy: ApprovalPolicy = Field(default=ApprovalPolicy.AUTOMATIC, description="Human approval requirement.")

    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is within the deterministic permissions."""
        return tool_name in self.allowed_tools


class AgentStateModel(BaseModel):
    """Strongly typed state tracking an active or completed agent run."""
    mission_id: str
    agent_id: str
    task: str
    status: AgentStatus = AgentStatus.IDLE
    current_step: int = 0
    max_steps: int = 5
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    tool_results: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = 0.0
    errors: List[str] = Field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Immutability guard for security policy fields
    def update_protected_field_attempt(self, field_name: str) -> None:
        """Guard against runtime tampering with security policy attributes."""
        if field_name in ("max_steps", "allowed_tools", "security_policy", "approval_policy"):
            raise PermissionError(f"Security violation: Agent state cannot mutate protected field '{field_name}'")
