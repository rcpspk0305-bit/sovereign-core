"""Vector Store factory and service abstraction providing unified access to Chroma and Qdrant."""

import logging
from typing import Optional

from app.config import settings
from app.core.interfaces.rag import BaseRetriever
from app.core.rag.chroma import ChromaStore
from app.integrations.qdrant.adapter import QdrantStore

logger = logging.getLogger("sovereign.rag.service")

_active_store: Optional[BaseRetriever] = None


def get_vector_store(backend: Optional[str] = None, force_new: bool = False) -> BaseRetriever:
    """Return the configured vector store backend instance (Chroma or Qdrant).
    
    The RAG layer consumes this unified interface without knowing which backend is active.
    """
    global _active_store
    if _active_store is not None and not force_new and backend is None:
        return _active_store

    selected_backend = (backend or getattr(settings, "VECTOR_BACKEND", "chroma")).lower().strip()

    if selected_backend == "qdrant" or (backend is None and getattr(settings, "ENABLE_QDRANT", False) and selected_backend != "chroma"):
        logger.info("Initializing Qdrant vector store backend at '%s'", settings.QDRANT_URL)
        store = QdrantStore()
    else:
        logger.info("Initializing ChromaDB vector store backend at '%s'", settings.CHROMA_PERSIST_DIR)
        store = ChromaStore()

    if not force_new and backend is None:
        _active_store = store

    return store


def set_active_vector_store(store: Optional[BaseRetriever]) -> None:
    """Explicitly set or reset the active singleton vector store (used for tests and migration)."""
    global _active_store
    _active_store = store
