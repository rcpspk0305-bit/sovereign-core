"""Abstract Base Interface for Retrieval-Augmented Generation (RAG) and Vector Stores."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Document(BaseModel):
    """Representing an indexed text document or chunk."""
    id: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None


class SearchResult(BaseModel):
    """Result of a semantic search query with relevance scoring."""
    document: Document
    score: float


class BaseEmbeddingProvider(ABC):
    """Abstract interface for embedding text."""

    @abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """Generate embedding vector for a single query."""
        pass

    @abstractmethod
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for multiple text documents."""
        pass


class BaseRetriever(ABC):
    """Abstract interface for document indexing and similarity retrieval."""

    @abstractmethod
    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Index a list of documents and return their assigned IDs."""
        pass

    @abstractmethod
    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        """Retrieve the top-k most relevant documents for a query."""
        pass

    @abstractmethod
    async def delete(self, document_ids: List[str]) -> bool:
        """Remove specified documents from the vector store."""
        pass

    @abstractmethod
    async def count(self) -> int:
        """Return the total number of indexed documents."""
        pass

    @abstractmethod
    async def clear(self) -> bool:
        """Wipe all documents from the store."""
        pass
