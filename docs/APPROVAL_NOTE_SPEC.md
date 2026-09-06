# Structured Approval Note Generator Specification

## 1. Overview

The **Approval Note Generator** (`ApprovalNoteGeneratorTool`) creates tamper-evident, verifiable Microsoft Word (`.docx`) audit artifacts based on forensic evidence retrieved by the inspection agent.

To prevent agent hallucinations, the tool enforces strict **pre-generation validation** so unsupported claims cannot be silently presented as verified facts.

---

## 2. Parameter Contract

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `str` | Yes | Title of the formal approval note. |
| `task_id` | `str` | Yes | Task / mission identifier associated with this note. |
| `summary` | `str` | Yes | Executive summary of inspection findings. |
| `findings` | `List[str]` | Yes | Specific factual findings to be validated and recorded. |
| `citations` | `List[str]` | Yes | Source document references supporting each finding. |
| `risk_assessment` | `str` | Yes | Qualitative risk level (`Low`, `Medium`, `High`, `Critical`). |
| `approval_requested_by` | `str` | Yes | Identity or role of the requesting agent. |
| `approver_role` | `str` | Yes | Required role of the human signatory (e.g., `Chief Safety Engineer`). |

---

## 3. Claim Validation Engine

Before creating the `.docx` document, the generator verifies claims against citations:
1. **Empty Citation Guard**: At least one citation must be provided if findings are declared.
2. **Unsupported Claim Detection**: If citations are missing or do not correlate with findings, validation warns or rejects the generation.
3. **Cryptographic Checksum**: Upon generation, a SHA-256 hash is computed over the binary document to ensure tamper evidence.

---

## 4. Generated Artifact Structure

The resulting `.docx` file contains:
- **Formal Header & Metadata**: Task ID, Generation Date, Requesting Entity.
- **Executive Summary**: Synthesized inspection context.
- **Numbered Findings**: Verified factual assertions.
- **Evidence Citations**: References to repository documentation and chunk indices.
- **Risk Assessment**: Standardized risk rating with color-coded callouts.
- **Human Approval & Signature Block**: Explicit manual approval section with date, sign-off line, and authorization status.
- **Cryptographic Hash**: Embedded SHA-256 digest of the audit record.
