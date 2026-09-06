# Security, Governance & Compliance Specification

## 1. Threat Model & Boundaries

Sovereign-Core is architected for zero-trust, high-assurance environments where data leakage and unmonitored agent actions are unacceptable.

### 1.1 Non-Negotiable Boundaries
- **No Unrestricted Shell Access**: Shell command execution, arbitrary code interpretation, and operating system access are prohibited.
- **No Autonomous External Internet**: Agents cannot perform outbound HTTP requests, web crawling, or external API queries.
- **Strict Tool Whitelisting**: Agents can only invoke tools registered with `ControlledToolRegistry`. Attempted invocations of unregistered tools trigger an immediate `POLICY_VIOLATION` audit log and are blocked.
- **Step Bounding**: Agents operate within a hard ceiling of allowed steps (default: 5, max: 10) to prevent denial-of-service or infinite loops.

---

## 2. Audit Trail & Cryptographic Verification

All system activities are recorded into an append-only JSONL audit ledger (`data/audit/audit.jsonl`).

### Audit Event Types
- `LLM_REQUEST` / `LLM_RESPONSE`: Captures prompts, completions, and latencies.
- `TOOL_EXECUTION`: Tool inputs, execution latency, and outputs.
- `POLICY_VIOLATION`: Logged whenever an agent attempts unauthorized tool calls.
- `DOCUMENT_INGESTION`: Chunk counts and vector embedding indexing.
- `MISSION_APPROVAL`: Timestamped human approval actions.

---

## 3. Storage and File System Hygiene

- All flight records are isolated under `data/flight_records/`.
- All generated inspection documents are isolated under `data/artifacts/`.
- Vector embeddings and chunk data are isolated under `data/chroma/`.
- All temporary scripts and scratch files are cleaned and excluded from version control via `.gitignore`.
