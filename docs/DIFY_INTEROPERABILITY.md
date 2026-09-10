# Sovereign-Core Dify Interoperability Layer & Workflow Architecture

## 1. Executive Summary & System Boundaries

The **Dify Interoperability Layer** provides Sovereign-Core with portable import, export, and translation capabilities for graph-based agent workflows without compromising the system's air-gapped security model.

### Non-Replacement Principle
Dify operates strictly as an **optional format adapter** and **never** replaces Sovereign-Core's authoritative subsystems:
* **Agent Runtime**: Remains native Sovereign-Core autonomous agent execution.
* **LangGraph**: Powers local deterministic state machines and graph execution.
* **Workflow Runtime**: Manages step budgets, cycle detection, and topological dispatch.
* **RAG**: Handled by local ChromaDB / Qdrant instances with air-gapped embeddings.
* **LLMService**: Interfaces directly with local Ollama / Gemma / Llama daemons.
* **Flight Recorder**: Serves as the immutable blackbox audit system.
* **Security Policy**: Sovereign-Core's air-gap and resource boundaries cannot be overridden.

Sovereign-Core can run **entirely without Dify**.

---

## 2. Security Model: Untrusted Workflow Intake

All externally imported workflow definitions (whether in Sovereign format or Dify DSL) are treated as **untrusted inputs**.

### Fail-Closed Lifecycle Pipeline
```text
IMPORT  ──>  VALIDATE  ──>  SECURITY ANALYSIS  ──>  USER REVIEW  ──>  APPROVE  ──>  EXECUTE
```

