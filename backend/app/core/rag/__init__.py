"""RAG module."""

from app.core.rag.in_memory import (
    InMemoryVectorStore,
    SimpleEmbeddingProvider,
    cosine_similarity,
)

__all__ = [
    "InMemoryVectorStore",
    "SimpleEmbeddingProvider",
    "cosine_similarity",
]
