"""Agent orchestration router with controlled Inspection-Analysis Agent."""

import datetime
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.v1.chat import get_audit_logger
from app.api.v1.rag import get_retriever
from app.core.agents.inspection_agent import InspectionAnalysisAgent
from app.core.interfaces.agents import AgentResult, BaseAgent
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.rag import BaseRetriever
from app.core.interfaces.tools import ToolDefinition
from app.core.llm.service import get_llm_provider
from app.core.tools.document_generation import DocumentGenerationTool
from app.core.tools.document_retrieval import DocumentRetrievalTool
from app.core.tools.registry import CalculatorTool, ControlledToolRegistry

router = APIRouter(prefix="/agents", tags=["Agents"])


class AgentRunRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    max_steps: int = Field(default=5, ge=1, le=10)
    model: Optional[str] = None
    agent_type: str = Field(default="inspection_analysis")


def get_controlled_tool_registry(
    retriever: BaseRetriever = Depends(get_retriever),
) -> ControlledToolRegistry:
    """Create a strictly controlled tool registry with only permitted inspection tools."""
    registry = ControlledToolRegistry()
    registry.register(DocumentRetrievalTool(retriever=retriever))
    registry.register(CalculatorTool())
    registry.register(DocumentGenerationTool())
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


@router.get("/tools", response_model=List[ToolDefinition])
async def list_agent_tools(
    tool_registry: ControlledToolRegistry = Depends(get_controlled_tool_registry),
) -> List[ToolDefinition]:
    """List explicitly authorized tools for the controlled inspection agent."""
    return tool_registry.list_tools()


@router.post("/run", response_model=AgentResult)
async def run_agent(
    request: AgentRunRequest,
    agent: BaseAgent = Depends(get_agent),
) -> AgentResult:
    """Execute a controlled agent reasoning loop with explicitly registered inspection tools."""
    session_id = request.session_id or str(uuid.uuid4())
    result = await agent.run(
        prompt=request.prompt,
        session_id=session_id,
        max_steps=request.max_steps,
        model=request.model,
    )
    return result
