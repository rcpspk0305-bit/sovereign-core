---
title: Vector Store Interface Conformance and Test Isolation for Local RAG
date: 2026-09-11
category: test-failures
module: backend/app/core/rag
problem_type: test_failure
component: testing_framework
symptoms:
  - "DimensionalityMismatchError 422 in test_rag_interface.py when running offline test client"
  - "Persistent test document contamination in production data/chroma directory"
  - "TypeError when passing filters and collection kwargs to InMemoryVectorStore"
root_cause: test_isolation
resolution_type: code_fix
severity: high
tags: [rag, vector-store, test-isolation, lsp-conformance, fast-api-dependency-override]
---

# Vector Store Interface Conformance and Test Isolation for Local RAG

## Problem
Running the RAG API integration tests (`backend/tests/test_rag_interface.py`) caused runtime errors (`DimensionalityMismatchError: Embedding dimension 16 does not match collection dimensionality 768`) and contaminated the production vector database at `backend/data/chroma/`. Concurrently, swapping the production Chroma backend for `InMemoryVectorStore` failed LSP type contracts with missing methods and signature parameters.

## Symptoms
- `backend/tests/test_rag_interface.py` failed with HTTP 422: `chromadb.errors.DimensionalityMismatchError` because test fixtures uploaded documents with mock 16-dimensional embeddings into an existing 768-dimensional Chroma collection on disk.
- Test runs altered persistent files under `backend/data/chroma/`, causing flaky subsequent test executions and state pollution across developer workstations.
- Calls to `retriever.search(query, filters=..., collection=...)` crashed on `InMemoryVectorStore` with `TypeError: unexpected keyword argument`.
- Calls to `retriever.list_documents()` and `retriever.delete_document()` raised `AttributeError` on `InMemoryVectorStore`.

## What Didn't Work
- Relying on filesystem teardowns after test runs: Even with directory deletion hooks, running tests concurrently or aborting early left orphan SQLite and binary index files in `backend/data/chroma/`.
- Relying on default dependency overrides in `backend/tests/conftest.py`: The `test_client` fixture overrode `get_llm_provider`, `get_llm_service`, and `get_audit_logger`, but omitted `get_retriever`, allowing routes in `backend/app/api/v1/rag.py` to fall back to the default production `ChromaVectorStore`.

## Solution

### 1. Enforce Full Interface Conformance on InMemoryVectorStore
Updated `backend/app/core/rag/in_memory.py` to fully implement `BaseRetriever` specifications, adding `backend_name`, `filters`, `collection`, `**kwargs`, `list_documents()`, and `delete_document()`:

```python
# backend/app/core/rag/in_memory.py
class InMemoryVectorStore(BaseRetriever):
    backend_name: str = "in_memory"

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        collection: Optional[str] = None,
        **kwargs: Any,
    ) -> List[SearchResult]:
        if not self.documents:
            return []
        query_embedding = await self.embedding_provider.embed_query(query)
        scored_results: List[SearchResult] = []
        for doc in self.documents.values():
            if not doc.embedding:
                continue
            if filters:
                if not all(doc.metadata.get(k) == v for k, v in filters.items()):
                    continue
            score = cosine_similarity(query_embedding, doc.embedding)
            if score_threshold is not None and score < score_threshold:
                continue
            scored_results.append(SearchResult(document=doc, score=score))
        scored_results.sort(key=lambda x: x.score, reverse=True)
        return scored_results[:top_k]

    async def list_documents(self) -> List[Dict[str, Any]]:
        docs_map: Dict[str, Dict[str, Any]] = {}
        for doc in self.documents.values():
            name = doc.metadata.get("document_name", "unknown")
            if name not in docs_map:
                docs_map[name] = {"filename": name, "total_chunks": 0, "pages": set()}
            docs_map[name]["total_chunks"] += 1
            if "page_number" in doc.metadata:
                docs_map[name]["pages"].add(doc.metadata["page_number"])
        return [
            {"filename": k, "total_chunks": v["total_chunks"], "pages": len(v["pages"]) if v["pages"] else 1}
            for k, v in docs_map.items()
        ]

    async def delete_document(self, filename: str) -> Dict[str, Any]:
        ids_to_del = [
            d_id for d_id, doc in self.documents.items()
            if doc.metadata.get("document_name") == filename
        ]
        await self.delete(ids_to_del)
        return {"status": "deleted", "filename": filename, "chunks_deleted": len(ids_to_del)}
```

### 2. Isolate FastAPI Test Client from Disk Persistence
Overrode the `get_retriever` dependency in `backend/tests/conftest.py` so that all route handlers mount an ephemeral, in-memory store:

```python
# backend/tests/conftest.py
@pytest.fixture
def test_client(
    mock_llm_client: MockLLMClient,
    in_memory_audit_logger: FileAndMemoryAuditLogger,
    in_memory_vector_store: InMemoryVectorStore,
) -> TestClient:
    app = create_application()
    from app.api.v1.chat import get_audit_logger
    from app.api.v1.rag import get_retriever

    app.dependency_overrides[get_llm_provider] = lambda: mock_llm_client
    app.dependency_overrides[get_llm_service] = lambda: LLMService(mock_llm_client)
    app.dependency_overrides[get_audit_logger] = lambda: in_memory_audit_logger
    app.dependency_overrides[get_retriever] = lambda: in_memory_vector_store
    return TestClient(app)
```

## Why This Works
1. **Zero Disk I/O Side Effects**: In-memory stores exist solely in process RAM during fixture lifespan and are cleanly garbage collected when each test function exits. Production `data/chroma` is never opened or mutated.
2. **Strict Liskov Substitution Principle**: Route handlers and agent tools call `.search(..., filters=...)`, `.list_documents()`, and `.delete_document()`. Both `ChromaVectorStore` and `InMemoryVectorStore` adhere to the exact same contract.

## Prevention
- Always verify that mock or test vector stores inherit and fully implement all abstract methods of `BaseRetriever`.
- Ensure any test client accessing API endpoints overrides external persistence layers (`get_retriever`, `get_audit_logger`, `get_llm_provider`).
- Validate embedding dimension consistency between mock embedding providers and target vector collections.

## Related Issues
- `backend/tests/test_rag_interface.py`: All 6 test suites now pass without touching persistent storage.
- `backend/tests/test_real_life_use_cases.py`: Utilizes `InMemoryVectorStore` across all 7 enterprise scenario simulations.
