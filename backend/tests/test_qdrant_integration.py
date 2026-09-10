"""Comprehensive tests for Qdrant and Chroma vector stores, interface compliance, and migration."""

from pathlib import Path
from typing import Any, List
import pytest
from qdrant_client import QdrantClient

from app.core.interfaces.rag import (
    BaseRetriever,
    DimensionalityMismatchError,
    Document,
    VectorStoreHealth,
)
from app.core.rag.chroma import ChromaStore, ChromaVectorStore
from app.core.rag.in_memory import SimpleEmbeddingProvider
from app.core.rag.migration import migrate_chroma_to_qdrant
from app.core.rag.service import get_vector_store, set_active_vector_store
from app.core.tools.document_retrieval import DocumentRetrievalTool
from app.integrations.qdrant.adapter import QdrantRetrieverAdapter, QdrantStore


@pytest.fixture
def mock_embedding_provider_64() -> SimpleEmbeddingProvider:
    return SimpleEmbeddingProvider(dimension=64)


@pytest.fixture
def mock_embedding_provider_128() -> SimpleEmbeddingProvider:
    return SimpleEmbeddingProvider(dimension=128)


@pytest.fixture
def chroma_store(tmp_path: Path, mock_embedding_provider_64: SimpleEmbeddingProvider) -> ChromaStore:
    return ChromaStore(
        persist_dir=tmp_path / "chroma_qdrant_test",
        collection_name="test_chroma_col",
        embedding_provider=mock_embedding_provider_64,
    )


@pytest.fixture
def qdrant_memory_store(mock_embedding_provider_64: SimpleEmbeddingProvider) -> QdrantStore:
    client = QdrantClient(":memory:")
    return QdrantStore(
        collection_name="test_qdrant_col",
        embedding_provider=mock_embedding_provider_64,
        client=client,
    )


def sample_documents() -> List[Document]:
    return [
        Document(
            id="doc-radar-1",
            content="Radar subsystem tracks multi-target orbital trajectories with Doppler radar telemetry.",
            metadata={
                "document_name": "Radar_Manual.pdf",
                "document_id": "doc-radar-1",
                "page_number": 1,
                "chunk_index": 0,
                "source": "Radar_Manual.pdf (Page 1)",
            },
        ),
        Document(
            id="doc-radar-2",
            content="Phased array antennas provide zero-inertia beam steering for space surveillance.",
            metadata={
                "document_name": "Radar_Manual.pdf",
                "document_id": "doc-radar-2",
                "page_number": 2,
                "chunk_index": 1,
                "source": "Radar_Manual.pdf (Page 2)",
            },
        ),
        Document(
            id="doc-crypto-1",
            content="Air-gapped post-quantum cryptographic primitives prevent unauthorized key derivation.",
            metadata={
                "document_name": "Crypto_Spec.pdf",
                "document_id": "doc-crypto-1",
                "page_number": 4,
                "chunk_index": 0,
                "source": "Crypto_Spec.pdf (Page 4)",
            },
        ),
    ]


# 1. Interface Compliance
def test_interface_compliance(chroma_store: ChromaStore, qdrant_memory_store: QdrantStore):
    required_methods = [
        "add",
        "add_documents",
        "search",
        "delete",
        "count",
        "health",
        "clear",
        "list_documents",
        "delete_document",
    ]
    for store in (chroma_store, qdrant_memory_store):
        assert isinstance(store, BaseRetriever)
        for method in required_methods:
            assert hasattr(store, method), f"{store.__class__.__name__} is missing {method}"
            assert callable(getattr(store, method))


# 2. Chroma Implementation
@pytest.mark.asyncio
async def test_chroma_implementation(chroma_store: ChromaStore):
    docs = sample_documents()
    added_ids = await chroma_store.add(docs)
    assert len(added_ids) == 3
    assert await chroma_store.count() == 3

    results = await chroma_store.search("Doppler radar telemetry", top_k=2)
    assert len(results) >= 1
    assert "Radar_Manual.pdf" in results[0].document.metadata.get("document_name", "")

    # Health check
    health = await chroma_store.health()
    assert health.status == "healthy"
    assert health.backend == "chroma"
    assert health.total_documents == 3

    # Delete single document
    del_res = await chroma_store.delete_document("Crypto_Spec.pdf")
    assert del_res["chunks_deleted"] == 1
    assert await chroma_store.count() == 2

    # Clear
    assert await chroma_store.clear() is True
    assert await chroma_store.count() == 0


