"""RAG document ingestion, PDF parsing, and similarity search router."""

import datetime
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.v1.chat import get_audit_logger
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.rag import BaseRetriever, Document, SearchResult
from app.core.rag.chroma import ChromaVectorStore
from app.core.rag.chunker import TextChunker
from app.core.rag.pdf_parser import PyMuPDFParser

router = APIRouter(prefix="/rag", tags=["RAG"])

# Shared RAG retriever instance backed by ChromaDB
_shared_retriever: Optional[BaseRetriever] = None


def get_retriever() -> BaseRetriever:
    global _shared_retriever
    if _shared_retriever is None:
        _shared_retriever = ChromaVectorStore()
    return _shared_retriever


class IngestRequest(BaseModel):
    documents: List[Document]


class IngestResponse(BaseModel):
    indexed_count: int
    document_ids: List[str]


class UploadResponse(BaseModel):
    filename: str
    total_pages: int
    total_chunks: int
    document_ids: List[str]
    status: str = "indexed"


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=4, ge=1, le=20)
    score_threshold: Optional[float] = None


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf_document(
    file: UploadFile = File(...),
    chunk_size: Optional[int] = Form(default=None),
    chunk_overlap: Optional[int] = Form(default=None),
    retriever: BaseRetriever = Depends(get_retriever),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> UploadResponse:
    """Upload and parse a PDF document with PyMuPDF, chunking and indexing into ChromaDB."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported for upload.")

    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    parser = PyMuPDFParser(chunker=chunker)

    try:
        chunks = parser.parse_pdf(file_bytes=content_bytes, filename=file.filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF document: {str(exc)}")

    if not chunks:
        raise HTTPException(status_code=400, detail="No extractable text found in the PDF document.")

    doc_ids = await retriever.add_documents(chunks)
    total_pages = chunks[0].metadata.get("total_pages", 1) if chunks else 1

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_INGEST,
            payload={
                "filename": file.filename,
                "pages": total_pages,
                "chunks_indexed": len(doc_ids),
                "ids": doc_ids,
            },
        )
    )

    return UploadResponse(
        filename=file.filename,
        total_pages=total_pages,
        total_chunks=len(doc_ids),
        document_ids=doc_ids,
        status="indexed",
    )


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    request: IngestRequest,
    retriever: BaseRetriever = Depends(get_retriever),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> IngestResponse:
    """Index one or more text documents for vector similarity search."""
    doc_ids = await retriever.add_documents(request.documents)
    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_INGEST,
            payload={"count": len(doc_ids), "ids": doc_ids},
        )
    )
    return IngestResponse(indexed_count=len(doc_ids), document_ids=doc_ids)


@router.post("/search", response_model=List[SearchResult])
async def search_documents(
    request: SearchRequest,
    retriever: BaseRetriever = Depends(get_retriever),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> List[SearchResult]:
    """Execute vector similarity search over indexed documents with citation metadata."""
    results = await retriever.search(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
    )
    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_QUERY,
            prompt_preview=request.query[:100],
            payload={"top_k": request.top_k, "results_found": len(results)},
        )
    )
    return results


@router.get("/stats")
async def get_rag_stats(
    retriever: BaseRetriever = Depends(get_retriever),
) -> Dict[str, Any]:
    """Return current vector store statistics."""
    count = await retriever.count()
    return {"total_documents": count, "backend": retriever.__class__.__name__}


@router.delete("/clear")
async def clear_rag(
    retriever: BaseRetriever = Depends(get_retriever),
) -> Dict[str, str]:
    """Clear all indexed documents."""
    await retriever.clear()
    return {"status": "cleared"}
