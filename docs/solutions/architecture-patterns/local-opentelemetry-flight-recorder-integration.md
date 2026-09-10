---
title: Local OpenTelemetry Substrate Underneath Flight Recorder with Zero Egress Redaction
date: 2026-09-10
category: architecture-patterns
module: backend/app/core/telemetry
problem_type: architecture_pattern
component: observability
severity: medium
applies_when:
  - "Adding telemetry or tracing to a local-first, air-gapped AI application"
  - "Integrating standardized OpenTelemetry without breaking user-facing mission blackbox systems"
tags: [opentelemetry, flight-recorder, privacy, tracing, local-first]
---

# Local OpenTelemetry Substrate Underneath Flight Recorder with Zero Egress Redaction

## Context
Sovereign-Core requires rigorous operational observability (traces, spans, latency metrics, error tracking) across its multi-agent reasoning, RAG pipeline, LLM calls, and workflow execution. However, Sovereign-Core is strictly a privacy-first, local-first, air-gapped system governed by a `NO_EGRESS` security policy. The application already features a user-facing mission blackbox called the AI Flight Recorder. Introducing OpenTelemetry could risk exposing sensitive prompt texts, embeddings, or PII to external endpoints, or displacing the intuitive Flight Recorder interface.

## Guidance
Treat OpenTelemetry as an underlying standardized tracing and metrics substrate directly beneath the Sovereign Flight Recorder rather than replacing it:

```text
Application
    │
    ├── Flight Recorder (User-Facing Mission Blackbox)
    │
    └── OpenTelemetry (Standardized Tracing & Metrics Substrate)
          ↓
       Local Exporters (In-Memory, Console, Local OTLP gRPC)
```

1. **Air-Gapped & Disabled by Default**:
   All OpenTelemetry integrations default to disabled (`ENABLE_OPENTELEMETRY=False`, `OTEL_ENABLED=False`) and bind strictly to local validated endpoints (e.g. `http://localhost:4317`). Any attempt to set remote cloud OTLP endpoints is blocked by `validate_local_endpoint`.

2. **Privacy Redaction Pipeline**:
   All spans pass through `RedactionPipeline` before export. Prompts, raw LLM completions, credentials, and PII are redacted from span attributes and events, ensuring strict data sovereignty.

3. **Hierarchical Span Model**:
   Spans are strictly nested to mirror mission execution flow:
   `mission` → `agent execution` / `workflow` → `llm.call` → `rag.retrieve` (`embedding`, `vector.search`) → `tool` → `verifier` → `artifact.generate`.

4. **Telemetry Bridge**:
   The `TelemetryBridge` listens to Flight Recorder events and automatically translates blackbox records into standardized OpenTelemetry spans and metric recordings without coupling high-level business logic to the OpenTelemetry SDK.

## Why This Matters
Adopting this pattern preserves the user experience and audit disposition workflow of the Flight Recorder while granting enterprise-grade OpenTelemetry interoperability. It maintains full adherence to zero-egress security constraints by design.

## When to Apply
- When integrating standardized enterprise observability into air-gapped or sensitive AI systems.
- When existing domain-specific audit blackboxes must coexist with OpenTelemetry.
- When trace spans must capture LLM/RAG latency without leaking sensitive tokens or prompts.

## Examples
### Safe Span Execution with Privacy Redaction:
```python
from app.core.telemetry import get_tracer, redact_attributes

tracer = get_tracer("sovereign.llm")

with tracer.start_as_current_span("llm.call") as span:
    span.set_attribute("model.name", "gemma4:e2b")
    span.set_attribute("stream", True)
    # Never attach raw prompt strings directly:
    safe_attrs = redact_attributes({"prompt.tokens": 128, "completion.tokens": 64})
    for k, v in safe_attrs.items():
        span.set_attribute(k, v)
```

### Exporter Initialization with Local Endpoint Validation:
```python
from app.integrations.base import validate_local_endpoint

# Validates that endpoint resolves to localhost / 127.0.0.1
validate_local_endpoint("http://localhost:4317")
```

## Related
- [Architecture Documentation](../../ARCHITECTURE.md)
- [API Reference](../../API_REFERENCE.md)
- [Flight Recorder Spec](../../FLIGHT_RECORDER_SPEC.md)
- [Security & Governance](../../SECURITY_AND_GOVERNANCE.md)
