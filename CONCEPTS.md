# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Entities

### Session
A persistent local conversational context holding sequential user and assistant turns, memory token allocations, and active telemetry references across workbench tabs.

### Mission
A discrete, goal-driven operational execution dispatched to an autonomous agent or workflow, bounded by a finite step budget and evaluated for zero-egress policy compliance.

### Flight Record
An immutable, forensic blackbox audit record capturing telemetry spans, timestamps, tool inputs and outputs, retrieved citations, and approval status for a single completed mission or workflow run.

### Sovereign Workflow
A deterministic, directed acyclic graph composed of typed execution nodes (trigger, retrieval, tool execution, inference, condition, approval gate, and seal) operating under strict local-first constraints.

### Air-Gap Boundary
The strict operational perimeter that guarantees zero outbound network transmission, ensuring all model inference, vector similarity search, and tool executions remain strictly within local interfaces.

### Controlled Tool Registry
The authoritative allowlist of verified, local-only executable functions accessible to agents and workflow runtimes, rejecting shell execution, arbitrary system commands, or unvetted scripts.

## Processes

### Mission Dispatch
The orchestration process that validates input directives, checks active model availability, attaches memory context, and streams real-time execution steps through local telemetry sockets.

### Security Static Analysis
The pre-execution inspection of a workflow definition that validates graph topology, detects cycles, ensures required terminals, and rejects unauthorized tools before runtime invocation.

### Human-in-the-Loop Approval Gate
The mandatory pause in execution requiring explicit operator review and authorization before high-risk actions, unvetted workflows, or external document exports are executed.

## Flagged Ambiguities

- "Mission" vs "Session": A Session is a conversational interaction container that may span multiple turns and inspect data over time; a Mission is an atomic execution run dispatched with bounded step budgets and forensic blackbox recording.
- "Sovereign Workflow" vs "LangGraph Agent": Sovereign Workflow is the system of record and deterministic directed execution model; LangGraph is an internal execution adapter for autonomous state graphs.