# 3. Qdrant Implementation
@pytest.mark.asyncio
async def test_qdrant_implementation(qdrant_memory_store: QdrantStore):
    docs = sample_documents()
    added_ids = await qdrant_memory_store.add(docs)
    assert len(added_ids) == 3
    assert await qdrant_memory_store.count() == 3

    results = await qdrant_memory_store.search("cryptographic air-gapped primitives", top_k=2)
    assert len(results) >= 1
    assert results[0].document.metadata.get("document_name") == "Crypto_Spec.pdf"
    assert results[0].score > 0.0

    # Health check
    health = await qdrant_memory_store.health()
    assert health.status == "healthy"
    assert health.backend == "qdrant"
    assert health.total_documents == 3
    assert health.dimension == 64

    # List documents
    doc_list = await qdrant_memory_store.list_documents()
    assert len(doc_list) == 2  # Radar_Manual.pdf (2 chunks) and Crypto_Spec.pdf (1 chunk)

    # Delete single document
    del_res = await qdrant_memory_store.delete_document("Crypto_Spec.pdf")
    assert del_res["chunks_deleted"] == 1
    assert await qdrant_memory_store.count() == 2

    # Clear
    assert await qdrant_memory_store.clear() is True
    assert await qdrant_memory_store.count() == 0


# 4. Metadata Filtering
@pytest.mark.asyncio
async def test_qdrant_metadata_filtering(qdrant_memory_store: QdrantStore):
    docs = sample_documents()
    await qdrant_memory_store.add(docs)

    # Search with filter for document_name
    filtered_results = await qdrant_memory_store.search(
        query="radar antennas space surveillance",
        top_k=5,
        filters={"document_name": "Radar_Manual.pdf"},
    )
    assert len(filtered_results) > 0
    for r in filtered_results:
        assert r.document.metadata["document_name"] == "Radar_Manual.pdf"

    # Search with filter for page_number
    page_2_results = await qdrant_memory_store.search(
        query="radar antennas",
        top_k=5,
        filters={"page_number": 2},
    )
    assert len(page_2_results) == 1
    assert page_2_results[0].document.metadata["page_number"] == 2


@pytest.mark.asyncio
async def test_chroma_metadata_filtering(chroma_store: ChromaStore):
    docs = sample_documents()
    await chroma_store.add(docs)

    filtered_results = await chroma_store.search(
        query="radar antennas",
        top_k=5,
        filters={"document_name": "Radar_Manual.pdf"},
    )
    assert len(filtered_results) > 0
    for r in filtered_results:
        assert r.document.metadata["document_name"] == "Radar_Manual.pdf"


# 5. Dimensionality Mismatch Fails Safely (No Silent Corruption)
@pytest.mark.asyncio
async def test_dimensionality_mismatch_fails_safely(
    tmp_path: Path,
    mock_embedding_provider_64: SimpleEmbeddingProvider,
    mock_embedding_provider_128: SimpleEmbeddingProvider,
):
    # Qdrant test
    qdrant_client = QdrantClient(":memory:")
    qdrant_store = QdrantStore(
        collection_name="dim_test_col",
        embedding_provider=mock_embedding_provider_64,
        client=qdrant_client,
    )

    docs_64 = [
        Document(
            id="doc-64",
            content="64-dimension content",
            embedding=[0.1] * 64,
        )
    ]
    await qdrant_store.add(docs_64)
    assert await qdrant_store.count() == 1

    # Attempt to add 128-dimensional vector into 64-dimensional collection
    docs_128 = [
        Document(
            id="doc-128",
            content="128-dimension mismatch content",
            embedding=[0.2] * 128,
        )
    ]

    with pytest.raises(DimensionalityMismatchError):
        await qdrant_store.add(docs_128)

    # Collection must NOT be corrupted or wiped
    assert await qdrant_store.count() == 1

    # Query with 128-dim provider against 64-dim collection must also fail safely
    qdrant_mismatched = QdrantStore(
        collection_name="dim_test_col",
        embedding_provider=mock_embedding_provider_128,
        client=qdrant_client,
    )
    with pytest.raises(DimensionalityMismatchError):
        await qdrant_mismatched.search("query needing 128 dimensions")

    # Chroma test
    chroma_store = ChromaStore(
        persist_dir=tmp_path / "chroma_dim_test",
        collection_name="chroma_dim_test_col",
        embedding_provider=mock_embedding_provider_64,
    )
    await chroma_store.add(docs_64)
    assert await chroma_store.count() == 1

    # Attempt to add 128-dimensional vector into Chroma collection
    with pytest.raises(DimensionalityMismatchError):
        await chroma_store.add(docs_128)

    # Chroma collection must NOT be wiped or corrupted
    assert await chroma_store.count() == 1


