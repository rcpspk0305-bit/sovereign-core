"""Flight Recorder telemetry and blackbox event data models."""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    AUTO_VERIFIED = "AUTO_VERIFIED"
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"
    POLICY_VIOLATION = "POLICY_VIOLATION"
    FAILED = "FAILED"


class NetworkMode(str, Enum):
    AIR_GAPPED_LOCAL = "AIR_GAPPED_LOCAL"
    NO_EGRESS = "NO_EGRESS"


class FlightEventType(str, Enum):
    TASK_STARTED = "task_started"
    STEP_STARTED = "step_started"
    TOOL_CALLED = "tool_called"
    SOURCES_RETRIEVED = "sources_retrieved"
    TOOL_COMPLETED = "tool_completed"
    ARTIFACT_GENERATED = "artifact_generated"
    ERROR_RECORDED = "error_recorded"
    TASK_COMPLETED = "task_completed"
    APPROVAL_UPDATED = "approval_updated"
    # Agent Squad Mission Lifecycle Events
    MISSION_CREATED = "mission.created"
    AGENT_SELECTED = "agent.selected"
    AGENT_STARTED = "agent.started"
    AGENT_STEP_STARTED = "agent.step.started"
    AGENT_STEP_COMPLETED = "agent.step.completed"
    TOOL_STARTED = "tool.started"
    EVIDENCE_FOUND = "evidence.found"
    VERIFICATION_STARTED = "verification.started"
    VERIFICATION_COMPLETED = "verification.completed"
    APPROVAL_REQUESTED = "approval.requested"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"
    MISSION_COMPLETED = "mission.completed"


class RetrievedSource(BaseModel):
    """Document snippet retrieved from local vector store."""
    document_name: str
    page_number: Optional[int] = None
    similarity_score: float
    chunk_preview: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GeneratedArtifact(BaseModel):
    """Artifact generated during an inspection mission."""
    artifact_id: str
    artifact_type: str = "report"
    title: str
    content: str
    checksum_sha256: str
    timestamp: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RecordedError(BaseModel):
    """Error or policy violation recorded during mission execution."""
    step_number: Optional[int] = None
    error_message: str
    severity: str = "error"  # "error", "warning", "policy_violation"
    timestamp: str


class ToolExecutionRecord(BaseModel):
    """Summary of a tool execution for quick evidence auditing."""
    step_number: int
    tool_name: str
    tool_arguments: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: float = 0.0
    success: bool = True
    error: Optional[str] = None
    output_preview: Optional[str] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None


from typing import Any, Dict, List, Optional, Union

class FlightEvent(BaseModel):
    """Real-time event emitted to WebSocket clients."""
    event_type: Union[FlightEventType, str]
    task_id: str
    timestamp: str
    data: Dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    span_id: Optional[str] = None


class StepRecord(BaseModel):
    """Detailed record of an individual reasoning and execution step."""
    step_number: int
    thought: Optional[str] = ""
    tool_name: Optional[str] = None
    tool_arguments: Dict[str, Any] = Field(default_factory=dict)
    observation: Optional[str] = None
    timestamp: Optional[str] = None
    status: Optional[str] = "completed"
    trace_id: Optional[str] = None
    span_id: Optional[str] = None


class FlightRecord(BaseModel):
    """Complete blackbox mission record for audit and replay."""
    task_id: str
    model: str
    prompt: str
    network_mode: NetworkMode = NetworkMode.AIR_GAPPED_LOCAL
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    status: str = "running"  # "running", "completed", "failed"
    start_time: str
    end_time: Optional[str] = None
    total_latency_ms: Optional[float] = None
    steps: List[StepRecord] = Field(default_factory=list)
    tools_called: List[ToolExecutionRecord] = Field(default_factory=list)
    retrieved_sources: List[RetrievedSource] = Field(default_factory=list)
    artifacts_generated: List[GeneratedArtifact] = Field(default_factory=list)
    errors: List[RecordedError] = Field(default_factory=list)
    final_response: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
