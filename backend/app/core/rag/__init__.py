"""RAG module providing vector storage, embedding providers, PDF parsing, and chunking."""

from app.core.rag.chroma import ChromaStore, ChromaVectorStore
from app.core.rag.chunker import TextChunker
from app.core.rag.embeddings import OllamaEmbeddingProvider
from app.core.rag.in_memory import (
    InMemoryVectorStore,
    SimpleEmbeddingProvider,
    cosine_similarity,
)
from app.core.rag.migration import MigrationResult, migrate_chroma_to_qdrant
from app.core.rag.pdf_parser import PyMuPDFParser
from app.core.rag.service import get_vector_store, set_active_vector_store
from app.integrations.qdrant.adapter import QdrantRetrieverAdapter, QdrantStore

__all__ = [
    "ChromaStore",
    "ChromaVectorStore",
    "QdrantStore",
    "QdrantRetrieverAdapter",
    "get_vector_store",
    "set_active_vector_store",
    "migrate_chroma_to_qdrant",
    "MigrationResult",
    "PyMuPDFParser",
    "TextChunker",
    "OllamaEmbeddingProvider",
    "InMemoryVectorStore",
    "SimpleEmbeddingProvider",
    "cosine_similarity",
]
