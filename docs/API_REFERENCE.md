# Sovereign-Core API Reference

## Base URL
`http://localhost:8000/api/v1`

---

## 1. Flight Recorder Endpoints

### `GET /flight-recorder/records`
List all recorded mission blackbox records.
- **Query Parameters**:
  - `limit` (int, default: 50): Number of records to return.
- **Response**: `List[FlightRecord]`

### `GET /flight-recorder/records/{task_id}`
Retrieve a specific mission record.
- **Response**: `FlightRecord`

### `POST /flight-recorder/run`
Trigger a forensic agent mission and capture telemetry.
- **Request Body**:
  ```json
  {
    "prompt": "string",
    "model": "string (optional)",
    "network_mode": "AIR_GAPPED_LOCAL",
    "task_id": "string (optional)",
    "max_steps": 5
  }
  ```
- **Response**: `FlightRecord`

### `POST /flight-recorder/records/{task_id}/approval`
Update human approval status for a task.
- **Request Body**:
  ```json
  {
    "approval_status": "APPROVED | REJECTED | PENDING",
    "notes": "string (optional)"
  }
  ```
- **Response**: `FlightRecord`

### `WebSocket /flight-recorder/ws` & `/flight-recorder/ws/{task_id}`
Real-time bi-directional telemetry streaming.
- **Wire format**: JSON messages conforming to `FlightEvent`.

---

## 2. Models Endpoint

### `GET /models`
Discover available local models. If local Ollama daemon is offline, returns default local model info with 200 OK.
- **Response**: `List[ModelInfo]`

---

## 3. Agents Endpoints

### `POST /agents/run`
Execute the controlled agent loop using either Sovereign Classic Loop or LangGraph Controlled State Graph.
- **Request Body**:
  ```json
  {
    "prompt": "string",
    "session_id": "string (optional)",
    "max_steps": 5,
    "model": "string (optional)",
    "orchestrator": "langgraph | default (optional)"
  }
  ```
- **Response**: `AgentResult`

### `GET /agents/{mission_id}`
Retrieve the execution state and status of a graph or classic mission.
- **Path Parameter**: `mission_id` (string)
- **Response**:
  ```json
  {
    "mission_id": "string",
    "status": "RUNNING | COMPLETED | ERROR",
    "current_step": 2,
    "max_steps": 5,
    "result": "AgentResult | null"
  }
  ```

### `POST /agents/{mission_id}/approve`
Submit human authority gate approval or rejection for a mission.
- **Path Parameter**: `mission_id` (string)
- **Request Body**:
  ```json
  {
    "approved": true,
    "notes": "string (optional)"
  }
  ```
- **Response**: `{"mission_id": "...", "approval_status": "APPROVED | REJECTED"}`

### `POST /agents/{mission_id}/cancel`
Gracefully cancel an active mission execution.
- **Path Parameter**: `mission_id` (string)
- **Response**: `{"mission_id": "...", "status": "CANCELLED"}`

---

## 4. Chat Endpoints

### `POST /chat`
Execute single-turn chat or streaming completions.
- **Request Body**:
  ```json
  {
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "string (optional)",
    "temperature": 0.7,
    "stream": false
  }
  ```
- **Response**: `LLMResponse` (or Server-Sent Events stream when `stream=true`)

---

## 5. RAG / Document Endpoints

### `POST /rag/upload`
Upload and ingest a document (`.pdf`, `.txt`, `.md`) into ChromaDB.
- **Request**: Multipart Form Data with `file`
- **Response**: `UploadResponse`

### `POST /rag/search`
Perform vector search against ingested documents.
- **Request Body**:
  ```json
  {
    "query": "string",
    "top_k": 4
  }
  ```
- **Response**: `List[SearchResult]`

---

## 6. Audit Endpoints

### `GET /audit`
Retrieve recent audit log events.
- **Query Parameters**:
  - `limit` (int, default: 50)
- **Response**: `List[AuditEvent]`

---

## 7. OpenTelemetry Distributed Tracing & Metrics

Sovereign-Core automatically propagates OpenTelemetry context throughout all internal subsystem operations, correlating each Flight Record with a W3C trace.

### Configuration Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `OTEL_ENABLED` | bool | `false` | Enable/disable OpenTelemetry tracing and metrics |
| `OTEL_EXPORTER` | string | `"console"` | Exporter backend: `"console"`, `"in_memory"`, or `"otlp"` |
| `OTEL_ENDPOINT` | string | `""` | Local OTLP endpoint (e.g. `"http://localhost:4317"`). Non-local destinations rejected. |
| `OTEL_SERVICE_NAME`| string | `"sovereign-core"` | Service name attached to all telemetry resources |
| `OTEL_REDACTION_ENABLED` | bool | `true` | Redact sensitive keys and truncate long prompt/document payloads |

### Correlated Schema Extensions

`FlightRecord`, `FlightEvent`, `StepRecord`, and `ToolExecutionRecord` payloads now include:
- `trace_id` (string, optional): 32-character hex OpenTelemetry Trace ID (e.g., `4bf92f3577b34da6a3ce929d0e0e4736`).
- `span_id` (string, optional): 16-character hex OpenTelemetry Span ID (e.g., `00f067aa0ba902b7`).
- `latency_ms` (float, optional): Step/tool execution time in milliseconds.
- `tokens` (int, optional): Step/tool token consumption.
