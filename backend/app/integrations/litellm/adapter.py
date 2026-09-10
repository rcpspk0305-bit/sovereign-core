"""LiteLLM Adapter implementing BaseLLMClient for multi-provider local routing."""

import importlib.util
from typing import Any, AsyncIterator, Dict, List, Optional

from app.config import settings
from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    LLMConnectionError,
    LLMHealthStatus,
    LLMResponse,
    LLMUsage,
    ModelInfo,
    StreamChunk,
)
from app.integrations.base import (
    BaseIntegrationAdapter,
    validate_local_endpoint,
)


class LiteLLMClientAdapter(BaseLLMClient, BaseIntegrationAdapter):
    """Adapter for LiteLLM unified interface, strictly configured for local backends."""

    def __init__(
        self,
        api_base: Optional[str] = None,
        default_model: Optional[str] = None,
    ) -> None:
        self.api_base = api_base or settings.LITELLM_API_BASE
        self.default_model = default_model or settings.LITELLM_DEFAULT_MODEL
        validate_local_endpoint(self.api_base)

    @property
    def name(self) -> str:
        return "litellm"

    def is_enabled(self) -> bool:
        return bool(settings.ENABLE_LITELLM)

    def is_available(self) -> bool:
        return importlib.util.find_spec("litellm") is not None

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
        formatted_messages = [{"role": m.role.value, "content": m.content} for m in messages]

        try:
            resp = await litellm.acompletion(
                model=chosen_model,
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                api_base=self.api_base,
                **kwargs,
            )
            content = resp.choices[0].message.content or ""
            usage = LLMUsage(
                prompt_tokens=getattr(resp.usage, "prompt_tokens", 0),
                completion_tokens=getattr(resp.usage, "completion_tokens", 0),
                total_tokens=getattr(resp.usage, "total_tokens", 0),
            )
            return LLMResponse(
                content=content,
                model=chosen_model,
                usage=usage,
            )
        except Exception as ex:
            raise LLMConnectionError(f"LiteLLM completion error: {ex}", provider="litellm", model=chosen_model)

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
        formatted_messages = [{"role": m.role.value, "content": m.content} for m in messages]

        try:
            response_stream = await litellm.acompletion(
                model=chosen_model,
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                api_base=self.api_base,
                stream=True,
                **kwargs,
            )
            async for chunk in response_stream:
                delta = chunk.choices[0].delta.content or ""
                done = bool(chunk.choices[0].finish_reason)
                yield StreamChunk(content=delta, done=done, model=chosen_model)
        except Exception as ex:
            raise LLMConnectionError(f"LiteLLM stream error: {ex}", provider="litellm", model=chosen_model)

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        self.check_ready()
        import litellm  # type: ignore

        chosen_model = model or "ollama/nomic-embed-text"
        try:
            resp = await litellm.aembedding(
                model=chosen_model,
                input=texts,
                api_base=self.api_base,
                **kwargs,
            )
            return [item["embedding"] for item in resp.data]
        except Exception as ex:
            raise LLMConnectionError(f"LiteLLM embedding error: {ex}", provider="litellm", model=chosen_model)

    async def list_models(self) -> List[ModelInfo]:
        self.check_ready()
        return [ModelInfo(id=self.default_model, name=self.default_model)]

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
