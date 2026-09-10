"""LangGraph Workflow Adapter implementing BaseWorkflowEngine."""

import importlib.util
import time
import uuid
from typing import Any, Dict

from app.config import settings
from app.core.interfaces.workflows import (
    BaseWorkflowEngine,
    WorkflowExecutionResult,
    WorkflowGraph,
    WorkflowNodeStatus,
    WorkflowStepResult,
)
from app.integrations.base import BaseIntegrationAdapter


class LangGraphWorkflowAdapter(BaseWorkflowEngine, BaseIntegrationAdapter):
    """Adapter executing graph-based workflows via LangGraph state machines."""

    @property
    def name(self) -> str:
        return "langgraph"

    def is_enabled(self) -> bool:
        return bool(settings.ENABLE_LANGGRAPH)

    def is_available(self) -> bool:
        return importlib.util.find_spec("langgraph") is not None

    def validate_graph(self, graph: WorkflowGraph) -> bool:
        self.check_ready()
        if not graph.nodes:
            return False
        return True

    async def execute(
        self,
        graph: WorkflowGraph,
        initial_input: Dict[str, Any],
        **kwargs: Any,
    ) -> WorkflowExecutionResult:
        self.check_ready()
        start_time = time.perf_counter()
        execution_id = f"langgraph_exec_{uuid.uuid4().hex[:12]}"

        from langgraph.graph import StateGraph, END  # type: ignore

        # Construct a simple state graph matching the workflow nodes
        workflow = StateGraph(dict)

        for node in graph.nodes:
            def make_node_fn(n_id=node.id, params=node.parameters):
                def node_fn(state: dict):
                    res = dict(state)
                    res[f"{n_id}_executed"] = True
                    res.update(params)
                    return res
                return node_fn

            workflow.add_node(node.id, make_node_fn())

        for edge in graph.edges:
            workflow.add_edge(edge.source, edge.target)

        # Connect leaves to END
        targets = {edge.target for edge in graph.edges}
        sources = {edge.source for edge in graph.edges}
        leaves = sources - targets if not targets else {n.id for n in graph.nodes if n.id not in sources}
        for leaf in leaves:
            workflow.add_edge(leaf, END)

        # Set entry point
        entry_points = [n.id for n in graph.nodes if n.id not in targets]
        if entry_points:
            workflow.set_entry_point(entry_points[0])
        elif graph.nodes:
            workflow.set_entry_point(graph.nodes[0].id)

        compiled_app = workflow.compile()
        final_state = await compiled_app.ainvoke(initial_input)
        total_latency = (time.perf_counter() - start_time) * 1000.0

        step_results = [
            WorkflowStepResult(
                node_id=n.id,
                status=WorkflowNodeStatus.COMPLETED,
                output_data={"executed": True},
            )
            for n in graph.nodes
        ]

        return WorkflowExecutionResult(
            workflow_id=graph.id,
            execution_id=execution_id,
            success=True,
            final_output=final_state,
            step_results=step_results,
            total_latency_ms=total_latency,
        )
