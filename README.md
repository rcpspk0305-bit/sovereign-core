# Sovereign-Core

> Production-Quality Local AI Workbench Foundation with Real-Time Telemetry & 3D Interactive Workbench

Sovereign-Core is an extensible, privacy-first local AI workbench built with a **FastAPI** Python backend, **Next.js TypeScript** frontend, native **Ollama** integration, **PyMuPDF** document parsing, **ChromaDB** persistent vector storage, **Anime.js v4** 3D animation physics, and **Docker Compose** orchestration.

For an exhaustive breakdown of libraries, versions, models, and specifications, see [TECHNOLOGIES.md](TECHNOLOGIES.md).

---

## Key Features & Architecture

### 1. Local LLM Execution & Typed Service Abstraction
- **Local LLM Execution**: Native, async communication with local Ollama daemon using **Gemma 4 E2B** (`gemma4:e2b`) as default model, supporting streaming, prompt evaluation, and timeout handling.
- **Typed Service Abstraction**: High-level `LLMService` decouples application logic from raw Ollama endpoints, with structured exception hierarchies (`LLMConnectionError`, `LLMTimeoutError`, `LLMModelNotFoundError`).
- **Dynamic Model Selection**: Live model discovery and selection via `/api/v1/models` and `/api/v1/health` with fallback resilience.

### 2. Document Ingestion & Vector Knowledge Memory
- **PyMuPDF Extraction**: Extracts text page-by-page from uploaded PDFs, preserving layout, chunk indices, and page numbers.
- **Smart Overlapping Chunker**: Splits extracted text respecting sentence and word boundaries with configurable chunk size (500) and overlap (50).
- **ChromaDB Vector Store**: Local persistent vector index using HNSW cosine distance space (`hnsw:space: cosine`) with auto-recovering dimensionality migration.
- **Neural Embeddings**: Seamless vector generation via Ollama's `nomic-embed-text:latest` with zero-downtime deterministic fallback.
- **Source Citation Retention**: Every indexed and retrieved chunk retains `document_name`, `page_number`, `chunk_index`, and `source` metadata so responses cite exact origins.

### 3. Controlled Inspection Agent & Tool Bay
- **Controlled Reasoning Loop**: Bounded single-agent execution constrained strictly to authorized local tools: `document_retrieval`, `calculator`, `document_generation`, and `approval_note_generator`.
- **Strict Security Guardrails**: Zero unrestricted shell access and zero autonomous internet access with deterministic policy enforcement (`NO_EGRESS`).
- **Step Budget Bounds**: Configurable step count ceiling (1 to 10 steps) preventing infinite loops.
- **Interactive Tool Bay**: Visual catalog of registered tools, schema parameter inspection, and dry-run JSON execution sandbox with millisecond latency metrics.

### 4. AI Flight Recorder & Real-Time Telemetry Streaming
- **WebSocket Telemetry Stream**: Real-time event broadcasting (`/api/v1/flight-recorder/ws` and `/ws/{task_id}`) for thought steps, tool calls, and provenance retrieval.
- **Durable Blackbox Mission Records**: Persists task ID, model, network mode, step traces, tool executions, retrieved sources, errors, artifacts, and auditor disposition.
- **Auditor Disposition Workflow**: Interactive sign-off controls (`AUTO_VERIFIED`, `APPROVED`, `PENDING`, `REJECTED`, `POLICY_VIOLATION`, `FAILED`).
- **Approval Note Artifact Generator**: Produces cryptographically verified `.docx` approval documents with SHA-256 checksums, unverified claim warnings, and human sign-off signature blocks.

### 5. Standardized Error Architecture & 3D Holographic Diagnostic HUD
- **Contract-First Error Contracts**: Typed error schema (`AppError`, `ErrorCode`, `ErrorSeverity`) adhering to stable API design guidelines.
- **Categorized Error Codes**: `NETWORK_OFFLINE`, `OLLAMA_DISCONNECTED`, `MISSION_TIMEOUT`, `AGENT_EXECUTION_FAILED`, `POLICY_VIOLATION`, `VALIDATION_ERROR`, and `STREAM_ABORTED`.
- **3D Holographic Diagnostic Modal**: Floating diagnostic HUD presenting operator diagnosis, suggested remediation steps, copyable diagnostic traces, and interactive retry triggers.
- **Orphan / Stuck Request Prevention**: Native `AbortController` integration allowing immediate cancellation of long-running missions.

