"""Unit tests for third-party integration adapters, security boundaries, and air-gap enforcement."""

import pytest
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.rag import BaseRetriever
from app.core.interfaces.telemetry import BaseTelemetrySink
from app.core.interfaces.workflows import BaseWorkflowEngine
from app.integrations.base import (
    BaseIntegrationAdapter,
    IntegrationDisabledError,
    SecurityPolicyViolationError,
    validate_local_endpoint,
)
from app.integrations.dify import DifyWorkflowAdapter
from app.integrations.langgraph import LangGraphWorkflowAdapter
from app.integrations.litellm import LiteLLMClientAdapter
from app.integrations.opentelemetry import OpenTelemetrySinkAdapter
from app.integrations.qdrant import QdrantRetrieverAdapter


def test_airgap_security_policy_enforcement():
    # Permitted local endpoints
    assert validate_local_endpoint("localhost") is True
    assert validate_local_endpoint("127.0.0.1:11434") is True
    assert validate_local_endpoint("http://host.docker.internal:6333") is True
    assert validate_local_endpoint("http://192.168.1.50:8000") is True

    # Forbidden external endpoints (violates NO_EGRESS)
    with pytest.raises(SecurityPolicyViolationError):
        validate_local_endpoint("https://api.openai.com/v1")

    with pytest.raises(SecurityPolicyViolationError):
        validate_local_endpoint("https://api.anthropic.com")

    with pytest.raises(SecurityPolicyViolationError):
        validate_local_endpoint("8.8.8.8:53")


def test_litellm_adapter_boundary():
    adapter = LiteLLMClientAdapter()
    assert isinstance(adapter, BaseLLMClient)
    assert isinstance(adapter, BaseIntegrationAdapter)
    assert adapter.name == "litellm"
    assert adapter.is_enabled() is False

    # Attempting to initialize with external endpoint must fail immediately
    with pytest.raises(SecurityPolicyViolationError):
        LiteLLMClientAdapter(api_base="https://cloud.litellm.ai")


def test_qdrant_adapter_boundary():
    adapter = QdrantRetrieverAdapter()
    assert isinstance(adapter, BaseRetriever)
    assert isinstance(adapter, BaseIntegrationAdapter)
    assert adapter.name == "qdrant"
    assert adapter.is_enabled() is False

    with pytest.raises(SecurityPolicyViolationError):
        QdrantRetrieverAdapter(host="qdrant.cloud.io")


def test_opentelemetry_adapter_boundary():
    adapter = OpenTelemetrySinkAdapter()
    assert isinstance(adapter, BaseTelemetrySink)
    assert isinstance(adapter, BaseIntegrationAdapter)
    assert adapter.name == "opentelemetry"
    assert adapter.is_enabled() is False

    with pytest.raises(SecurityPolicyViolationError):
        OpenTelemetrySinkAdapter(endpoint="https://api.honeycomb.io")


def test_langgraph_adapter_boundary():
    adapter = LangGraphWorkflowAdapter()
    assert isinstance(adapter, BaseWorkflowEngine)
    assert isinstance(adapter, BaseIntegrationAdapter)
    assert adapter.name == "langgraph"
    assert adapter.is_enabled() is False


def test_dify_adapter_boundary():
    adapter = DifyWorkflowAdapter()
    assert isinstance(adapter, BaseWorkflowEngine)
    assert isinstance(adapter, BaseIntegrationAdapter)
    assert adapter.name == "dify"
    assert adapter.is_enabled() is False

    with pytest.raises(SecurityPolicyViolationError):
        DifyWorkflowAdapter(api_base="https://api.dify.ai/v1")


@pytest.mark.asyncio
async def test_disabled_adapters_block_execution():
    litellm_adapter = LiteLLMClientAdapter()
    with pytest.raises(IntegrationDisabledError):
        await litellm_adapter.complete([])

    qdrant_adapter = QdrantRetrieverAdapter()
    with pytest.raises(IntegrationDisabledError):
        await qdrant_adapter.add_documents([])

    otel_adapter = OpenTelemetrySinkAdapter()
    from app.core.interfaces.telemetry import TelemetryEvent
    with pytest.raises(IntegrationDisabledError):
        await otel_adapter.emit_event(
            TelemetryEvent(event_id="e", timestamp="t", name="n")
        )
