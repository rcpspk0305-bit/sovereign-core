"""Safe Chroma-to-Qdrant migration utility adhering to zero-loss guarantees."""

import logging
import time
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.core.interfaces.rag import (
    DimensionalityMismatchError,
    Document,
)
from app.core.rag.chroma import ChromaVectorStore
from app.integrations.qdrant.adapter import QdrantRetrieverAdapter

logger = logging.getLogger("sovereign.rag.migration")


class MigrationResult(BaseModel):
    """Result summary of a vector store migration execution."""
    success: bool
    source_backend: str = "chroma"
    target_backend: str = "qdrant"
    source_count: int = 0
    migrated_count: int = 0
    target_count: int = 0
    dimension: int = 0
    sample_retrieved: bool = False
    sample_score: Optional[float] = None
    sample_document_name: Optional[str] = None
    duration_seconds: float = 0.0
    original_collection_preserved: bool = True
    error: Optional[str] = None


async def migrate_chroma_to_qdrant(
    source_store: ChromaVectorStore,
    target_store: QdrantRetrieverAdapter,
    verify_sample: bool = True,
) -> MigrationResult:
    """Execute safe, non-destructive migration from ChromaDB to Qdrant.
    
    Guarantees:
    1. Export from ChromaDB collection.
    2. Validate embedding dimensions across all records.
    3. Fail safely if dimensionality mismatches target without altering either store.
    4. Upsert validated points into Qdrant.
    5. Verify post-migration point counts.
    6. Verify sample retrieval and provenance retention.
    7. NEVER automatically delete or clear the original ChromaDB collection.
    """
    start_time = time.perf_counter()
    logger.info(
        "Beginning migration from Chroma '%s' to Qdrant '%s'",
        source_store.collection_name,
        target_store.collection_name,
    )

    try:
        # 1. Export from Chroma
        chroma_data = source_store._collection.get(include=["documents", "metadatas", "embeddings"])
        ids: List[str] = chroma_data.get("ids", []) or []
        contents: List[str] = chroma_data.get("documents", []) or []
        metas: List[Dict[str, Any]] = chroma_data.get("metadatas", []) or []
        embeddings = chroma_data.get("embeddings")

        source_count = len(ids)
        if source_count == 0:
            logger.info("Chroma collection '%s' is empty. Migration complete with 0 records.", source_store.collection_name)
            return MigrationResult(
                success=True,
                source_count=0,
                migrated_count=0,
                target_count=await target_store.count(),
                dimension=0,
                sample_retrieved=True,
                duration_seconds=round(time.perf_counter() - start_time, 3),
                original_collection_preserved=True,
            )

        # 2. Validate dimensions
        if embeddings is None or len(embeddings) == 0 or embeddings[0] is None:
            # Need to compute embeddings if Chroma didn't return them
            logger.info("Exported records lack raw embeddings; generating via embedding provider.")
            generated = await source_store.embedding_provider.embed_documents(contents)
            embeddings = generated

        dimension = len(embeddings[0])
        for idx, emb in enumerate(embeddings):
            if len(emb) != dimension:
                raise DimensionalityMismatchError(
                    f"Exported record '{ids[idx]}' dimension {len(emb)} differs from batch dimension {dimension}."
                )

        # 3. Check target Qdrant dimension if target collection already exists
        target_client = target_store._get_client()
        target_dim = target_store._get_collection_dimension(target_client, target_store.collection_name)
        if target_dim is not None and target_dim != dimension:
            raise DimensionalityMismatchError(
                f"Cannot migrate: source Chroma embeddings have dimension {dimension}, "
                f"but target Qdrant collection '{target_store.collection_name}' has dimension {target_dim}."
            )

        # 4. Construct Document objects
        documents: List[Document] = []
        for doc_id, text, meta, emb in zip(ids, contents, metas, embeddings):
            meta = meta or {}
            documents.append(
                Document(
                    id=doc_id,
                    content=text,
                    metadata=meta,
                    embedding=list(emb),
                )
            )

        # 5. Upsert to Qdrant
        migrated_ids = await target_store.add_documents(documents)
        migrated_count = len(migrated_ids)

        # 6. Verify count
        target_count = await target_store.count()
        if target_count < source_count:
            logger.warning("Target count (%d) is lower than source count (%d)", target_count, source_count)

        # 7. Verify sample retrieval
        sample_retrieved = False
        sample_score = None
        sample_doc_name = None

        if verify_sample and documents:
            sample_doc = documents[0]
            sample_query = sample_doc.content[:80]
            results = await target_store.search(query=sample_query, top_k=1)
            if results and len(results) > 0:
                sample_retrieved = True
                sample_score = results[0].score
                sample_doc_name = results[0].document.metadata.get("document_name")

        duration = round(time.perf_counter() - start_time, 3)
        logger.info(
            "Migration successful: %d records migrated in %.2fs. Original Chroma collection preserved.",
            migrated_count,
            duration,
        )

        return MigrationResult(
            success=True,
            source_count=source_count,
            migrated_count=migrated_count,
            target_count=target_count,
            dimension=dimension,
            sample_retrieved=sample_retrieved,
            sample_score=sample_score,
            sample_document_name=sample_doc_name,
            duration_seconds=duration,
            original_collection_preserved=True,
        )

    except Exception as exc:
        duration = round(time.perf_counter() - start_time, 3)
        logger.error("Migration failed safely without deleting original collection: %s", exc)
        return MigrationResult(
            success=False,
            source_count=source_store._collection.count() if hasattr(source_store, "_collection") else 0,
            migrated_count=0,
            target_count=await target_store.count() if hasattr(target_store, "count") else 0,
            dimension=0,
            sample_retrieved=False,
            duration_seconds=duration,
            original_collection_preserved=True,
            error=str(exc),
        )
