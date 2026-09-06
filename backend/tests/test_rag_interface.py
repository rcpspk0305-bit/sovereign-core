"""Tests for RAG interface, vector retrieval, PDF upload, and RAG API endpoints."""

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.core.interfaces.rag import Document
from app.core.rag.in_memory import InMemoryVectorStore, cosine_similarity


def create_test_pdf() -> bytes:
    """Create a minimal 2-page test PDF in memory."""
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_text((50, 72), "Architecture Overview: Sovereign Core executes models on local hardware.")
    p2 = doc.new_page()
    p2.insert_text((50, 72), "Citation Verification: Retrieved chunks cite document name and page number.")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_cosine_similarity_edge_cases():
    # Identical unit vectors
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
    # Orthogonal vectors
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)
    # Zero vectors
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0
    # Unequal dimensions
    assert cosine_similarity([1.0], [1.0, 2.0]) == 0.0


@pytest.mark.asyncio
async def test_in_memory_vector_store_workflow(in_memory_vector_store: InMemoryVectorStore):
    docs = [
        Document(id="doc-1", content="Sovereign Core runs local AI models privately."),
        Document(id="doc-2", content="Python and FastAPI power the backend API service."),
        Document(id="doc-3", content="Docker Compose manages multi-container deployments."),
    ]

    # Ingest
    added_ids = await in_memory_vector_store.add_documents(docs)
    assert len(added_ids) == 3
    assert await in_memory_vector_store.count() == 3

    # Search
    results = await in_memory_vector_store.search(query="local AI models privacy", top_k=2)
    assert len(results) >= 1
    assert results[0].document.id == "doc-1"
    assert results[0].score > 0.0

    # Delete
    deleted = await in_memory_vector_store.delete(["doc-1"])
    assert deleted is True
    assert await in_memory_vector_store.count() == 2

    # Clear
    await in_memory_vector_store.clear()
    assert await in_memory_vector_store.count() == 0


def test_rag_api_endpoints(test_client: TestClient):
    # Ingest direct documents
    ingest_payload = {
        "documents": [
            {
                "id": "api-1",
                "content": "Retrieval Augmented Generation with local embeddings.",
                "metadata": {"document_name": "manual.pdf", "page_number": 1},
            },
            {
                "id": "api-2",
                "content": "FastAPI is a modern web framework for Python APIs.",
                "metadata": {"document_name": "manual.pdf", "page_number": 2},
            },
        ]
    }
    ingest_res = test_client.post("/api/v1/rag/ingest", json=ingest_payload)
    assert ingest_res.status_code == 200
    assert ingest_res.json()["indexed_count"] == 2

    # Stats
    stats_res = test_client.get("/api/v1/rag/stats")
    assert stats_res.status_code == 200
    assert stats_res.json()["total_documents"] >= 2

    # Search and verify metadata retention
    search_payload = {"query": "embeddings and retrieval", "top_k": 2}
    search_res = test_client.post("/api/v1/rag/search", json=search_payload)
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) >= 1
    assert "score" in results[0]
    assert "document" in results[0]
    assert "metadata" in results[0]["document"]

    # Clear
    clear_res = test_client.delete("/api/v1/rag/clear")
    assert clear_res.status_code == 200
    assert clear_res.json()["status"] == "cleared"


def test_rag_pdf_upload_and_citations(test_client: TestClient):
    pdf_bytes = create_test_pdf()

    # Upload PDF via multipart endpoint
    files = {"file": ("whitepaper.pdf", pdf_bytes, "application/pdf")}
    upload_res = test_client.post("/api/v1/rag/upload", files=files)
    assert upload_res.status_code == 200
    data = upload_res.json()
    assert data["filename"] == "whitepaper.pdf"
    assert data["total_pages"] == 2
    assert data["total_chunks"] >= 2
    assert data["status"] == "indexed"

    # Search for content from page 2
    search_res = test_client.post(
        "/api/v1/rag/search",
        json={"query": "Citation Verification Retrieved chunks cite", "top_k": 2},
    )
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) > 0

    # Verify citation metadata is retained
    doc_meta = results[0]["document"]["metadata"]
    assert doc_meta.get("document_name") == "whitepaper.pdf"
    assert "page_number" in doc_meta
    assert "source" in doc_meta