# 6. Safe Migration Utility
@pytest.mark.asyncio
async def test_chroma_to_qdrant_migration_safe(chroma_store: ChromaStore, qdrant_memory_store: QdrantStore):
    docs = sample_documents()
    await chroma_store.add(docs)
    initial_chroma_count = await chroma_store.count()
    assert initial_chroma_count == 3

    # Execute safe migration
    result = await migrate_chroma_to_qdrant(
        source_store=chroma_store,
        target_store=qdrant_memory_store,
        verify_sample=True,
    )

    assert result.success is True
    assert result.source_count == 3
    assert result.migrated_count == 3
    assert result.target_count == 3
    assert result.sample_retrieved is True
    assert result.sample_score is not None and result.sample_score > 0.0
    assert result.original_collection_preserved is True

    # CRITICAL CHECK: Original ChromaDB collection was NEVER deleted
    after_migration_chroma_count = await chroma_store.count()
    assert after_migration_chroma_count == initial_chroma_count

    # Sample query on target Qdrant returns proper citation
    qdrant_results = await qdrant_memory_store.search("Doppler radar telemetry", top_k=1)
    assert len(qdrant_results) == 1
    assert qdrant_results[0].document.metadata.get("document_name") == "Radar_Manual.pdf"
    assert qdrant_results[0].document.metadata.get("page_number") == 1


# 7. Empty Collection Handling
@pytest.mark.asyncio
async def test_empty_collection_handling(chroma_store: ChromaStore, qdrant_memory_store: QdrantStore):
    # Search empty Chroma
    c_res = await chroma_store.search("random query", top_k=4)
    assert c_res == []
    assert await chroma_store.count() == 0

    # Search empty Qdrant
    q_res = await qdrant_memory_store.search("random query", top_k=4)
    assert q_res == []
    assert await qdrant_memory_store.count() == 0

    # Migrate empty Chroma
    migration_res = await migrate_chroma_to_qdrant(chroma_store, qdrant_memory_store)
    assert migration_res.success is True
    assert migration_res.migrated_count == 0


# 8. Unavailable Qdrant Handling
@pytest.mark.asyncio
async def test_unavailable_qdrant_handling():
    # Point to closed local port
    dead_adapter = QdrantStore(url="http://127.0.0.1:59999")
    health = await dead_adapter.health()
    assert health.status == "unavailable"
    assert health.error is not None


# 9. Retrieval Provenance and Citation Preservation
@pytest.mark.asyncio
async def test_retrieval_provenance_and_citations(qdrant_memory_store: QdrantStore):
    docs = sample_documents()
    await qdrant_memory_store.add(docs)

    tool = DocumentRetrievalTool(retriever=qdrant_memory_store)
    exec_res = await tool.execute(query="Doppler radar telemetry", top_k=2)
    assert exec_res.success is True
    assert exec_res.output is not None

    chunks = exec_res.output["chunks"]
    assert len(chunks) >= 1

    top_chunk = chunks[0]
    assert top_chunk["document_name"] == "Radar_Manual.pdf"
    assert top_chunk["page_number"] in [1, 2]
    assert "source" in top_chunk
    assert "chunk_index" in top_chunk
    assert top_chunk["similarity_score"] > 0.0


# 10. Vector Store Factory Switch
def test_vector_store_factory_switching():
    set_active_vector_store(None)
    chroma = get_vector_store(backend="chroma", force_new=True)
    assert isinstance(chroma, ChromaVectorStore)
    assert chroma.backend_name == "chroma"

    qdrant = get_vector_store(backend="qdrant", force_new=True)
    assert isinstance(qdrant, QdrantRetrieverAdapter)
    assert qdrant.backend_name == "qdrant"
    set_active_vector_store(None)
