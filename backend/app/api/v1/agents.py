"""Agent orchestration router."""

import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.v1.chat import get_audit_logger
from app.api.v1.tools import get_tool_registry
from app.core.agents.orchestrator import SimpleOrchestratorAgent
from app.core.interfaces.agents import AgentResult, BaseAgent
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.tools import BaseToolRegistry
from app.core.llm.service import get_llm_provider

router = APIRouter(prefix="/agents", tags=["Agents"])


class AgentRunRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    max_steps: int = Field(default=5, ge=1, le=20)
    model: Optional[str] = None


def get_agent(
    llm_client: BaseLLMClient = Depends(get_llm_provider),
    tool_registry: BaseToolRegistry = Depends(get_tool_registry),
) -> BaseAgent:
    return SimpleOrchestratorAgent(
        llm_client=llm_client,
        tool_registry=tool_registry,
    )


@router.post("/run", response_model=AgentResult)
async def run_agent(
    request: AgentRunRequest,
    agent: BaseAgent = Depends(get_agent),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> AgentResult:
    """Execute an agent reasoning loop with tool access."""
    session_id = request.session_id or str(uuid.uuid4())
    result = await agent.run(
        prompt=request.prompt,
        session_id=session_id,
        max_steps=request.max_steps,
        model=request.model,
    )

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.AGENT_RUN,
            session_id=session_id,
            prompt_preview=request.prompt[:120],
            response_preview=result.final_response[:120],
            latency_ms=result.total_latency_ms,
            status="success" if result.success else "failed",
            error=result.error,
            payload={"steps_count": len(result.steps)},
        )
    )

    return result
