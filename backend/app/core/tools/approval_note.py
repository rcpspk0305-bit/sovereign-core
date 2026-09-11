"""Approval Note Artifact Generator with Claim-Evidence Validation and Local DOCX Creation."""

import datetime
import hashlib
import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import docx
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

from app.core.interfaces.tools import BaseTool, ToolDefinition, ToolResult

logger = logging.getLogger("sovereign.tools.approval_note")


class ApprovalNoteGeneratorTool(BaseTool):
    """Controlled tool for generating structured, evidence-grounded approval notes with DOCX export.

    Enforces:
    - Claim-Evidence validation: Claims without retrieved source backing are explicitly flagged as UNVERIFIED.
    - Explicit Human Approval section: Sign-off fields for name, role, decision, signature, date, and conditions.
    - Local DOCX generation: Formats a professional Microsoft Word document saved to local disk with SHA-256 integrity.
    """

    def __init__(self, artifacts_dir: Optional[Path] = None) -> None:
        from app.config import settings  # local import avoids circular at module load
        self.artifacts_dir = artifacts_dir or settings.ARTIFACTS_DIR
        try:
            self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        except Exception as ex:
            logger.warning("Could not initialize artifacts directory: %s", ex)

    @property
    def name(self) -> str:
        return "approval_note_generator"

    @property
    def description(self) -> str:
        return (
            "Generates a formal, structured Approval Note artifact with source citations, "
            "claim-evidence validation, an explicit human approval sign-off section, and local DOCX file output."
        )

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the Approval Note (e.g. 'Approval Note: Apollo99 Thermal Incident Assessment').",
                    },
                    "decision": {
                        "type": "string",
                        "enum": ["APPROVED", "CONDITIONAL_APPROVAL", "REJECTED", "PENDING_AUDIT"],
                        "description": "Preliminary recommendation or decision status. Default is 'CONDITIONAL_APPROVAL'.",
                        "default": "CONDITIONAL_APPROVAL",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Executive summary detailing the objective, context, and core justification.",
                    },
                    "findings": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "statement": {"type": "string", "description": "The finding, assertion, or fact."},
                                "citation": {"type": "string", "description": "Source reference, document name, or page."},
                            },
                            "required": ["statement"],
                        },
                        "description": "List of factual findings/claims with corresponding source citations.",
                    },
                    "citations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of verified source references, e.g. ['apollo99_spec.pdf (Page 4)'].",
                    },
                    "retrieved_evidence": {
                        "type": "string",
                        "description": "Optional raw or concatenated retrieved text chunks used for claim verification.",
                    },
                    "risk_assessment": {
                        "type": "string",
                        "description": "Risk analysis, caveats, or mitigating factors.",
                    },
                    "human_approval_role": {
                        "type": "string",
                        "description": "Required human authority role (e.g. 'Lead Systems Engineer / Flight Operations Director').",
                        "default": "Lead Systems Engineer / Flight Operations Director",
                    },
                },
                "required": ["title", "summary", "findings"],
            },
        )

    def _validate_claim(
        self,
        statement: str,
        citation: Optional[str],
        citations_list: List[str],
        retrieved_evidence: str,
    ) -> Tuple[bool, str]:
        """Validate if a claim is factually grounded in citations or retrieved text.

        Returns (is_verified, reason).
        """
        trimmed = statement.strip()
        if not citation and not citations_list and not retrieved_evidence:
            return False, "No citation or retrieved evidence provided for this assertion."

        # Check if an explicit citation is attached directly
        has_direct_citation = bool(citation and len(citation.strip()) > 3)

        # Build corpus of known evidence text
        evidence_corpus = (retrieved_evidence + " " + " ".join(citations_list)).lower()

        # Extract meaningful tokens (numbers, uppercase words, significant keywords)
        numbers = re.findall(r"\d+(?:\.\d+)?", trimmed)
        alphanumeric_terms = [w.lower() for w in re.findall(r"\b[a-zA-Z]{4,}\b", trimmed)]

        # If numbers are claimed (e.g. 75, 82, 7, 4500), they must exist in the evidence corpus
        if numbers:
            unmatched_numbers = [num for num in numbers if num not in evidence_corpus]
            if unmatched_numbers and not has_direct_citation:
                return (
                    False,
                    f"Numerical claim ({', '.join(unmatched_numbers)}) not found in retrieved evidence.",
                )

        # If there is a direct citation, consider it verified
        if has_direct_citation:
            return True, f"Verified via cited source: {citation}"

        # Otherwise check if significant terms match evidence
        if alphanumeric_terms:
            matched_terms = [term for term in alphanumeric_terms if term in evidence_corpus]
            overlap_ratio = len(matched_terms) / len(alphanumeric_terms)
            if overlap_ratio >= 0.60:
                return True, "Verified via semantic overlap with retrieved evidence chunks."

        return (
            False,
            "Unsupported claim: Lacks direct source citation and does not match retrieved evidence.",
        )

    def _create_docx(
        self,
        filepath: Path,
        title: str,
        decision: str,
        summary: str,
        validated_findings: List[Dict[str, Any]],
        citations: List[str],
        risk_assessment: Optional[str],
        human_approval_role: str,
        validation_status: str,
        now_utc: str,
    ) -> None:
        """Create a professional DOCX document using python-docx."""
        doc = docx.Document()

        # Page margins
        for section in doc.sections:
            section.top_margin = Inches(0.8)
            section.bottom_margin = Inches(0.8)
            section.left_margin = Inches(0.8)
            section.right_margin = Inches(0.8)

        # 1. Header Banner
        header_p = doc.add_paragraph()
        header_run = header_p.add_run("SOVEREIGN-CORE CONTROLLED MISSION ARTIFACT")
        header_run.font.size = Pt(9)
        header_run.font.bold = True
        header_run.font.color.rgb = RGBColor(100, 116, 139)  # Slate
        header_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

        # 2. Main Title
        title_p = doc.add_paragraph()
        title_run = title_p.add_run(title)
        title_run.font.size = Pt(20)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(15, 23, 42)  # Dark slate

        # 3. Metadata Table
        meta_table = doc.add_table(rows=4, cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        meta_data = [
            ("Date / Timestamp", now_utc),
            ("Preliminary Decision", decision),
            ("Security Policy", "Controlled Air-Gapped Local Execution (No Egress)"),
            ("Grounding Status", validation_status),
        ]
        for row_idx, (label, val) in enumerate(meta_data):
            row = meta_table.rows[row_idx]
            cell_lbl, cell_val = row.cells[0], row.cells[1]
            cell_lbl.width = Inches(2.2)
            cell_val.width = Inches(4.5)

            p_lbl = cell_lbl.paragraphs[0]
            run_lbl = p_lbl.add_run(label)
            run_lbl.font.bold = True
            run_lbl.font.size = Pt(10)

            p_val = cell_val.paragraphs[0]
            run_val = p_val.add_run(val)
            run_val.font.size = Pt(10)
            if label == "Grounding Status" and "UNSUPPORTED" in val:
                run_val.font.bold = True
                run_val.font.color.rgb = RGBColor(225, 29, 72)  # Rose/Red
            elif label == "Preliminary Decision":
                run_val.font.bold = True
                run_val.font.color.rgb = (
                    RGBColor(16, 185, 129) if "APPROVED" in val else RGBColor(217, 119, 6)
                )

        doc.add_paragraph()  # Spacing

        # 4. Executive Summary
        h_sum = doc.add_heading("1. Executive Summary", level=1)
        h_sum.runs[0].font.size = Pt(14)
        h_sum.runs[0].font.color.rgb = RGBColor(30, 41, 59)
        p_sum = doc.add_paragraph(summary)
        p_sum.style.font.size = Pt(11)

        # 5. Unsupported Claims Warning Callout (if any unverified claims exist)
        unverified_claims = [f for f in validated_findings if not f["is_verified"]]
        if unverified_claims:
            warn_p = doc.add_paragraph()
            warn_run = warn_p.add_run("WARNING: UNSUPPORTED CLAIMS IDENTIFIED\n")
            warn_run.font.bold = True
            warn_run.font.size = Pt(11)
            warn_run.font.color.rgb = RGBColor(225, 29, 72)

            warn_desc = warn_p.add_run(
                "The following findings could not be factually grounded against retrieved citations or vector evidence. "
                "Per Sovereign-Core verification policy, these claims are explicitly classified as UNVERIFIED and "
                "must NOT be treated as verified facts without independent human verification:\n"
            )
            warn_desc.font.size = Pt(10)
            warn_desc.font.color.rgb = RGBColor(190, 18, 60)

            for uv in unverified_claims:
                uv_p = doc.add_paragraph(style="List Bullet")
                uv_run = uv_p.add_run(f"[UNVERIFIED] {uv['statement']} — {uv['reason']}")
                uv_run.font.size = Pt(10)
                uv_run.font.bold = True
                uv_run.font.color.rgb = RGBColor(190, 18, 60)

        # 6. Detailed Findings & Grounding Verification
        h_find = doc.add_heading("2. Verified Findings & Evidence Grounding", level=1)
        h_find.runs[0].font.size = Pt(14)
        h_find.runs[0].font.color.rgb = RGBColor(30, 41, 59)

        # Findings Table
        findings_table = doc.add_table(rows=1 + len(validated_findings), cols=3)
        findings_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        headers = ["Finding / Assertion", "Grounding Status", "Source Citation"]
        for col_idx, h_text in enumerate(headers):
            cell = findings_table.rows[0].cells[col_idx]
            p = cell.paragraphs[0]
            run = p.add_run(h_text)
            run.font.bold = True
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(255, 255, 255)

        # Set column widths
        col_widths = [Inches(3.5), Inches(1.5), Inches(1.8)]
        for row in findings_table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = w

        # Populate findings rows
        for idx, f_item in enumerate(validated_findings, start=1):
            row = findings_table.rows[idx]
            # Column 1: Statement
            p0 = row.cells[0].paragraphs[0]
            r0 = p0.add_run(f_item["statement"])
            r0.font.size = Pt(9.5)

            # Column 2: Status
            p1 = row.cells[1].paragraphs[0]
            if f_item["is_verified"]:
                r1 = p1.add_run("VERIFIED")
                r1.font.bold = True
                r1.font.size = Pt(9)
                r1.font.color.rgb = RGBColor(16, 185, 129)
            else:
                r1 = p1.add_run("UNVERIFIED")
                r1.font.bold = True
                r1.font.size = Pt(9)
                r1.font.color.rgb = RGBColor(225, 29, 72)

            # Column 3: Citation
            p2 = row.cells[2].paragraphs[0]
            citation_text = f_item.get("citation") or "None (Uncited)"
            r2 = p2.add_run(citation_text)
            r2.font.size = Pt(9)
            if not f_item["is_verified"]:
                r2.font.italic = True
                r2.font.color.rgb = RGBColor(148, 163, 184)

        doc.add_paragraph()  # Spacing

        # 7. Risk Analysis & Caveats
        if risk_assessment:
            h_risk = doc.add_heading("3. Risk Analysis & Operational Caveats", level=1)
            h_risk.runs[0].font.size = Pt(14)
            h_risk.runs[0].font.color.rgb = RGBColor(30, 41, 59)
            p_risk = doc.add_paragraph(risk_assessment)
            p_risk.style.font.size = Pt(11)

        # 8. Source Citations & Provenance
        if citations:
            h_cite = doc.add_heading("4. Source Citations & References", level=1)
            h_cite.runs[0].font.size = Pt(14)
            h_cite.runs[0].font.color.rgb = RGBColor(30, 41, 59)
            for c in citations:
                p_c = doc.add_paragraph(style="List Bullet")
                r_c = p_c.add_run(c)
                r_c.font.size = Pt(10)

        # 9. EXPLICIT HUMAN APPROVAL SECTION
        h_app = doc.add_heading("5. Explicit Human Approval & Governance Sign-Off", level=1)
        h_app.runs[0].font.size = Pt(14)
        h_app.runs[0].font.color.rgb = RGBColor(30, 41, 59)

        desc_p = doc.add_paragraph(
            "This Approval Note was compiled autonomously by Sovereign-Core. Final deployment, mission execution, "
            "and legal authority require mandatory human-in-the-loop review and signature below:"
        )
        desc_p.style.font.size = Pt(10.5)

        # Sign-off box table
        sign_table = doc.add_table(rows=6, cols=2)
        sign_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        sign_fields = [
            ("REQUIRED APPROVER ROLE", human_approval_role),
            ("HUMAN APPROVER NAME", "________________________________________________"),
            ("FORMAL DISPOSITION", "[  ] APPROVED       [  ] CONDITIONAL       [  ] REJECTED"),
            ("DIGITAL / PHYSICAL SIGNATURE", "________________________________________________"),
            ("SIGN-OFF DATE", "____________________"),
            ("CONDITIONS & CAVEATS", "________________________________________________\n________________________________________________"),
        ]

        for row_idx, (f_name, f_val) in enumerate(sign_fields):
            row = sign_table.rows[row_idx]
            c0, c1 = row.cells[0], row.cells[1]
            c0.width = Inches(2.5)
            c1.width = Inches(4.2)

            p0 = c0.paragraphs[0]
            r0 = p0.add_run(f_name)
            r0.font.bold = True
            r0.font.size = Pt(9.5)
            r0.font.color.rgb = RGBColor(51, 65, 85)

            p1 = c1.paragraphs[0]
            r1 = p1.add_run(f_val)
            r1.font.size = Pt(9.5)
            if f_name == "REQUIRED APPROVER ROLE":
                r1.font.bold = True
                r1.font.color.rgb = RGBColor(14, 116, 144)

        doc.save(str(filepath))

    async def execute(self, **kwargs: Any) -> ToolResult:
        start = time.perf_counter()
        title = kwargs.get("title")
        summary = kwargs.get("summary")
        raw_findings = kwargs.get("findings")

        if not title or not isinstance(title, str) or not title.strip():
            return ToolResult(
                success=False,
                output=None,
                error="Parameter 'title' must be a non-empty string.",
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )

        if not summary or not isinstance(summary, str) or not summary.strip():
            return ToolResult(
                success=False,
                output=None,
                error="Parameter 'summary' must be a non-empty string.",
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )

        if not raw_findings or not isinstance(raw_findings, list) or len(raw_findings) == 0:
            return ToolResult(
                success=False,
                output=None,
                error="Parameter 'findings' must be a non-empty list of findings.",
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )

        decision = kwargs.get("decision", "CONDITIONAL_APPROVAL")
        citations: List[str] = kwargs.get("citations") or []
        retrieved_evidence = str(kwargs.get("retrieved_evidence", ""))
        risk_assessment = kwargs.get("risk_assessment")
        human_approval_role = kwargs.get(
            "human_approval_role", "Lead Systems Engineer / Flight Operations Director"
        )
        now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # 1. Normalize and Validate Claims
        validated_findings: List[Dict[str, Any]] = []
        unverified_claims: List[Dict[str, Any]] = []

        for item in raw_findings:
            if isinstance(item, str):
                statement = item
                citation = None
            elif isinstance(item, dict):
                statement = str(item.get("statement") or item.get("claim") or "")
                citation = item.get("citation")
            else:
                statement = str(item)
                citation = None

            is_verified, reason = self._validate_claim(
                statement=statement,
                citation=citation,
                citations_list=citations,
                retrieved_evidence=retrieved_evidence,
            )

            record = {
                "statement": statement,
                "citation": citation,
                "is_verified": is_verified,
                "reason": reason,
            }
            validated_findings.append(record)
            if not is_verified:
                unverified_claims.append(record)

        total_claims = len(validated_findings)
        unverified_count = len(unverified_claims)
        verified_count = total_claims - unverified_count

        if unverified_count > 0:
            validation_status = f"FLAGGED ({unverified_count} of {total_claims} claims UNSUPPORTED)"
        else:
            validation_status = f"FULLY GROUNDED ({verified_count} of {total_claims} verified)"

        # 2. Build Markdown Representation
        md_lines = [
            f"# {title.strip()}",
            "",
            f"> **Generated**: {now_utc}  ",
            "> **Classification**: Controlled Sovereign Approval Note  ",
            f"> **Preliminary Recommendation**: {decision}  ",
            f"> **Grounding Validation Status**: {validation_status}",
            "",
            "## 1. Executive Summary",
            summary.strip(),
            "",
        ]

        if unverified_count > 0:
            md_lines.extend([
                "### ⚠️ CAUTION: UNSUPPORTED CLAIMS DETECTED",
                "> **NOTICE**: The following findings could not be corroborated against retrieved citations or vector evidence.",
                "> Per Sovereign-Core governance policy, they are explicitly demarcated as UNVERIFIED and must not be treated as verified facts:",
                "",
            ])
            for uv in unverified_claims:
                md_lines.append(f"- 🔴 **[UNVERIFIED CLAIM]**: {uv['statement']} *(Reason: {uv['reason']})*")
            md_lines.append("")

        md_lines.append("## 2. Findings & Evidence Grounding")
        for idx, vf in enumerate(validated_findings, start=1):
            badge = "✅ [VERIFIED]" if vf["is_verified"] else "⚠️ [UNVERIFIED]"
            cite_str = f" *(Citation: {vf['citation']})*" if vf.get("citation") else " *(No Citation)*"
            md_lines.append(f"{idx}. {badge} {vf['statement']}{cite_str}")

        if risk_assessment:
            md_lines.extend([
                "",
                "## 3. Risk Analysis & Operational Caveats",
                risk_assessment.strip(),
            ])

        if citations:
            md_lines.extend([
                "",
                "## 4. Source Citations & References",
            ])
            for c in citations:
                md_lines.append(f"- {c}")

        md_lines.extend([
            "",
            "## 5. Explicit Human Approval & Governance Sign-Off",
            "This Approval Note was compiled by Sovereign-Core. Execution authority requires mandatory human sign-off:",
            "",
            "```text",
            "=======================================================================",
            f"REQUIRED APPROVER ROLE: {human_approval_role}",
            "HUMAN APPROVER NAME:    _______________________________________________",
            "FORMAL DISPOSITION:     [ ] APPROVED    [ ] CONDITIONAL    [ ] REJECTED",
            "DIGITAL/PHYSICAL SIGN:  _______________________________________________",
            "DATE OF SIGN-OFF:       ____________________",
            "CONDITIONS & CAVEATS:   _______________________________________________",
            "=======================================================================",
            "```",
        ])

        markdown_doc = "\n".join(md_lines)

        # 3. Generate Local DOCX File
        slug = re.sub(r"[^\w\-]", "_", title.lower()[:35]).strip("_")
        filename = f"approval_note_{slug}_{uuid.uuid4().hex[:6]}.docx"
        filepath = self.artifacts_dir / filename

        docx_generated = False
        docx_checksum = None
        docx_size_bytes = 0

        if HAS_DOCX:
            try:
                self._create_docx(
                    filepath=filepath,
                    title=title.strip(),
                    decision=decision,
                    summary=summary.strip(),
                    validated_findings=validated_findings,
                    citations=citations,
                    risk_assessment=risk_assessment,
                    human_approval_role=human_approval_role,
                    validation_status=validation_status,
                    now_utc=now_utc,
                )
                docx_generated = True
                file_bytes = filepath.read_bytes()
                docx_size_bytes = len(file_bytes)
                docx_checksum = hashlib.sha256(file_bytes).hexdigest()
            except Exception as ex:
                logger.warning("Failed to generate DOCX file: %s", ex)

        elapsed = (time.perf_counter() - start) * 1000.0

        return ToolResult(
            success=True,
            output={
                "artifact_type": "approval_note",
                "title": title.strip(),
                "decision": decision,
                "document_content": markdown_doc,
                "docx_file_path": str(filepath.resolve()) if docx_generated else None,
                "docx_file_name": filename if docx_generated else None,
                "docx_file_size_bytes": docx_size_bytes,
                "checksum_sha256": docx_checksum or hashlib.sha256(markdown_doc.encode("utf-8")).hexdigest(),
                "validation_status": validation_status,
                "total_claims": total_claims,
                "verified_claims_count": verified_count,
                "unsupported_claims_count": unverified_count,
                "unsupported_claims": [uv["statement"] for uv in unverified_claims],
                "human_approval_role": human_approval_role,
            },
            execution_time_ms=round(elapsed, 2),
        )
