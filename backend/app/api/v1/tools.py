"""Tool discovery and execution router."""

import datetime
import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v1.chat import get_audit_logger
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.tools import BaseToolRegistry, ToolDefinition, ToolResult
from app.core.tools.registry import ToolRegistry

router = APIRouter(prefix="/tools", tags=["Tools"])

_shared_tool_registry = ToolRegistry()


def get_tool_registry() -> BaseToolRegistry:
    return _shared_tool_registry


class ToolExecuteRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}
    session_id: str | None = None


@router.get("", response_model=List[ToolDefinition])
async def list_tools(
    registry: BaseToolRegistry = Depends(get_tool_registry),
) -> List[ToolDefinition]:
    """Retrieve schema definitions for all registered tools."""
    return registry.list_tools()


@router.post("/execute", response_model=ToolResult)
async def execute_tool(
    request: ToolExecuteRequest,
    registry: BaseToolRegistry = Depends(get_tool_registry),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> ToolResult:
    """Execute a registered tool with provided arguments."""
    result = await registry.execute_tool(request.name, request.arguments)

    await audit_logger.log(
        AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.TOOL_EXECUTION,
            session_id=request.session_id,
            latency_ms=result.execution_time_ms,
            status="success" if result.success else "failed",
            error=result.error,
            payload={
                "tool_name": request.name,
                "arguments": request.arguments,
            },
        )
    )

    if not result.success and not result.error:
        raise HTTPException(status_code=400, detail="Tool execution failed.")

    return result
