# AI Flight Recorder ("Black Box") Specification

## 1. Purpose & Scope

The **AI Flight Recorder** serves as a forensic, evidence-oriented telemetry subsystem for autonomous agent missions. Similar to an aircraft flight data recorder, it continuously captures, structures, streams, and persists all internal reasoning, tool executions, document chunks retrieved, artifacts produced, policy errors, and approval decisions.

---

## 2. Telemetry Wire Protocol (WebSocket)

### Endpoint
- Global stream: `ws://localhost:8000/api/v1/flight-recorder/ws`
- Task-filtered stream: `ws://localhost:8000/api/v1/flight-recorder/ws/{task_id}`

### Event Format
All messages exchanged over the WebSocket are JSON payloads conforming to the `FlightEvent` schema:

```json
{
  "event_type": "step_started | tool_called | tool_completed | sources_retrieved | artifact_generated | error_recorded | task_completed | task_started | connected | subscribed | pong",
  "task_id": "string",
  "timestamp": "ISO-8601 UTC string",
  "data": { ... }
}
```

### Supported Client Inbound Actions
1. **`ping`**: Heartbeat check. Server responds with `pong`.
2. **`subscribe`**: Binds the socket to a specific `task_id`.
3. **`run_mission`**: Triggers execution of an agent mission with parameters (`prompt`, `model`, `network_mode`, `task_id`, `max_steps`).
4. **`update_approval`**: Updates human approval status (`APPROVED`, `REJECTED`, `PENDING`) with optional reviewer notes.

---

## 3. Flight Record Schema (`FlightRecord`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `task_id` | `str` | Unique deterministic or random identifier for the mission. |
| `model` | `str` | Identifier of model used for inference (e.g., `gemma4:e2b`). |
| `prompt` | `str` | Original user objective or inspection trigger. |
| `network_mode` | `NetworkMode` | `AIR_GAPPED_LOCAL` \| `HYBRID_EGRESS` \| `OFFLINE_SIMULATION`. |
| `approval_status`| `ApprovalStatus`| `AUTO_VERIFIED` \| `APPROVED` \| `PENDING` \| `REJECTED` \| `POLICY_VIOLATION` \| `FAILED`. |
| `status` | `str` | `running` \| `completed` \| `failed`. |
| `start_time` | `datetime` | UTC timestamp of mission start. |
| `end_time` | `datetime` | UTC timestamp of mission termination. |
| `total_latency_ms` | `float` | Cumulative duration of the mission in milliseconds. |
| `steps` | `List[Step]` | Timeline of thought processes and step status. |
| `tools_called` | `List[ToolRecord]`| Structured ledger of tool executions, inputs, latency, and outputs. |
| `retrieved_sources`| `List[Source]` | Document chunks retrieved from vector store with similarity scores. |
| `artifacts_generated`| `List[Artifact]`| Generated files with SHA-256 digests and file sizes. |
| `errors` | `List[Error]` | Diagnosed errors and policy boundary violations. |
| `final_answer` | `str` | Final synthesized inspection report. |

---

## 4. Human Approval Workflow

1. Missions initially enter the `PENDING` approval status.
2. If all tools succeed without policy violations, status may advance to `AUTO_VERIFIED`.
3. High-risk actions (document generation, audit certification) require a human reviewer to inspect telemetry and mark the flight record as `APPROVED` or `REJECTED`.
4. Approval decisions are broadcast in real-time over the WebSocket and permanently stored in the flight record on disk (`data/flight_records/{task_id}.json`).
