"""Abstract Base Interface for Language Model Providers."""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str
    name: Optional[str] = None
    tool_call_id: Optional[str] = None


class ModelInfo(BaseModel):
    id: str
    name: str
    size_bytes: Optional[int] = None
    digest: Optional[str] = None
    modified_at: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class LLMUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class LLMResponse(BaseModel):
    content: str
    model: str
    finish_reason: Optional[str] = "stop"
    usage: Optional[LLMUsage] = Field(default_factory=LLMUsage)
    latency_ms: Optional[float] = None
    raw_response: Optional[Dict[str, Any]] = None


class StreamChunk(BaseModel):
    content: str
    done: bool = False
    model: Optional[str] = None
    finish_reason: Optional[str] = None


class BaseLLMClient(ABC):
    """Clean abstract base client for local LLM inference engines."""

    @abstractmethod
    async def complete(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Execute a non-streaming chat completion."""
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Execute a streaming chat completion emitting StreamChunks."""
        pass

    @abstractmethod
    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        """Compute text embeddings for a list of string inputs."""
        pass

    @abstractmethod
    async def list_models(self) -> List[ModelInfo]:
        """Discover and list all locally installed models."""
        pass

    @abstractmethod
    async def health(self) -> bool:
        """Check if the LLM runtime is reachable and ready."""
        pass
