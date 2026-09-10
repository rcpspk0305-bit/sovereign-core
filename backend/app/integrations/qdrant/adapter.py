"""Qdrant Vector Database Adapter implementing BaseRetriever and VectorStore contract."""

import importlib.util
import logging
import time
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.config import settings
from app.core.interfaces.rag import (
    BaseEmbeddingProvider,
    BaseRetriever,
    DimensionalityMismatchError,
    Document,
    SearchResult,
    VectorStoreHealth,
)
from app.core.telemetry.metrics import record_rag_query
from app.core.telemetry.tracer import (
    trace_embedding,
    trace_rag,
    trace_vector_search,
)
from app.integrations.base import (
    BaseIntegrationAdapter,
    validate_local_endpoint,
)

logger = logging.getLogger("sovereign.rag.qdrant")


def _to_qdrant_point_id(doc_id: str) -> str:
    """Ensure point ID is a valid UUID string required by Qdrant."""
    try:
        val = uuid.UUID(doc_id)
        return str(val)
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, doc_id))


class QdrantRetrieverAdapter(BaseRetriever, BaseIntegrationAdapter):
    """Production vector store backed by Qdrant vector database, strictly air-gapped."""

    backend_name: str = "qdrant"

    def __init__(
        self,
        url: Optional[str] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
        collection_name: Optional[str] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        client: Optional[Any] = None,
    ) -> None:
        if host is not None or port is not None:
            self.host = host or getattr(settings, "QDRANT_HOST", "localhost")
            self.port = port or getattr(settings, "QDRANT_PORT", 6333)
            self.url = url
            validate_local_endpoint(f"{self.host}:{self.port}")
        elif url is not None:
            self.url = url
            parsed = urlparse(self.url)
            endpoint = f"{parsed.hostname or 'localhost'}:{parsed.port or 6333}"
            validate_local_endpoint(endpoint)
            self.host = parsed.hostname or "localhost"
            self.port = parsed.port or 6333
        else:
            self.url = getattr(settings, "QDRANT_URL", "http://localhost:6333")
            self.host = getattr(settings, "QDRANT_HOST", "localhost")
            self.port = getattr(settings, "QDRANT_PORT", 6333)
            if self.url:
                parsed = urlparse(self.url)
                endpoint = f"{parsed.hostname or 'localhost'}:{parsed.port or 6333}"
                validate_local_endpoint(endpoint)
            else:
                validate_local_endpoint(f"{self.host}:{self.port}")

        self.collection_name = (
            collection_name
            or getattr(settings, "QDRANT_COLLECTION", None)
            or getattr(settings, "QDRANT_COLLECTION_NAME", "sovereign_documents")
        )
        if embedding_provider is None:
            from app.core.rag.embeddings import OllamaEmbeddingProvider
            self.embedding_provider = OllamaEmbeddingProvider()
        else:
            self.embedding_provider = embedding_provider

        self._client: Any = client

    @property
    def name(self) -> str:
        return "qdrant"

    def is_enabled(self) -> bool:
        backend_choice = getattr(settings, "VECTOR_BACKEND", "chroma").lower()
        return backend_choice == "qdrant" or bool(getattr(settings, "ENABLE_QDRANT", False))

    def is_available(self) -> bool:
        return importlib.util.find_spec("qdrant_client") is not None

    def _get_client(self) -> Any:
        """Get or initialize the QdrantClient instance."""
        if self._client is not None:
            return self._client

        self.check_ready()
        from qdrant_client import QdrantClient  # type: ignore

        if self.url:
            self._client = QdrantClient(url=self.url)
        else:
            self._client = QdrantClient(host=self.host, port=self.port)
        return self._client

    def _get_collection_dimension(self, client: Any, collection_name: str) -> Optional[int]:
        """Fetch dimensionality of existing collection if it exists."""
        try:
            info = client.get_collection(collection_name=collection_name)
            params = getattr(info.config, "params", None)
            vectors = getattr(params, "vectors", None)
            if hasattr(vectors, "size"):
                return int(vectors.size)
            if isinstance(vectors, dict) and "size" in vectors:
                return int(vectors["size"])
        except Exception:
            pass
        return None

    def _ensure_collection(self, client: Any, collection_name: str, dimension: int) -> None:
        """Ensure the target collection exists with expected dimensions, failing safely on mismatch."""
        from qdrant_client.models import Distance, VectorParams  # type: ignore

        existing_dim = self._get_collection_dimension(client, collection_name)
        if existing_dim is not None:
            if existing_dim != dimension:
                raise DimensionalityMismatchError(
                    f"Embedding dimensionality mismatch for Qdrant collection '{collection_name}': "
                    f"existing collection has dimension {existing_dim}, but incoming embeddings have dimension {dimension}."
                )
            return

        # Collection does not exist yet; create it safely
        try:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
            )
            logger.info("Created Qdrant collection '%s' with dimension %d (cosine)", collection_name, dimension)
        except Exception as exc:
            # Check if created concurrently
            existing = self._get_collection_dimension(client, collection_name)
            if existing is not None and existing != dimension:
                raise DimensionalityMismatchError(
                    f"Embedding dimensionality mismatch for Qdrant collection '{collection_name}': "
                    f"existing collection has dimension {existing}, but incoming embeddings have dimension {dimension}."
                ) from exc

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Index documents into Qdrant collection, validating dimensions and computing embeddings if needed."""
        client = self._get_client()
        if not documents:
            return []
        from qdrant_client.models import PointStruct  # type: ignore

        texts_needing_embeddings: List[str] = []
        indices_needing_embeddings: List[int] = []

        for i, doc in enumerate(documents):
            if not doc.embedding:
                texts_needing_embeddings.append(doc.content)
                indices_needing_embeddings.append(i)

        if texts_needing_embeddings:
            generated = await self.embedding_provider.embed_documents(texts_needing_embeddings)
            for idx, emb in zip(indices_needing_embeddings, generated):
                documents[idx].embedding = emb

        first_emb = next((d.embedding for d in documents if d.embedding), None)
        if not first_emb:
            logger.warning("No embeddings available to index into Qdrant.")
            return []

        dimension = len(first_emb)
        self._ensure_collection(client, self.collection_name, dimension)

        points: List[PointStruct] = []
        doc_ids: List[str] = []

        for doc in documents:
            if not doc.embedding:
                continue
            if len(doc.embedding) != dimension:
                raise DimensionalityMismatchError(
                    f"Document ID '{doc.id}' embedding dimension {len(doc.embedding)} does not match collection dimension {dimension}"
                )

            meta = dict(doc.metadata or {})
            fname = meta.get("document_name") or meta.get("filename") or "unknown"
            meta["document_name"] = fname
            meta["document_id"] = meta.get("document_id") or doc.id
            meta["page_number"] = int(meta.get("page_number", 1))
            meta["chunk_index"] = int(meta.get("chunk_index", 0))
            meta["source"] = meta.get("source") or f"{fname} (Page {meta['page_number']})"

            payload = {
                "content": doc.content,
                "doc_id": doc.id,
                **meta,
            }

            point_id = _to_qdrant_point_id(doc.id)
            points.append(
                PointStruct(
                    id=point_id,
                    vector=doc.embedding,
                    payload=payload,
                )
            )
            doc_ids.append(doc.id)

        if points:
            client.upsert(collection_name=self.collection_name, points=points)
            logger.info("Upserted %d points into Qdrant collection '%s'", len(points), self.collection_name)

        return doc_ids

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        collection: Optional[str] = None,
    ) -> List[SearchResult]:
        """Execute vector similarity search in Qdrant with filters and provenance metadata."""
        target_collection = collection or self.collection_name
        if not query.strip():
            return []

        client = self._get_client()

        # Check collection existence
        existing_dim = self._get_collection_dimension(client, target_collection)
        if existing_dim is None:
            return []

        start_time = time.perf_counter()
        with trace_rag(collection=target_collection, top_k=top_k, query=query, backend="qdrant") as rag_span:
            try:
                emb_model = getattr(self.embedding_provider, "model", "default")
                with trace_embedding(model=emb_model, chunk_count=1):
                    query_emb = await self.embedding_provider.embed_query(query)

                if len(query_emb) != existing_dim:
                    raise DimensionalityMismatchError(
                        f"Query embedding dimension {len(query_emb)} does not match Qdrant collection dimension {existing_dim}"
                    )

                # Construct Qdrant filter
                qdrant_filter = None
                if filters:
                    from qdrant_client.models import FieldCondition, Filter, MatchValue  # type: ignore

                    conditions = [
                        FieldCondition(key=k, match=MatchValue(value=v))
                        for k, v in filters.items()
                        if v is not None
                    ]
                    if conditions:
                        qdrant_filter = Filter(must=conditions)

                with trace_vector_search(collection=target_collection, top_k=top_k):
                    if hasattr(client, "query_points"):
                        response = client.query_points(
                            collection_name=target_collection,
                            query=query_emb,
                            limit=top_k,
                            query_filter=qdrant_filter,
                            score_threshold=score_threshold,
                            with_payload=True,
                        )
                        scored_points = response.points
                    else:
                        scored_points = client.search(
                            collection_name=target_collection,
                            query_vector=query_emb,
                            limit=top_k,
                            query_filter=qdrant_filter,
                            score_threshold=score_threshold,
                            with_payload=True,
                        )

                search_results: List[SearchResult] = []
                for pt in scored_points:
                    payload = pt.payload or {}
                    raw_id = payload.get("doc_id") or str(pt.id)
                    content = payload.get("content", "")

                    # Extract metadata excluding internal content
                    meta = {k: v for k, v in payload.items() if k != "content"}

                    doc = Document(
                        id=raw_id,
                        content=content,
                        metadata=meta,
                    )
                    score = float(pt.score) if hasattr(pt, "score") else 0.0
                    search_results.append(SearchResult(document=doc, score=round(score, 4)))

                search_results.sort(key=lambda r: r.score, reverse=True)
                dur = time.perf_counter() - start_time
                record_rag_query(collection=target_collection, latency_seconds=dur, success=True)
                rag_span.set_attribute("rag.matches_count", len(search_results))
                rag_span.set_attribute("rag.backend", "qdrant")
                rag_span.set_attribute("rag.document_ids", [r.document.id for r in search_results])
                return search_results
            except Exception as e:
                dur = time.perf_counter() - start_time
                record_rag_query(collection=target_collection, latency_seconds=dur, success=False)
                raise

    async def delete(self, document_ids: List[str]) -> bool:
        """Delete documents from Qdrant by document IDs."""
        if not document_ids:
            return True
        try:
            client = self._get_client()
            from qdrant_client.models import FieldCondition, Filter, MatchAny  # type: ignore

            # Delete matching doc_id in payload
            client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="doc_id", match=MatchAny(any=document_ids))]
                ),
            )
            return True
        except Exception as exc:
            logger.error("Failed to delete points from Qdrant: %s", exc)
            return False

    async def count(self, collection: Optional[str] = None) -> int:
        """Return total indexed points count in collection."""
        target = collection or self.collection_name
        try:
            client = self._get_client()
            info = client.get_collection(collection_name=target)
            return getattr(info, "points_count", 0) or 0
        except Exception:
            return 0

    async def clear(self) -> bool:
        """Delete collection entirely in Qdrant."""
        try:
            client = self._get_client()
            client.delete_collection(collection_name=self.collection_name)
            logger.info("Cleared Qdrant collection '%s'", self.collection_name)
            return True
        except Exception as exc:
            logger.error("Failed to clear Qdrant collection: %s", exc)
            return False

    async def health(self) -> VectorStoreHealth:
        """Return Qdrant health, connectivity, dimension, and collection counts."""
        try:
            client = self._get_client()
            cnt = await self.count()
            dim = self._get_collection_dimension(client, self.collection_name)
            return VectorStoreHealth(
                status="healthy",
                backend="qdrant",
                collection=self.collection_name,
                total_documents=cnt,
                total_vectors=cnt,
                dimension=dim,
                endpoint=self.url or f"{self.host}:{self.port}",
            )
        except Exception as exc:
            return VectorStoreHealth(
                status="unavailable",
                backend="qdrant",
                collection=self.collection_name,
                total_documents=0,
                total_vectors=0,
                error=str(exc),
                endpoint=self.url or f"{self.host}:{self.port}",
            )

    async def list_documents(self) -> List[Dict[str, Any]]:
        """List distinct documents indexed in Qdrant."""
        try:
            client = self._get_client()
            if self._get_collection_dimension(client, self.collection_name) is None:
                return []

            points, _ = client.scroll(
                collection_name=self.collection_name,
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )

            doc_map: Dict[str, Dict[str, Any]] = {}
            for pt in points:
                payload = pt.payload or {}
                raw_id = payload.get("doc_id") or str(pt.id)
                fname = payload.get("document_name") or payload.get("filename") or f"Document_{str(raw_id)[:8]}"
                if fname not in doc_map:
                    doc_map[fname] = {
                        "id": raw_id,
                        "filename": fname,
                        "document_name": fname,
                        "total_chunks": 0,
                        "total_pages": int(payload.get("total_pages", 1)),
                        "total_tokens": 0,
                        "uploaded_at": payload.get("timestamp") or "Recent",
                        "document_ids": [],
                    }
                doc_map[fname]["total_chunks"] += 1
                doc_map[fname]["document_ids"].append(raw_id)
                doc_map[fname]["total_tokens"] += int(payload.get("token_count", 120))

            return list(doc_map.values())
        except Exception as exc:
            logger.error("Failed to list documents from Qdrant: %s", exc)
            return []

    async def delete_document(self, filename: str) -> Dict[str, Any]:
        """Delete all chunks belonging to a document filename in Qdrant."""
        try:
            client = self._get_client()
            from qdrant_client.models import FieldCondition, Filter, MatchValue  # type: ignore

            # Count matching
            docs = await self.list_documents()
            matched = next((d for d in docs if d["filename"] == filename), None)
            chunks_count = matched["total_chunks"] if matched else 0

            # Delete points matching document_name
            client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    should=[
                        FieldCondition(key="document_name", match=MatchValue(value=filename)),
                        FieldCondition(key="filename", match=MatchValue(value=filename)),
                    ]
                ),
            )
            return {"status": "deleted", "filename": filename, "chunks_deleted": chunks_count}
        except Exception as exc:
            logger.error("Failed to delete document '%s' in Qdrant: %s", filename, exc)
            return {"status": "error", "filename": filename, "chunks_deleted": 0, "error": str(exc)}


# Type alias for VectorStore contract
QdrantStore = QdrantRetrieverAdapter
