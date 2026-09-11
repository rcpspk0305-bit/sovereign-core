---
title: "Vector Search SIMD Acceleration and Inverted Indexing for In-Memory RAG"
date: 2026-09-11
category: performance-issues
module: backend/app/core/rag
problem_type: performance_issue
component: database
symptoms:
  - "In-memory vector similarity searches took ~100ms per query across 2,000 document chunks"
  - "Query embedding norm was redundantly recalculated N times on every search call"
  - "Document listing and deletion performed full O(N) scans across all chunk records"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [rag, vector-search, simd-acceleration, numpy, inverted-index, performance-optimization]
---

# Vector Search SIMD Acceleration and Inverted Indexing for In-Memory RAG

## Problem
In local-first and air-gapped environments, the `InMemoryVectorStore` retriever suffered from severe latency bottlenecks during semantic searches. For a modest corpus of 2,000 document chunks, each search query took ~99.1 ms, capping query throughput at only 10.1 QPS. Furthermore, document listing and multi-chunk deletions required scanning the entire dictionary sequentially.

## Symptoms
- Search queries over 2,000 document chunks exhibited a mean latency of 99.086 ms and p95 latency of 120.349 ms.
- Retrieval throughput plateaued at ~10 QPS on multi-agent test workloads.
- The `cosine_similarity` function executed $O(N)$ redundant `math.sqrt()` calls on `query_embedding` for every document in the store.
- `list_documents()` and `delete_document()` scaled linearly with total chunk count ($O(N)$) rather than file count ($O(\text{files})$).

## What Didn't Work
- Micro-optimizing pure-Python `zip()` iterations: While avoiding `range()` indices shaved ~5% of overhead, pure-Python scalar loops remained fundamentally constrained by interpreter overhead.
- Simple LRU query caching: Query text caching helped repeated queries, but did not address dynamic, multi-turn agent missions with unique search prompts.

## Solution

### 1. SIMD Matrix-Vector Dot Product & Query Norm Hoisting
Replaced scalar loops with a dense 2D float64 matrix representation (`np.ndarray`) for document embeddings. The query norm is computed once per search, and all cosine dot products are evaluated in a single vectorized BLAS operation:

```python
# backend/app/core/rag/in_memory.py
if _NUMPY_AVAILABLE and not filters:
    if self._matrix_dirty or self._matrix is None:
        self._sync_matrix()

    if self._matrix is not None and len(self._doc_ids) > 0:
        q_vec = np.array(query_embedding, dtype=np.float64)
        dot_products = np.dot(self._matrix, q_vec)
        scores = dot_products / (q_norm * self._matrix_norms)

        n_items = len(self._doc_ids)
        k = min(top_k, n_items)
        if n_items <= k:
            top_indices = np.argsort(-scores)
        else:
            partitioned = np.argpartition(-scores, k)[:k]
            top_indices = partitioned[np.argsort(-scores[partitioned])]
```

### 2. Partitioned Heap Top-K Selection
Replaced full $O(N \log N)$ sorting with `np.argpartition` for the vectorized path and a bounded min-heap (`heapq.heapreplace`) for filtered/fallback paths, dropping selection complexity to $O(N + k \log k)$ and $O(N \log k)$ respectively.

### 3. Inverted Document-Name Index
Maintained `_doc_name_to_ids: Dict[str, Set[str]]` and `_doc_name_to_pages: Dict[str, Set[int]]` during ingestion and deletion:

```python
# backend/app/core/rag/in_memory.py
async def list_documents(self) -> List[Dict[str, Any]]:
    if self._doc_name_to_ids:
        return [
            {
                "filename": name,
                "total_chunks": len(chunk_ids),
                "pages": len(self._doc_name_to_pages.get(name, set())) or 1,
            }
            for name, chunk_ids in self._doc_name_to_ids.items()
        ]
```

## Why This Works
1. **BLAS Vectorization**: Modern CPUs execute vectorized floating-point matrix multiplications using AVX2/AVX-512 vector units, processing multiple vector dimensions per clock cycle rather than interpreting Python bytecode.
2. **Elimination of Redundant Work**: Computing the query norm once ($O(d)$) rather than $N$ times ($O(N \cdot d)$) eliminates $1,999$ redundant square root and multiplication sequences per search across a 2,000-chunk store.
3. **Index Locality**: Inverted indices reduce document metadata aggregation from an $O(N)$ full table scan to $O(\text{files})$ hash lookups.

## Performance Benchmark Results
Measured with `backend/benchmarks/benchmark_in_memory_vector_store.py` (2,000 chunks, 50 files, 200 queries, dimension=64):

| Metric | Baseline | Optimized | Improvement |
| :--- | :--- | :--- | :--- |
| **Search Latency (Mean)** | 99.086 ms | **0.717 ms** | **138.2x faster (99.28% reduction)** |
| **Search Latency (p95)** | 120.349 ms | **1.854 ms** | **64.9x faster** |
| **Search Throughput** | 10.1 QPS | **1394.2 QPS** | **138.0x throughput increase** |
| **Document Listing** | 2.909 ms | **0.072 ms** | **40.4x faster** |
| **Document Deletion** | 0.594 ms | **0.189 ms** | **3.1x faster** |
| **Retrieval Accuracy** | 1.0 (100%) | **1.0 (100%)** | **Exact match (0.0% drift)** |

## Prevention
- Never perform un-hoisted mathematical reductions inside iterative document loops.
- Avoid full list sorting when only top-$k$ elements ($k \ll N$) are needed.
- Always maintain secondary inverted indices for frequently queried metadata attributes like document names.

## Related Issues
- `.context/compound-engineering/ce-optimize/in-memory-vector-store/spec.yaml`: Optimization spec and stopping rules.
- `.context/compound-engineering/ce-optimize/in-memory-vector-store/experiment-log.yaml`: Full experiment log with raw baseline and post-optimization measurements.
- `backend/tests/test_rag_interface.py`: All vector store unit tests verified passing.
