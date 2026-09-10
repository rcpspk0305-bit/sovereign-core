"""ChromaDB Vector Store and Retriever implementing BaseRetriever."""

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb

from app.config import settings
from app.core.interfaces.rag import (
    BaseEmbeddingProvider,
    BaseRetriever,
    DimensionalityMismatchError,
    Document,
    SearchResult,
    VectorStoreHealth,
)
from app.core.rag.embeddings import OllamaEmbeddingProvider
from app.core.telemetry.tracer import (
    trace_rag,
    trace_embedding,
    trace_vector_search,
)
from app.core.telemetry.metrics import record_rag_query


logger = logging.getLogger("sovereign.rag.chroma")


class ChromaVectorStore(BaseRetriever):
    """Production local vector store backed by ChromaDB with cosine distance indexing."""

    backend_name: str = "chroma"

    def __init__(
        self,
        persist_dir: Optional[Path] = None,
        collection_name: Optional[str] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
    ) -> None:
        self.persist_dir = Path(persist_dir or settings.CHROMA_PERSIST_DIR)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.collection_name = collection_name or settings.CHROMA_COLLECTION_NAME
        self.embedding_provider = embedding_provider or OllamaEmbeddingProvider()

        self._client = chromadb.PersistentClient(path=str(self.persist_dir))
        self._collection = self._client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "Initialized ChromaDB collection '%s' at '%s' with %d indexed records",
            self.collection_name,
            self.persist_dir,
            self._collection.count(),
        )

    def _clean_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure all metadata keys and values conform to ChromaDB constraints."""
        clean: Dict[str, Any] = {}
        for k, v in metadata.items():
            if isinstance(v, (str, int, float, bool)):
                clean[k] = v
            elif v is None:
                continue
            else:
                clean[k] = str(v)
        return clean

    def _get_existing_dimension(self) -> Optional[int]:
        """Inspect existing collection vector dimension if documents are indexed."""
        try:
            if self._collection.count() > 0:
                sample = self._collection.get(limit=1, include=["embeddings"])
                embeddings = sample.get("embeddings")
                if embeddings is not None and len(embeddings) > 0 and embeddings[0] is not None:
                    return len(embeddings[0])
        except Exception:
            pass
        return None

    def _validate_dimensions(self, embeddings: List[List[float]]) -> None:
        """Validate embedding vectors against existing collection dimensionality, failing safely on mismatch."""
        if not embeddings or not embeddings[0]:
            return
        incoming_dim = len(embeddings[0])
        existing_dim = self._get_existing_dimension()
        if existing_dim is not None and existing_dim != incoming_dim:
            raise DimensionalityMismatchError(
                f"Embedding dimensionality mismatch for collection '{self.collection_name}': "
                f"existing collection has dimension {existing_dim}, but incoming embeddings have dimension {incoming_dim}."
            )

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Index a batch of documents into ChromaDB, computing embeddings and validating dimensions safely."""
        if not documents:
            return []

        ids: List[str] = []
        contents: List[str] = []
        metadatas: List[Dict[str, Any]] = []
        texts_needing_embeddings: List[str] = []
        indices_needing_embeddings: List[int] = []

        for i, doc in enumerate(documents):
            ids.append(doc.id)
            contents.append(doc.content)
            # Ensure provenance fields exist
            meta = dict(doc.metadata or {})
            if "document_name" not in meta and "filename" in meta:
                meta["document_name"] = meta["filename"]
            cleaned = self._clean_metadata(meta)
            if not cleaned:
                cleaned = {"source": "unspecified"}
            metadatas.append(cleaned)
            if not doc.embedding:
                texts_needing_embeddings.append(doc.content)
                indices_needing_embeddings.append(i)

        embeddings: List[List[float]] = [doc.embedding or [] for doc in documents]

        if texts_needing_embeddings:
            generated = await self.embedding_provider.embed_documents(texts_needing_embeddings)
            for idx, emb in zip(indices_needing_embeddings, generated):
                embeddings[idx] = emb
                documents[idx].embedding = emb

        # Fail safely if dimensions mismatch
        self._validate_dimensions(embeddings)

        try:
            self._collection.upsert(
                ids=ids,
                documents=contents,
                metadatas=metadatas,
                embeddings=embeddings,
            )
        except Exception as exc:
            if "dimension" in str(exc).lower():
                raise DimensionalityMismatchError(
                    f"Dimensionality mismatch in ChromaDB collection '{self.collection_name}': {exc}"
                ) from exc
            raise exc

        logger.info("Upserted %d documents into ChromaDB collection '%s'", len(ids), self.collection_name)
        return ids

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        collection: Optional[str] = None,
    ) -> List[SearchResult]:
        """Retrieve top-k documents from ChromaDB, supporting metadata filtering and collection selection."""
        target_collection = self._collection
        target_collection_name = self.collection_name

        if collection and collection != self.collection_name:
            target_collection_name = collection
            target_collection = self._client.get_or_create_collection(
                name=collection,
                metadata={"hnsw:space": "cosine"},
            )

        if not query.strip() or target_collection.count() == 0:
            return []

        start_time = time.perf_counter()
        with trace_rag(collection=target_collection_name, top_k=top_k, query=query, backend="chroma") as rag_span:
            try:
                emb_model = getattr(self.embedding_provider, "model", "default")
                with trace_embedding(model=emb_model, chunk_count=1):
                    query_emb = await self.embedding_provider.embed_query(query)

                # Validate query embedding dimension against target collection
                existing_dim = self._get_existing_dimension()
                if existing_dim is not None and len(query_emb) != existing_dim:
                    raise DimensionalityMismatchError(
                        f"Query embedding dimension {len(query_emb)} does not match collection dimension {existing_dim}"
                    )

                k = min(top_k, target_collection.count())
                where_clause: Optional[Dict[str, Any]] = None
                if filters:
                    cleaned_filters = self._clean_metadata(filters)
                    if len(cleaned_filters) == 1:
                        where_clause = cleaned_filters
                    elif len(cleaned_filters) > 1:
                        where_clause = {"$and": [{k_name: v_val} for k_name, v_val in cleaned_filters.items()]}

                with trace_vector_search(collection=target_collection_name, top_k=k):
                    query_kwargs: Dict[str, Any] = {
                        "query_embeddings": [query_emb],
                        "n_results": k,
                        "include": ["documents", "metadatas", "distances"],
                    }
                    if where_clause:
                        query_kwargs["where"] = where_clause

                    try:
                        results = target_collection.query(**query_kwargs)
                    except Exception as exc:
                        if "dimension" in str(exc).lower():
                            raise DimensionalityMismatchError(
                                f"Dimensionality mismatch for query against collection '{target_collection_name}': {exc}"
                            ) from exc
                        raise exc

                matched_ids = results.get("ids", [[]])[0]
                matched_docs = results.get("documents", [[]])[0]
                matched_metas = results.get("metadatas", [[]])[0]
                matched_distances = results.get("distances", [[]])[0]

                search_results: List[SearchResult] = []
                for doc_id, text, meta, dist in zip(matched_ids, matched_docs, matched_metas, matched_distances):
                    # In cosine space, distance in Chroma is 1 - cosine_similarity
                    similarity = max(0.0, min(1.0, 1.0 - dist))
                    if score_threshold is not None and similarity < score_threshold:
                        continue

                    doc = Document(
                        id=doc_id,
                        content=text,
                        metadata=meta or {},
                    )
                    search_results.append(
                        SearchResult(
                            document=doc,
                            score=round(similarity, 4),
                        )
                    )

                # Sort descending by similarity score
                search_results.sort(key=lambda r: r.score, reverse=True)
                dur = time.perf_counter() - start_time
                record_rag_query(collection=target_collection_name, latency_seconds=dur, success=True)
                rag_span.set_attribute("rag.matches_count", len(search_results))
                rag_span.set_attribute("rag.backend", "chroma")
                rag_span.set_attribute("rag.document_ids", [r.document.id for r in search_results])
                return search_results
            except Exception as e:
                dur = time.perf_counter() - start_time
                record_rag_query(collection=target_collection_name, latency_seconds=dur, success=False)
                raise

    async def delete(self, document_ids: List[str]) -> bool:
        """Remove documents by ID from Chroma collection."""
        if not document_ids:
            return True
        try:
            self._collection.delete(ids=document_ids)
            return True
        except Exception as exc:
            logger.error("Failed to delete documents from ChromaDB: %s", exc)
            return False

    async def count(self, collection: Optional[str] = None) -> int:
        """Return total number of documents in the collection."""
        if collection and collection != self.collection_name:
            col = self._client.get_or_create_collection(name=collection)
            return col.count()
        return self._collection.count()

    async def clear(self) -> bool:
        """Clear all records by deleting and re-creating the collection."""
        try:
            self._client.delete_collection(name=self.collection_name)
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("Cleared ChromaDB collection '%s'", self.collection_name)
            return True
        except Exception as exc:
            logger.error("Failed to clear ChromaDB collection: %s", exc)
            return False

    async def health(self) -> VectorStoreHealth:
        """Return operational health status and collection statistics."""
        try:
            cnt = self._collection.count()
            dim = self._get_existing_dimension()
            return VectorStoreHealth(
                status="healthy",
                backend="chroma",
                collection=self.collection_name,
                total_documents=cnt,
                total_vectors=cnt,
                dimension=dim,
                endpoint=str(self.persist_dir),
            )
        except Exception as exc:
            return VectorStoreHealth(
                status="degraded",
                backend="chroma",
                collection=self.collection_name,
                total_documents=0,
                total_vectors=0,
                error=str(exc),
                endpoint=str(self.persist_dir),
            )

    async def list_documents(self) -> List[Dict[str, Any]]:
        """List all indexed documents/attachments with grouped metadata."""
        try:
            data = self._collection.get(include=["metadatas"])
            metas = data.get("metadatas", []) or []
            ids = data.get("ids", []) or []
            doc_map: Dict[str, Dict[str, Any]] = {}
            for doc_id, meta in zip(ids, metas):
                meta = meta or {}
                fname = meta.get("document_name") or meta.get("filename") or f"Document_{doc_id[:8]}"
                if fname not in doc_map:
                    doc_map[fname] = {
                        "id": doc_id,
                        "filename": fname,
                        "document_name": fname,
                        "total_chunks": 0,
                        "total_pages": int(meta.get("total_pages", 1)),
                        "total_tokens": 0,
                        "uploaded_at": meta.get("timestamp") or "Recent",
                        "document_ids": [],
                    }
                doc_map[fname]["total_chunks"] += 1
                doc_map[fname]["document_ids"].append(doc_id)
                doc_map[fname]["total_tokens"] += int(meta.get("token_count", 120))
            return list(doc_map.values())
        except Exception as exc:
            logger.error("Failed to list documents from ChromaDB: %s", exc)
            return []

    async def delete_document(self, filename: str) -> Dict[str, Any]:
        """Delete all chunks for a specific document filename."""
        deleted_count = 0
        try:
            data = self._collection.get(include=["metadatas"])
            metas = data.get("metadatas", []) or []
            ids = data.get("ids", []) or []
            matched = [
                doc_id for doc_id, meta in zip(ids, metas)
                if meta and (meta.get("filename") == filename or meta.get("document_name") == filename)
            ]
            if matched:
                self._collection.delete(ids=matched)
                deleted_count = len(matched)
            return {"status": "deleted", "filename": filename, "chunks_deleted": deleted_count}
        except Exception as exc:
            logger.error("Failed to delete document '%s' from ChromaDB: %s", filename, exc)
            return {"status": "error", "filename": filename, "chunks_deleted": 0, "error": str(exc)}


# Type alias for VectorStore contract
ChromaStore = ChromaVectorStore
