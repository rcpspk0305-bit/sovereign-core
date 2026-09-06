"""Model discovery and inspection router."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.core.interfaces.llm import LLMConnectionError, LLMError, ModelInfo
from app.core.llm.service import LLMService, get_llm_service

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=List[ModelInfo])
async def list_available_models(
    llm_service: LLMService = Depends(get_llm_service),
) -> List[ModelInfo]:
    """Retrieve all models installed in local provider daemon with offline fallback."""
    try:
        return await llm_service.list_models()
    except (LLMConnectionError, LLMError):
        # Local daemon is offline / not installed; provide fallback default model
        return [
            ModelInfo(
                id=settings.DEFAULT_MODEL,
                name=f"{settings.DEFAULT_MODEL} (Local Default)",
            )
        ]
    except Exception:
        return [
            ModelInfo(
                id=settings.DEFAULT_MODEL,
                name=f"{settings.DEFAULT_MODEL} (Local Default)",
            )
        ]

