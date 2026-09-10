# Sovereign-Core

> Privacy-First Local AI Operating System — Cinematic UI · Local LLM · RAG · Agent Orchestration · Real-Time Telemetry

Sovereign-Core is an extensible, **local-first** AI workbench built for developers, researchers, and security-sensitive environments. It runs entirely on your machine — no cloud calls, no data leaving your network.

---

## Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python 3.11+) |
| **Agent Graph Engine** | LangGraph StateGraph (Adapter-pattern bounded orchestration) |
| **Telemetry & Tracing** | OpenTelemetry + Sovereign Flight Recorder (air-gapped, redacted) |
| **LLM Runtime** | Ollama (`gemma4:e2b` default) |
| **Vector Store** | ChromaDB (HNSW cosine default) · Qdrant (optional high-performance backend) |
| **Document Parsing** | PyMuPDF |
| **Frontend** | Next.js 16 · React · TypeScript |
| **Styling** | Tailwind CSS · Vanilla CSS |
| **Animation** | Framer Motion · Three.js / React Three Fiber |
| **Icons** | Lucide React |
| **UI Primitives** | shadcn/ui |
| **Containers** | Docker Compose |

---

## Workspaces

The UI is a single-page AI operating system with seven switchable top-level bays and specialized sub-views:

| Workspace Bay | Description |
|---|---|
| **Overview** | Sovereign Command Center — system telemetry, model status, and mission velocity at a glance |
| **01 Mission** | Cosmic Mission Launcher & Streaming Chat Cockpit — Three.js 3D Earth canvas, glassmorphic HUD, multi-turn session persistence |
| **02 Knowledge** | Deterministic Knowledge Ingestion (Chroma/Qdrant PDF pipeline) & Memory Flow Bay (4-tier context engine) |
| **03 Squad** | Autonomous Multi-Agent Command Grid & Controlled Zero-Egress Tool Execution Sandbox |
| **04 Workflows** | Visual Node-Canvas DAG Workflow Builder & Dify Interoperability Layer |
| **05 Flight Log** | Durable Flight Recorder Blackbox — real-time WebSocket telemetry, OpenTelemetry spans, and audit approval |
| **06 Models** | Local Model Control Center — live Ollama discovery, quantization controls, and hardware boundaries |
| **Settings** | Security governance, air-gap policy toggles, and system configuration |

---

## Key Features

### Local LLM & Model Management
- Async streaming via Ollama (`/api/v1/chat`, `/api/v1/models`)
- Live model discovery, dynamic selection, and health fallback
- Typed `LLMService` abstraction with structured exception hierarchy

### Sovereign Workflow Engine & Dify Interoperability Layer
- Deterministic DAG workflow execution engine (`START`, `RAG`, `TOOL`, `LLM`, `AGENT`, `CONDITION`, `APPROVAL`, `END`)
- Bidirectional Dify DSL import and export adapters allowing portable workflow definitions without external dependencies
- Static Security Analyzer: Kahn's cycle detection, AST syntax checks, tool allowlist enforcement, and step budget capping
- Human-in-the-loop approval gate: imported and untrusted workflows require explicit operator sign-off before execution
- Direct integration with AI Flight Recorder for step-by-step cryptographic audit logs and trace provenance

### Local-First Session Persistence & State Synchronization
- Dual-tier persistence: in-memory cache + browser `localStorage` + backend disk store (`/api/v1/sessions`)
- Reactive event bus with recursion-safe mutual suppression guards (`activeSessionIdRef`)
- Persistent DOM architecture using CSS display toggles, preserving active WebSockets, 3D canvases, and unfinished input across tabs
- Standardized `'en-US'` SSR locale normalization preventing hydration mismatches

