# Spec: Sovereign-Core Agent Squad (`SPEC-agent-squad`)

## Objective
Implement the first production-quality **Agent Squad** in Sovereign-Core. Rather than a generic autonomous agent with unrestricted permissions, create controlled, task-specific agents (Research Agent, Document Analyst, Data Analyst, Report Agent, Compliance Agent, and Mission Orchestrator) that execute explicit tasks through existing Sovereign-Core tools, strict step budgets, and security policies. The system guarantees deterministic permissions, proof-grounded evidence collection, human-in-the-loop approval gates, live WebSocket telemetry, and a mission-driven UI.

## Tech Stack
- **Backend**: Python 3.14+, FastAPI, Pydantic v2, PyMuPDF, ChromaDB, SQLite/JSON persistence.
- **Frontend**: Next.js 16 (App Router), React 18, TypeScript, TailwindCSS/Vanilla CSS design system, Lucide icons.
- **Reasoning**: Local Ollama (e.g. `gemma4:e2b`) with Sovereign Autonomous Fallback Engine for offline air-gap operations.
- **Tooling**: `document_retrieval`, `calculator`, `document_generation`, `approval_note_generator`.

## Commands
- **Backend Test Suite**:
  ```powershell
  .\.venv\Scripts\pytest tests/test_agent_squad.py tests/test_agent_adversarial.py tests/test_golden_mission.py -v
  ```
- **Backend Lint/Check**:
  ```powershell
  .\.venv\Scripts\ruff check app tests
  ```
- **Frontend Typecheck & Build**:
  ```powershell
  npm --prefix frontend run lint
  npm --prefix frontend run build
  ```
- **Dev Servers**:
  - Backend: `uvicorn app.main:app --reload --port 8000` (already active)
  - Frontend: `npm run dev` (already active on port 3000)

## Project Structure
```text
backend/app/core/agents/
├── __init__.py               → Public exports for Agent Squad
├── definitions.py            → AgentDefinition, AgentStateModel, AgentStatus
├── registry.py               → Central AgentRegistry with deterministic permissions
├── specialists.py            → 5 Specialist Agents (Research, Doc, Data, Report, Compliance)
├── classifier.py             → Controlled Task Classifier
├── mission_orchestrator.py   → High-Level Mission Orchestrator
└── telemetry_dispatcher.py   → Standardized event dispatcher to Flight Recorder WebSocket

backend/app/api/v1/
└── agents.py                 → REST API endpoints (/agents, /classify, /missions, /approve, /reject, /cancel)

backend/tests/
├── test_agent_squad.py       → Tests for each specialist agent
├── test_agent_adversarial.py → Boundary, error, prompt injection, and failure tests
└── test_golden_mission.py    → Deterministic end-to-end 3-page Golden Mission test

frontend/src/
├── components/agents/
│   └── AgentSquadWorkspace.tsx → Task-driven dynamic mission panel & execution graph
├── lib/
│   ├── api-client.ts         → API client methods for agent squad
│   └── types.ts              → Strongly typed frontend interfaces
└── tasks/
    ├── CAPABILITY_MAP.md     → Capability map
    └── SPEC-agent-squad.md   → Living specification
```

## Code Style
- Python: Pydantic v2 schemas for all inputs/outputs, type hints (`List`, `Dict`, `Optional`, `Any`), async execution, non-blocking fallback handling.
- Deterministic Tool Gating:
  ```python
  # Tools must be verified against static allowed_tools before execution:
  if tool_name not in self.definition.allowed_tools or not self.tool_registry.get(tool_name):
      raise PolicyViolationError(f"Tool '{tool_name}' not permitted for agent '{self.definition.id}'")
  ```
- Untrusted Document Handling:
  ```python
  # Document content is strictly quarantined as data, never prepended as system instruction:
  messages = [
      ChatMessage(role=ChatRole.SYSTEM, content=self.definition.system_instructions),
      ChatMessage(role=ChatRole.USER, content=f"UNTRUSTED DOCUMENT DATA:\n{doc_text}\n\nTASK:\n{task}"),
  ]
  ```

## Testing Strategy
- **Unit & Integration**: `test_agent_squad.py` verifies each specialist agent meets its input/output schema and stays within its step budget.
- **Adversarial Security**: `test_agent_adversarial.py` tests unknown agents, unauthorized tools, prompt injections in documents, RAG failures, and budget exhaustion.
- **End-to-End Golden Mission**: `test_golden_mission.py` executes the multi-page financial & compliance mission, verifying:
  - Document Analyst fact extraction
  - Data Analyst `(125 - 100) / 100 * 100 = 25%` calculation
  - Compliance Agent 5-point verification (`COMPLIANT`)
  - Report Agent artifact generation with citations
  - Verifier check
  - Human approval sign-off

## Boundaries
- **Always**: Enforce `allowed_tools` and `max_steps` at the backend level. Check evidence before verifying. Treat document text as untrusted data. Emit WebSocket telemetry for every state change.
- **Ask first / Gate on approval**: Generating official reports, modifying compliance disposition, executing sensitive external actions.
- **Never**: Allow LLMs to self-grant tool permissions; allow arbitrary shell or Python code execution; fabricate evidence; allow prompt injection from documents to alter agent instructions.

## Success Criteria
- [ ] All 5 specialist agents work independently and pass unit tests.
- [ ] Mission Orchestrator decomposes multi-step directives and delegates to specialist agents.
- [ ] Backend defines permissions deterministically; unauthorized tool calls fail safely.
- [ ] Step budgets are strictly enforced.
- [ ] Document instructions cannot override agent policy (injection resistance).
- [ ] Flight Recorder captures chronological timeline and WebSocket delivers live events.
- [ ] Task-driven UI automatically detects missions, shows live progress steps, and renders approval gates.
- [ ] Golden Demo Mission runs deterministically and passes end-to-end.
