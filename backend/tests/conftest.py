"""Test fixtures and mock providers for Sovereign-Core test suite."""

import sys
from pathlib import Path
from typing import Any, AsyncIterator, List, Optional

import pytest
from fastapi.testclient import TestClient

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.audit.logger import FileAndMemoryAuditLogger
from app.core.interfaces.llm import (
    BaseLLMClient,
    ChatMessage,
    LLMHealthStatus,
    LLMResponse,
    LLMUsage,
    ModelInfo,
    StreamChunk,
)
from app.core.llm.service import LLMService, get_llm_provider, get_llm_service
from app.core.rag.in_memory import InMemoryVectorStore, SimpleEmbeddingProvider
from app.core.tools.registry import ToolRegistry
from app.main import create_application


class MockLLMClient(BaseLLMClient):
    """Predictable mock LLM for testing contracts and routes."""

    def __init__(self, response_text: str = "Mocked LLM completion") -> None:
        self.response_text = response_text
        self.call_history: List[List[ChatMessage]] = []

    async def complete(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        self.call_history.append(messages)
        return LLMResponse(
            content=self.response_text,
            model=model or "gemma4:e2b",
            finish_reason="stop",
            usage=LLMUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
            latency_ms=12.5,
        )

    async def stream(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        self.call_history.append(messages)
        words = self.response_text.split()
        for i, word in enumerate(words):
            yield StreamChunk(
                content=word + " ",
                done=(i == len(words) - 1),
                model=model or "gemma4:e2b",
            )

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> List[List[float]]:
        provider = SimpleEmbeddingProvider(dimension=16)
        return await provider.embed_documents(texts)

    async def list_models(self) -> List[ModelInfo]:
        return [
            ModelInfo(
                id="gemma4:e2b",
                name="gemma4:e2b",
                size_bytes=7162405886,
            ),
            ModelInfo(
                id="nomic-embed-text:latest",
                name="nomic-embed-text:latest",
                size_bytes=300000000,
            ),
        ]

    async def health(self) -> bool:
        return True

    async def health_check(self) -> LLMHealthStatus:
        return LLMHealthStatus(
            is_alive=True,
            provider="mock",
            default_model="gemma4:e2b",
            default_model_available=True,
            available_models=["gemma4:e2b", "nomic-embed-text:latest"],
            latency_ms=1.5,
        )


@pytest.fixture
def mock_llm_client() -> MockLLMClient:
    return MockLLMClient()


@pytest.fixture
def mock_llm_service(mock_llm_client: MockLLMClient) -> LLMService:
    return LLMService(provider=mock_llm_client)


@pytest.fixture
def in_memory_audit_logger(tmp_path: Path) -> FileAndMemoryAuditLogger:
    return FileAndMemoryAuditLogger(
        log_dir=tmp_path,
        log_file="test_audit.jsonl",
        enabled=True,
    )


@pytest.fixture
def in_memory_vector_store() -> InMemoryVectorStore:
    return InMemoryVectorStore(embedding_provider=SimpleEmbeddingProvider(dimension=16))


@pytest.fixture
def tool_registry() -> ToolRegistry:
    return ToolRegistry()


@pytest.fixture
def test_client(
    mock_llm_client: MockLLMClient,
    in_memory_audit_logger: FileAndMemoryAuditLogger,
) -> TestClient:
    app = create_application()
    from app.api.v1.chat import get_audit_logger

    app.dependency_overrides[get_llm_provider] = lambda: mock_llm_client
    app.dependency_overrides[get_llm_service] = lambda: LLMService(mock_llm_client)
    app.dependency_overrides[get_audit_logger] = lambda: in_memory_audit_logger
    return TestClient(app)
