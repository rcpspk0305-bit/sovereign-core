"""Text chunking utility for RAG indexing with metadata propagation."""

import uuid
from typing import Any, Dict, List, Optional

from app.config import settings
from app.core.interfaces.rag import Document


class TextChunker:
    """Sliding-window text chunker respecting natural sentence and paragraph boundaries."""

    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> None:
        self.chunk_size = chunk_size or settings.RAG_CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.RAG_CHUNK_OVERLAP
        if self.chunk_overlap >= self.chunk_size:
            self.chunk_overlap = max(0, self.chunk_size // 4)

    def split_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks respecting natural boundaries."""
        clean_text = text.strip()
        if not clean_text:
            return []
        if len(clean_text) <= self.chunk_size:
            return [clean_text]

        chunks: List[str] = []
        start = 0
        text_len = len(clean_text)

        while start < text_len:
            end = min(start + self.chunk_size, text_len)

            if end < text_len:
                # Attempt to break at paragraph, sentence, or word boundary
                slice_window = clean_text[start:end]
                # Check for double newline (paragraph boundary)
                break_idx = slice_window.rfind("\n\n")
                if break_idx != -1 and break_idx > self.chunk_size // 3:
                    end = start + break_idx + 2
                else:
                    # Check for sentence end
                    sentence_breaks = [
                        slice_window.rfind(". "),
                        slice_window.rfind("! "),
                        slice_window.rfind("? "),
                        slice_window.rfind(".\n"),
                    ]
                    valid_sentence_breaks = [b for b in sentence_breaks if b > self.chunk_size // 3]
                    if valid_sentence_breaks:
                        end = start + max(valid_sentence_breaks) + 2
                    else:
                        # Fallback to word boundary
                        space_idx = slice_window.rfind(" ")
                        if space_idx != -1 and space_idx > self.chunk_size // 3:
                            end = start + space_idx + 1

            chunk_str = clean_text[start:end].strip()
            if chunk_str:
                chunks.append(chunk_str)

            if end >= text_len:
                break

            # Advance by chunk_size - overlap
            advance = max(1, (end - start) - self.chunk_overlap)
            start += advance

        return chunks

    def create_chunks(
        self,
        text: str,
        base_metadata: Optional[Dict[str, Any]] = None,
        doc_id_prefix: Optional[str] = None,
    ) -> List[Document]:
        """Chunk text and construct Document instances retaining all metadata."""
        raw_chunks = self.split_text(text)
        if not raw_chunks:
            return []

        prefix = doc_id_prefix or str(uuid.uuid4())[:8]
        documents: List[Document] = []
        total = len(raw_chunks)

        for i, chunk_text in enumerate(raw_chunks):
            meta = dict(base_metadata or {})
            meta["chunk_index"] = i
            meta["total_chunks"] = total
            if "document_name" in meta and "page_number" in meta:
                meta["source"] = f"{meta['document_name']} (Page {meta['page_number']})"

            doc = Document(
                id=f"{prefix}_chunk_{i}",
                content=chunk_text,
                metadata=meta,
            )
            documents.append(doc)

        return documents
