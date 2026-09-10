"""Provider adapter abstraction and factory for LLM providers."""

import logging
from typing import Optional

from app.config import settings
from app.core.interfaces.llm import BaseLLMClient, LLMValidationError
from app.core.llm.ollama import OllamaClient

logger = logging.getLogger("sovereign.llm.adapters")


class OllamaAdapter(OllamaClient):
    """Alias/Adapter pattern for the canonical Ollama provider."""
    pass


def create_llm_provider(provider_name: Optional[str] = None) -> BaseLLMClient:
    """Instantiate and return the configured active LLM provider adapter.
    
    Supports:
        - 'ollama': Local Ollama client (default)
        - 'litellm': Optional LiteLLM adapter for multi-provider routing
    """
    prov = (provider_name or getattr(settings, "LLM_PROVIDER", "ollama")).strip().lower()

    if prov == "ollama":
        return OllamaAdapter()

    if prov == "litellm":
        from app.integrations.litellm.adapter import LiteLLMClientAdapter
        return LiteLLMClientAdapter(enabled=True)

    raise LLMValidationError(
        f"Unsupported LLM provider: '{prov}'. Supported providers are: 'ollama', 'litellm'.",
        provider=prov,
    )
