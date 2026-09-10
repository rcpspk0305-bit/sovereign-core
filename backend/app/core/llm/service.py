"""Typed Service Abstraction for Language Model Operations.

This service acts as the boundary between application features (Chat,
Agents, RAG, API endpoints) and specific LLM provider implementations (such as Ollama).
"""

import logging
import time
from typing import Any, AsyncIterator, List, Optional

from fastapi import Depends

from app.config import settings
from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    LLMHealthStatus,
    LLMResponse,
    LLMValidationError,
    ModelInfo,
    StreamChunk,
)
from app.core.llm.ollama import OllamaClient
from app.core.telemetry import (
    trace_llm,
    trace_embedding,
    record_llm_request,
)

logger = logging.getLogger("sovereign.llm.service")


class LLMService:
    """High-level typed service decoupling the application from specific LLM providers."""

    def __init__(self, provider: BaseLLMClient) -> None:
        self._provider = provider

    @property
    def provider(self) -> BaseLLMClient:
        return self._provider

    async def complete(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Execute a non-streaming chat completion with validation and logging."""
        if not messages:
            raise LLMValidationError("At least one message is required for completion")

        target_model = model or settings.DEFAULT_MODEL
        logger.debug(
            "Service dispatching complete: provider=%s model=%s messages=%d",
            type(self._provider).__name__,
            target_model,
            len(messages),
        )
        start_time = time.perf_counter()
        with trace_llm(model=target_model, stream=False) as span:
            try:
                res = await self._provider.complete(
                    messages=messages,
                    model=target_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                )
                dur = time.perf_counter() - start_time
                record_llm_request(model=target_model, latency_seconds=dur, success=True)
                if res.usage:
                    span.set_attribute("llm.total_tokens", res.usage.total_tokens)
                return res
            except Exception as e:
                dur = time.perf_counter() - start_time
                record_llm_request(model=target_model, latency_seconds=dur, success=False, error_type=type(e).__name__)
                raise

    async def stream(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Execute a streaming chat completion yielding chunks."""
        if not messages:
            raise LLMValidationError("At least one message is required for streaming")

        target_model = model or settings.DEFAULT_MODEL
        logger.debug(
            "Service dispatching stream: provider=%s model=%s messages=%d",
            type(self._provider).__name__,
            target_model,
            len(messages),
        )
        async for chunk in self._provider.stream(
            messages=messages,
            model=target_model,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        ):
            yield chunk

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        """Compute embeddings for a list of string inputs."""
        if not texts:
            return []
        target_model = model or settings.DEFAULT_EMBEDDING_MODEL
        with trace_embedding(model=target_model, chunk_count=len(texts)):
            return await self._provider.embed(texts=texts, model=target_model, **kwargs)

    async def list_models(self) -> List[ModelInfo]:
        """Retrieve available models from the configured provider."""
        return await self._provider.list_models()

    async def check_health(self) -> LLMHealthStatus:
        """Perform a structured diagnostic health check on the provider."""
        return await self._provider.health_check()

    async def is_model_available(self, model_name: str) -> bool:
        """Check whether a specific model name is available in the provider."""
        try:
            models = await self.list_models()
            clean_target = model_name.strip().lower()
            return any(
                clean_target == m.id.lower()
                or clean_target == m.name.lower()
                or clean_target.split(":")[0] == m.name.split(":")[0]
                for m in models
            )
        except Exception as exc:
            logger.warning("Failed to check model availability for '%s': %s", model_name, exc)
            return False


# Singleton provider factory for dependency injection
_shared_ollama_provider: Optional[BaseLLMClient] = None


def get_llm_provider() -> BaseLLMClient:
    """Dependency provider returning the configured active LLM client."""
    global _shared_ollama_provider
    if _shared_ollama_provider is None:
        _shared_ollama_provider = OllamaClient()
    return _shared_ollama_provider


def get_llm_service(
    provider: BaseLLMClient = Depends(get_llm_provider),
) -> LLMService:
    """FastAPI dependency for accessing the typed LLM service."""
    return LLMService(provider=provider)
