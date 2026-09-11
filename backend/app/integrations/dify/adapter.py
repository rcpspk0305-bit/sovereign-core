"""Dify Adapter implementing BaseWorkflowEngine for self-hosted local Dify instances."""

import time
import uuid
from typing import Any, Dict, Optional

import httpx

from app.config import settings
from app.core.interfaces.workflows import (
    BaseWorkflowEngine,
    WorkflowExecutionResult,
    WorkflowGraph,
)
from app.integrations.base import (
    BaseIntegrationAdapter,
    validate_local_endpoint,
)


class DifyWorkflowAdapter(BaseWorkflowEngine, BaseIntegrationAdapter):
    """Adapter executing workflows via local self-hosted Dify instances."""

    def __init__(
        self,
        api_base: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        self.api_base = api_base or settings.DIFY_API_BASE
        self.api_key = api_key or settings.DIFY_API_KEY
        validate_local_endpoint(self.api_base)

    @property
    def name(self) -> str:
        return "dify"

    def is_enabled(self) -> bool:
        return bool(settings.ENABLE_DIFY)

    def is_available(self) -> bool:
        # Uses httpx which is already a core dependency of Sovereign-Core
        return True

    def validate_graph(self, graph: WorkflowGraph) -> bool:
        self.check_ready()
        return bool(graph.id)

    async def execute(
        self,
        graph: WorkflowGraph,
        initial_input: Dict[str, Any],
        **kwargs: Any,
    ) -> WorkflowExecutionResult:
        self.check_ready()
        start_time = time.perf_counter()
        execution_id = f"dify_exec_{uuid.uuid4().hex[:12]}"

        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "inputs": initial_input,
            "response_mode": "blocking",
            "user": "sovereign-operator",
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.api_base.rstrip('/')}/workflows/run",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()

            total_latency = (time.perf_counter() - start_time) * 1000.0
            outputs = data.get("data", {}).get("outputs", {})

            return WorkflowExecutionResult(
                workflow_id=graph.id,
                execution_id=execution_id,
                success=True,
                final_output=outputs,
                total_latency_ms=total_latency,
            )
        except Exception as ex:
            total_latency = (time.perf_counter() - start_time) * 1000.0
            return WorkflowExecutionResult(
                workflow_id=graph.id,
                execution_id=execution_id,
                success=False,
                total_latency_ms=total_latency,
                error=f"Dify execution error: {ex}",
            )
