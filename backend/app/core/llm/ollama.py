"""Concrete Ollama LLM provider implementing BaseLLMClient."""

import json
import time
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from app.config import settings
from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    LLMResponse,
    LLMUsage,
    ModelInfo,
    StreamChunk,
)


class OllamaClient(BaseLLMClient):
    """Async client for interacting with a local Ollama daemon."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.default_model = default_model or settings.DEFAULT_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=5.0),
        )

    async def complete(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Non-streaming chat completion."""
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

        start_time = time.perf_counter()
        async with self._get_client() as client:
            response = await client.post("/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        message = data.get("message", {})
        content = message.get("content", "")
        usage = LLMUsage(
            prompt_tokens=data.get("prompt_eval_count", 0),
            completion_tokens=data.get("eval_count", 0),
            total_tokens=data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
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
        """Streaming chat completion over SSE/newline JSON."""
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

        async with self._get_client() as client:
            async with client.stream("POST", "/api/chat", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk_data = json.loads(line)
                        content = chunk_data.get("message", {}).get("content", "")
                        done = chunk_data.get("done", False)
                        yield StreamChunk(
                            content=content,
                            done=done,
                            model=target_model,
                            finish_reason=chunk_data.get("done_reason") if done else None,
                        )
                    except json.JSONDecodeError:
                        continue

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        """Generate embedding vectors using Ollama /api/embed."""
        target_model = model or settings.DEFAULT_EMBEDDING_MODEL
        embeddings: List[List[float]] = []

        async with self._get_client() as client:
            # First attempt /api/embed (Ollama v0.1.34+)
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

            # Fallback to single text /api/embeddings endpoint
            for text in texts:
                res = await client.post(
                    "/api/embeddings",
                    json={"model": target_model, "prompt": text},
                )
                res.raise_for_status()
                data = res.json()
                embeddings.append(data.get("embedding", []))

        return embeddings

    async def list_models(self) -> List[ModelInfo]:
        """Query local Ollama instance for downloaded models."""
        async with self._get_client() as client:
            response = await client.get("/api/tags")
            response.raise_for_status()
            data = response.json()

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
        """Check if local Ollama daemon is active and responding."""
        try:
            async with self._get_client() as client:
                res = await client.get("/api/tags")
                return res.status_code == 200
        except Exception:
            return False
