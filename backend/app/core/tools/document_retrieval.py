"""Document Retrieval Tool for semantic vector search across indexed documents."""

import time
from typing import Any, Dict, List, Optional

from app.core.interfaces.rag import BaseRetriever
from app.core.interfaces.tools import BaseTool, ToolDefinition, ToolResult


class DocumentRetrievalTool(BaseTool):
    """Controlled tool for retrieving document chunks with source provenance."""

    def __init__(self, retriever: BaseRetriever) -> None:
        self.retriever = retriever

    @property
    def name(self) -> str:
        return "document_retrieval"

    @property
    def description(self) -> str:
        return (
            "Search and retrieve relevant text chunks from locally ingested documents "
            "and knowledge base. Returns text contents, document names, and page numbers for source verification."
        )

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query or concept to look up in the document repository.",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Maximum number of chunks to retrieve (1 to 10). Default is 4.",
                        "default": 4,
                        "minimum": 1,
                        "maximum": 10,
                    },
                    "score_threshold": {
                        "type": "number",
                        "description": "Optional minimum similarity threshold between 0.0 and 1.0.",
                        "minimum": 0.0,
                        "maximum": 1.0,
                    },
                },
                "required": ["query"],
            },
        )

    async def execute(self, **kwargs: Any) -> ToolResult:
        start = time.perf_counter()
        query = kwargs.get("query")
        if not query or not isinstance(query, str) or not query.strip():
            return ToolResult(
                success=False,
                output=None,
                error="Required parameter 'query' must be a non-empty string.",
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )

        top_k = kwargs.get("top_k", 4)
        try:
            top_k = int(top_k)
            top_k = max(1, min(10, top_k))
        except (ValueError, TypeError):
            top_k = 4

        score_threshold = kwargs.get("score_threshold")
        if score_threshold is not None:
            try:
                score_threshold = float(score_threshold)
            except (ValueError, TypeError):
                score_threshold = None

        try:
            results = await self.retriever.search(
                query=query.strip(),
                top_k=top_k,
                score_threshold=score_threshold,
            )

            formatted_chunks: List[Dict[str, Any]] = []
            for r in results:
                meta = r.document.metadata or {}
                formatted_chunks.append({
                    "content": r.document.content,
                    "document_name": meta.get("document_name", "unknown"),
                    "page_number": meta.get("page_number", 1),
                    "chunk_index": meta.get("chunk_index", 0),
                    "source": meta.get("source", f"{meta.get('document_name', 'unknown')} (Page {meta.get('page_number', 1)})"),
                    "similarity_score": r.score,
                })

            elapsed = (time.perf_counter() - start) * 1000.0
            return ToolResult(
                success=True,
                output={
                    "query": query.strip(),
                    "retrieved_count": len(formatted_chunks),
                    "chunks": formatted_chunks,
                },
                execution_time_ms=round(elapsed, 2),
            )
        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000.0
            return ToolResult(
                success=False,
                output=None,
                error=f"Document retrieval failed: {str(exc)}",
                execution_time_ms=round(elapsed, 2),
            )
