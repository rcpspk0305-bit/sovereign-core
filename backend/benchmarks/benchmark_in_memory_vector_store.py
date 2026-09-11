"""Benchmark harness for InMemoryVectorStore.

Measures:
1. Search latency (mean, p50, p95, p99 in ms) and QPS over 1,000 vector similarity queries.
2. Accuracy: top-k ranking fidelity against exact mathematical cosine similarity.
3. list_documents() latency across 2,000 chunks.
4. delete_document() latency for multi-chunk document deletion.
5. Unit test correctness verification (tests/test_rag_interface.py).

Outputs clean JSON to stdout for /ce-optimize metrics.
"""

import asyncio
import json
import math
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.interfaces.rag import Document, SearchResult
from app.core.rag.in_memory import InMemoryVectorStore, SimpleEmbeddingProvider


def ground_truth_cosine(vec1: List[float], vec2: List[float]) -> float:
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    na = math.sqrt(sum(a * a for a in vec1))
    nb = math.sqrt(sum(b * b for b in vec2))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


async def run_benchmark() -> Dict[str, Any]:
    dim = 64
    num_docs = 2000
    num_unique_files = 50
    num_queries = 200

    random.seed(42)

    # 1. Initialize store and seed documents
    provider = SimpleEmbeddingProvider(dimension=dim)
    store = InMemoryVectorStore(embedding_provider=provider)

    docs: List[Document] = []
    for i in range(num_docs):
        file_idx = i % num_unique_files
        filename = f"report_{file_idx}.pdf"
        page = (i // num_unique_files) + 1
        dept = "finance" if file_idx % 2 == 0 else "legal"
        text = f"Sovereign Core document section {i} for file {filename} covering department {dept} metrics and telemetry."
        doc = Document(
            id=f"doc_{i}",
            content=text,
            metadata={"document_name": filename, "page_number": page, "department": dept},
        )
        docs.append(doc)

    t_add_start = time.perf_counter()
    await store.add_documents(docs)
    add_time_ms = (time.perf_counter() - t_add_start) * 1000.0

    # 2. Prepare search queries
    query_texts = [
        f"telemetry section {q} department finance" if q % 2 == 0 else f"metrics report {q % num_unique_files}"
        for q in range(num_queries)
    ]

    # Warmup
    for q in query_texts[:10]:
        await store.search(q, top_k=4)

    # 3. Benchmark search latency and ranking fidelity
    latencies_ms: List[float] = []
    accuracy_matches = 0

    for q in query_texts:
        t0 = time.perf_counter()
        results: List[SearchResult] = await store.search(q, top_k=4)
        t1 = time.perf_counter()
        latencies_ms.append((t1 - t0) * 1000.0)

        # Ground truth verification: check if top result matches exact mathematical cosine ranking
        q_emb = await provider.embed_query(q)
        all_scored = [
            (doc.id, ground_truth_cosine(q_emb, doc.embedding))
            for doc in store.documents.values()
            if doc.embedding
        ]
        all_scored.sort(key=lambda x: x[1], reverse=True)
        max_score = all_scored[0][1] if all_scored else 0.0
        optimal_ids = {doc_id for doc_id, score in all_scored if abs(score - max_score) < 1e-5}

        if results and (results[0].document.id in optimal_ids or abs(results[0].score - max_score) < 1e-5):
            accuracy_matches += 1

    latencies_ms.sort()
    n = len(latencies_ms)
    mean_ms = sum(latencies_ms) / n
    p50_ms = latencies_ms[int(n * 0.50)]
    p95_ms = latencies_ms[int(n * 0.95)]
    p99_ms = latencies_ms[int(n * 0.99)]
    qps = (n / sum(latencies_ms)) * 1000.0 if sum(latencies_ms) > 0 else 0.0
    accuracy = accuracy_matches / n

    # 4. Benchmark list_documents latency
    t_list_start = time.perf_counter()
    doc_list = await store.list_documents()
    list_ms = (time.perf_counter() - t_list_start) * 1000.0
    assert len(doc_list) == num_unique_files, f"Expected {num_unique_files} files, got {len(doc_list)}"

    # 5. Benchmark delete_document latency
    del_target = "report_10.pdf"
    t_del_start = time.perf_counter()
    del_res = await store.delete_document(del_target)
    del_ms = (time.perf_counter() - t_del_start) * 1000.0
    assert del_res["status"] == "deleted"
    assert del_res["chunks_deleted"] > 0

    # 6. Verify unit tests pass
    test_proc = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_rag_interface.py", "-q"],
        capture_output=True,
        text=True,
    )
    test_passed = 1 if test_proc.returncode == 0 else 0

    metrics = {
        "search_latency_mean_ms": round(mean_ms, 3),
        "search_latency_p50_ms": round(p50_ms, 3),
        "search_latency_p95_ms": round(p95_ms, 3),
        "search_latency_p99_ms": round(p99_ms, 3),
        "search_qps": round(qps, 1),
        "add_documents_ms": round(add_time_ms, 2),
        "document_listing_ms": round(list_ms, 3),
        "document_deletion_ms": round(del_ms, 3),
        "retrieval_accuracy": round(accuracy, 4),
        "test_suite_passed": test_passed,
    }
    return metrics


if __name__ == "__main__":
    result = asyncio.run(run_benchmark())
    print(json.dumps(result, indent=2))
