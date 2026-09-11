"""Unit tests for concrete OllamaClient provider."""

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.core.interfaces.llm import (
    ChatMessage,
    ChatRole,
    LLMConnectionError,
    LLMModelNotFoundError,
    LLMResponseError,
    LLMTimeoutError,
    LLMValidationError,
)
from app.core.llm.ollama import OllamaClient


@pytest.mark.asyncio
async def test_ollama_empty_messages_validation():
    client = OllamaClient(default_model="gemma4:e2b")
    with pytest.raises(LLMValidationError):
        await client.complete(messages=[])

    with pytest.raises(LLMValidationError):
        async for _ in client.stream(messages=[]):
            pass


@pytest.mark.asyncio
async def test_ollama_complete_success():
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b")

    mock_response_data = {
        "model": "gemma4:e2b",
        "message": {"role": "assistant", "content": "Gemma is running."},
        "done": True,
        "done_reason": "stop",
        "prompt_eval_count": 8,
        "eval_count": 12,
    }

    req = httpx.Request("POST", "http://mock-ollama:11434/api/chat")
    mock_resp = httpx.Response(200, json=mock_response_data, request=req)
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        messages = [ChatMessage(role=ChatRole.USER, content="Hello")]
        res = await client.complete(messages=messages)

        assert res.content == "Gemma is running."
        assert res.model == "gemma4:e2b"
        assert res.usage.prompt_tokens == 8
        assert res.usage.completion_tokens == 12
        assert res.usage.total_tokens == 20
        assert res.latency_ms is not None


@pytest.mark.asyncio
async def test_ollama_stream_success():
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b")

    lines = [
        json.dumps({"message": {"content": "Hello "}, "done": False}),
        json.dumps({"message": {"content": "world!"}, "done": True, "done_reason": "stop"}),
    ]

    async def mock_aiter_lines():
        for line in lines:
            yield line

    mock_stream_response = AsyncMock()
    mock_stream_response.raise_for_status = lambda: None
    mock_stream_response.aiter_lines = mock_aiter_lines

    mock_stream_context = AsyncMock()
    mock_stream_context.__aenter__.return_value = mock_stream_response
    mock_stream_context.__aexit__.return_value = None

    with patch("httpx.AsyncClient.stream", return_value=mock_stream_context):
        messages = [ChatMessage(role=ChatRole.USER, content="Say hello")]
        chunks = []
        async for chunk in client.stream(messages=messages):
            chunks.append(chunk)

        assert len(chunks) == 2
        assert chunks[0].content == "Hello "
        assert chunks[0].done is False
        assert chunks[1].content == "world!"
        assert chunks[1].done is True
        assert chunks[1].finish_reason == "stop"


@pytest.mark.asyncio
async def test_ollama_timeout_error():
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b", timeout=5.0)

    with patch("httpx.AsyncClient.post", side_effect=httpx.ReadTimeout("Read timed out")):
        messages = [ChatMessage(role=ChatRole.USER, content="Timeout prompt")]
        with pytest.raises(LLMTimeoutError) as exc_info:
            await client.complete(messages=messages)

        assert exc_info.value.timeout_seconds == 5.0
        assert exc_info.value.provider == "ollama"
        assert exc_info.value.model == "gemma4:e2b"


@pytest.mark.asyncio
async def test_ollama_connection_error():
    client = OllamaClient(base_url="http://unreachable-host:11434", default_model="gemma4:e2b")

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")):
        messages = [ChatMessage(role=ChatRole.USER, content="Hello")]
        with pytest.raises(LLMConnectionError) as exc_info:
            await client.complete(messages=messages)

        assert exc_info.value.provider == "ollama"


@pytest.mark.asyncio
async def test_ollama_model_not_found_error():
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="nonexistent:model")

    request = httpx.Request("POST", "http://mock-ollama:11434/api/chat")
    mock_resp = httpx.Response(404, json={"error": "model 'nonexistent:model' not found"}, request=request)

    with patch("httpx.AsyncClient.post", side_effect=httpx.HTTPStatusError("Not found", request=request, response=mock_resp)):
        messages = [ChatMessage(role=ChatRole.USER, content="Hello")]
        with pytest.raises(LLMModelNotFoundError) as exc_info:
            await client.complete(messages=messages)

        assert exc_info.value.model == "nonexistent:model"
        assert exc_info.value.provider == "ollama"


