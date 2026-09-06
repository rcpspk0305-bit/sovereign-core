"""RAG module providing vector storage, embedding providers, PDF parsing, and chunking."""

from app.core.rag.chroma import ChromaVectorStore
from app.core.rag.chunker import TextChunker
from app.core.rag.embeddings import OllamaEmbeddingProvider
from app.core.rag.in_memory import (
    InMemoryVectorStore,
    SimpleEmbeddingProvider,
    cosine_similarity,
)
from app.core.rag.pdf_parser import PyMuPDFParser

__all__ = [
    "ChromaVectorStore",
    "PyMuPDFParser",
    "TextChunker",
    "OllamaEmbeddingProvider",
    "InMemoryVectorStore",
    "SimpleEmbeddingProvider",
    "cosine_similarity",
]
