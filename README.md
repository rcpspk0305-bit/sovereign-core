# Sovereign-Core

> Production-Quality Local AI Workbench Foundation

Sovereign-Core is an extensible, privacy-first local AI workbench built with a **FastAPI** Python backend, **Next.js TypeScript** frontend, native **Ollama** integration, and **Docker Compose** orchestration.

---

## Key Features & Architecture

- **Local LLM Execution**: Native, async communication with local Ollama daemon for completions, streaming, and embeddings.
- **Explicit Core Interfaces**:
  - `BaseLLMClient`: Abstract interface for language model providers.
  - `BaseRetriever`: Abstract interface for document indexing and vector search (RAG).
  - `BaseTool`: Type-safe tool execution engine with Pydantic JSON schema introspection.
  - `BaseAgent`: Orchestration loop contract with multi-step reasoning traces.
  - `BaseAuditLogger`: Structured JSON audit stream capturing latency, tokens, prompts, and tool invocations.
- **Production Backend**: Clean architecture with FastAPI, Pydantic v2 settings, CORS, healthchecks, and dependency injection.
- **Modern Frontend**: TypeScript Next.js dark-themed dashboard with live model selection, streaming chat, RAG playground, tool inspector, and audit log viewer.
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
│   │   │   ├── llm/         # Ollama client implementation
│   │   │   ├── rag/         # Vector store & retriever implementation
│   │   │   ├── tools/       # Tool registry & execution engine
│   │   │   ├── agents/      # Agent orchestration engine
│   │   │   └── audit/       # Structured JSON audit logger
│   │   ├── config.py        # Settings management
│   │   └── main.py          # Application entrypoint
│   ├── tests/               # Pytest unit & integration test suite
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/             # App router pages & global styling
│   │   ├── components/      # UI & workbench components
│   │   └── lib/             # API client & TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Production orchestration
└── .env.example             # Configuration variables
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running locally (`ollama serve`)
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
pytest tests -v

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
Interactive API documentation will be available at `http://localhost:8000/docs`.

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
The tests cover interface adherence, mock LLM streaming, vector retrieval calculations, tool schema validation, agent reasoning loops, and audit event persistence.

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
