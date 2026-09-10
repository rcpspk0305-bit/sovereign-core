"""Comprehensive test suite for LiteLLM provider integration, sovereignty enforcement,
streaming normalization, safe fallback, and telemetry instrumentation.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import Response

from app.config import settings
from app.core.interfaces.llm import (
    ChatMessage,
    ChatRole,
    LLMConnectionError,
    LLMModelNotFoundError,
    LLMResponse,
    LLMSecurityError,
    LLMUsage,
    LLMValidationError,
    ModelInfo,
    StreamChunk,
)
from app.core.llm.adapters import OllamaAdapter, create_llm_provider
from app.core.llm.ollama import OllamaClient
from app.core.llm.security import (
    is_remote_model_or_provider,
    validate_llm_request_security,
)
from app.core.llm.service import LLMService, get_llm_provider
from app.integrations.litellm.adapter import LiteLLMClientAdapter


# Helper class for mocking LiteLLM response objects
class MockLiteLLMChoice:
    def __init__(self, content: str, finish_reason: str = "stop"):
        self.message = MagicMock()
        self.message.content = content
        self.delta = MagicMock()
        self.delta.content = content
        self.finish_reason = finish_reason


class MockLiteLLMResponse:
    def __init__(self, content: str = "Test response", prompt_tokens: int = 15, completion_tokens: int = 25):
        self.choices = [MockLiteLLMChoice(content=content)]
        self.usage = MagicMock()
        self.usage.prompt_tokens = prompt_tokens
        self.usage.completion_tokens = completion_tokens
        self.usage.total_tokens = prompt_tokens + completion_tokens


# --------------------------------------------------------------------------
# 1. Test Ollama Provider Direct
# --------------------------------------------------------------------------
def test_ollama_provider_direct():
    """Verify OllamaClient and OllamaAdapter initialize properly and retain 'ollama' identity."""
    client = OllamaClient(default_model="gemma4:e2b")
    assert client.name == "ollama"
    assert client.default_model == "gemma4:e2b"

    adapter = OllamaAdapter(default_model="gemma4:e2b")
    assert adapter.name == "ollama"
    assert isinstance(adapter, OllamaClient)


# --------------------------------------------------------------------------
# 2. Test LiteLLM Adapter Complete (Mocked)
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_litellm_adapter_complete():
    """Verify LiteLLMClientAdapter.complete formats messages and normalizes response."""
    adapter = LiteLLMClientAdapter(default_model="ollama/gemma4:e2b", enabled=True)
    assert adapter.name == "litellm"

    mock_resp = MockLiteLLMResponse("Synthesized sovereign response", prompt_tokens=10, completion_tokens=20)

    with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acompletion:
        mock_acompletion.return_value = mock_resp

        messages = [ChatMessage(role=ChatRole.USER, content="Hello local AI")]
        res = await adapter.complete(messages=messages, model="ollama/gemma4:e2b")

        assert isinstance(res, LLMResponse)
        assert res.content == "Synthesized sovereign response"
        assert res.model == "ollama/gemma4:e2b"
        assert res.usage.total_tokens == 30
        assert res.latency_ms is not None

        mock_acompletion.assert_called_once()
        call_kwargs = mock_acompletion.call_args[1]
        assert call_kwargs["model"] == "ollama/gemma4:e2b"
        assert call_kwargs["messages"] == [{"role": "user", "content": "Hello local AI"}]


# --------------------------------------------------------------------------
# 3. Test LiteLLM Streaming Normalization
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_litellm_streaming_normalization():
    """Verify LiteLLMClientAdapter.stream yields normalized StreamChunks."""
    adapter = LiteLLMClientAdapter(default_model="ollama/gemma4:e2b", enabled=True)

    async def mock_stream_gen(*args, **kwargs):
        chunk1 = MagicMock()
        chunk1.choices = [MockLiteLLMChoice("Sovereign", finish_reason=None)]
        yield chunk1

        chunk2 = MagicMock()
        chunk2.choices = [MockLiteLLMChoice(" Core", finish_reason="stop")]
        yield chunk2

    with patch("litellm.acompletion", side_effect=mock_stream_gen):
        messages = [ChatMessage(role=ChatRole.USER, content="Stream test")]
        chunks = []
        async for chunk in adapter.stream(messages=messages, model="ollama/gemma4:e2b"):
            chunks.append(chunk)

        assert len(chunks) == 2
        assert chunks[0].content == "Sovereign"
        assert chunks[0].done is False
        assert chunks[1].content == " Core"
        assert chunks[1].done is True


# --------------------------------------------------------------------------
# 4. Test Provider Selection & Factory
# --------------------------------------------------------------------------
def test_provider_selection_factory():
    """Verify create_llm_provider correctly builds adapters based on configuration."""
    ollama_prov = create_llm_provider("ollama")
    assert isinstance(ollama_prov, OllamaAdapter)
    assert ollama_prov.name == "ollama"

    litellm_prov = create_llm_provider("litellm")
    assert isinstance(litellm_prov, LiteLLMClientAdapter)
    assert litellm_prov.name == "litellm"

    # Verify fallback to settings.LLM_PROVIDER
    with patch.object(settings, "LLM_PROVIDER", "ollama"):
        prov = get_llm_provider()
        assert prov.name == "ollama"


# --------------------------------------------------------------------------
# 5. Test Local-Only Enforcement
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_local_only_enforcement():
    """Verify that when LOCAL_ONLY=True, remote models/endpoints are blocked."""
    adapter = LiteLLMClientAdapter(default_model="ollama/gemma4:e2b", enabled=True)
    messages = [ChatMessage(role=ChatRole.USER, content="Check cloud egress")]

    with patch.object(settings, "LOCAL_ONLY", True):
        # Attempting OpenAI invocation
        with pytest.raises(LLMSecurityError) as exc_info:
            await adapter.complete(messages=messages, model="openai/gpt-4o")
        assert "Sovereignty Policy Violation" in str(exc_info.value)

        # Attempting Anthropic invocation
        with pytest.raises(LLMSecurityError) as exc_info:
            await adapter.complete(messages=messages, model="claude-3-5-sonnet")
        assert "Sovereignty Policy Violation" in str(exc_info.value)


# --------------------------------------------------------------------------
# 6. Test Cloud Provider Rejection at Security Gate
# --------------------------------------------------------------------------
def test_cloud_provider_rejection_security_gate():
    """Verify security validator directly detects and rejects remote targets."""
    assert is_remote_model_or_provider("openai/gpt-4o") is True
    assert is_remote_model_or_provider("gpt-4o") is True
    assert is_remote_model_or_provider("claude-3-5-sonnet") is True
    assert is_remote_model_or_provider("gemma4:e2b") is False
    assert is_remote_model_or_provider("ollama/gemma4:e2b") is False

    with patch.object(settings, "LOCAL_ONLY", True):
        with pytest.raises(LLMSecurityError):
            validate_llm_request_security(model="gpt-4o")

        with pytest.raises(LLMSecurityError):
            validate_llm_request_security(provider="anthropic")

        with pytest.raises(LLMSecurityError):
            validate_llm_request_security(api_base="https://api.openai.com/v1")


# --------------------------------------------------------------------------
# 7. Test Safe Local Fallback
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_safe_local_fallback():
    """Verify LLMService automatically falls back ONLY to verified local model."""
    mock_provider = MagicMock()
    mock_provider.name = "mock_provider"

    # Target model fails with connection error, but default local model succeeds
    async def mock_complete(messages, model, **kwargs):
        if model == "failing-model":
            raise LLMConnectionError("Model offline", model=model)
        return LLMResponse(content="Recovered via local fallback", model=settings.DEFAULT_MODEL)

    mock_provider.complete = AsyncMock(side_effect=mock_complete)

    service = LLMService(provider=mock_provider)
    messages = [ChatMessage(role=ChatRole.USER, content="Ping")]

    res = await service.complete(messages=messages, model="failing-model")
    assert res.content == "Recovered via local fallback"
    assert res.model == settings.DEFAULT_MODEL


# --------------------------------------------------------------------------
# 8. Test Model Discovery Catalog
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_model_discovery_local_and_remote():
    """Verify list_models exposes both local models and remote air-gap catalog."""
    adapter = LiteLLMClientAdapter(default_model="ollama/gemma4:e2b", enabled=True)

    with patch.object(settings, "LOCAL_ONLY", True):
        models = await adapter.list_models()
        assert len(models) >= 3

        local_model = next(m for m in models if m.is_local)
        assert local_model.provider == "litellm"
        assert local_model.status == "READY"

        remote_model = next(m for m in models if not m.is_local)
        assert remote_model.status == "DISABLED"


# --------------------------------------------------------------------------
# 9. Test Malformed Provider Configuration
# --------------------------------------------------------------------------
def test_malformed_provider_configuration():
    """Verify invalid provider name triggers LLMValidationError."""
    with pytest.raises(LLMValidationError) as exc:
        create_llm_provider("unsupported_cloud_runtime_xyz")
    assert "Unsupported LLM provider" in str(exc.value)


# --------------------------------------------------------------------------
# 10. Test API-Key Absence Handling
# --------------------------------------------------------------------------
def test_api_key_absence_when_remote_enabled():
    """Verify that when LOCAL_ONLY=False, attempting cloud calls without API key raises validation error."""
    with patch.object(settings, "LOCAL_ONLY", False):
        with patch.object(settings, "OPENAI_API_KEY", None):
            with patch.dict("os.environ", {}, clear=True):
                with pytest.raises(LLMValidationError) as exc:
                    validate_llm_request_security(model="openai/gpt-4o")
                assert "OpenAI API key is missing" in str(exc.value)


# --------------------------------------------------------------------------
# 11. Test Telemetry Integration
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_telemetry_integration():
    """Verify LLMService instruments OpenTelemetry span attributes and metrics."""
    mock_provider = MagicMock()
    mock_provider.name = "litellm"
    mock_provider.complete = AsyncMock(
        return_value=LLMResponse(
            content="Telemetry test output",
            model="gemma4:e2b",
            usage=LLMUsage(prompt_tokens=15, completion_tokens=25, total_tokens=40),
        )
    )

    service = LLMService(provider=mock_provider)
    messages = [ChatMessage(role=ChatRole.USER, content="Measure telemetry")]

    with patch("app.core.llm.service.record_llm_request") as mock_record:
        res = await service.complete(messages=messages, model="gemma4:e2b")
        assert res.content == "Telemetry test output"
        mock_record.assert_called_once()
        call_kwargs = mock_record.call_args[1]
        assert call_kwargs["model"] == "gemma4:e2b"
        assert call_kwargs["success"] is True
