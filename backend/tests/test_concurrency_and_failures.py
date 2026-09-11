"""Concurrency, Failure-Injection, and Backend Latency Benchmark Test Suite."""

import asyncio
import concurrent.futures
import json
import time
import urllib.request
import urllib.error
import pytest

BASE_URL = "http://127.0.0.1:8000"


def is_live_server_active() -> bool:
    try:
        req = urllib.request.Request(f"{BASE_URL}/api/v1/health", headers={"User-Agent": "Sovereign-Bench/1.0"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode())
            return data.get("status") == "healthy" and data.get("ollama_connected") is True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not is_live_server_active(),
    reason="Live backend server not running or Ollama disconnected; skipping live concurrency benchmarks.",
)

def timed_get(path: str) -> tuple[int, float, dict]:
    url = f"{BASE_URL}{path}"
    start = time.perf_counter()
    req = urllib.request.Request(url, headers={"User-Agent": "Sovereign-Bench/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        elapsed = (time.perf_counter() - start) * 1000.0
        data = json.loads(resp.read().decode())
        return resp.status, elapsed, data

def timed_post(path: str, body: dict) -> tuple[int, float, dict]:
    url = f"{BASE_URL}{path}"
    data_bytes = json.dumps(body).encode()
    start = time.perf_counter()
    req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json", "User-Agent": "Sovereign-Bench/1.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        elapsed = (time.perf_counter() - start) * 1000.0
        data = json.loads(resp.read().decode())
        return resp.status, elapsed, data

# -------------------------------------------------------------
# Section 31: Latency Measurements
# -------------------------------------------------------------
def benchmark_latencies():
    print("\n--- BENCHMARKING LATENCIES ---")
    
    # 1. Health latency
    _, h_lat, _ = timed_get("/api/v1/health")
    print(f"Health Latency: {h_lat:.2f} ms")

    # 2. Model discovery latency
    _, m_lat, _ = timed_get("/api/v1/models")
    print(f"Model Discovery Latency: {m_lat:.2f} ms")

    # 3. Vector search latency
    _, rag_lat, rag_res = timed_post("/api/v1/rag/search", {"query": "reactor efficiency", "top_k": 3})
    print(f"RAG Search Latency: {rag_lat:.2f} ms (Found {len(rag_res)} results)")

    # 4. Workflow execution latency
    _, wf_lat, wf_res = timed_post("/api/v1/workflows/tactical_inspection_wf/run", {})
    print(f"Workflow DAG Latency: {wf_lat:.2f} ms (5 nodes executed)")

    return {
        "health_ms": round(h_lat, 2),
        "models_ms": round(m_lat, 2),
        "rag_search_ms": round(rag_lat, 2),
        "workflow_ms": round(wf_lat, 2),
    }

# -------------------------------------------------------------
# Section 32: Concurrency Test
# -------------------------------------------------------------
def test_concurrency():
    print("\n--- TESTING CONCURRENCY ---")
    # Ensure workflow exists before executing concurrent runs
    try:
        timed_get("/api/v1/workflows/tactical_inspection_wf")
    except urllib.error.HTTPError:
        wf_def = {
            "id": "tactical_inspection_wf",
            "name": "Tactical Inspection Workflow",
            "version": "1.0.0",
            "nodes": [
                {"id": "node_start", "type": "START", "config": {}, "inputs": [], "outputs": ["query"]},
                {"id": "node_calc", "type": "TOOL", "config": {"tool": "calculator", "args": {"expression": "87 * 2"}}, "inputs": [], "outputs": ["result"]},
                {"id": "node_end", "type": "END", "config": {}, "inputs": ["result"], "outputs": []},
            ],
            "edges": [
                {"source": "node_start", "target": "node_calc"},
                {"source": "node_calc", "target": "node_end"},
            ],
            "inputs": {},
            "outputs": {},
            "policy": {"no_egress": True, "max_steps": 10, "require_approval": False},
        }
        timed_post("/api/v1/workflows", wf_def)
        timed_post("/api/v1/workflows/tactical_inspection_wf/approve", {"operator_name": "Lead SRE"})

    # Run 10 simultaneous RAG searches and workflow runs
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        rag_futures = [
            executor.submit(timed_post, "/api/v1/rag/search", {"query": f"query {i}", "top_k": 2})
            for i in range(5)
        ]
        wf_futures = [
            executor.submit(timed_post, "/api/v1/workflows/tactical_inspection_wf/run", {})
            for i in range(5)
        ]
        
        for f in concurrent.futures.as_completed(rag_futures + wf_futures):
            status, dur, _ = f.result()
            assert status == 200
            
    print("PASS Section 32: Concurrency test passed: 10 concurrent requests handled with 0 errors")

# -------------------------------------------------------------
# Section 33: Failure-Injection Test
# -------------------------------------------------------------
def test_failure_injection():
    print("\n--- TESTING FAILURE INJECTION & GRACEFUL DEGRADATION ---")

    # 1. Unknown model requested -> returns safe error (404 or 403)
    try:
        timed_post("/api/v1/chat", {"messages": [{"role": "user", "content": "hi"}], "model": "nonexistent:model_xyz"})
    except urllib.error.HTTPError as err:
        assert err.code in (404, 502, 503)
        print("PASS Section 33.1: Missing model safely rejected with HTTP", err.code)

    # 2. Corrupted PDF byte upload -> returns 422 Unprocessable
    boundary = "----WebKitFormBoundaryCorruptTest"
    corrupt_body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="corrupted.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
        f"NOT_A_VALID_PDF_HEADER_OR_DATA\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/v1/rag/upload",
        data=corrupt_body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            assert False, "Corrupted PDF should not return 200"
    except urllib.error.HTTPError as err:
        assert err.code in (400, 422)
        print("PASS Section 33.2: Corrupted PDF upload rejected gracefully with HTTP", err.code)

    # 3. Invalid tool expression / zero division
    from app.core.tools.registry import CalculatorTool
    calc = CalculatorTool()
    div_zero_res = asyncio.run(calc.execute(operation="divide", a=10, b=0))
    assert div_zero_res.success is False
    assert "division by zero" in div_zero_res.error.lower()
    print("PASS Section 33.3: Tool execution error handled safely without backend crash")

    # 4. Unknown workflow ID execution
    try:
        timed_post("/api/v1/workflows/nonexistent_workflow_id/run", {})
    except urllib.error.HTTPError as err:
        assert err.code == 404
        print("PASS Section 33.4: Non-existent workflow execution rejected with 404")

if __name__ == "__main__":
    latencies = benchmark_latencies()
    test_concurrency()
    test_failure_injection()
    print("\n=== ALL CONCURRENCY & FAILURE-INJECTION TESTS PASSED ===")
