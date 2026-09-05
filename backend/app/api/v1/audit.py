"""Audit log query router."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.api.v1.chat import get_audit_logger
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=List[AuditEvent])
async def query_audit_logs(
    limit: int = Query(default=50, ge=1, le=500),
    event_type: Optional[AuditEventType] = Query(default=None),
    session_id: Optional[str] = Query(default=None),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
) -> List[AuditEvent]:
    """Retrieve filtered recent audit log records."""
    return await audit_logger.query(
        limit=limit,
        event_type=event_type,
        session_id=session_id,
    )
