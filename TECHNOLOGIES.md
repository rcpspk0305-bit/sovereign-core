# Technology Stack & Architecture

This document provides a comprehensive overview of the technologies, libraries, frameworks, and architecture patterns powering **Sovereign-Core**.

---

## 1. Core Architecture Overview

Sovereign-Core is architected as an air-gapped, privacy-first AI platform that decouples interface contracts from underlying provider implementations.

```mermaid
graph TD
    Client[Next.js TypeScript Frontend] -->|REST / SSE| API[FastAPI Backend]
    API --> ServiceLayer[Typed LLM & RAG Services]
    ServiceLayer --> Interfaces[Core Interface Abstractions]
    Interfaces --> Ollama[Local Ollama: Gemma 4 E2B & Nomic Embed]
    Interfaces --> PyMuPDF[PyMuPDF Page Parser & Chunker]
    Interfaces --> ChromaDB[ChromaDB Vector Store]
    Interfaces --> Tools[Tool Registry & Execution Engine]
    Interfaces --> Audit[Structured Audit Logger]
```

---

## 2. Backend Technologies

| Technology | Version / Spec | Purpose & Role |
| :--- | :--- | :--- |
| **Python** | `3.11+` | Primary backend language utilizing modern async/await patterns and type annotations. |
| **FastAPI** | `^0.115.0` | High-performance asynchronous REST API framework providing automatic OpenAPI / Swagger documentation, dependency injection, and streaming response support. |
| **Uvicorn** | `^0.32.0` | Lightning-fast ASGI web server implementation for Python. |
| **Pydantic** | `^2.9.0` | Data validation, settings management (`pydantic-settings`), and strict schema serialization across all API contracts and tool definitions. |
| **HTTPX** | `^0.27.0` | Fully asynchronous HTTP client for non-blocking communication with the local Ollama daemon and external APIs with fine-grained timeout controls. |
| **PyMuPDF** | `^1.24.0` | High-performance PDF parser used for page-by-page text and layout extraction, retaining exact page coordinates and metadata. |
| **ChromaDB** | `^0.5.0` | Local persistent embedding database using SQLite/DuckDB storage and HNSW cosine distance space for vector indexing and semantic nearest-neighbor retrieval. |
| **Pytest** | `^8.3.0` | Test runner powering the unit, integration, and contract test suite (`pytest-asyncio`, `anyio`, `pytest-cov`). |

---

## 3. Local AI & LLM Models

| Component | Default Model / Engine | Purpose |
| :--- | :--- | :--- |
| **Ollama** | Daemon (`http://localhost:11434`) | Local execution engine for quantized GGUF models running natively on GPU/CPU without cloud telemetry. |
| **Default Chat LLM** | `gemma4:e2b` | Default lightweight, high-reasoning local foundation model by Google DeepMind. |
| **Alternative LLM** | `gemma4:e4b-it-qat` | Quantized instruct model for advanced local reasoning. |
| **Embedding Model** | `nomic-embed-text:latest` | 768-dimensional neural vector embedding model tuned for retrieval tasks and cosine similarity indexing. |
| **Deterministic Fallback** | `SimpleEmbeddingProvider` | Built-in zero-dependency vector provider used during offline development or testing. |

---

## 4. Frontend Technologies

| Technology | Version / Spec | Purpose & Role |
| :--- | :--- | :--- |
| **Next.js** | `^16.3.4` | Production React framework utilizing App Router, Server Components, and Turbopack bundler. |
| **React** | `^19.0.0` | Declarative UI library for building reactive client interfaces. |
| **TypeScript** | `^5.0.0` | Static type safety end-to-end matching backend Pydantic schemas. |
| **Lucide React** | `^1.16.0` | Clean, modern iconography across all workbench dashboards. |
| **Modern Styling** | Vanilla CSS Tokens | Sleek dark-mode aesthetic with CSS variables, glowing indicators, responsive grid layouts, and micro-interactions. |

---

## 5. Storage & Persistence

| Store | Location | Purpose |
| :--- | :--- | :--- |
| **ChromaDB Vector Store** | `./backend/data/chroma` | Persistent vector index holding chunk embeddings, document provenance, and page metadata. |
| **Audit Logs** | `./backend/data/audit.jsonl` | Append-only structured JSONL audit stream recording token usage, latencies, model parameters, and safety events. |
| **In-Memory Cache** | Process memory | High-speed cache for session diagnostics, active tools, and ephemeral streaming states. |

---

## 6. Containerization & DevOps

| Tool | Purpose |
| :--- | :--- |
| **Docker** | Multi-stage production container builds for frontend and backend. |
| **Docker Compose** | Multi-container local orchestration with host-gateway bridging (`host.docker.internal`) to allow containers to access host GPU-accelerated Ollama. |
