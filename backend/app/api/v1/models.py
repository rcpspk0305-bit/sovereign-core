"""Model discovery and inspection router."""

from typing import List

from fastapi import APIRouter, Depends

from app.config import settings
from app.core.interfaces.llm import LLMConnectionError, LLMError, ModelInfo
from app.core.llm.service import LLMService, get_llm_service

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=List[ModelInfo])
async def list_available_models(
    llm_service: LLMService = Depends(get_llm_service),
) -> List[ModelInfo]:
    """Retrieve all models installed in local provider daemon plus remote catalog with sovereignty status."""
    is_local_only = getattr(settings, "LOCAL_ONLY", True)
    openai_status = "DISABLED" if is_local_only else ("READY" if getattr(settings, "OPENAI_API_KEY", None) else "UNCONFIGURED")
    anthropic_status = "DISABLED" if is_local_only else ("READY" if getattr(settings, "ANTHROPIC_API_KEY", None) else "UNCONFIGURED")

    remote_catalog = [
        ModelInfo(
            id="openai/gpt-4o",
            name="GPT-4o (Omni Architecture)",
            provider="openai",
            is_local=False,
            status=openai_status,
            capabilities=["chat", "streaming", "vision"],
            context_window=128000,
        ),
        ModelInfo(
            id="anthropic/claude-3-5-sonnet",
            name="Claude 3.5 Sonnet",
            provider="anthropic",
            is_local=False,
            status=anthropic_status,
            capabilities=["chat", "streaming", "analysis"],
            context_window=200000,
        ),
    ]

    try:
        models = await llm_service.list_models()
        # Merge remote catalog if not already present
        existing_ids = {m.id for m in models}
        for r_model in remote_catalog:
            if r_model.id not in existing_ids:
                models.append(r_model)
        return models
    except (LLMConnectionError, LLMError, Exception):
        # Local daemon is offline / fallback default model
        fallback_local = ModelInfo(
            id=settings.DEFAULT_MODEL,
            name=f"{settings.DEFAULT_MODEL} (Local Default)",
            provider=getattr(llm_service.provider, "name", "ollama"),
            is_local=True,
            status="READY",
            capabilities=["chat", "streaming", "embeddings"],
            context_window=8192,
        )
        return [fallback_local] + remote_catalog