1. **IMPORT**: Ingests external JSON/YAML. Automatically sets workflow state to `APPROVAL REQUIRED`.
2. **VALIDATE**: Performs graph validation (DAG check, Kahn's algorithm cycle detection, START and END node reachability).
3. **SECURITY ANALYSIS**: Deterministic static inspection against high-risk vulnerability patterns.
4. **USER REVIEW**: Operators review findings, risk scores, and graph topology in the UI.
5. **APPROVE**: Explicit human-in-the-loop cryptographic sign-off transitions state to `READY`.
6. **EXECUTE**: Only approved, validated workflows can run through the local runtime.

### Strict Rejection Criteria
Workflows containing any of the following are immediately flagged as `INVALID` or rejected:
* **Arbitrary Shell**: Execution commands (`bash`, `sh`, `powershell`, `cmd.exe`, `os.system`).
* **Arbitrary Code**: Code execution primitives (`eval`, `exec`, `__import__`, `Function()`, `import os`).
* **Unrestricted HTTP**: Network egress to remote URLs or non-local IP addresses (violating `NO_EGRESS`).
* **Unknown Tools**: Tools outside Sovereign-Core's configured `ToolRegistry` allowlist.
* **Unknown Model Providers**: Remote cloud API keys or endpoints bypassing local models.
* **Filesystem Escape**: Traversal patterns (`../`, `..\\`, `/etc`, `C:\Windows`, `.ssh`).
* **Unsafe Expressions**: Template injection exploits (`__class__`, `__mro__`, `__subclasses__`).

---

## 3. Policy Inheritance

Every workflow executed by Sovereign-Core automatically inherits non-negotiable security constraints:
```text
┌────────────────────────────────────────────────────────┐
│ Sovereign-Core Base Policy Constraints                 │
├────────────────────────────────────────────────────────┤
│ • NO_EGRESS: Strict air-gap (localhost / IPC only)     │
│ • Tool Allowlist: system_info, calculator, RAG, note   │
│ • Step Budget: Hard cap at 20 steps maximum            │
│ • Approval Requirements: Mandatory human review        │
│ • Resource Limits: 60s timeout, memory & token bounds  │
└────────────────────────────────────────────────────────┘
```
External workflow metadata or policy sections can **never** weaken or override these baselines.

---

## 4. Internal Workflow Model

The internal schema defines deterministic directed workflows:
```text
Workflow
 ├── id: str
 ├── name: str
 ├── version: str (Semantic versioning: e.g. 1.0.0)
 ├── nodes: List[WorkflowNode]
 ├── edges: List[WorkflowEdge]
 ├── inputs: Dict[str, Any]
 ├── outputs: Dict[str, Any]
 └── policy: WorkflowPolicy
```

### Canonical Node Primitives
| Node Type | Sovereign Runtime Primitive | Purpose |
| :--- | :--- | :--- |
| `START` | Directive Intake | Ingests initial task parameters and directive. |
| `RAG` | Vector Store Retriever | Queries local ChromaDB vectors for document evidence. |
| `TOOL` | Allowlisted Tool Registry | Executes sandboxed, allowlisted operations (e.g. calculator). |
| `LLM` | Local LLM Inference | Air-gapped prompt synthesis via local Ollama models. |
| `AGENT` | LangGraph Agent Orchestrator | Autonomous multi-step reasoning with bounded steps. |
| `CONDITION` | Deterministic Branch Gate | Evaluates safe conditional expressions. |
| `APPROVAL` | Human Sign-off Gate | Enforces human review and sign-off before proceeding. |
| `END` | Cryptographic Seal | Collates results and computes SHA-256 attestation seal. |

Each node schema:
```json
{
  "id": "n1",
  "name": "Local LLM Synthesis",
  "type": "LLM",
  "config": {
    "model": "llama3",
    "provider": "ollama",
    "prompt_template": "Analyze the gathered parameters: {{input}}"
  },
  "inputs": ["gathered_parameters"],
  "outputs": ["synthesis_result"],
  "position": { "x": 500, "y": 200 }
}
```

---

## 5. Export & Import Formats

### Canonical Sovereign Export Format
```json
{
  "format": "sovereign-workflow",
  "version": "1.0",
  "exported_at": "2026-09-10T12:00:00Z",
  "workflow": {
    "id": "tactical_inspection_wf",
    "name": "Tactical Inspection Workflow",
    "version": "1.0.0",
    "nodes": [ ... ],
    "edges": [ ... ],
    "policy": {
      "no_egress": true,
      "max_steps": 20
    }
  }
}
```

### Dify DSL Compatibility Mapping
| Dify DSL Node | Sovereign-Core Canonical Type | Safety Status |
| :--- | :--- | :--- |
| `start` | `START` | Permitted |
| `llm` | `LLM` | Permitted (mapped to local air-gapped model) |
| `agent` | `AGENT` | Permitted (dispatched to LangGraph orchestrator) |
| `tool` | `TOOL` | Permitted (validated against allowlist) |
| `knowledge-retrieval` | `RAG` | Permitted (mapped to local Chroma collections) |
| `if-else` | `CONDITION` | Permitted (evaluated deterministically) |
| `human-in-the-loop` | `APPROVAL` | Permitted |
| `end` | `END` | Permitted |
| `code` | *Rejected* | **Strictly Forbidden** (arbitrary code execution) |
| `http-request` | *Rejected* | **Strictly Forbidden** (violates NO_EGRESS) |
| `template-transform` | *Restricted* | Allowed only if code/injection-free |

---

## 6. Execution Runtime & Flight Recorder Integration

Execution follows a strict pipeline:
$$\text{Workflow} \longrightarrow \text{Validator} \longrightarrow \text{LangGraph Adapter} \longrightarrow \text{Tools / RAG / LLM} \longrightarrow \text{AI Flight Recorder}$$

Every execution step:
1. Emits real-time WebSocket events (`task_started`, `step_started`, `tool_called`, `task_completed`).
2. Records fine-grained timing, inputs, outputs, and errors.
3. Produces a cryptographically sealed `FlightRecord` for complete provenance and blackbox audit replay.

---

## 7. REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/workflows` | List all workflows with state and version metadata. |
| `GET` | `/api/v1/workflows/{id}` | Get workflow graph details, policy, and security analysis. |
| `POST` | `/api/v1/workflows` | Save/create workflow with optional version bump (`patch`, `minor`, `major`). |
| `POST` | `/api/v1/workflows/validate` | Run static security analysis and topological checks. |
| `POST` | `/api/v1/workflows/{id}/approve` | Review and approve workflow for execution. |
| `POST` | `/api/v1/workflows/{id}/run` | Execute approved workflow through Sovereign-Core runtime. |
| `POST` | `/api/v1/workflows/import` | Import untrusted workflow from Sovereign JSON or Dify DSL. |
| `GET` | `/api/v1/workflows/{id}/export` | Export workflow (`format=sovereign` or `format=dify`). |
