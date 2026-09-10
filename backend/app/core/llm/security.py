"""Security boundary and sovereignty enforcement for LLM providers and models."""

import logging
import os
from typing import Optional

from app.config import settings
from app.core.interfaces.llm import LLMSecurityError, LLMValidationError

logger = logging.getLogger("sovereign.llm.security")

# Known cloud/remote provider identifiers and model prefixes
REMOTE_PROVIDERS = {
    "openai",
    "anthropic",
    "cohere",
    "bedrock",
    "gemini",
    "azure",
    "groq",
    "deepseek",
    "mistral",
    "replicate",
    "together",
}

REMOTE_MODEL_PREFIXES = (
    "openai/",
    "anthropic/",
    "gpt-",
    "claude-",
    "text-embedding-",
    "o1",
    "o3",
    "gemini",
    "azure/",
    "bedrock/",
    "cohere/",
)


def is_remote_model_or_provider(model: Optional[str], provider: Optional[str] = None) -> bool:
    """Determine whether a given model string or provider identifier refers to a remote cloud service."""
    if provider and provider.lower() in REMOTE_PROVIDERS:
        return True

    if not model:
        return False

    clean_model = model.strip().lower()

    for prefix in REMOTE_MODEL_PREFIXES:
        if clean_model.startswith(prefix):
            return True

    # Check for slash notation e.g. "provider/model_name"
    if "/" in clean_model:
        prefix_part = clean_model.split("/")[0]
        if prefix_part in REMOTE_PROVIDERS:
            return True
        if prefix_part in ("ollama", "localhost", "local", "vllm"):
            return False

    return False


def validate_llm_request_security(
    model: Optional[str] = None,
    provider: Optional[str] = None,
    api_base: Optional[str] = None,
) -> None:
    """Enforce strict server-side sovereignty and air-gap boundaries.
    
    Raises:
        LLMSecurityError: If remote models/providers are invoked while LOCAL_ONLY is True.
        LLMValidationError: If required cloud credentials are missing when LOCAL_ONLY is False.
    """
    is_remote = is_remote_model_or_provider(model=model, provider=provider)

    # 1. Enforce LOCAL_ONLY air-gap policy
    if getattr(settings, "LOCAL_ONLY", True):
        if is_remote:
            msg = (
                f"Sovereignty Policy Violation: Remote provider/model '{provider or model}' "
                "is strictly prohibited when LOCAL_ONLY=true. Cloud egress blocked."
            )
            logger.warning(msg)
            raise LLMSecurityError(msg, provider=provider, model=model)

        # Validate local endpoint if api_base is supplied
        if api_base:
            try:
                from app.integrations.base import validate_local_endpoint
                validate_local_endpoint(api_base)
            except Exception as exc:
                msg = f"Sovereignty Policy Violation: Endpoint '{api_base}' violates local boundary: {exc}"
                logger.warning(msg)
                raise LLMSecurityError(msg, provider=provider, model=model) from exc

    # 2. If LOCAL_ONLY is False and a remote model is explicitly used, verify credentials exist
    elif is_remote:
        prov_name = (provider or (model.split("/")[0] if model and "/" in model else "")).lower()
        if "openai" in prov_name or (model and model.lower().startswith("gpt-")):
            key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
            if not key or not key.strip():
                raise LLMValidationError(
                    "OpenAI API key is missing. Set OPENAI_API_KEY environment variable.",
                    provider="openai",
                    model=model,
                )
        elif "anthropic" in prov_name or (model and model.lower().startswith("claude-")):
            key = getattr(settings, "ANTHROPIC_API_KEY", None) or os.environ.get("ANTHROPIC_API_KEY")
            if not key or not key.strip():
                raise LLMValidationError(
                    "Anthropic API key is missing. Set ANTHROPIC_API_KEY environment variable.",
                    provider="anthropic",
                    model=model,
                )
