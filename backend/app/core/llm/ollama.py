"""Concrete Ollama LLM provider implementing BaseLLMClient."""

import json
import logging
import time
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from app.config import settings
from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    LLMConnectionError,
    LLMError,
    LLMHealthStatus,
    LLMModelNotFoundError,
    LLMResponse,
    LLMResponseError,
    LLMTimeoutError,
    LLMUsage,
    LLMValidationError,
    ModelInfo,
    StreamChunk,
)

logger = logging.getLogger("sovereign.llm.ollama")


class OllamaClient(BaseLLMClient):
    """Async client for interacting with a local Ollama daemon."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: Optional[float] = None,
        connect_timeout: float = 5.0,
    ) -> None:
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.default_model = default_model or settings.DEFAULT_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS
        self.connect_timeout = connect_timeout

    @property
    def name(self) -> str:
        return "ollama"

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=self.connect_timeout),
        )

    def _handle_exception(self, exc: Exception, model: Optional[str] = None) -> None:
        """Map raw transport and HTTP errors to typed LLM domain exceptions."""
        if isinstance(exc, LLMError):
            raise exc

        if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException)):
            logger.error(
                "Ollama request timeout [model=%s, timeout=%ss]: %s",
                model,
                self.timeout,
                exc,
            )
            raise LLMTimeoutError(
                f"Ollama request timed out after {self.timeout}s: {exc}",
                timeout_seconds=self.timeout,
                provider="ollama",
                model=model,
            ) from exc

        if isinstance(exc, (httpx.ConnectError, httpx.NetworkError)):
            logger.error("Ollama connection failed [url=%s]: %s", self.base_url, exc)
            raise LLMConnectionError(
                f"Could not connect to Ollama daemon at {self.base_url}: {exc}",
                provider="ollama",
                model=model,
            ) from exc

        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            error_detail = ""
            try:
                data = exc.response.json()
                error_detail = data.get("error", exc.response.text)
            except Exception:
                error_detail = exc.response.text

            logger.error(
                "Ollama returned HTTP error [status=%s, model=%s]: %s",
                status,
                model,
                error_detail,
            )

            if status == 404:
                raise LLMModelNotFoundError(
                    f"Model '{model}' not found in Ollama: {error_detail}",
                    provider="ollama",
                    model=model,
                    details={"status_code": status},
                ) from exc

            raise LLMResponseError(
                f"Ollama error (HTTP {status}): {error_detail}",
                status_code=status,
                provider="ollama",
                model=model,
                details={"response": error_detail},
            ) from exc

        logger.error("Unexpected error in Ollama client [model=%s]: %s", model, exc)
        raise LLMError(
            f"Ollama unexpected error: {exc}",
            provider="ollama",
            model=model,
        ) from exc

    async def complete(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Execute a non-streaming chat completion."""
        if not messages:
            raise LLMValidationError("Chat messages list cannot be empty", provider="ollama")

        target_model = model or self.default_model
        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": [m.model_dump(exclude_none=True) for m in messages],
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        payload["options"].update(kwargs.get("options", {}))

        logger.info(
            "Executing Ollama completion [model=%s, messages=%d, temperature=%.2f]",
            target_model,
            len(messages),
            temperature,
        )
        start_time = time.perf_counter()

        try:
            async with self._get_client() as client:
                response = await client.post("/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            self._handle_exception(exc, model=target_model)

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        message = data.get("message", {})
        content = message.get("content", "")
        if not content and message.get("thinking"):
            content = message.get("thinking", "")
        prompt_tokens = data.get("prompt_eval_count", 0)
        completion_tokens = data.get("eval_count", 0)
        usage = LLMUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )

        logger.info(
            "Completed Ollama generation [model=%s, tokens=%d, latency=%.1fms]",
            target_model,
            usage.total_tokens,
            latency_ms,
        )

        return LLMResponse(
            content=content,
            model=target_model,
            finish_reason=data.get("done_reason", "stop"),
            usage=usage,
            latency_ms=round(latency_ms, 2),
            raw_response=data,
        )

    async def stream(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Execute a streaming chat completion emitting StreamChunks."""
        if not messages:
            raise LLMValidationError("Chat messages list cannot be empty", provider="ollama")

        target_model = model or self.default_model
        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": [m.model_dump(exclude_none=True) for m in messages],
            "stream": True,
            "options": {
                "temperature": temperature,
            },
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        payload["options"].update(kwargs.get("options", {}))

        logger.info("Opening Ollama stream [model=%s, messages=%d]", target_model, len(messages))

        try:
            async with self._get_client() as client:
                async with client.stream("POST", "/api/chat", json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk_data = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        content = chunk_data.get("message", {}).get("content", "")
                        if not content and chunk_data.get("message", {}).get("thinking"):
                            content = chunk_data.get("message", {}).get("thinking", "")
                        done = chunk_data.get("done", False)
                        yield StreamChunk(
                            content=content,
                            done=done,
                            model=target_model,
                            finish_reason=chunk_data.get("done_reason") if done else None,
                        )
        except Exception as exc:
            self._handle_exception(exc, model=target_model)

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        """Generate embedding vectors using Ollama /api/embed with fallback."""
        if not texts:
            return []

        target_model = model or settings.DEFAULT_EMBEDDING_MODEL
        embeddings: List[List[float]] = []

        try:
            async with self._get_client() as client:
                # First attempt /api/embed (modern Ollama API)
                try:
                    response = await client.post(
                        "/api/embed",
                        json={"model": target_model, "input": texts},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return data.get("embeddings", [])
                except Exception:
                    pass

                # Fallback to single-item /api/embeddings
                for text in texts:
                    res = await client.post(
                        "/api/embeddings",
                        json={"model": target_model, "prompt": text},
                    )
                    res.raise_for_status()
                    data = res.json()
                    embeddings.append(data.get("embedding", []))
            return embeddings
        except Exception as exc:
            self._handle_exception(exc, model=target_model)
            return []

    async def list_models(self) -> List[ModelInfo]:
        """Query local Ollama daemon for installed models."""
        try:
            async with self._get_client() as client:
                response = await client.get("/api/tags")
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            self._handle_exception(exc, model=None)

        models: List[ModelInfo] = []
        for item in data.get("models", []):
            models.append(
                ModelInfo(
                    id=item.get("model", item.get("name", "unknown")),
                    name=item.get("name", "unknown"),
                    size_bytes=item.get("size"),
                    digest=item.get("digest"),
                    modified_at=item.get("modified_at"),
                    details=item.get("details"),
                )
            )
        return models

    async def health(self) -> bool:
        """Simple boolean reachability check."""
        try:
            async with self._get_client() as client:
                res = await client.get("/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def health_check(self) -> LLMHealthStatus:
        """Detailed health diagnostic checking connection, latency, and default model presence."""
        start_time = time.perf_counter()
        try:
            async with self._get_client() as client:
                res = await client.get("/api/tags")
                latency_ms = (time.perf_counter() - start_time) * 1000.0
                if res.status_code != 200:
                    return LLMHealthStatus(
                        is_alive=False,
                        provider="ollama",
                        default_model=self.default_model,
                        default_model_available=False,
                        latency_ms=round(latency_ms, 2),
                        error=f"Ollama returned HTTP {res.status_code}",
                    )
                data = res.json()
                installed_models = [
                    item.get("name", item.get("model", ""))
                    for item in data.get("models", [])
                ]
                default_available = any(
                    self.default_model == m or self.default_model.split(":")[0] == m.split(":")[0]
                    for m in installed_models
                )
                return LLMHealthStatus(
                    is_alive=True,
                    provider="ollama",
                    default_model=self.default_model,
                    default_model_available=default_available,
                    available_models=installed_models,
                    latency_ms=round(latency_ms, 2),
                )
        except Exception as exc:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.warning("Ollama health check failed: %s", exc)
            return LLMHealthStatus(
                is_alive=False,
                provider="ollama",
                default_model=self.default_model,
                default_model_available=False,
                latency_ms=round(latency_ms, 2),
                error=str(exc),
            )
