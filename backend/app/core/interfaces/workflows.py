"""Abstract Base Interface for Graph-Based Workflows and Agent Orchestration."""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WorkflowNodeType(str, Enum):
    TRIGGER = "trigger"
    ROUTER = "router"
    AGENT = "agent"
    RETRIEVAL = "retrieval"
    EVAL = "eval"
    MODEL = "model"
    SEAL = "seal"
    CUSTOM = "custom"


class WorkflowNodeStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowNode(BaseModel):
    """An execution step or logic unit in a workflow graph."""
    id: str
    label: str
    type: WorkflowNodeType = WorkflowNodeType.CUSTOM
    handler: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: Optional[float] = 30.0


class WorkflowEdge(BaseModel):
    """Directed connection between workflow nodes with optional condition."""
    source: str
    target: str
    condition: Optional[str] = None  # e.g., "status == 'completed'"


class WorkflowGraph(BaseModel):
    """Declarative specification of a directed workflow graph."""
    id: str
    name: str
    description: Optional[str] = None
    nodes: List[WorkflowNode] = Field(default_factory=list)
    edges: List[WorkflowEdge] = Field(default_factory=list)
    max_steps: int = Field(default=20, ge=1, le=100)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowStepResult(BaseModel):
    """Outcome of an individual node execution."""
    node_id: str
    status: WorkflowNodeStatus
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: float = 0.0
    error: Optional[str] = None


class WorkflowExecutionResult(BaseModel):
    """Overall outcome of a workflow execution run."""
    workflow_id: str
    execution_id: str
    success: bool
    final_output: Dict[str, Any] = Field(default_factory=dict)
    step_results: List[WorkflowStepResult] = Field(default_factory=list)
    total_latency_ms: float = 0.0
    error: Optional[str] = None


class BaseWorkflowEngine(ABC):
    """Abstract interface for executing graph-based workflows."""

    @abstractmethod
    def validate_graph(self, graph: WorkflowGraph) -> bool:
        """Validate topological soundness and cycle safety of the graph."""
        pass

    @abstractmethod
    async def execute(
        self,
        graph: WorkflowGraph,
        initial_input: Dict[str, Any],
        **kwargs: Any,
    ) -> WorkflowExecutionResult:
        """Execute the workflow graph starting from trigger nodes."""
        pass