### Document Ingestion & Vector Stores (ChromaDB & Qdrant)
- PyMuPDF page-by-page extraction with layout preservation
- Smart overlapping chunker (chunk=500, overlap=50, sentence-boundary-aware)
- Unified `VectorStore` interface (`add`, `search`, `delete`, `count`, `health`, `metadata filtering`)
- ChromaDB persistent HNSW vector index as default lightweight local store
- Optional Qdrant vector store (`VECTOR_BACKEND=qdrant`, `QDRANT_URL=http://localhost:6333`)
- Safe, non-destructive migration utility (`POST /api/v1/rag/migrate` with Chroma retention guarantee)
- Fail-safe dimensionality mismatch validation (`DimensionalityMismatchError`, prevents collection corruption)
- `nomic-embed-text:latest` neural embeddings via Ollama
- Full provenance and source citation retention: `document_name`, `document_id`, `page_number`, `chunk_index`, `source`
- Telemetry span attribution (`rag.retrieve`, `vector.search`) with backend tracking and raw query redaction

### Agent Orchestration & LangGraph
- Bounded single-agent & multi-agent reasoning loop (1–10 configurable steps)
- LangGraph adapter for controlled graph-based orchestration with deterministic routing
- Human approval checkpoints, failure recovery branches, and strict step budgets
- Registered tools: `document_retrieval`, `calculator`, `document_generation`, `approval_note_generator`
- Zero unrestricted shell/internet access (`NO_EGRESS` policy)
- Agent Squad Workspace for multi-agent management

### AI Flight Recorder & OpenTelemetry
- WebSocket real-time telemetry stream (`/api/v1/flight-recorder/ws`)
- Durable mission blackbox: task ID, model, step traces, tool calls, provenance, errors
- Standardized OpenTelemetry tracing & metrics substrate underneath Flight Recorder
- Hierarchical span model: `mission` → `agent execution` / `workflow` → `llm.call` → `rag.retrieve` (`embedding`, `vector.search`) → `tool` → `verifier` → `artifact.generate`
- Metric instrumentation: mission execution counters, step duration histograms, error meters
- Privacy-first redaction pipeline: automatic sanitization of prompts, tokens, and PII before trace export
- Air-gapped local exporters: console, in-memory, and local OTLP (`http://localhost:4317`); disabled by default (`OTEL_ENABLED=false`)
- Auditor disposition workflow: `AUTO_VERIFIED` · `APPROVED` · `PENDING` · `REJECTED` · `POLICY_VIOLATION` · `FAILED`
- Cryptographically verified `.docx` approval note generation (SHA-256)

### Cinematic UI
- Three.js / React Three Fiber 3D cosmic canvas (landing & chat)
- Framer Motion micro-animations, staggered entry, physics spring transitions
- Glassmorphism panels, gradient mesh backgrounds, ambient glow system
- Fully dark-mode, responsive, keyboard-navigable

---

