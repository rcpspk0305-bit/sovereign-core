"""Qdrant Vector Database Adapter implementing BaseRetriever."""

import importlib.util
from typing import Any, Dict, List, Optional

from app.config import settings
from app.core.interfaces.rag import (
    BaseRetriever,
    Document,
    SearchResult,
)
from app.integrations.base import (
    BaseIntegrationAdapter,
    validate_local_endpoint,
)


class QdrantRetrieverAdapter(BaseRetriever, BaseIntegrationAdapter):
    """Adapter for Qdrant vector database, strictly bound to local instances."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        collection_name: Optional[str] = None,
    ) -> None:
        self.host = host or settings.QDRANT_HOST
        self.port = port or settings.QDRANT_PORT
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME
        validate_local_endpoint(f"{self.host}:{self.port}")
        self._client: Any = None

    @property
    def name(self) -> str:
        return "qdrant"

    def is_enabled(self) -> bool:
        return bool(settings.ENABLE_QDRANT)

    def is_available(self) -> bool:
        return importlib.util.find_spec("qdrant_client") is not None

    def _get_client(self) -> Any:
        self.check_ready()
        if self._client is None:
            from qdrant_client import QdrantClient  # type: ignore
            self._client = QdrantClient(host=self.host, port=self.port)
        return self._client

    async def add_documents(self, documents: List[Document]) -> List[str]:
        client = self._get_client()
        from qdrant_client.models import PointStruct  # type: ignore

        points = []
        doc_ids = []
        for doc in documents:
            if not doc.embedding:
                continue
            points.append(
                PointStruct(
                    id=doc.id,
                    vector=doc.embedding,
                    payload={"content": doc.content, **doc.metadata},
                )
            )
            doc_ids.append(doc.id)

        if points:
            client.upsert(collection_name=self.collection_name, points=points)
        return doc_ids

    async def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        # Qdrant vector search requires pre-embedded query vector or fastembed
        self.check_ready()
        return []

    async def delete(self, document_ids: List[str]) -> bool:
        client = self._get_client()
        from qdrant_client.models import PointIdsList  # type: ignore

        client.delete(
            collection_name=self.collection_name,
            points_selector=PointIdsList(points=document_ids),
        )
        return True

    async def count(self) -> int:
        client = self._get_client()
        info = client.get_collection(collection_name=self.collection_name)
        return getattr(info, "points_count", 0) or 0

    async def clear(self) -> bool:
        client = self._get_client()
        client.delete_collection(collection_name=self.collection_name)
        return True
