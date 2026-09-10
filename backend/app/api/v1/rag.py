"""RAG document ingestion, PDF parsing, and similarity search router."""

import datetime
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.v1.chat import get_audit_logger
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.rag import (
    BaseRetriever,
    DimensionalityMismatchError,
    Document,
    SearchResult,
    VectorStoreHealth,
)
from app.config import settings
from app.core.rag.chroma import ChromaStore
from app.core.rag.chunker import TextChunker
from app.core.rag.migration import MigrationResult, migrate_chroma_to_qdrant
from app.core.rag.pdf_parser import PyMuPDFParser
from app.core.rag.service import get_vector_store
from app.integrations.qdrant.adapter import QdrantStore

router = APIRouter(prefix="/rag", tags=["RAG"])


def get_retriever() -> BaseRetriever:
    """Dependency provider for the configured vector store backend."""
    return get_vector_store()


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
    filters: Optional[Dict[str, Any]] = None
    collection: Optional[str] = None


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf_document(
    file: UploadFile = File(...),
    chunk_size: Optional[int] = Form(default=None),
    chunk_overlap: Optional[int] = Form(default=None),
    retriever: BaseRetriever = Depends(get_retriever),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> UploadResponse:
    """Upload and parse a PDF document with PyMuPDF, chunking and indexing into the active vector store."""
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

    try:
        doc_ids = await retriever.add_documents(chunks)
    except DimensionalityMismatchError as d_err:
        raise HTTPException(status_code=422, detail=str(d_err))

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
                "backend": getattr(retriever, "backend_name", retriever.__class__.__name__),
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
    """Index one or more text documents into the active vector store."""
    try:
        doc_ids = await retriever.add_documents(request.documents)
    except DimensionalityMismatchError as d_err:
        raise HTTPException(status_code=422, detail=str(d_err))

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_INGEST,
            payload={
                "count": len(doc_ids),
                "ids": doc_ids,
                "backend": getattr(retriever, "backend_name", retriever.__class__.__name__),
            },
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
    try:
        results = await retriever.search(
            query=request.query,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            filters=request.filters,
            collection=request.collection,
        )
    except DimensionalityMismatchError as d_err:
        raise HTTPException(status_code=422, detail=str(d_err))

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_QUERY,
            prompt_preview=request.query[:100],
            payload={
                "top_k": request.top_k,
                "results_found": len(results),
                "backend": getattr(retriever, "backend_name", retriever.__class__.__name__),
                "filters": request.filters,
            },
        )
    )
    return results


@router.get("/health", response_model=VectorStoreHealth)
async def get_vector_store_health(
    retriever: BaseRetriever = Depends(get_retriever),
) -> VectorStoreHealth:
    """Return live health and metadata of the active vector store backend."""
    return await retriever.health()


@router.get("/stats")
async def get_rag_stats(
    retriever: BaseRetriever = Depends(get_retriever),
) -> Dict[str, Any]:
    """Return current vector store statistics and backend identity."""
    health = await retriever.health()
    return {
        "total_documents": health.total_documents,
        "total_vectors": health.total_vectors,
        "backend": health.backend,
        "collection": health.collection,
        "dimension": health.dimension,
        "status": health.status,
    }


@router.get("/documents")
async def list_documents(
    retriever: BaseRetriever = Depends(get_retriever),
) -> List[Dict[str, Any]]:
    """List all indexed documents/attachments with metadata via the backend abstraction."""
    return await retriever.list_documents()


@router.delete("/documents/{filename}")
async def delete_document(
    filename: str,
    retriever: BaseRetriever = Depends(get_retriever),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> Dict[str, Any]:
    """Delete all chunks for a specific document filename."""
    res = await retriever.delete_document(filename)
    deleted_count = res.get("chunks_deleted", 0)

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_INGEST,
            payload={
                "action": "delete",
                "filename": filename,
                "chunks_deleted": deleted_count,
                "backend": getattr(retriever, "backend_name", retriever.__class__.__name__),
            },
        )
    )
    return res


@router.delete("/clear")
async def clear_rag(
    retriever: BaseRetriever = Depends(get_retriever),
) -> Dict[str, str]:
    """Clear all indexed documents from the active vector store."""
    await retriever.clear()
    return {"status": "cleared"}


@router.post("/migrate", response_model=MigrationResult)
async def migrate_to_qdrant(
    verify_sample: bool = True,
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> MigrationResult:
    """Safely migrate all documents from ChromaDB into Qdrant vector database."""
    if not getattr(settings, "ENABLE_QDRANT", False):
        raise HTTPException(
            status_code=400,
            detail="Qdrant integration is disabled in settings (ENABLE_QDRANT=False). Set ENABLE_QDRANT=true in .env to enable migration.",
        )

    source_chroma = ChromaStore()
    target_qdrant = QdrantStore()

    result = await migrate_chroma_to_qdrant(
        source_store=source_chroma,
        target_store=target_qdrant,
        verify_sample=verify_sample,
    )

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.RAG_INGEST,
            payload={
                "action": "migrate_chroma_to_qdrant",
                "success": result.success,
                "migrated_count": result.migrated_count,
                "error": result.error,
            },
        )
    )

    if not result.success:
        err = result.error or "Migration failed"
        if "disabled" in err.lower() or "mismatch" in err.lower():
            raise HTTPException(status_code=400, detail=err)
        raise HTTPException(status_code=500, detail=err)

    return result

