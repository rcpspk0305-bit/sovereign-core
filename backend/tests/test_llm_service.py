"""Unit tests for typed LLMService abstraction."""

import pytest

from app.core.interfaces.llm import (
    ChatMessage,
    ChatRole,
    LLMValidationError,
)
from app.core.llm.service import LLMService
from tests.conftest import MockLLMClient


@pytest.mark.asyncio
async def test_llm_service_complete_validation(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    with pytest.raises(LLMValidationError):
        await service.complete(messages=[])


@pytest.mark.asyncio
async def test_llm_service_complete_delegation(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    messages = [ChatMessage(role=ChatRole.USER, content="Hello")]
    response = await service.complete(messages=messages, model="gemma4:e2b")

    assert response.content == "Mocked LLM completion"
    assert response.model == "gemma4:e2b"
    assert len(mock_llm_client.call_history) == 1


@pytest.mark.asyncio
async def test_llm_service_stream_validation(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    with pytest.raises(LLMValidationError):
        async for _ in service.stream(messages=[]):
            pass


@pytest.mark.asyncio
async def test_llm_service_stream_delegation(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    messages = [ChatMessage(role=ChatRole.USER, content="Stream")]
    chunks = []
    async for chunk in service.stream(messages=messages):
        chunks.append(chunk.content)

    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_llm_service_embed(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    assert await service.embed([]) == []

    embeddings = await service.embed(["test doc"])
    assert len(embeddings) == 1
    assert len(embeddings[0]) == 16


@pytest.mark.asyncio
async def test_llm_service_health(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    health = await service.check_health()
    assert health.is_alive is True
    assert health.default_model == "gemma4:e2b"
    assert health.default_model_available is True


@pytest.mark.asyncio
async def test_llm_service_is_model_available(mock_llm_client: MockLLMClient):
    service = LLMService(provider=mock_llm_client)
    assert await service.is_model_available("gemma4:e2b") is True
    assert await service.is_model_available("gemma4") is True
    assert await service.is_model_available("GEMMA4:E2B") is True
    assert await service.is_model_available("nonexistent-model") is False
