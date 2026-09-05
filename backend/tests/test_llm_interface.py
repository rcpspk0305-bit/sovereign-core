"""Tests verifying LLM interface contract adherence and API routing."""

import pytest
from fastapi.testclient import TestClient
from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    ChatRole,
    LLMResponse,
)
from tests.conftest import MockLLMClient


@pytest.mark.asyncio
async def test_mock_llm_client_complete():
    client: BaseLLMClient = MockLLMClient("Hello from test suite")
    messages = [
        ChatMessage(role=ChatRole.USER, content="Say hello"),
    ]
    response: LLMResponse = await client.complete(messages=messages, model="test-model")

    assert response.content == "Hello from test suite"
    assert response.model == "test-model"
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
        "model": "llama3.2:latest",
        "temperature": 0.5,
        "stream": False,
    }
    response = test_client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert data["model"] == "llama3.2:latest"


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
