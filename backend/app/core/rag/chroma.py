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
    Document,
    SearchResult,
)
from app.core.rag.embeddings import OllamaEmbeddingProvider
from app.core.telemetry import (
    trace_rag,
    trace_embedding,
    trace_vector_search,
    trace_document_ingestion,
    record_rag_query,
)

logger = logging.getLogger("sovereign.rag.chroma")


class ChromaVectorStore(BaseRetriever):
    """Production local vector store backed by ChromaDB with cosine distance indexing."""

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

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Index a batch of documents into ChromaDB, computing embeddings if needed."""
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
            metadatas.append(self._clean_metadata(doc.metadata))
            if not doc.embedding:
                texts_needing_embeddings.append(doc.content)
                indices_needing_embeddings.append(i)

        embeddings: List[List[float]] = [doc.embedding or [] for doc in documents]

        if texts_needing_embeddings:
            generated = await self.embedding_provider.embed_documents(texts_needing_embeddings)
            for idx, emb in zip(indices_needing_embeddings, generated):
                embeddings[idx] = emb
                documents[idx].embedding = emb

        try:
            self._collection.upsert(
                ids=ids,
                documents=contents,
                metadatas=metadatas,
                embeddings=embeddings,
            )
        except Exception as exc:
            if "dimension" in str(exc).lower():
                logger.warning(
                    "Dimensionality mismatch in collection '%s' (%s). Re-initializing collection for new embedding model.",
                    self.collection_name,
                    exc,
                )
                await self.clear()
                self._collection.upsert(
                    ids=ids,
                    documents=contents,
                    metadatas=metadatas,
                    embeddings=embeddings,
                )
            else:
                raise exc

        logger.info("Upserted %d documents into ChromaDB collection '%s'", len(ids), self.collection_name)
        return ids

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        """Retrieve top-k documents from ChromaDB, preserving page and document metadata."""
        if not query.strip() or self._collection.count() == 0:
            return []

        start_time = time.perf_counter()
        with trace_rag(collection=self.collection_name, top_k=top_k, query=query) as rag_span:
            try:
                emb_model = getattr(self.embedding_provider, "model", "default")
                with trace_embedding(model=emb_model, chunk_count=1):
                    query_emb = await self.embedding_provider.embed_query(query)

                k = min(top_k, self._collection.count())
                with trace_vector_search(collection=self.collection_name, top_k=k):
                    try:
                        results = self._collection.query(
                            query_embeddings=[query_emb],
                            n_results=k,
                            include=["documents", "metadatas", "distances"],
                        )
                    except Exception as exc:
                        if "dimension" in str(exc).lower():
                            logger.warning(
                                "Dimensionality mismatch for query against collection '%s' (%s). Clearing outdated collection.",
                                self.collection_name,
                                exc,
                            )
                            await self.clear()
                            return []
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
                record_rag_query(collection=self.collection_name, latency_seconds=dur, success=True)
                rag_span.set_attribute("rag.matches_count", len(search_results))
                return search_results
            except Exception as e:
                dur = time.perf_counter() - start_time
                record_rag_query(collection=self.collection_name, latency_seconds=dur, success=False)
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

    async def count(self) -> int:
        """Return total number of documents in the collection."""
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
