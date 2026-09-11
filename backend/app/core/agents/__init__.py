"""Agents module for Sovereign-Core Agent Squad."""

from app.core.agents.definitions import (
    AgentDefinition,
    AgentStateModel,
    AgentStatus,
    ApprovalPolicy,
)
from app.core.agents.inspection_agent import InspectionAnalysisAgent
from app.core.agents.orchestrator import SimpleOrchestratorAgent
from app.core.agents.registry import AgentRegistry, agent_registry
from app.core.agents.classifier import TaskClassifier, TaskClassificationResult, task_classifier
from app.core.agents.mission_orchestrator import MissionOrchestrator, ORCHESTRATOR_DEF
from app.core.agents.specialists import (
    ComplianceAgent,
    DataAnalyst,
    DocumentAnalyst,
    ReportAgent,
    ResearchAgent,
    COMPLIANCE_AGENT_DEF,
    DATA_ANALYST_DEF,
    DOCUMENT_ANALYST_DEF,
    REPORT_AGENT_DEF,
    RESEARCH_AGENT_DEF,
    SpecialistAgentBase,
)
from app.core.agents.telemetry_dispatcher import (
    AgentTelemetryDispatcher,
    agent_telemetry_dispatcher,
    get_telemetry_dispatcher,
)


def _init_default_agent_registry() -> None:
    """Register the production-quality Agent Squad in the central registry."""
    agent_registry.register(RESEARCH_AGENT_DEF, ResearchAgent)
    agent_registry.register(DOCUMENT_ANALYST_DEF, DocumentAnalyst)
    agent_registry.register(DATA_ANALYST_DEF, DataAnalyst)
    agent_registry.register(REPORT_AGENT_DEF, ReportAgent)
    agent_registry.register(COMPLIANCE_AGENT_DEF, ComplianceAgent)
    agent_registry.register(ORCHESTRATOR_DEF, MissionOrchestrator)


_init_default_agent_registry()

__all__ = [
    "AgentDefinition",
    "AgentRegistry",
    "AgentStateModel",
    "AgentStatus",
    "ApprovalPolicy",
    "ComplianceAgent",
    "DataAnalyst",
    "DocumentAnalyst",
    "InspectionAnalysisAgent",
    "MissionOrchestrator",
    "ReportAgent",
    "ResearchAgent",
    "SimpleOrchestratorAgent",
    "SpecialistAgentBase",
    "TaskClassificationResult",
    "TaskClassifier",
    "AgentTelemetryDispatcher",
    "agent_telemetry_dispatcher",
    "get_telemetry_dispatcher",
    "agent_registry",
    "task_classifier",
    "RESEARCH_AGENT_DEF",
    "DOCUMENT_ANALYST_DEF",
    "DATA_ANALYST_DEF",
    "REPORT_AGENT_DEF",
    "COMPLIANCE_AGENT_DEF",
    "ORCHESTRATOR_DEF",
]
