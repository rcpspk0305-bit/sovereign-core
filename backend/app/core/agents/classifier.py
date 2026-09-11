"""Controlled Task Classifier for Sovereign-Core Agent Squad."""

from typing import List, Optional
from pydantic import BaseModel, Field


class TaskClassificationResult(BaseModel):
    """Structured output from task intent classification."""
    category: str = Field(..., description="Classification category (research, document_analysis, data_analysis, compliance, report_generation, complex_mission).")
    target_agent_id: str = Field(..., description="Assigned agent ID in AgentRegistry.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence score.")
    reasoning: str = Field(..., description="Explanation of classification decision.")
    suggested_pipeline: List[str] = Field(default_factory=list, description="Ordered agent IDs for complex missions.")
    requires_clarification: bool = Field(default=False, description="Flag indicating underspecified intent.")


class TaskClassifier:
    """Classifies user prompts into registered specialist agents or multi-agent missions."""

    COMPLEX_MISSION_KEYWORDS = (
        "and calculate",
        "and check compliance",
        "and generate",
        "and produce",
        "executive summary",
        "end to end",
        "full analysis",
        "golden mission",
    )

    DATA_KEYWORDS = (
        "calculate",
        "growth",
        "percentage",
        "increase",
        "delta",
        "math",
        "arithmetic",
        "sum",
        "difference",
        "ratio",
        "revenue growth",
    )

    COMPLIANCE_KEYWORDS = (
        "compliance",
        "rules",
        "audit date",
        "signatory",
        "classification",
        "retention",
        "compliant",
        "satisfies",
        "requirements",
        "non-compliant",
    )

    REPORT_KEYWORDS = (
        "generate report",
        "produce report",
        "write report",
        "create report",
        "executive report",
        "formal report",
        "structured report",
    )

    DOC_ANALYSIS_KEYWORDS = (
        "summarize document",
        "contradiction",
        "inconsistency",
        "compare sections",
        "extract facts",
        "missing information",
        "suspicious instruction",
        "page 2",
        "uploaded report",
        "analyze document",
    )

    RESEARCH_KEYWORDS = (
        "find",
        "search",
        "retrieve",
        "what is",
        "reactor efficiency",
        "tell me about",
        "investigate",
        "knowledge base",
    )

    def classify(self, prompt: str) -> TaskClassificationResult:
        """Deterministically classify a user prompt using keyword heuristics and pattern matching."""
        if not prompt or not prompt.strip():
            return TaskClassificationResult(
                category="research",
                target_agent_id="research",
                confidence=0.0,
                reasoning="Empty directive supplied. Requires user clarification.",
                requires_clarification=True,
            )

        p_lower = prompt.lower().strip()

        # 1. Complex Mission Detection
        # Check if directive combines multiple specialist domains (e.g. analyze + calculate + compliance + report)
        domain_hits = 0
        if any(k in p_lower for k in self.DOC_ANALYSIS_KEYWORDS):
            domain_hits += 1
        if any(k in p_lower for k in self.DATA_KEYWORDS):
            domain_hits += 1
        if any(k in p_lower for k in self.COMPLIANCE_KEYWORDS):
            domain_hits += 1
        if any(k in p_lower for k in self.REPORT_KEYWORDS):
            domain_hits += 1

        is_complex = domain_hits >= 2 or any(k in p_lower for k in self.COMPLEX_MISSION_KEYWORDS)

        if is_complex:
            pipeline: List[str] = []
            if any(k in p_lower for k in self.DOC_ANALYSIS_KEYWORDS) or "document" in p_lower:
                pipeline.append("document_analyst")
            if any(k in p_lower for k in self.DATA_KEYWORDS):
                pipeline.append("data_analyst")
            if any(k in p_lower for k in self.COMPLIANCE_KEYWORDS):
                pipeline.append("compliance")
            if any(k in p_lower for k in self.REPORT_KEYWORDS) or "report" in p_lower or "summary" in p_lower:
                pipeline.append("report")

            if not pipeline:
                pipeline = ["document_analyst", "data_analyst", "compliance", "report"]

            return TaskClassificationResult(
                category="complex_mission",
                target_agent_id="orchestrator",
                confidence=0.95,
                reasoning=f"Detected multi-domain mission spanning {domain_hits} domains. Routing to Mission Orchestrator.",
                suggested_pipeline=pipeline,
            )

        # 2. Compliance Evaluation
        if any(k in p_lower for k in self.COMPLIANCE_KEYWORDS):
            return TaskClassificationResult(
                category="compliance",
                target_agent_id="compliance",
                confidence=0.92,
                reasoning="Directive focuses on rule evaluation and regulatory compliance inspection.",
                suggested_pipeline=["compliance"],
            )

        # 3. Quantitative / Data Analysis
        if any(k in p_lower for k in self.DATA_KEYWORDS):
            return TaskClassificationResult(
                category="data_analysis",
                target_agent_id="data_analyst",
                confidence=0.94,
                reasoning="Directive requests quantitative computation, percentage calculation, or arithmetic analysis.",
                suggested_pipeline=["data_analyst"],
            )

        # 4. Report Generation
        if any(k in p_lower for k in self.REPORT_KEYWORDS):
            return TaskClassificationResult(
                category="report_generation",
                target_agent_id="report",
                confidence=0.91,
                reasoning="Directive requests compiling findings into a formal report artifact.",
                suggested_pipeline=["report"],
            )

        # 5. Document Structure Analysis
        if any(k in p_lower for k in self.DOC_ANALYSIS_KEYWORDS):
            return TaskClassificationResult(
                category="document_analysis",
                target_agent_id="document_analyst",
                confidence=0.90,
                reasoning="Directive requires structural document inspection, fact extraction, or contradiction checking.",
                suggested_pipeline=["document_analyst"],
            )

        # 6. Research
        if any(k in p_lower for k in self.RESEARCH_KEYWORDS) or len(p_lower.split()) <= 6:
            return TaskClassificationResult(
                category="research",
                target_agent_id="research",
                confidence=0.85,
                reasoning="Directive mapped to semantic retrieval and evidence synthesis.",
                suggested_pipeline=["research"],
            )

        # Low confidence fallback -> Route to Orchestrator or request clarification
        return TaskClassificationResult(
            category="complex_mission",
            target_agent_id="orchestrator",
            confidence=0.60,
            reasoning="Broad or ambiguous directive routed to Mission Orchestrator for dynamic decomposition.",
            suggested_pipeline=["research", "document_analyst"],
            requires_clarification=False,
        )


task_classifier = TaskClassifier()
