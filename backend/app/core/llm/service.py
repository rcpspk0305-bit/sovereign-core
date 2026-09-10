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
    LLMConnectionError,
    LLMError,
    LLMHealthStatus,
    LLMModelNotFoundError,
    LLMResponse,
    LLMSecurityError,
    LLMValidationError,
    ModelInfo,
    StreamChunk,
)
from app.core.llm.adapters import create_llm_provider
from app.core.llm.ollama import OllamaClient
from app.core.llm.security import is_remote_model_or_provider
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
        """Execute a non-streaming chat completion with validation, telemetry, and safe local fallback."""
        if not messages:
            raise LLMValidationError("At least one message is required for completion")

        target_model = model or getattr(settings, "LLM_MODEL", settings.DEFAULT_MODEL)
        provider_name = getattr(self._provider, "name", "unknown")
        is_local = not is_remote_model_or_provider(target_model, provider_name)

        logger.debug(
            "Service dispatching complete: provider=%s model=%s local=%s messages=%d",
            provider_name,
            target_model,
            is_local,
            len(messages),
        )
        start_time = time.perf_counter()

        with trace_llm(model=target_model, stream=False) as span:
            span.set_attribute("llm.provider", provider_name)
            span.set_attribute("llm.is_local", is_local)

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
                    span.set_attribute("llm.prompt_tokens", res.usage.prompt_tokens)
                    span.set_attribute("llm.completion_tokens", res.usage.completion_tokens)
                return res
            except (LLMConnectionError, LLMModelNotFoundError) as exc:
                # Safe Local Fallback: never fall back to cloud, only to local DEFAULT_MODEL
                fallback_model = settings.DEFAULT_MODEL
                if target_model != fallback_model:
                    logger.warning(
                        "Model '%s' failed on provider '%s': %s. Executing safe fallback to local model '%s'.",
                        target_model,
                        provider_name,
                        exc,
                        fallback_model,
                    )
                    span.set_attribute("llm.fallback", True)
                    span.set_attribute("llm.fallback_target", fallback_model)
                    res = await self._provider.complete(
                        messages=messages,
                        model=fallback_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **kwargs,
                    )
                    dur = time.perf_counter() - start_time
                    record_llm_request(model=fallback_model, latency_seconds=dur, success=True)
                    return res
                raise
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
        """Execute a streaming chat completion yielding normalized StreamChunks."""
        if not messages:
            raise LLMValidationError("At least one message is required for streaming")

        target_model = model or getattr(settings, "LLM_MODEL", settings.DEFAULT_MODEL)
        provider_name = getattr(self._provider, "name", "unknown")
        is_local = not is_remote_model_or_provider(target_model, provider_name)

        logger.debug(
            "Service dispatching stream: provider=%s model=%s local=%s messages=%d",
            provider_name,
            target_model,
            is_local,
            len(messages),
        )

        with trace_llm(model=target_model, stream=True) as span:
            span.set_attribute("llm.provider", provider_name)
            span.set_attribute("llm.is_local", is_local)

            try:
                async for chunk in self._provider.stream(
                    messages=messages,
                    model=target_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                ):
                    yield chunk
            except (LLMConnectionError, LLMModelNotFoundError) as exc:
                fallback_model = settings.DEFAULT_MODEL
                if target_model != fallback_model:
                    logger.warning(
                        "Streaming model '%s' failed on provider '%s': %s. Executing safe fallback to local model '%s'.",
                        target_model,
                        provider_name,
                        exc,
                        fallback_model,
                    )
                    span.set_attribute("llm.fallback", True)
                    span.set_attribute("llm.fallback_target", fallback_model)
                    async for chunk in self._provider.stream(
                        messages=messages,
                        model=fallback_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **kwargs,
                    ):
                        yield chunk
                else:
                    raise

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
                or clean_target.split("/")[-1] == m.id.lower().split("/")[-1]
                for m in models
            )
        except Exception as exc:
            logger.warning("Failed to check model availability for '%s': %s", model_name, exc)
            return False


# Singleton provider instance cache
_active_provider_instance: Optional[BaseLLMClient] = None
_active_provider_name: Optional[str] = None


def get_llm_provider() -> BaseLLMClient:
    """Dependency provider returning the configured active LLM client adapter."""
    global _active_provider_instance, _active_provider_name
    current_provider_config = getattr(settings, "LLM_PROVIDER", "ollama").strip().lower()

    if _active_provider_instance is None or _active_provider_name != current_provider_config:
        _active_provider_instance = create_llm_provider(current_provider_config)
        _active_provider_name = current_provider_config

    return _active_provider_instance


def get_llm_service(
    provider: BaseLLMClient = Depends(get_llm_provider),
) -> LLMService:
    """FastAPI dependency for accessing the typed LLM service."""
    return LLMService(provider=provider)