### 6. 3D Interactive Workbench UI & Anime.js v4 Engine
- **3D Perspective Tilt**: Physics-based 3D tilt (`apply3DTilt`, `reset3DTilt`) on hover for console cards and workbench bays.
- **Multi-Axis Orbital Mechanics**: Continuous 3D rotation of orbital rings and glowing core pulsations using Anime.js timing loops.
- **Four Fully Interactive Workbench Bays**:
  - **Mission Control**: 3D console with prompt presets, millisecond elapsed timer, live reasoning step progression, instant abort button, and formatted output feed.
  - **Knowledge Field**: Real-time ChromaDB vector statistics, semantic memory search with similarity percentage bars, PDF drag-and-drop dropzone, and database reset.
  - **Tool Bay**: Registered tools catalog, schema inspector, and JSON parameter execution sandbox.
  - **Flight Recorder Bay**: Live streaming telemetry status, mission history, provenance source previews, and formal approval controls.

---

## Directory Layout

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Modular API routes (chat, models, rag, tools, agents, flight-recorder, audit)
│   │   ├── core/
│   │   │   ├── interfaces/  # Abstract contracts (llm, rag, tools, agents, audit)
│   │   │   ├── llm/         # Ollama client & typed LLMService implementation
│   │   │   ├── rag/         # PyMuPDF parser, chunker, embeddings, & ChromaDB vector store
│   │   │   ├── tools/       # Tool registry, calculator, doc retrieval, doc generation, approval note
│   │   │   ├── agents/      # Controlled inspection agent orchestration engine
│   │   │   ├── flight_recorder/ # Blackbox manager, telemetry event broadcaster, data models
│   │   │   └── audit/       # Structured JSON audit logger
│   │   ├── config.py        # Settings & absolute path anchoring (relative to backend/)
│   │   └── main.py          # Application entrypoint & WebSocket routes
│   ├── data/                # Runtime data directory (persisted locally)
│   │   ├── artifacts/       # Generated DOCX approval notes
│   │   ├── audit/           # Structured JSON audit logs
│   │   ├── chroma/          # ChromaDB persistent vector index
│   │   └── flight_records/  # Persisted mission blackbox JSON records
│   ├── tests/               # Pytest unit & integration test suite (66+ tests)
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (layout, globals.css with 3D tokens, page.tsx)
│   │   ├── components/
│   │   │   └── workbench/   # 3D Workbench bays (MissionConsole3D, KnowledgeBay, ToolBay, FlightRecorderBay, ErrorDiagnosticModal)
│   │   └── lib/             # API client (api-client.ts), contracts (types.ts), Anime.js v4 engine (animations.ts)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Production container orchestration
├── TECHNOLOGIES.md          # Comprehensive technology stack reference
└── .env.example             # Environment configuration variables
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

# Run backend test suite
pytest -v

# Start FastAPI dev server (data paths are anchored absolutely to backend/)
uvicorn app.main:app --reload --port 8000
```

Interactive Swagger documentation is available at `http://localhost:8000/docs`.

### 2. Local Development (Frontend)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` to access the Sovereign-Core interactive 3D workbench.

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

The 66+ tests cover:
- Interface adherence and abstract base contract validation
- Mock and live LLM streaming
- PyMuPDF parsing and source metadata retention
- ChromaDB vector indexing, cosine similarity retrieval, and migration
- Tool schema validation and safe sandbox execution
- Agent reasoning loops and step-budget enforcement
- Real-time WebSocket telemetry broadcasting
- Claim-evidence grounding validation and unverified claim detection
- Local DOCX approval note generation with cryptographic checksums
- Structured JSON audit persistence

---

## Documentation Links

- [System Architecture](docs/ARCHITECTURE.md)
- [AI Flight Recorder Specification](docs/FLIGHT_RECORDER_SPEC.md)
- [Approval Note Generator Specification](docs/APPROVAL_NOTE_SPEC.md)
- [Security & Governance Specification](docs/SECURITY_AND_GOVERNANCE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Technology Stack Overview](TECHNOLOGIES.md)
- [Interactive API Documentation (Swagger UI)](http://localhost:8000/docs)

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
