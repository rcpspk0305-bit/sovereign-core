import heapq
import math
from typing import Any, Dict, List, Optional, Set

try:
    import numpy as np
    _NUMPY_AVAILABLE = True
except ImportError:
    _NUMPY_AVAILABLE = False

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
    """High-performance, vectorized in-memory vector store for local RAG retrieval."""

    backend_name: str = "in_memory"

    def __init__(
        self,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
    ) -> None:
        self.documents: Dict[str, Document] = {}
        self.embedding_provider = embedding_provider or SimpleEmbeddingProvider()

        # Vectorization & acceleration state
        self._doc_ids: List[str] = []
        self._doc_norms: Dict[str, float] = {}
        self._matrix: Optional[Any] = None  # np.ndarray of shape (N, D)
        self._matrix_norms: Optional[Any] = None  # np.ndarray of shape (N,)
        self._matrix_dirty: bool = False

        # Inverted index for fast O(1) document listing and targeted deletion
        self._doc_name_to_ids: Dict[str, Set[str]] = {}
        self._doc_name_to_pages: Dict[str, Set[int]] = {}

    def _sync_matrix(self) -> None:
        """Rebuild dense numpy embedding matrix if documents were modified."""
        if not _NUMPY_AVAILABLE or not self._matrix_dirty:
            return

        valid_docs = [doc for doc in self.documents.values() if doc.embedding]
        self._doc_ids = [doc.id for doc in valid_docs]

        if valid_docs:
            raw_mat = np.array([doc.embedding for doc in valid_docs], dtype=np.float64)
            norms = np.linalg.norm(raw_mat, axis=1)
            # Replace zero norms with 1.0 to prevent divide-by-zero
            norms = np.where(norms == 0.0, 1.0, norms)
            self._matrix = raw_mat
            self._matrix_norms = norms
        else:
            self._matrix = None
            self._matrix_norms = None

        self._matrix_dirty = False

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

            # Precalculate scalar norm
            if doc.embedding:
                norm_val = math.sqrt(sum(x * x for x in doc.embedding))
                self._doc_norms[doc.id] = norm_val if norm_val > 0.0 else 1.0

            # Update inverted index
            doc_name = doc.metadata.get("document_name", "unknown")
            if doc_name not in self._doc_name_to_ids:
                self._doc_name_to_ids[doc_name] = set()
                self._doc_name_to_pages[doc_name] = set()

            self._doc_name_to_ids[doc_name].add(doc.id)
            if "page_number" in doc.metadata:
                self._doc_name_to_pages[doc_name].add(doc.metadata["page_number"])

        self._matrix_dirty = True
        return added_ids

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        collection: Optional[str] = None,
        **kwargs: Any,
    ) -> List[SearchResult]:
        """Retrieve top-k most relevant documents via accelerated cosine similarity."""
        if not self.documents:
            return []

        query_embedding = await self.embedding_provider.embed_query(query)
        if not query_embedding:
            return []

        q_norm = math.sqrt(sum(x * x for x in query_embedding))
        if q_norm == 0.0:
            return []

        # Branch 1: Vectorized NumPy path (fast SIMD matrix-vector multiplication)
        if _NUMPY_AVAILABLE and not filters:
            if self._matrix_dirty or self._matrix is None:
                self._sync_matrix()

            if self._matrix is not None and len(self._doc_ids) > 0:
                q_vec = np.array(query_embedding, dtype=np.float64)
                # Compute all dot products in a single vectorized BLAS call
                dot_products = np.dot(self._matrix, q_vec)
                # Denominator: q_norm * doc_norms
                scores = dot_products / (q_norm * self._matrix_norms)

                n_items = len(self._doc_ids)
                k = min(top_k, n_items)

                if n_items <= k:
                    top_indices = np.argsort(-scores)
                else:
                    # Partition to find top-k in O(N), then sort top-k in O(k log k)
                    partitioned = np.argpartition(-scores, k)[:k]
                    top_indices = partitioned[np.argsort(-scores[partitioned])]

                results: List[SearchResult] = []
                for idx in top_indices:
                    score = float(scores[idx])
                    if score_threshold is not None and score < score_threshold:
                        continue
                    doc_id = self._doc_ids[idx]
                    doc = self.documents.get(doc_id)
                    if doc:
                        results.append(SearchResult(document=doc, score=score))

                return results

        # Branch 2: Filtered or pure-Python path with hoisted query norm and heap top-k
        scored_heap: List[tuple] = []  # min-heap storing (score, doc_id, doc)

        for doc in self.documents.values():
            if not doc.embedding:
                continue
            if filters:
                matches = True
                for k, v in filters.items():
                    if doc.metadata.get(k) != v:
                        matches = False
                        break
                if not matches:
                    continue

            # Hoisted cosine similarity: norm_a is precalculated (q_norm)
            dot_product = sum(a * b for a, b in zip(query_embedding, doc.embedding))
            norm_b = self._doc_norms.get(doc.id)
            if norm_b is None:
                norm_b = math.sqrt(sum(b * b for b in doc.embedding))
                self._doc_norms[doc.id] = norm_b if norm_b > 0.0 else 1.0

            if norm_b == 0.0:
                continue

            score = dot_product / (q_norm * norm_b)
            if score_threshold is not None and score < score_threshold:
                continue

            # Maintain top-k via min-heap in O(N log k)
            if len(scored_heap) < top_k:
                heapq.heappush(scored_heap, (score, doc.id, doc))
            elif score > scored_heap[0][0]:
                heapq.heapreplace(scored_heap, (score, doc.id, doc))

        # Sort descending
        scored_heap.sort(key=lambda x: x[0], reverse=True)
        return [SearchResult(document=item[2], score=item[0]) for item in scored_heap]

    async def list_documents(self) -> List[Dict[str, Any]]:
        """List distinct documents and aggregated chunks via inverted index in O(num_files)."""
        if self._doc_name_to_ids:
            return [
                {
                    "filename": name,
                    "total_chunks": len(chunk_ids),
                    "pages": len(self._doc_name_to_pages.get(name, set())) or 1,
                }
                for name, chunk_ids in self._doc_name_to_ids.items()
            ]

        # Fallback if inverted index is empty
        docs_map: Dict[str, Dict[str, Any]] = {}
        for doc in self.documents.values():
            name = doc.metadata.get("document_name", "unknown")
            if name not in docs_map:
                docs_map[name] = {"filename": name, "total_chunks": 0, "pages": set()}
            docs_map[name]["total_chunks"] += 1
            if "page_number" in doc.metadata:
                docs_map[name]["pages"].add(doc.metadata["page_number"])

        return [
            {
                "filename": k,
                "total_chunks": v["total_chunks"],
                "pages": len(v["pages"]) if v["pages"] else 1,
            }
            for k, v in docs_map.items()
        ]

    async def delete_document(self, filename: str) -> Dict[str, Any]:
        """Delete all chunks for a document filename using inverted index."""
        ids_to_del = list(self._doc_name_to_ids.get(filename, []))
        if not ids_to_del:
            ids_to_del = [
                d_id for d_id, doc in self.documents.items()
                if doc.metadata.get("document_name") == filename
            ]

        await self.delete(ids_to_del)
        self._doc_name_to_ids.pop(filename, None)
        self._doc_name_to_pages.pop(filename, None)
        return {"status": "deleted", "filename": filename, "chunks_deleted": len(ids_to_del)}

    async def delete(self, document_ids: List[str]) -> bool:
        """Delete documents by their IDs."""
        deleted = False
        for doc_id in document_ids:
            doc = self.documents.pop(doc_id, None)
            if doc is not None:
                deleted = True
                self._doc_norms.pop(doc_id, None)
                doc_name = doc.metadata.get("document_name")
                if doc_name and doc_name in self._doc_name_to_ids:
                    self._doc_name_to_ids[doc_name].discard(doc_id)
                    if not self._doc_name_to_ids[doc_name]:
                        self._doc_name_to_ids.pop(doc_name, None)
                        self._doc_name_to_pages.pop(doc_name, None)

        if deleted:
            self._matrix_dirty = True
        return deleted

    async def count(self) -> int:
        return len(self.documents)

    async def clear(self) -> bool:
        self.documents.clear()
        self._doc_ids.clear()
        self._doc_norms.clear()
        self._matrix = None
        self._matrix_norms = None
        self._matrix_dirty = False
        self._doc_name_to_ids.clear()
        self._doc_name_to_pages.clear()
        return True
