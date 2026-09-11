"""Open-source AI infrastructure integration adapters."""

from app.integrations.base import (
    BaseIntegrationAdapter,
    IntegrationDisabledError,
    IntegrationUnavailableError,
    SecurityPolicyViolationError,
    validate_local_endpoint,
)
from app.integrations.dify import DifyWorkflowAdapter
from app.integrations.litellm import LiteLLMClientAdapter
from app.integrations.opentelemetry import OpenTelemetrySinkAdapter
from app.integrations.qdrant import QdrantRetrieverAdapter

try:
    from app.integrations.langgraph import LangGraphWorkflowAdapter
except ModuleNotFoundError as exc:  # pragma: no cover - depends on optional integration extra
    if exc.name != "langgraph":
        raise
    LangGraphWorkflowAdapter = None  # type: ignore[assignment,misc]

__all__ = [
    "BaseIntegrationAdapter",
    "SecurityPolicyViolationError",
    "IntegrationUnavailableError",
    "IntegrationDisabledError",
    "validate_local_endpoint",
    "LiteLLMClientAdapter",
    "QdrantRetrieverAdapter",
    "OpenTelemetrySinkAdapter",
    "LangGraphWorkflowAdapter",
    "DifyWorkflowAdapter",
]
