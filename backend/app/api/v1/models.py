"""Model discovery and inspection router."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.chat import get_llm_client
from app.core.interfaces.llm import BaseLLMClient, ModelInfo

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=List[ModelInfo])
async def list_available_models(
    llm_client: BaseLLMClient = Depends(get_llm_client),
) -> List[ModelInfo]:
    """Retrieve all models installed in local Ollama daemon."""
    try:
        return await llm_client.list_models()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to communicate with Ollama: {str(exc)}",
        )
