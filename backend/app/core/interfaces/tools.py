"""Abstract Base Interface for Tools and Tool Registry."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ToolDefinition(BaseModel):
    """Schema descriptor for a callable tool."""
    name: str
    description: str
    parameters: Dict[str, Any] = Field(
        default_factory=lambda: {"type": "object", "properties": {}, "required": []}
    )


class ToolResult(BaseModel):
    """Execution output from a tool call."""
    success: bool
    output: Any
    error: Optional[str] = None
    execution_time_ms: Optional[float] = None


class BaseTool(ABC):
    """Abstract class that all Sovereign-Core tools must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the tool."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human and LLM-readable summary of tool purpose."""
        pass

    @abstractmethod
    def get_definition(self) -> ToolDefinition:
        """Return the JSON schema representation of the tool."""
        pass

    @abstractmethod
    async def execute(self, **kwargs: Any) -> ToolResult:
        """Execute the tool with supplied keyword arguments."""
        pass


class BaseToolRegistry(ABC):
    """Interface for discovering and invoking tools safely."""

    @abstractmethod
    def register(self, tool: BaseTool) -> None:
        """Register a new tool instance."""
        pass

    @abstractmethod
    def get(self, name: str) -> Optional[BaseTool]:
        """Retrieve a registered tool by name."""
        pass

    @abstractmethod
    def list_tools(self) -> List[ToolDefinition]:
        """List schema definitions of all registered tools."""
        pass

    @abstractmethod
    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Validate parameters and invoke a registered tool."""
        pass
