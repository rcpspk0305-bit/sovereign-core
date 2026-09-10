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


class DimensionalityMismatchError(ValueError):
    """Raised when embedding vector dimensionality does not match the target collection."""
    pass


class VectorStoreHealth(BaseModel):
    """Strongly-typed health and status representation of a vector store backend."""
    status: str = "healthy"  # "healthy", "degraded", "unavailable"
    backend: str = "chroma"  # "chroma" or "qdrant"
    collection: str = "default"
    total_documents: int = 0
    total_vectors: int = 0
    dimension: Optional[int] = None
    endpoint: Optional[str] = None
    error: Optional[str] = None


class BaseRetriever(ABC):
    """Abstract interface for document indexing and similarity retrieval."""

    async def add(self, documents: List[Document]) -> List[str]:
        """Index a list of documents and return their assigned IDs."""
        return await self.add_documents(documents)

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
        filters: Optional[Dict[str, Any]] = None,
        collection: Optional[str] = None,
    ) -> List[SearchResult]:
        """Retrieve the top-k most relevant documents for a query with optional filters."""
        pass

    @abstractmethod
    async def delete(self, document_ids: List[str]) -> bool:
        """Remove specified documents from the vector store."""
        pass

    @abstractmethod
    async def count(self, collection: Optional[str] = None) -> int:
        """Return the total number of indexed documents."""
        pass

    @abstractmethod
    async def clear(self) -> bool:
        """Wipe all documents from the store."""
        pass

    async def health(self) -> VectorStoreHealth:
        """Return vector store health status and metadata."""
        count = await self.count()
        return VectorStoreHealth(
            status="healthy",
            backend=getattr(self, "backend_name", self.__class__.__name__),
            collection=getattr(self, "collection_name", "default"),
            total_documents=count,
            total_vectors=count,
        )

    async def list_documents(self) -> List[Dict[str, Any]]:
        """List distinct documents and aggregated chunks."""
        return []

    async def delete_document(self, filename: str) -> Dict[str, Any]:
        """Delete all chunks for a document filename."""
        return {"status": "deleted", "filename": filename, "chunks_deleted": 0}

