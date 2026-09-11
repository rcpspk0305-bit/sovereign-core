---
title: "Compliance Agent Fallback Grounding and System Instruction Evidence Contamination"
date: 2026-09-11
category: test-failures
module: backend/app/core/agents/specialists.py
problem_type: test_failure
component: specialist_agents
symptoms:
  - "ComplianceAgent offline fallback returned COMPLIANT on documents with zero relevant facts"
  - "Hallucination and adversarial black-box test test_agy_adversarial_hallucination_and_uncertainty failed"
  - "Agent fabricated compliance certifications based on keywords matched in system prompt"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [agents, compliance, offline-fallback, prompt-isolation, hallucination-prevention]
---

# Compliance Agent Fallback Grounding and System Instruction Evidence Contamination

## Problem
During autonomous end-to-end black-box validation with AGY (`test_agy_adversarial_hallucination_and_uncertainty`), the `ComplianceAgent` was tested with a query about Section 409A executive compensation against an ingested document that only contained an office holiday schedule. When running with the local LLM offline (engaging the autonomous fallback engine), the agent unexpectedly marked the audit as `COMPLIANT` with 0.96 confidence instead of reporting `INSUFFICIENT_EVIDENCE` or `UNVERIFIED`.

## Symptoms
- In adversarial test `test_agy_adversarial_hallucination_and_uncertainty`, the assertion failed:
  ```text
  assert 'COMPLIANT' in ('INSUFFICIENT_EVIDENCE', 'UNVERIFIED', 'NON_COMPLIANT')
  ```
- The agent output listed verified evidence rules:
  - `Company name 'Sovereign Technologies' verified on Page 2.`
  - `Authorized signatory confirmed present.`
  - `Security classification specified as CONFIDENTIAL.`
- In reality, the ingested test document contained only: `"Public Notice: Office is closed on national holidays."`

## What Didn't Work
- Relying on prompt engineering to suppress self-reporting: When the local LLM daemon is unreachable or disabled for air-gapped continuity, specialist agents execute their deterministic rule fallback `_execute_fallback_step()`. The issue was not model hallucination, but deterministic rule evaluation against contaminated message history.
- Checking raw message count: Simply checking if `messages` contains more than two items does not isolate tool observations, because the system prompt and initial user instruction are always present at indices 0 and 1.

## Root Cause
In `backend/app/core/agents/specialists.py`, line 1156 of `ComplianceAgent._execute_fallback_step`:
```python
# Flawed implementation
all_text = prompt + " " + " ".join(m.content for m in messages)
lower_text = all_text.lower()
```
`messages` contains the entire chat history:
1. `messages[0]`: The system prompt containing agent definitions, tool specifications, and parameter guidelines (which contains words like `"Sovereign-Core"`, `"present"`, `"signed"`, and `"confidential"`).
2. `messages[1]`: The user's query prompt.
3. Subsequent tool call requests and tool observation messages.

Because `messages[0]` contained the phrase `"You are Sovereign-Core's ComplianceAgent..."`, the rule checking `"sovereign"` evaluated to `True`. Similarly, tool parameter definitions in `messages[0]` describing fields like `"present"` and `"CONFIDENTIAL"` matched the signatory and classification checks, erroneously certifying full compliance without any backing evidence from the document.

## Solution
Restricted the evaluation text in `ComplianceAgent._execute_fallback_step` strictly to tool observation payloads (`"Observation from 'document_retrieval'"`). System instructions and prompt templates are explicitly filtered out.

```python
# Fixed implementation in backend/app/core/agents/specialists.py
# Evaluate rules strictly against retrieved document observations (never system prompt or prompt metadata)
retrieved_text = " ".join(m.content for m in messages if "Observation from '" in m.content)
lower_text = retrieved_text.lower()

checks = []
all_compliant = True

rules_to_check = self.DEFAULT_RULES
for rule in rules_to_check:
    r_lower = rule.lower()
    status = "INSUFFICIENT_EVIDENCE"
    evidence = []
    reason = "No matching evidence found in document."

    if "company" in r_lower:
        if "sovereign technologies" in lower_text or "sovereign" in lower_text:
            status = "COMPLIANT"
            evidence = ["Required company name: Sovereign Technologies"]
            reason = "Company name verified in retrieved document."
        else:
            all_compliant = False
    # Remaining rules evaluate against lower_text from observations only...
```

If the retrieved document observations do not contain the required terms, `status` remains `"INSUFFICIENT_EVIDENCE"` and `all_compliant` remains `False`, resulting in an overall status of `INSUFFICIENT_EVIDENCE`.

## Verification & Ground Truth
1. Re-ran `tests/test_agy_blackbox_validation.py::test_agy_adversarial_hallucination_and_uncertainty`:
   ```bash
   .\.venv\Scripts\pytest tests/test_agy_blackbox_validation.py -v -k test_agy_adversarial_hallucination_and_uncertainty
   ```
   **Result:** PASSED. When facts are absent from the retrieved chunks, `parsed.get("status")` returned `INSUFFICIENT_EVIDENCE`.
2. Verified all 13 AGY black-box test scenarios:
   ```bash
   .\.venv\Scripts\pytest tests/test_agy_blackbox_validation.py -v
   ```
   **Result:** 13 passed in 3.29s.
3. Full backend regression test suite:
   ```bash
   .\.venv\Scripts\pytest -v
   ```
   **Result:** 193 passed, 13 skipped, 0 failed.

## Prevention & Lessons Learned
- **Never include system prompts in evidence evaluation:** Autonomous fallback logic and deterministic parsers must strictly separate agent scaffolding (system prompts, role instructions, schema definitions) from observational evidence returned by tools.
- **Enforce Anti-False-Result validation:** Automated black-box adversarial tests that supply deliberately incomplete or contradictory information are essential to expose optimistic fallback paths that accidentally create false positives.
