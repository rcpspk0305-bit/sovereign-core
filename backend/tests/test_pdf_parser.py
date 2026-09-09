"""Unit tests for PyMuPDF PDF parsing and text chunking with citation metadata."""

import pymupdf

from app.core.rag.chunker import TextChunker
from app.core.rag.pdf_parser import PyMuPDFParser


def create_sample_pdf_bytes() -> bytes:
    """Create a 2-page sample PDF in memory using PyMuPDF."""
    doc = pymupdf.open()

    # Page 1
    page1 = doc.new_page()
    page1.insert_text(
        (50, 72),
        "Page 1 Content: Sovereign-Core is a production local AI workbench. "
        "It provides local LLM inference, structured tool execution, and privacy-first workflows.",
    )

    # Page 2
    page2 = doc.new_page()
    page2.insert_text(
        (50, 72),
        "Page 2 Content: Retrieval-Augmented Generation indexes documentation using PyMuPDF and ChromaDB. "
        "Every retrieved chunk must retain document name and page metadata so final answers can cite their sources.",
    )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_text_chunker_basic():
    chunker = TextChunker(chunk_size=100, chunk_overlap=20)
    text = (
        "First sentence explaining AI architecture. "
        "Second sentence describing local inference with Ollama. "
        "Third sentence describing vector retrieval with ChromaDB."
    )
    chunks = chunker.create_chunks(
        text=text,
        base_metadata={"document_name": "test.txt", "page_number": 1},
        doc_id_prefix="test",
    )

    assert len(chunks) >= 2
    for i, c in enumerate(chunks):
        assert c.metadata["document_name"] == "test.txt"
        assert c.metadata["page_number"] == 1
        assert c.metadata["chunk_index"] == i
        assert "source" in c.metadata


def test_pdf_parser_page_and_metadata_retention():
    pdf_bytes = create_sample_pdf_bytes()
    filename = "sovereign_guide.pdf"

    parser = PyMuPDFParser(chunker=TextChunker(chunk_size=200, chunk_overlap=30))
    documents = parser.parse_pdf(file_bytes=pdf_bytes, filename=filename)

    assert len(documents) >= 2

    # Group by page number
    page1_docs = [d for d in documents if d.metadata.get("page_number") == 1]
    page2_docs = [d for d in documents if d.metadata.get("page_number") == 2]

    assert len(page1_docs) >= 1
    assert len(page2_docs) >= 1

    # Verify Page 1 chunk metadata
    for doc in page1_docs:
        assert doc.metadata["document_name"] == filename
        assert doc.metadata["page_number"] == 1
        assert doc.metadata["total_pages"] == 2
        assert "Sovereign-Core" in doc.content
        assert doc.metadata["source"] == f"{filename} (Page 1)"

    # Verify Page 2 chunk metadata
    for doc in page2_docs:
        assert doc.metadata["document_name"] == filename
        assert doc.metadata["page_number"] == 2
        assert doc.metadata["total_pages"] == 2
        assert "ChromaDB" in doc.content or "PyMuPDF" in doc.content
        assert doc.metadata["source"] == f"{filename} (Page 2)"
