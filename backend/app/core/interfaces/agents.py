"""Abstract Base Interface for Agents and Multi-Step Orchestration."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.core.interfaces.llm import ChatMessage
from app.core.interfaces.tools import ToolResult


class AgentStep(BaseModel):
    """An individual reasoning, action, or observation cycle."""
    step_number: int
    thought: Optional[str] = None
    tool_name: Optional[str] = None
    tool_arguments: Optional[Dict[str, Any]] = None
    tool_result: Optional[ToolResult] = None
    observation: Optional[str] = None
    timestamp: Optional[str] = None


class AgentState(BaseModel):
    """Session state and history for an agent execution."""
    session_id: str
    messages: List[ChatMessage] = Field(default_factory=list)
    steps: List[AgentStep] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentResult(BaseModel):
    """Final output from an agent execution run."""
    session_id: str
    final_response: str
    steps: List[AgentStep] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None
    total_latency_ms: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseAgent(ABC):
    """Abstract class for intelligent local reasoning agents."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the agent."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of the agent's capability."""
        pass

    @abstractmethod
    async def run(
        self,
        prompt: str,
        session_id: Optional[str] = None,
        max_steps: int = 5,
        **kwargs: Any,
    ) -> AgentResult:
        """Execute a reasoning/action loop for the supplied user prompt."""
        pass
