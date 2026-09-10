"""Internal Workflow Data Models and Security Schemas for Sovereign-Core."""

import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WorkflowNodeType(str, Enum):
    START = "START"
    LLM = "LLM"
    AGENT = "AGENT"
    TOOL = "TOOL"
    RAG = "RAG"
    CONDITION = "CONDITION"
    APPROVAL = "APPROVAL"
    END = "END"


class WorkflowState(str, Enum):
    DRAFT = "DRAFT"
    VALID = "VALID"
    INVALID = "INVALID"
    APPROVAL_REQUIRED = "APPROVAL REQUIRED"
    READY = "READY"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class FindingSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SecurityFinding(BaseModel):
    """Specific security or policy issue identified by static workflow inspection."""
    severity: FindingSeverity
    message: str
    rule_violated: str
    node_id: Optional[str] = None
    field_path: Optional[str] = None


class SecurityAnalysisReport(BaseModel):
    """Outcome of static security analysis on an imported or edited workflow."""
    is_safe: bool = True
    state: WorkflowState = WorkflowState.DRAFT
    risk_score: float = 0.0  # 0.0 (benign) to 1.0 (critical threat)
    requires_approval: bool = False
    findings: List[SecurityFinding] = Field(default_factory=list)
    analyzed_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


class WorkflowNode(BaseModel):
    """Executable node in a Sovereign-Core directed workflow graph."""
    id: str
    name: str = ""
    type: WorkflowNodeType = WorkflowNodeType.TOOL
    config: Dict[str, Any] = Field(default_factory=dict)
    inputs: List[str] | Dict[str, Any] = Field(default_factory=list)
    outputs: List[str] | Dict[str, Any] = Field(default_factory=list)
    position: Optional[Dict[str, float]] = None  # e.g. {"x": 100, "y": 200}
    status: Optional[str] = "idle"


class WorkflowEdge(BaseModel):
    """Directed connection between workflow nodes with optional condition."""
    id: str
    source: str
    target: str
    condition: Optional[str] = None
    label: Optional[str] = None


class WorkflowPolicy(BaseModel):
    """Immutable Sovereign-Core policy constraints inherited by every workflow."""
    no_egress: bool = True
    tool_allowlist: List[str] = Field(
        default_factory=lambda: [
            "document_retrieval",
            "calculator",
            "document_generation",
            "approval_note",
            "system_info",
        ]
    )
    max_steps: int = Field(default=20, ge=1, le=50)
    requires_approval: bool = True
    resource_limits: Dict[str, Any] = Field(
        default_factory=lambda: {
            "max_execution_time_seconds": 60.0,
            "max_memory_mb": 512,
            "max_tokens_per_call": 4096,
        }
    )
    allowed_providers: List[str] = Field(
        default_factory=lambda: ["ollama", "local", "gemma", "llama", "deepseek"]
    )


class Workflow(BaseModel):
    """Internal canonical Workflow model for Sovereign-Core."""
    id: str
    name: str
    version: str = "1.0.0"
    description: Optional[str] = None
    nodes: List[WorkflowNode] = Field(default_factory=list)
    edges: List[WorkflowEdge] = Field(default_factory=list)
    inputs: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    policy: WorkflowPolicy = Field(default_factory=WorkflowPolicy)
    state: WorkflowState = WorkflowState.DRAFT
    approval_status: Optional[str] = None  # "APPROVED", "PENDING", "REJECTED"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    security_analysis: Optional[SecurityAnalysisReport] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


class WorkflowStepExecution(BaseModel):
    node_id: str
    status: str
    inputs: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: float = 0.0
    error: Optional[str] = None


class WorkflowExecutionResponse(BaseModel):
    workflow_id: str
    execution_id: str
    success: bool
    state: WorkflowState
    final_output: Dict[str, Any] = Field(default_factory=dict)
    step_results: List[WorkflowStepExecution] = Field(default_factory=list)
    total_latency_ms: float = 0.0
    error: Optional[str] = None
    flight_record_id: Optional[str] = None
