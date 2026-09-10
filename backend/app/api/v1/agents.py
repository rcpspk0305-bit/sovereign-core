"""Agent orchestration router with controlled Inspection-Analysis Agent and LangGraph Orchestrator."""

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.v1.chat import get_audit_logger
from app.api.v1.rag import get_retriever
from app.config import settings
from app.core.agents.inspection_agent import InspectionAnalysisAgent
from app.core.interfaces.agents import AgentResult, BaseAgent
from app.core.interfaces.audit import BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.rag import BaseRetriever
from app.core.interfaces.tools import ToolDefinition
from app.core.llm.service import get_llm_provider
from app.core.tools.approval_note import ApprovalNoteGeneratorTool
from app.core.tools.document_generation import DocumentGenerationTool
from app.core.tools.document_retrieval import DocumentRetrievalTool
from app.core.tools.registry import CalculatorTool, ControlledToolRegistry
try:
    from app.integrations.langgraph.orchestrator import LangGraphAgentOrchestrator
except ModuleNotFoundError as exc:  # pragma: no cover - optional integration dependency
    if exc.name != "langgraph":
        raise

    class LangGraphAgentOrchestrator:  # type: ignore[no-redef]
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            raise HTTPException(
                status_code=503,
                detail="LangGraph integration is unavailable. Install the langgraph dependency.",
            )

router = APIRouter(prefix="/agents", tags=["Agents"])


class AgentRunRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    max_steps: int = Field(default=5, ge=1, le=10)
    model: Optional[str] = None
    agent_type: str = Field(default="inspection_analysis")
    orchestrator: Optional[str] = Field(default="default")  # "default" or "langgraph"


class MissionApprovalRequest(BaseModel):
    status: str = Field(default="APPROVED")  # "APPROVED" or "REJECTED"
    notes: Optional[str] = None


def get_controlled_tool_registry(
    retriever: BaseRetriever = Depends(get_retriever),
) -> ControlledToolRegistry:
    """Create a strictly controlled tool registry with only permitted inspection tools."""
    registry = ControlledToolRegistry()
    registry.register(DocumentRetrievalTool(retriever=retriever))
    registry.register(CalculatorTool())
    registry.register(DocumentGenerationTool())
    registry.register(ApprovalNoteGeneratorTool())
    return registry


def get_agent(
    llm_client: BaseLLMClient = Depends(get_llm_provider),
    tool_registry: ControlledToolRegistry = Depends(get_controlled_tool_registry),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> BaseAgent:
    """Default agent dependency injecting the single controlled InspectionAnalysisAgent."""
    return InspectionAnalysisAgent(
        llm_client=llm_client,
        tool_registry=tool_registry,
        audit_logger=audit_logger,
        max_allowed_steps=10,
    )


# Shared orchestrator instance
_langgraph_orchestrator: Optional[LangGraphAgentOrchestrator] = None


def get_langgraph_orchestrator(
    llm_client: BaseLLMClient = Depends(get_llm_provider),
    tool_registry: ControlledToolRegistry = Depends(get_controlled_tool_registry),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> LangGraphAgentOrchestrator:
    """Dependency injecting LangGraph-based controlled agent orchestrator."""
    global _langgraph_orchestrator
    if _langgraph_orchestrator is None:
        _langgraph_orchestrator = LangGraphAgentOrchestrator(
            llm_client=llm_client,
            tool_registry=tool_registry,
            audit_logger=audit_logger,
            max_allowed_steps=10,
        )
    return _langgraph_orchestrator


@router.get("/tools", response_model=List[ToolDefinition])
async def list_agent_tools(
    tool_registry: ControlledToolRegistry = Depends(get_controlled_tool_registry),
) -> List[ToolDefinition]:
    """List explicitly authorized tools for the controlled inspection agent."""
    return tool_registry.list_tools()


@router.post("/run", response_model=AgentResult)
async def run_agent(
    request: AgentRunRequest,
    default_agent: BaseAgent = Depends(get_agent),
    langgraph_orchestrator: LangGraphAgentOrchestrator = Depends(get_langgraph_orchestrator),
) -> AgentResult:
    """Execute a controlled agent reasoning loop with explicitly registered inspection tools."""
    session_id = request.session_id or str(uuid.uuid4())

    # Dispatch to LangGraph if explicitly requested or globally enabled
    use_langgraph = (
        request.orchestrator == "langgraph"
        or settings.ENABLE_LANGGRAPH
    )

    chosen_agent: BaseAgent = langgraph_orchestrator if use_langgraph else default_agent

    result = await chosen_agent.run(
        prompt=request.prompt,
        session_id=session_id,
        max_steps=request.max_steps,
        model=request.model,
    )
    return result


@router.get("/{mission_id}", response_model=Dict[str, Any])
async def get_mission_status(
    mission_id: str,
    orchestrator: LangGraphAgentOrchestrator = Depends(get_langgraph_orchestrator),
) -> Dict[str, Any]:
    """Retrieve fine-grained graph execution state and provenance for a mission."""
    state = orchestrator.get_mission_state(mission_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Mission '\''{mission_id}'\'' not found.")
    return {
        "mission_id": state.get("mission_id"),
        "task": state.get("task"),
        "current_step": state.get("current_step"),
        "max_steps": state.get("max_steps"),
        "current_node": state.get("current_node"),
        "verification_status": state.get("verification_status"),
        "approval_required": state.get("approval_required"),
        "approval_status": state.get("approval_status"),
        "cancelled": state.get("cancelled", False),
        "evidence_count": len(state.get("evidence", [])),
        "citations_count": len(state.get("citations", [])),
        "errors": state.get("errors", []),
        "final_output": state.get("final_output"),
    }


@router.post("/{mission_id}/approve")
async def approve_mission(
    mission_id: str,
    request: MissionApprovalRequest,
    orchestrator: LangGraphAgentOrchestrator = Depends(get_langgraph_orchestrator),
) -> Dict[str, Any]:
    """Record human sign-off or disposition on a pending mission."""
    success = orchestrator.approve_mission(
        mission_id=mission_id,
        status=request.status,
        notes=request.notes,
    )
    if not success:
        raise HTTPException(status_code=404, detail=f"Mission '\''{mission_id}'\'' not found or already completed.")
    return {
        "mission_id": mission_id,
        "approval_status": request.status,
        "notes": request.notes,
        "status": "success",
    }


@router.post("/{mission_id}/cancel")
async def cancel_mission(
    mission_id: str,
    orchestrator: LangGraphAgentOrchestrator = Depends(get_langgraph_orchestrator),
) -> Dict[str, Any]:
    """Cancel an active mission safely at the current step boundary."""
    cancelled = orchestrator.cancel_mission(mission_id)
    return {
        "mission_id": mission_id,
        "cancelled": cancelled,
        "status": "cancelled" if cancelled else "not_found",
    }
