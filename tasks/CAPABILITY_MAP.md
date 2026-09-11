# Capability Map: Sovereign-Core Agent Squad

| Module ID | Responsibility | Depends On |
|---|---|---|
| `agent-registry` | Strongly typed definitions (`AgentDefinition`), authoritative permissions, state models (`AgentStateModel`, `AgentStatus`), central `AgentRegistry` | Existing `BaseAgent`, `BaseToolRegistry` |
| `specialist-agents` | 5 controlled specialist agents: Research Agent, Document Analyst, Data Analyst, Report Agent, Compliance Agent | `agent-registry`, existing tools (`document_retrieval`, `calculator`, `document_generation`) |
| `mission-orchestrator` | Controlled Task Classifier, mission decomposition, sequential/graph specialist delegation, verifier pass | `agent-registry`, `specialist-agents` |
| `telemetry-approval` | Event dispatcher emitting standardized telemetry (`mission.created` ... `mission.completed`), Flight Recorder integration, Human-in-the-loop approval gate | `mission-orchestrator`, existing Flight Recorder |
| `api-routes` | REST endpoints for agent listing, task classification, mission creation, status query, approval/rejection, cancellation | `mission-orchestrator`, `telemetry-approval` |
| `frontend-mission-ui` | Dynamic task-driven mission execution panel, execution graph, live activity, evidence cards, tool payloads, result, approval gate | `api-routes`, existing WebSocket connection |
| `testing-golden-mission` | Specialist agent tests, adversarial security tests, deterministic 3-page Golden Demo Mission end-to-end | All modules |

**Build Order**:
`agent-registry` → `specialist-agents` → `mission-orchestrator` → `telemetry-approval` → `api-routes` → `frontend-mission-ui` → `testing-golden-mission`
