# Sovereign-Core

> Production-Quality Local AI Workbench Foundation

Sovereign-Core is an extensible, privacy-first local AI workbench built with a **FastAPI** Python backend, **Next.js TypeScript** frontend, native **Ollama** integration, **PyMuPDF** document parsing, **ChromaDB** persistent vector storage, and **Docker Compose** orchestration.

For an exhaustive breakdown of libraries, versions, models, and specifications, see [TECHNOLOGIES.md](TECHNOLOGIES.md).

---

## Key Features & Architecture

- **Local LLM Execution**: Native, async communication with local Ollama daemon using **Gemma 4 E2B** (`gemma4:e2b`) as default model, supporting streaming, prompt evaluation, and timeout handling.
- **Typed Service Abstraction**: High-level `LLMService` decouples application logic from raw Ollama endpoints, with structured exception hierarchies (`LLMConnectionError`, `LLMTimeoutError`, `LLMModelNotFoundError`).
- **Document Ingestion & RAG**:
  - **PyMuPDF Extraction**: Extracts text page-by-page from uploaded PDFs, preserving layout and page numbers.
  - **Smart Overlapping Chunker**: Splits extracted text respecting sentence and word boundaries with configurable chunk size and overlap.
  - **ChromaDB Vector Store**: Local persistent vector index using HNSW cosine distance space (`hnsw:space: cosine`) with auto-recovering dimensionality migration.
  - **Neural Embeddings**: Seamless vector generation via Ollama's `nomic-embed-text:latest` with zero-downtime deterministic fallback.
  - **Source Citation Retention**: Every indexed and retrieved chunk retains `document_name`, `page_number`, `chunk_index`, and `source` metadata so responses can cite exact origins.
- **Controlled Inspection-Analysis Agent**:
  - Single controlled reasoning agent bounded exclusively to authorized tools: `document_retrieval`, `calculator`, and `document_generation`.
  - Strict security guardrails: Zero unrestricted shell access and zero autonomous internet access with deterministic policy enforcement.
  - Step budget bounds: Configurable step count ceiling (1 to 10 steps) preventing infinite loops.
  - End-to-end audit logging: Captures structured tool calls, parameter validations, observations, and latencies.
- **Explicit Core Interfaces**:
  - `BaseLLMClient`: Abstract interface for language model providers.
  - `BaseRetriever`: Abstract interface for document indexing and vector search.
  - `BaseEmbeddingProvider`: Abstract interface for vector embedding generation.
  - `BaseTool`: Type-safe tool execution engine with Pydantic JSON schema introspection.
  - `BaseAgent`: Orchestration loop contract with multi-step reasoning traces.
  - `BaseAuditLogger`: Structured JSON audit stream capturing latency, tokens, prompts, and tool invocations.
- **Modern Frontend**: TypeScript Next.js dark-themed dashboard with live model selection, streaming chat, RAG workbench with drag-and-drop PDF upload and citation badges, tool inspector, and audit log viewer.
- **Docker Compose Ready**: One-command containerized spin-up with host-gateway resolution for local GPU-accelerated Ollama.

---

## Directory Layout

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Modular API endpoints (chat, models, rag, tools, agents, audit)
│   │   ├── core/
│   │   │   ├── interfaces/  # Abstract contracts (llm, rag, tools, agents, audit)
│   │   │   ├── llm/         # Ollama client & typed LLMService implementation
│   │   │   ├── rag/         # PyMuPDF parser, chunker, embeddings, & ChromaDB vector store
│   │   │   ├── tools/       # Tool registry & execution engine
│   │   │   ├── agents/      # Agent orchestration engine
│   │   │   └── audit/       # Structured JSON audit logger
│   │   ├── config.py        # Settings management
│   │   └── main.py          # Application entrypoint
│   ├── data/                # Persistent ChromaDB storage & audit logs
│   ├── tests/               # Pytest unit & integration test suite
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/             # App router pages & global styling
│   │   ├── components/      # UI & workbench components (Chat, RAG, Tools, Agents, Audit)
│   │   └── lib/             # API client & TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Production orchestration
├── TECHNOLOGIES.md          # Comprehensive technology stack reference
└── .env.example             # Configuration variables
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running locally (`ollama serve`)
- Pull default models:
  ```bash
  ollama run gemma4:e2b
  ollama pull nomic-embed-text
  ```
- Docker & Docker Compose (optional for containerized deployment)

### 1. Local Development (Backend)

```bash
cd backend
python -m venv .venv
# Activate virtual environment:
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run test suite
pytest -v

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
Interactive API documentation is available at `http://localhost:8000/docs`.

### 2. Local Development (Frontend)

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to access the Sovereign-Core workbench.

### 3. Docker Compose Spin-up

```bash
cp .env.example .env
docker compose up --build
```
The backend will connect to your host machine's Ollama instance via `host.docker.internal:11434`.

---

## Testing

Run the full backend test suite:
```bash
cd backend
pytest -v
```
The 45+ tests cover interface adherence, mock and live LLM streaming, PyMuPDF parsing, metadata retention, ChromaDB vector indexing and retrieval, tool schema validation, agent reasoning loops, and audit event persistence.

---

## Documentation Links

- [Technology Stack & Architecture](TECHNOLOGIES.md)
- [API Documentation (Swagger UI)](http://localhost:8000/docs)

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
