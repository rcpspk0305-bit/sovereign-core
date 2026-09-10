"""Application configuration settings using Pydantic Settings."""

from pathlib import Path
from typing import List, Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to the backend/ directory — works regardless of CWD.
_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Central configuration parameters for Sovereign-Core backend."""

    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Server binding (0.0.0.0 enables Docker container port mapping; set to 127.0.0.1 for local-only workstation isolation)
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    ALLOWED_ORIGINS: Union[str, List[str]] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # Ollama & LLM settings
    LLM_PROVIDER: str = "ollama"  # "ollama" or "litellm"
    LOCAL_ONLY: bool = True       # Enforce strict zero-egress local boundary (rejects remote cloud providers)
    LLM_MODEL: str = "gemma4:e2b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "gemma4:e2b"
    DEFAULT_EMBEDDING_MODEL: str = "nomic-embed-text:latest"
    LLM_TIMEOUT_SECONDS: float = 120.0

    # Optional Remote Cloud Provider Keys (never hardcoded, read from environment)
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Audit settings
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_DIR: Path = _BACKEND_DIR / "data" / "audit"
    AUDIT_LOG_FILE: str = "audit.jsonl"

    # RAG & Vector Store settings
    VECTOR_BACKEND: str = "chroma"  # "chroma" (default local) or "qdrant"
    STORE_RAG_QUERY_TEXT: bool = False
    CHROMA_PERSIST_DIR: Path = _BACKEND_DIR / "data" / "chroma"
    CHROMA_COLLECTION_NAME: str = "sovereign_knowledge"
    RAG_CHUNK_SIZE: int = 500
    RAG_CHUNK_OVERLAP: int = 50

    # Artifact & flight-record storage
    ARTIFACTS_DIR: Path = _BACKEND_DIR / "data" / "artifacts"
    FLIGHT_RECORDS_DIR: Path = _BACKEND_DIR / "data" / "flight_records"

    # Open-Source Integration Flags (all disabled by default, air-gapped local endpoints)
    ENABLE_LITELLM: bool = False
    LITELLM_API_BASE: str = "http://localhost:11434"
    LITELLM_DEFAULT_MODEL: str = "ollama/gemma4:e2b"

    ENABLE_QDRANT: bool = False
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "sovereign_documents"
    QDRANT_COLLECTION_NAME: str = "sovereign_documents"

    # OpenTelemetry Tracing & Metrics (local-first, air-gapped)
    ENABLE_OPENTELEMETRY: bool = False
    OTEL_ENABLED: bool = False
    OTEL_EXPORTER: str = "console"  # "console", "in_memory", "otlp", "none"
    OTEL_ENDPOINT: Optional[str] = None
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "sovereign-core"
    OTEL_REDACTION_ENABLED: bool = True

    ENABLE_LANGGRAPH: bool = False

    ENABLE_DIFY: bool = False
    DIFY_API_BASE: str = "http://localhost/v1"
    DIFY_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v  # type: ignore
        raise ValueError(v)


settings = Settings()