## Directory Layout

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/              # Routes: chat, models, rag, tools, agents, flight-recorder, workflows, sessions, audit
│   │   ├── core/
│   │   │   ├── interfaces/      # Abstract contracts (llm, rag, tools, agents, workflows, audit)
│   │   │   ├── workflows/       # Deterministic DAG engine, runtime, models, security analyzer, store
│   │   │   ├── llm/             # Ollama client & LLMService
│   │   │   ├── rag/             # PyMuPDF parser, chunker, embeddings, ChromaDB store
│   │   │   ├── tools/           # Tool registry, calculator, doc retrieval, approval note
│   │   │   ├── agents/          # Controlled inspection agent engine
│   │   │   ├── flight_recorder/ # Blackbox manager & telemetry broadcaster
│   │   │   ├── telemetry/       # OpenTelemetry tracer, metrics, bridge, redaction
│   │   │   └── audit/           # Structured JSON audit logger
│   │   ├── integrations/        # LangGraph, OpenTelemetry, LiteLLM, Qdrant, Dify adapters
│   │   ├── config.py
│   │   └── main.py
│   ├── data/
│   │   ├── artifacts/           # Generated DOCX approval notes
│   │   ├── audit/               # Structured JSON audit logs
│   │   ├── chroma/              # ChromaDB persistent index
│   │   ├── flight_records/      # Mission blackbox JSON records
│   │   └── sessions/            # Disk-persisted mission sessions
│   ├── tests/                   # 125+ pytest unit & integration tests
│   ├── Dockerfile
│   └── pyproject.toml
├── docs/
│   ├── ARCHITECTURE.md          # Complete system architecture specification
│   ├── API_REFERENCE.md         # Exhaustive endpoint reference and payloads
│   ├── DIFY_INTEROPERABILITY.md # Safe Dify interoperability layer specification
│   ├── FLIGHT_RECORDER_SPEC.md  # Forensic mission telemetry blackbox spec
│   ├── SECURITY_AND_GOVERNANCE.md # Zero-egress rules, AST analyzers, approval gates
│   └── solutions/               # Durable compounded engineering learnings repository
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router (layout.tsx, globals.css, page.tsx)
│   │   ├── components/
│   │   │   ├── agents/          # AgentSquadWorkspace
│   │   │   ├── chat/            # AgentChatLauncher, ChatWorkspace, InteractiveCosmicChatCanvas
│   │   │   ├── knowledge/       # DocumentPipelineWorkspace
│   │   │   ├── landing/         # CosmicHero, CosmicCanvas3D
│   │   │   ├── models/          # ModelControlCenter
│   │   │   ├── settings/        # SettingsWorkspace
│   │   │   ├── visualizations/  # WorkflowNodeCanvas, IntelligenceCore
│   │   │   └── workbench/       # CommandCenterOverview, KnowledgeBay, MemoryFlowBay,
│   │   │                        #   ToolBay, FlightRecorderBay
│   │   └── lib/                 # api-client.ts, session-store.ts, types.ts, animations.ts
│   ├── Dockerfile
│   └── package.json
├── CONCEPTS.md                  # Core domain glossary and entity definitions
├── docker-compose.yml
├── TECHNOLOGIES.md
└── .env.example
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running

```bash
ollama serve
ollama run gemma4:e2b
ollama pull nomic-embed-text
```

Docker & Docker Compose *(optional)*

---

### Backend

```bash
cd backend
python -m venv .venv

# Activate
# Windows:  .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run tests
pytest -v

# Start dev server
uvicorn app.main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`

---

### Docker Compose

```bash
cp .env.example .env
docker compose up --build

# Optional: Spin up with Qdrant vector store service enabled
docker compose --profile qdrant up --build
```

The backend connects to Ollama on the host via `host.docker.internal:11434` and Qdrant at `http://qdrant:6333` when enabled.

---

## Testing

```bash
cd backend
pytest -v
```

124+ tests covering:
- LLM interface adherence, mock & live streaming
- PyMuPDF parsing and source metadata retention
- VectorStore contract compliance across ChromaDB & Qdrant
- Fail-safe dimensionality mismatch validation (`DimensionalityMismatchError`)
- Chroma-to-Qdrant non-destructive migration & citation preservation
- Tool schema validation and sandbox execution
- Agent reasoning loops and step-budget enforcement
- LangGraph StateGraph adapter, routing, approval checkpoints, and cycle limits
- OpenTelemetry span hierarchy, tracer lifecycle, redaction, and metric counters
- WebSocket telemetry broadcasting
- Claim-evidence grounding and unverified claim detection
- DOCX approval note generation with SHA-256 checksums
- Structured JSON audit persistence

---

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [AI Flight Recorder Spec](docs/FLIGHT_RECORDER_SPEC.md)
- [Approval Note Generator Spec](docs/APPROVAL_NOTE_SPEC.md)
- [Security & Governance Spec](docs/SECURITY_AND_GOVERNANCE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Technology Stack](TECHNOLOGIES.md)
- [Swagger UI](http://localhost:8000/docs)

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
