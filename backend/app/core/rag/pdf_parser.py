"""PDF document parser using PyMuPDF (fitz) with page-level metadata retention."""

import re
from typing import List, Optional

import pymupdf

from app.core.interfaces.rag import Document
from app.core.rag.chunker import TextChunker


class PyMuPDFParser:
    """Extracts text page-by-page from PDFs and chunks with source provenance."""

    def __init__(self, chunker: Optional[TextChunker] = None) -> None:
        self.chunker = chunker or TextChunker()

    def parse_pdf(self, file_bytes: bytes, filename: str) -> List[Document]:
        """Extract text from PDF byte stream and return chunked Document objects.

        Every chunk preserves:
        - document_name: exact original filename
        - page_number: 1-indexed page where the text originates
        - total_pages: page count of the PDF document
        - chunk_index: index of the chunk within the page
        - source: human-readable citation string (e.g. "report.pdf (Page 2)")
        """
        clean_name = re.sub(r"[^\w\-.]", "_", filename)
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        total_pages = len(doc)
        all_chunks: List[Document] = []

        try:
            for page_idx in range(total_pages):
                page_num = page_idx + 1
                page = doc[page_idx]
                page_text = page.get_text()

                if not page_text.strip():
                    continue

                page_metadata = {
                    "document_name": filename,
                    "page_number": page_num,
                    "total_pages": total_pages,
                    "source": f"{filename} (Page {page_num})",
                }

                page_prefix = f"{clean_name}_p{page_num}"
                chunks = self.chunker.create_chunks(
                    text=page_text,
                    base_metadata=page_metadata,
                    doc_id_prefix=page_prefix,
                )
                all_chunks.extend(chunks)
        finally:
            doc.close()

        return all_chunks
