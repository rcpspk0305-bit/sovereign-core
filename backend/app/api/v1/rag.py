"""RAG document ingestion and similarity search router."""

import datetime
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.v1.chat import get_audit_logger
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.rag import BaseRetriever, Document, SearchResult
from app.core.rag.in_memory import InMemoryVectorStore

router = APIRouter(prefix="/rag", tags=["RAG"])

# Shared RAG retriever instance
_shared_retriever = InMemoryVectorStore()


def get_retriever() -> BaseRetriever:
    return _shared_retriever


class IngestRequest(BaseModel):
    documents: List[Document]


class IngestResponse(BaseModel):
    indexed_count: int
    document_ids: List[str]


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=4, ge=1, le=20)
    score_threshold: Optional[float] = None


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
    """Execute vector similarity search over indexed documents."""
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
    return {"total_documents": count, "backend": "InMemoryVectorStore"}


@router.delete("/clear")
async def clear_rag(
    retriever: BaseRetriever = Depends(get_retriever),
) -> Dict[str, str]:
    """Clear all indexed documents."""
    await retriever.clear()
    return {"status": "cleared"}
