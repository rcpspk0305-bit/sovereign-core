"""Chat completion endpoints supporting standard and streaming responses."""

import datetime
import json
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient, ChatMessage, LLMResponse
from app.core.audit.logger import FileAndMemoryAuditLogger
from app.core.llm.ollama import OllamaClient

router = APIRouter(prefix="/chat", tags=["Chat"])

# Shared singleton dependencies
_shared_audit_logger = FileAndMemoryAuditLogger()
_shared_llm_client = OllamaClient()


def get_llm_client() -> BaseLLMClient:
    return _shared_llm_client


def get_audit_logger() -> BaseAuditLogger:
    return _shared_audit_logger


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = None
    stream: bool = False
    session_id: Optional[str] = None


@router.post("", response_model=Optional[LLMResponse])
async def create_chat_completion(
    request: ChatRequest,
    llm_client: BaseLLMClient = Depends(get_llm_client),
    audit_logger: BaseAuditLogger = Depends(get_audit_logger),
):
    """Execute non-streaming or SSE streaming chat completion."""
    session_id = request.session_id or str(uuid.uuid4())
    start_time = time.perf_counter()

    prompt_preview = request.messages[-1].content if request.messages else ""
    req_event_id = str(uuid.uuid4())

    await audit_logger.log(
        AuditEvent(
            id=req_event_id,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            event_type=AuditEventType.LLM_REQUEST,
            session_id=session_id,
            model=request.model,
            prompt_preview=prompt_preview[:120],
            payload={"messages_count": len(request.messages), "temperature": request.temperature},
        )
    )

    if request.stream:
        async def event_generator():
            full_response = []
            try:
                async for chunk in llm_client.stream(
                    messages=request.messages,
                    model=request.model,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                ):
                    full_response.append(chunk.content)
                    data = chunk.model_dump_json()
                    yield f"data: {data}\n\n"

                elapsed = (time.perf_counter() - start_time) * 1000.0
                await audit_logger.log(
                    AuditEvent(
                        id=str(uuid.uuid4()),
                        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        event_type=AuditEventType.LLM_RESPONSE,
                        session_id=session_id,
                        model=request.model,
                        response_preview="".join(full_response)[:120],
                        latency_ms=round(elapsed, 2),
                        status="success",
                    )
                )
            except Exception as e:
                err_msg = str(e)
                yield f"data: {json.dumps({'error': err_msg})}\n\n"
                await audit_logger.log(
                    AuditEvent(
                        id=str(uuid.uuid4()),
                        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        event_type=AuditEventType.LLM_ERROR,
                        session_id=session_id,
                        model=request.model,
                        error=err_msg,
                        status="failed",
                    )
                )

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    try:
        response = await llm_client.complete(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        elapsed = (time.perf_counter() - start_time) * 1000.0
        token_dict = None
        if response.usage:
            token_dict = {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens,
                "total": response.usage.total_tokens,
            }

        await audit_logger.log(
            AuditEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                event_type=AuditEventType.LLM_RESPONSE,
                session_id=session_id,
                model=response.model,
                response_preview=response.content[:120],
                tokens=token_dict,
                latency_ms=round(elapsed, 2),
                status="success",
            )
        )
        return response
    except Exception as exc:
        await audit_logger.log(
            AuditEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                event_type=AuditEventType.LLM_ERROR,
                session_id=session_id,
                model=request.model,
                error=str(exc),
                status="failed",
            )
        )
        raise HTTPException(status_code=502, detail=f"LLM Provider Error: {str(exc)}")
