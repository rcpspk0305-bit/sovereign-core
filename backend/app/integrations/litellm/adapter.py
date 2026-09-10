"""LiteLLM Adapter implementing BaseLLMClient for multi-provider routing."""

import importlib.util
import logging
import time
from typing import Any, AsyncIterator, Dict, List, Optional

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
    LLMTimeoutError,
    LLMUsage,
    LLMValidationError,
    ModelInfo,
    StreamChunk,
)
from app.core.llm.security import (
    is_remote_model_or_provider,
    validate_llm_request_security,
)
from app.integrations.base import (
    BaseIntegrationAdapter,
    validate_local_endpoint,
)

logger = logging.getLogger("sovereign.llm.litellm")


class LiteLLMClientAdapter(BaseLLMClient, BaseIntegrationAdapter):
    """Adapter for LiteLLM unified interface, strictly enforcing local sovereignty."""

    def __init__(
        self,
        api_base: Optional[str] = None,
        default_model: Optional[str] = None,
        enabled: Optional[bool] = None,
    ) -> None:
        self.api_base = api_base or settings.LITELLM_API_BASE
        self.default_model = default_model or settings.LITELLM_DEFAULT_MODEL
        self._enabled = enabled
        if getattr(settings, "LOCAL_ONLY", True):
            validate_local_endpoint(self.api_base)

    @property
    def name(self) -> str:
        return "litellm"

    def is_enabled(self) -> bool:
        if self._enabled is not None:
            return self._enabled
        return bool(
            settings.ENABLE_LITELLM
            or getattr(settings, "LLM_PROVIDER", "").lower() == "litellm"
        )

    def is_available(self) -> bool:
        return importlib.util.find_spec("litellm") is not None

    def _format_messages(self, messages: List[ChatMessage]) -> List[Dict[str, str]]:
        return [{"role": m.role.value, "content": m.content} for m in messages]

    def _map_litellm_exception(self, exc: Exception, model: str) -> LLMError:
        """Map LiteLLM or transport exceptions to Sovereign-Core typed domain exceptions."""
        if isinstance(exc, (LLMSecurityError, LLMValidationError)):
            return exc

        err_str = str(exc).lower()
        if "rate limit" in err_str or "timeout" in err_str:
            return LLMTimeoutError(
                f"LiteLLM timeout/rate-limit error: {exc}",
                provider="litellm",
                model=model,
            )
        if "not found" in err_str or "does not exist" in err_str:
            return LLMModelNotFoundError(
                f"LiteLLM model '{model}' not found: {exc}",
                provider="litellm",
                model=model,
            )
        if "authentication" in err_str or "api_key" in err_str or "unauthorized" in err_str:
            return LLMValidationError(
                f"LiteLLM authentication/key error: {exc}",
                provider="litellm",
                model=model,
            )

        return LLMConnectionError(
            f"LiteLLM invocation error: {exc}",
            provider="litellm",
            model=model,
        )

    async def complete(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        self.check_ready()
        import litellm  # type: ignore

        chosen_model = model or self.default_model

        # 1. Enforce local-only and security policies BEFORE sending any data
        validate_llm_request_security(
            model=chosen_model,
            provider="litellm",
            api_base=self.api_base if not is_remote_model_or_provider(chosen_model) else None,
        )

        formatted_messages = self._format_messages(messages)
        start_time = time.perf_counter()

        try:
            extra_kwargs: Dict[str, Any] = {}
            if not is_remote_model_or_provider(chosen_model):
                extra_kwargs["api_base"] = self.api_base

            resp = await litellm.acompletion(
                model=chosen_model,
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **extra_kwargs,
                **kwargs,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000.0
            content = resp.choices[0].message.content or ""
            finish_reason = getattr(resp.choices[0], "finish_reason", "stop")

            usage_obj = getattr(resp, "usage", None)
            usage = LLMUsage(
                prompt_tokens=getattr(usage_obj, "prompt_tokens", 0) if usage_obj else 0,
                completion_tokens=getattr(usage_obj, "completion_tokens", 0) if usage_obj else 0,
                total_tokens=getattr(usage_obj, "total_tokens", 0) if usage_obj else 0,
            )

            return LLMResponse(
                content=content,
                model=chosen_model,
                finish_reason=finish_reason,
                usage=usage,
                latency_ms=latency_ms,
            )
        except Exception as ex:
            mapped = self._map_litellm_exception(ex, chosen_model)
            logger.error("LiteLLM completion failed for model '%s': %s", chosen_model, mapped)
            raise mapped from ex

    async def stream(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        self.check_ready()
        import litellm  # type: ignore

        chosen_model = model or self.default_model

        # Enforce sovereignty boundary before opening stream
        validate_llm_request_security(
            model=chosen_model,
            provider="litellm",
            api_base=self.api_base if not is_remote_model_or_provider(chosen_model) else None,
        )

        formatted_messages = self._format_messages(messages)

        try:
            extra_kwargs: Dict[str, Any] = {}
            if not is_remote_model_or_provider(chosen_model):
                extra_kwargs["api_base"] = self.api_base

            response_stream = await litellm.acompletion(
                model=chosen_model,
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                **extra_kwargs,
                **kwargs,
            )

            emitted_done = False
            async for chunk in response_stream:
                choices = getattr(chunk, "choices", [])
                if not choices:
                    continue
                choice = choices[0]
                delta = getattr(choice, "delta", None)
                delta_content = getattr(delta, "content", "") or ""
                finish_reason = getattr(choice, "finish_reason", None)
                done = bool(finish_reason)

                if done:
                    emitted_done = True

                yield StreamChunk(
                    content=delta_content,
                    done=done,
                    model=chosen_model,
                    finish_reason=finish_reason,
                )

            if not emitted_done:
                yield StreamChunk(
                    content="",
                    done=True,
                    model=chosen_model,
                    finish_reason="stop",
                )

        except Exception as ex:
            mapped = self._map_litellm_exception(ex, chosen_model)
            logger.error("LiteLLM stream failed for model '%s': %s", chosen_model, mapped)
            raise mapped from ex

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        self.check_ready()
        import litellm  # type: ignore

        chosen_model = model or "ollama/nomic-embed-text"
        validate_llm_request_security(
            model=chosen_model,
            provider="litellm",
            api_base=self.api_base if not is_remote_model_or_provider(chosen_model) else None,
        )

        try:
            extra_kwargs: Dict[str, Any] = {}
            if not is_remote_model_or_provider(chosen_model):
                extra_kwargs["api_base"] = self.api_base

            resp = await litellm.aembedding(
                model=chosen_model,
                input=texts,
                **extra_kwargs,
                **kwargs,
            )
            return [item["embedding"] for item in resp.data]
        except Exception as ex:
            mapped = self._map_litellm_exception(ex, chosen_model)
            raise mapped from ex

    async def list_models(self) -> List[ModelInfo]:
        """List locally available models and catalog remote models with their status."""
        self.check_ready()
        models: List[ModelInfo] = [
            ModelInfo(
                id=self.default_model,
                name=f"{self.default_model} (Local LiteLLM)",
                provider="litellm",
                is_local=True,
                status="READY",
                capabilities=["chat", "streaming", "embeddings"],
                context_window=8192,
            )
        ]

        # Check local-only policy to determine remote model visibility/status
        is_local_only = getattr(settings, "LOCAL_ONLY", True)

        openai_status = "DISABLED" if is_local_only else ("READY" if getattr(settings, "OPENAI_API_KEY", None) else "UNCONFIGURED")
        anthropic_status = "DISABLED" if is_local_only else ("READY" if getattr(settings, "ANTHROPIC_API_KEY", None) else "UNCONFIGURED")

        models.append(
            ModelInfo(
                id="openai/gpt-4o",
                name="GPT-4o (Omni Architecture)",
                provider="openai",
                is_local=False,
                status=openai_status,
                capabilities=["chat", "streaming", "vision"],
                context_window=128000,
            )
        )
        models.append(
            ModelInfo(
                id="anthropic/claude-3-5-sonnet",
                name="Claude 3.5 Sonnet",
                provider="anthropic",
                is_local=False,
                status=anthropic_status,
                capabilities=["chat", "streaming", "analysis"],
                context_window=200000,
            )
        )

        return models

    async def health(self) -> bool:
        if not self.is_enabled() or not self.is_available():
            return False
        return True

    async def health_check(self) -> LLMHealthStatus:
        alive = await self.health()
        return LLMHealthStatus(
            is_alive=alive,
            provider="litellm",
            default_model=self.default_model,
            default_model_available=alive,
            available_models=[self.default_model] if alive else [],
        )