@pytest.mark.asyncio
async def test_ollama_server_500_error():
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b")

    request = httpx.Request("POST", "http://mock-ollama:11434/api/chat")
    mock_resp = httpx.Response(500, json={"error": "internal CUDA failure"}, request=request)

    with patch("httpx.AsyncClient.post", side_effect=httpx.HTTPStatusError("Internal error", request=request, response=mock_resp)):
        messages = [ChatMessage(role=ChatRole.USER, content="Hello")]
        with pytest.raises(LLMResponseError) as exc_info:
            await client.complete(messages=messages)

        assert exc_info.value.status_code == 500
        assert "internal CUDA failure" in exc_info.value.message


@pytest.mark.asyncio
async def test_ollama_health_check_healthy():
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b")

    req = httpx.Request("GET", "http://mock-ollama:11434/api/tags")
    mock_resp = httpx.Response(
        200,
        json={"models": [{"name": "gemma4:e2b", "model": "gemma4:e2b"}, {"name": "nomic-embed-text:latest"}]},
        request=req,
    )
    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        status = await client.health_check()
        assert status.is_alive is True
        assert status.default_model == "gemma4:e2b"
        assert status.default_model_available is True
        assert "gemma4:e2b" in status.available_models
        assert status.latency_ms is not None


@pytest.mark.asyncio
async def test_ollama_health_check_unreachable():
    client = OllamaClient(base_url="http://unreachable:11434", default_model="gemma4:e2b")

    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("Daemon down")):
        status = await client.health_check()
        assert status.is_alive is False
        assert status.default_model_available is False
        assert status.error is not None


@pytest.mark.asyncio
async def test_ollama_thinking_model_fallback_complete():
    """Verify that reasoning models emitting 'thinking' without 'content' retain their output."""
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b")

    mock_response_data = {
        "model": "gemma4:e2b",
        "message": {
            "role": "assistant",
            "content": "",
            "thinking": "Step 1: Analyze question. Step 2: Formulate answer.",
        },
        "done": True,
        "done_reason": "length",
        "prompt_eval_count": 10,
        "eval_count": 25,
    }

    req = httpx.Request("POST", "http://mock-ollama:11434/api/chat")
    mock_resp = httpx.Response(200, json=mock_response_data, request=req)
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        messages = [ChatMessage(role=ChatRole.USER, content="Explain")]
        res = await client.complete(messages=messages)

        assert res.content == "Step 1: Analyze question. Step 2: Formulate answer."
        assert res.finish_reason == "length"


@pytest.mark.asyncio
async def test_ollama_thinking_model_fallback_stream():
    """Verify that streaming chunks from reasoning models yield thinking output when content is empty."""
    client = OllamaClient(base_url="http://mock-ollama:11434", default_model="gemma4:e2b")

    lines = [
        json.dumps({"message": {"content": "", "thinking": "Thinking... "}, "done": False}),
        json.dumps({"message": {"content": "Final answer."}, "done": True, "done_reason": "stop"}),
    ]

    async def mock_aiter_lines():
        for line in lines:
            yield line

    mock_stream_response = AsyncMock()
    mock_stream_response.raise_for_status = lambda: None
    mock_stream_response.aiter_lines = mock_aiter_lines

    mock_stream_context = AsyncMock()
    mock_stream_context.__aenter__.return_value = mock_stream_response
    mock_stream_context.__aexit__.return_value = None

    with patch("httpx.AsyncClient.stream", return_value=mock_stream_context):
        messages = [ChatMessage(role=ChatRole.USER, content="Hello")]
        chunks = []
        async for chunk in client.stream(messages=messages):
            chunks.append(chunk)

        assert len(chunks) == 2
        assert chunks[0].content == "Thinking... "
        assert chunks[1].content == "Final answer."
