# Sovereign-Core

> Privacy-First Local AI Operating System — Cinematic UI · Local LLM · RAG · Agent Orchestration · Real-Time Telemetry

Sovereign-Core is an extensible, **local-first** AI workbench built for developers, researchers, and security-sensitive environments. It runs entirely on your machine — no cloud calls, no data leaving your network.

---

## Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python 3.11+) |
| **LLM Runtime** | Ollama (`gemma4:e2b` default) |
| **Vector Store** | ChromaDB (HNSW cosine) |
| **Document Parsing** | PyMuPDF |
| **Frontend** | Next.js 16 · React · TypeScript |
| **Styling** | Tailwind CSS · Vanilla CSS |
| **Animation** | Framer Motion · Three.js / React Three Fiber |
| **Icons** | Lucide React |
| **UI Primitives** | shadcn/ui |
| **Containers** | Docker Compose |

---

## Workspaces

The UI is a single-page AI operating system with eight switchable workspaces:

| Workspace | Description |
|---|---|
| **Overview** | Sovereign Command Center — system health, model status, telemetry at a glance |
| **Chat** | Mission Intelligence Cockpit — streaming LLM chat with context injection |
| **Knowledge Base** | ChromaDB semantic memory — search, stats, PDF ingestion |
| **Documents** | Deterministic Knowledge Ingestion — PDF drag-and-drop pipeline |
| **Agent Squad** | Controlled multi-agent orchestration with step-budget enforcement |
| **Workflows** | Node-canvas visual workflow builder |
| **Models** | Model Control Center — live Ollama model discovery and selection |
| **Settings** | Environment, API keys, and system configuration |

The shell also includes two immersive 3D landing screens:

- **Mission** — React Three Fiber cosmic hero canvas
- **Mission Chat** — animated 3D chat canvas

---

## Key Features

### Local LLM & Model Management
- Async streaming via Ollama (`/api/v1/chat`, `/api/v1/models`)
- Live model discovery, dynamic selection, and health fallback
- Typed `LLMService` abstraction with structured exception hierarchy

### Document Ingestion & RAG
- PyMuPDF page-by-page extraction with layout preservation
- Smart overlapping chunker (chunk=500, overlap=50, sentence-boundary-aware)
- ChromaDB persistent HNSW vector index with auto-recovering dimensionality migration
- `nomic-embed-text:latest` neural embeddings via Ollama
- Source citation retention: `document_name`, `page_number`, `chunk_index`

### Agent Orchestration
- Bounded single-agent reasoning loop (1–10 configurable steps)
- Registered tools: `document_retrieval`, `calculator`, `document_generation`, `approval_note_generator`
- Zero unrestricted shell/internet access (`NO_EGRESS` policy)
- Agent Squad Workspace for multi-agent management

### AI Flight Recorder & Telemetry
- WebSocket real-time telemetry stream (`/api/v1/flight-recorder/ws`)
- Durable mission blackbox: task ID, model, step traces, tool calls, provenance, errors
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
│   │   ├── api/v1/              # Routes: chat, models, rag, tools, agents, flight-recorder, audit
│   │   ├── core/
│   │   │   ├── interfaces/      # Abstract contracts (llm, rag, tools, agents, audit)
│   │   │   ├── llm/             # Ollama client & LLMService
│   │   │   ├── rag/             # PyMuPDF parser, chunker, embeddings, ChromaDB store
│   │   │   ├── tools/           # Tool registry, calculator, doc retrieval, approval note
│   │   │   ├── agents/          # Controlled inspection agent engine
│   │   │   ├── flight_recorder/ # Blackbox manager & telemetry broadcaster
│   │   │   └── audit/           # Structured JSON audit logger
│   │   ├── config.py
│   │   └── main.py
│   ├── data/
│   │   ├── artifacts/           # Generated DOCX approval notes
│   │   ├── audit/               # Structured JSON audit logs
│   │   ├── chroma/              # ChromaDB persistent index
│   │   └── flight_records/      # Mission blackbox JSON records
│   ├── tests/                   # 66+ pytest unit & integration tests
│   ├── Dockerfile
│   └── pyproject.toml
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
│   │   └── lib/                 # api-client.ts, types.ts, animations.ts
│   ├── Dockerfile
│   └── package.json
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
```

The backend connects to Ollama on the host via `host.docker.internal:11434`.

---

## Testing

```bash
cd backend
pytest -v
```

66+ tests covering:
- LLM interface adherence, mock & live streaming
- PyMuPDF parsing and source metadata retention
- ChromaDB indexing, cosine similarity, and migration
- Tool schema validation and sandbox execution
- Agent reasoning loops and step-budget enforcement
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
