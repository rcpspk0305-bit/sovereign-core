"""Embedding providers for vector retrieval."""

import logging
from typing import List, Optional

from app.config import settings
from app.core.interfaces.rag import BaseEmbeddingProvider
from app.core.llm.ollama import OllamaClient
from app.core.rag.in_memory import SimpleEmbeddingProvider

logger = logging.getLogger("sovereign.rag.embeddings")


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    """Local embedding provider communicating with local Ollama daemon."""

    def __init__(
        self,
        client: Optional[OllamaClient] = None,
        model: Optional[str] = None,
        fallback_dimension: int = 64,
    ) -> None:
        self.client = client or OllamaClient()
        self.model = model or settings.DEFAULT_EMBEDDING_MODEL
        self._fallback = SimpleEmbeddingProvider(dimension=fallback_dimension)

    async def embed_query(self, text: str) -> List[float]:
        """Generate embedding vector for a single query."""
        res = await self.embed_documents([text])
        return res[0] if res else self._fallback._embed_text(text)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts using Ollama with deterministic fallback."""
        if not texts:
            return []
        try:
            embeddings = await self.client.embed(texts=texts, model=self.model)
            if embeddings and len(embeddings) == len(texts):
                return embeddings
        except Exception as exc:
            logger.warning(
                "Ollama embeddings unavailable for model '%s' (%s). Using fallback provider.",
                self.model,
                exc,
            )
        return await self._fallback.embed_documents(texts)
