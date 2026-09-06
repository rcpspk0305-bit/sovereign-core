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


class LLMHealthStatus(BaseModel):
    is_alive: bool
    provider: str
    default_model: str
    default_model_available: bool
    available_models: List[str] = Field(default_factory=list)
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class LLMError(Exception):
    """Base exception for all LLM provider and service failures."""

    def __init__(
        self,
        message: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.model = model
        self.details = details or {}


class LLMConnectionError(LLMError):
    """Raised when the LLM daemon or host cannot be reached."""
    pass


class LLMTimeoutError(LLMError):
    """Raised when an inference or network request times out."""

    def __init__(
        self,
        message: str,
        timeout_seconds: Optional[float] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message, provider=provider, model=model, details=details)
        self.timeout_seconds = timeout_seconds


class LLMModelNotFoundError(LLMError):
    """Raised when the requested model is not downloaded or available."""
    pass


class LLMResponseError(LLMError):
    """Raised when the LLM provider returns an HTTP error or malformed payload."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message, provider=provider, model=model, details=details)
        self.status_code = status_code


class LLMValidationError(LLMError):
    """Raised when prompt, parameters, or messages fail validation."""
    pass


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

    async def health_check(self) -> LLMHealthStatus:
        """Detailed health check returning latency and model availability."""
        is_ok = await self.health()
        return LLMHealthStatus(
            is_alive=is_ok,
            provider="unknown",
            default_model="unknown",
            default_model_available=is_ok,
        )
