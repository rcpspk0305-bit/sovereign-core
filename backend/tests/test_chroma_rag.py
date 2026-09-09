"""Unit tests for ChromaVectorStore ingestion, metadata retention, and semantic retrieval."""

from pathlib import Path

import pytest

from app.core.interfaces.rag import Document
from app.core.rag.chroma import ChromaVectorStore
from app.core.rag.in_memory import SimpleEmbeddingProvider


@pytest.fixture
def chroma_store(tmp_path: Path) -> ChromaVectorStore:
    return ChromaVectorStore(
        persist_dir=tmp_path / "chroma_test",
        collection_name="test_knowledge",
        embedding_provider=SimpleEmbeddingProvider(dimension=64),
    )


@pytest.mark.asyncio
async def test_chroma_ingestion_and_metadata_retention(chroma_store: ChromaVectorStore):
    docs = [
        Document(
            id="doc1_p1_c0",
            content="Local privacy-first artificial intelligence models run on Ollama.",
            metadata={
                "document_name": "architecture.pdf",
                "page_number": 1,
                "chunk_index": 0,
                "source": "architecture.pdf (Page 1)",
            },
        ),
        Document(
            id="doc1_p2_c0",
            content="Vector database ChromaDB indexes extracted chunks for fast nearest-neighbor search.",
            metadata={
                "document_name": "architecture.pdf",
                "page_number": 2,
                "chunk_index": 0,
                "source": "architecture.pdf (Page 2)",
            },
        ),
        Document(
            id="doc2_p5_c1",
            content="Agent orchestration loops coordinate tool calls and prompt construction.",
            metadata={
                "document_name": "agents_whitepaper.pdf",
                "page_number": 5,
                "chunk_index": 1,
                "source": "agents_whitepaper.pdf (Page 5)",
            },
        ),
    ]

    added_ids = await chroma_store.add_documents(docs)
    assert len(added_ids) == 3
    assert await chroma_store.count() == 3

    # Query for ChromaDB nearest neighbor
    results = await chroma_store.search("ChromaDB vector database search", top_k=2)
    assert len(results) > 0

    top_match = results[0]
    # Check score
    assert 0.0 <= top_match.score <= 1.0

    # CRITICAL CHECK: Every retrieved chunk retains document name and page metadata
    assert "document_name" in top_match.document.metadata
    assert "page_number" in top_match.document.metadata
    assert top_match.document.metadata["document_name"] == "architecture.pdf"
    assert top_match.document.metadata["page_number"] == 2
    assert "source" in top_match.document.metadata


@pytest.mark.asyncio
async def test_chroma_search_threshold_and_top_k(chroma_store: ChromaVectorStore):
    docs = [
        Document(
            id=f"doc_{i}",
            content=f"Document content sentence number {i} talking about machine learning.",
            metadata={"document_name": "data.pdf", "page_number": i + 1},
        )
        for i in range(5)
    ]
    await chroma_store.add_documents(docs)
    assert await chroma_store.count() == 5

    # Test top_k limiting
    res_2 = await chroma_store.search("machine learning", top_k=2)
    assert len(res_2) == 2

    for r in res_2:
        assert r.document.metadata["document_name"] == "data.pdf"
        assert isinstance(r.document.metadata["page_number"], int)


@pytest.mark.asyncio
async def test_chroma_delete_and_clear(chroma_store: ChromaVectorStore):
    docs = [
        Document(
            id="to_delete_1",
            content="Temporary chunk for deletion.",
            metadata={"document_name": "temp.pdf", "page_number": 1},
        ),
        Document(
            id="to_delete_2",
            content="Another temporary chunk.",
            metadata={"document_name": "temp.pdf", "page_number": 1},
        ),
    ]
    await chroma_store.add_documents(docs)
    assert await chroma_store.count() == 2

    # Delete single doc
    del_ok = await chroma_store.delete(["to_delete_1"])
    assert del_ok is True
    assert await chroma_store.count() == 1

    # Clear whole collection
    clear_ok = await chroma_store.clear()
    assert clear_ok is True
    assert await chroma_store.count() == 0
