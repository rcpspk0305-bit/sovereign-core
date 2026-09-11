"""Tests verifying LLM interface contract adherence and API routing."""

import pytest
from fastapi.testclient import TestClient

from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    ChatRole,
    LLMConnectionError,
    LLMModelNotFoundError,
    LLMResponse,
    LLMTimeoutError,
)
from app.core.llm.service import LLMService, get_llm_service
from tests.conftest import MockLLMClient


@pytest.mark.asyncio
async def test_mock_llm_client_complete():
    client: BaseLLMClient = MockLLMClient("Hello from test suite")
    messages = [
        ChatMessage(role=ChatRole.USER, content="Say hello"),
    ]
    response: LLMResponse = await client.complete(messages=messages, model="gemma4:e2b")

    assert response.content == "Hello from test suite"
    assert response.model == "gemma4:e2b"
    assert response.usage is not None
    assert response.usage.total_tokens == 15
    assert response.latency_ms is not None


@pytest.mark.asyncio
async def test_mock_llm_client_stream():
    client: BaseLLMClient = MockLLMClient("Chunk1 Chunk2 Chunk3")
    messages = [ChatMessage(role=ChatRole.USER, content="Stream tokens")]

    chunks = []
    async for chunk in client.stream(messages=messages):
        chunks.append(chunk.content)

    assert len(chunks) == 3
    assert "".join(chunks).strip() == "Chunk1 Chunk2 Chunk3"


@pytest.mark.asyncio
async def test_mock_llm_client_embed():
    client: BaseLLMClient = MockLLMClient()
    embeddings = await client.embed(["test query", "another sentence"])
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 16


def test_chat_api_completion(test_client: TestClient):
    payload = {
        "messages": [
            {"role": "user", "content": "How are you?"}
        ],
        "model": "gemma4:e2b",
        "temperature": 0.5,
        "stream": False,
    }
    response = test_client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert data["model"] == "gemma4:e2b"


def test_chat_api_streaming(test_client: TestClient):
    payload = {
        "messages": [
            {"role": "user", "content": "Stream me a message"}
        ],
        "stream": True,
    }
    response = test_client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert len(response.text) > 0


def test_models_listing_endpoint(test_client: TestClient):
    response = test_client.get("/api/v1/models")
    assert response.status_code == 200
    models = response.json()
    assert isinstance(models, list)
    assert len(models) >= 1
    assert "id" in models[0]
    assert any(m["id"] == "gemma4:e2b" for m in models)


def test_chat_api_timeout_error(test_client: TestClient):
    class TimeoutClient(MockLLMClient):
        async def complete(self, *args, **kwargs):
            raise LLMTimeoutError("Inference timed out", timeout_seconds=120.0, provider="ollama", model="gemma4:e2b")

    app = test_client.app
    app.dependency_overrides[get_llm_service] = lambda: LLMService(TimeoutClient())

    payload = {"messages": [{"role": "user", "content": "Hello"}]}
    res = test_client.post("/api/v1/chat", json=payload)
    assert res.status_code == 504
    data = res.json()
    assert data["error"] == "LLMTimeoutError"
    assert data["timeout_seconds"] == 120.0


def test_chat_api_connection_error(test_client: TestClient):
    class ConnectionFailClient(MockLLMClient):
        async def complete(self, *args, **kwargs):
            raise LLMConnectionError("Failed to connect to daemon", provider="ollama", model="gemma4:e2b")

    app = test_client.app
    app.dependency_overrides[get_llm_service] = lambda: LLMService(ConnectionFailClient())

    payload = {"messages": [{"role": "user", "content": "Hello"}]}
    res = test_client.post("/api/v1/chat", json=payload)
    assert res.status_code == 503
    data = res.json()
    assert data["error"] == "LLMConnectionError"


def test_chat_api_model_not_found_error(test_client: TestClient):
    class ModelNotFoundClient(MockLLMClient):
        async def complete(self, *args, **kwargs):
            raise LLMModelNotFoundError("Model not found", provider="ollama", model="nonexistent:latest")

    app = test_client.app
    app.dependency_overrides[get_llm_service] = lambda: LLMService(ModelNotFoundClient())

    payload = {"messages": [{"role": "user", "content": "Hello"}], "model": "nonexistent:latest"}
    res = test_client.post("/api/v1/chat", json=payload)
    assert res.status_code == 404
    data = res.json()
    assert data["error"] == "LLMModelNotFoundError"


@pytest.mark.asyncio
async def test_llm_service_explicit_model_not_found_raises():
    class SelectiveFailClient(MockLLMClient):
        async def complete(self, messages, model=None, **kwargs):
            if model == "missing:model":
                raise LLMModelNotFoundError("Missing model", provider="ollama", model="missing:model")
            return LLMResponse(content="fallback ok", model=model or "default")

    svc = LLMService(SelectiveFailClient())
    # Explicit model request should raise directly without fallback
    with pytest.raises(LLMModelNotFoundError):
        await svc.complete(messages=[ChatMessage(role=ChatRole.USER, content="hi")], model="missing:model")

