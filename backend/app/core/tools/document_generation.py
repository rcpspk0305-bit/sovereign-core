"""Document Generation Tool for creating structured inspection and analysis reports."""

import datetime
import time
from typing import Any, Dict, List, Optional

from app.core.interfaces.tools import BaseTool, ToolDefinition, ToolResult


class DocumentGenerationTool(BaseTool):
    """Controlled tool for generating structured inspection reports and markdown documents."""

    @property
    def name(self) -> str:
        return "document_generation"

    @property
    def description(self) -> str:
        return (
            "Generates a structured inspection report, analysis summary, or markdown document "
            "with title, executive summary, itemized findings, citations, and actionable recommendations."
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
                        "description": "The title of the inspection or analysis document.",
                    },
                    "summary": {
                        "type": "string",
                        "description": "High-level executive summary of the inspection or analysis.",
                    },
                    "findings": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of specific findings, observations, or metrics extracted during inspection.",
                    },
                    "citations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of source document citations (e.g. ['manual.pdf (Page 4)']).",
                    },
                    "recommendations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional actionable recommendations or next steps.",
                    },
                    "format": {
                        "type": "string",
                        "enum": ["markdown", "json"],
                        "description": "Output format of the generated document. Default is 'markdown'.",
                        "default": "markdown",
                    },
                },
                "required": ["title", "summary", "findings"],
            },
        )

    async def execute(self, **kwargs: Any) -> ToolResult:
        start = time.perf_counter()
        title = kwargs.get("title")
        summary = kwargs.get("summary")
        findings = kwargs.get("findings")

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

        if not findings or not isinstance(findings, list) or len(findings) == 0:
            return ToolResult(
                success=False,
                output=None,
                error="Parameter 'findings' must be a non-empty list of string findings.",
                execution_time_ms=round((time.perf_counter() - start) * 1000.0, 2),
            )

        citations: List[str] = kwargs.get("citations") or []
        recommendations: List[str] = kwargs.get("recommendations") or []
        doc_format = kwargs.get("format", "markdown").lower()

        now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        if doc_format == "json":
            doc_data = {
                "title": title.strip(),
                "generated_at": now_utc,
                "executive_summary": summary.strip(),
                "findings": [str(f) for f in findings],
                "citations": [str(c) for c in citations],
                "recommendations": [str(r) for r in recommendations],
            }
            elapsed = (time.perf_counter() - start) * 1000.0
            return ToolResult(
                success=True,
                output={
                    "document_format": "json",
                    "title": title.strip(),
                    "document_content": doc_data,
                    "findings_count": len(findings),
                    "citations_count": len(citations),
                },
                execution_time_ms=round(elapsed, 2),
            )

        # Markdown format
        lines = [
            f"# {title.strip()}",
            "",
            f"> **Generated**: {now_utc}  ",
            "> **Classification**: Controlled Sovereign Inspection Report",
            "",
            "## Executive Summary",
            summary.strip(),
            "",
            "## Detailed Findings",
        ]

        for i, finding in enumerate(findings, start=1):
            lines.append(f"{i}. {finding}")

        if citations:
            lines.extend([
                "",
                "## Source Citations & References",
            ])
            for citation in citations:
                lines.append(f"- {citation}")

        if recommendations:
            lines.extend([
                "",
                "## Actionable Recommendations",
            ])
            for i, rec in enumerate(recommendations, start=1):
                lines.append(f"{i}. {rec}")

        markdown_doc = "\n".join(lines)
        word_count = len(markdown_doc.split())

        elapsed = (time.perf_counter() - start) * 1000.0
        return ToolResult(
            success=True,
            output={
                "document_format": "markdown",
                "title": title.strip(),
                "document_content": markdown_doc,
                "word_count": word_count,
                "findings_count": len(findings),
                "citations_count": len(citations),
            },
            execution_time_ms=round(elapsed, 2),
        )
