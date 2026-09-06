"""Model discovery and inspection router."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.interfaces.llm import LLMError, ModelInfo
from app.core.llm.service import LLMService, get_llm_service

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=List[ModelInfo])
async def list_available_models(
    llm_service: LLMService = Depends(get_llm_service),
) -> List[ModelInfo]:
    """Retrieve all models installed in local provider daemon."""
    try:
        return await llm_service.list_models()
    except LLMError as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to communicate with LLM provider: {str(exc)}",
        )
