"""In-memory Vector Store and Retriever implementing BaseRetriever."""

import math
from typing import Dict, List, Optional

from app.core.interfaces.rag import (
    BaseEmbeddingProvider,
    BaseRetriever,
    Document,
    SearchResult,
)


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute standard cosine similarity between two numeric vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)


class SimpleEmbeddingProvider(BaseEmbeddingProvider):
    """Fallback embedding provider producing normalized frequency vectors for local testing."""

    def __init__(self, dimension: int = 64) -> None:
        self.dimension = dimension

    def _embed_text(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        words = text.lower().split()
        if not words:
            return vec
        for word in words:
            idx = sum(ord(c) for c in word) % self.dimension
            vec[idx] += 1.0
        # Normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    async def embed_query(self, text: str) -> List[float]:
        return self._embed_text(text)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_text(t) for t in texts]


class InMemoryVectorStore(BaseRetriever):
    """Clean, high-performance in-memory vector store for local RAG retrieval."""

    def __init__(
        self,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
    ) -> None:
        self.documents: Dict[str, Document] = {}
        self.embedding_provider = embedding_provider or SimpleEmbeddingProvider()

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Index documents, computing embeddings if missing."""
        texts_to_embed: List[str] = []
        indices_to_embed: List[int] = []

        for i, doc in enumerate(documents):
            if not doc.embedding:
                texts_to_embed.append(doc.content)
                indices_to_embed.append(i)

        if texts_to_embed:
            generated_embeddings = await self.embedding_provider.embed_documents(
                texts_to_embed
            )
            for idx, emb in zip(indices_to_embed, generated_embeddings):
                documents[idx].embedding = emb

        added_ids: List[str] = []
        for doc in documents:
            self.documents[doc.id] = doc
            added_ids.append(doc.id)

        return added_ids

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        """Retrieve top-k most relevant documents via cosine similarity."""
        if not self.documents:
            return []

        query_embedding = await self.embedding_provider.embed_query(query)
        scored_results: List[SearchResult] = []

        for doc in self.documents.values():
            if not doc.embedding:
                continue
            score = cosine_similarity(query_embedding, doc.embedding)
            if score_threshold is not None and score < score_threshold:
                continue
            scored_results.append(SearchResult(document=doc, score=score))

        scored_results.sort(key=lambda x: x.score, reverse=True)
        return scored_results[:top_k]

    async def delete(self, document_ids: List[str]) -> bool:
        """Delete documents by their IDs."""
        deleted = False
        for doc_id in document_ids:
            if doc_id in self.documents:
                del self.documents[doc_id]
                deleted = True
        return deleted

    async def count(self) -> int:
        return len(self.documents)

    async def clear(self) -> bool:
        self.documents.clear()
        return True
