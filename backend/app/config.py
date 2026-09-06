"""Application configuration settings using Pydantic Settings."""

from pathlib import Path
from typing import List, Union

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

    # Ollama settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "gemma4:e2b"
    DEFAULT_EMBEDDING_MODEL: str = "nomic-embed-text:latest"
    LLM_TIMEOUT_SECONDS: float = 120.0

    # Audit settings
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_DIR: Path = _BACKEND_DIR / "data" / "audit"
    AUDIT_LOG_FILE: str = "audit.jsonl"

    # RAG & Chroma settings
    CHROMA_PERSIST_DIR: Path = _BACKEND_DIR / "data" / "chroma"
    CHROMA_COLLECTION_NAME: str = "sovereign_knowledge"
    RAG_CHUNK_SIZE: int = 500
    RAG_CHUNK_OVERLAP: int = 50

    # Artifact & flight-record storage
    ARTIFACTS_DIR: Path = _BACKEND_DIR / "data" / "artifacts"
    FLIGHT_RECORDS_DIR: Path = _BACKEND_DIR / "data" / "flight_records"

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
