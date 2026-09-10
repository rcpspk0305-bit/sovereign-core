"""Deterministic Local Workflow Engine implementing BaseWorkflowEngine."""

import asyncio
import inspect
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Set
from collections import defaultdict, deque

from app.core.interfaces.workflows import (
    BaseWorkflowEngine,
    WorkflowEdge,
    WorkflowExecutionResult,
    WorkflowGraph,
    WorkflowNode,
    WorkflowNodeStatus,
    WorkflowNodeType,
    WorkflowStepResult,
)
from app.core.telemetry import trace_workflow, record_workflow_execution


class WorkflowExecutionError(Exception):
    """Raised when a workflow fails validation or execution."""
    pass


class DeterministicLocalWorkflowEngine(BaseWorkflowEngine):
    """Air-gapped, local-only directed graph execution engine with cycle detection and step budgets."""

    def __init__(self) -> None:
        self._custom_handlers: Dict[str, Callable[[Dict[str, Any], WorkflowNode], Any]] = {}

    def register_handler(
        self,
        name: str,
        handler: Callable[[Dict[str, Any], WorkflowNode], Any],
    ) -> None:
        """Register a custom execution handler for specific node handlers."""
        self._custom_handlers[name] = handler

    def validate_graph(self, graph: WorkflowGraph) -> bool:
        """Verify topological soundness, valid node references, and cycle absence."""
        if not graph.nodes:
            raise WorkflowExecutionError("Workflow graph contains no nodes.")

        node_ids = {node.id for node in graph.nodes}
        if len(node_ids) != len(graph.nodes):
            raise WorkflowExecutionError("Workflow graph contains duplicate node IDs.")

        in_degree: Dict[str, int] = {node_id: 0 for node_id in node_ids}
        adj: Dict[str, List[str]] = defaultdict(list)

        for edge in graph.edges:
            if edge.source not in node_ids:
                raise WorkflowExecutionError(f"Edge references non-existent source node: {edge.source}")
            if edge.target not in node_ids:
                raise WorkflowExecutionError(f"Edge references non-existent target node: {edge.target}")
            adj[edge.source].append(edge.target)
            in_degree[edge.target] += 1

        # Kahn'\''s algorithm for cycle detection
        queue = deque([node_id for node_id, deg in in_degree.items() if deg == 0])
        visited_count = 0

        while queue:
            curr = queue.popleft()
            visited_count += 1
            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited_count != len(node_ids):
            raise WorkflowExecutionError("Cycle detected in directed workflow graph.")

        return True

    async def execute(
        self,
        graph: WorkflowGraph,
        initial_input: Dict[str, Any],
        **kwargs: Any,
    ) -> WorkflowExecutionResult:
        """Execute the workflow graph respecting topological order and step budget."""
        start_time = time.perf_counter()
        execution_id = f"wf_exec_{uuid.uuid4().hex[:12]}"

        with trace_workflow(workflow_id=graph.id, step_count=len(graph.nodes)):
            try:
                self.validate_graph(graph)
            except WorkflowExecutionError as e:
                total_latency = (time.perf_counter() - start_time) * 1000.0
                record_workflow_execution(workflow_id=graph.id, success=False)
                return WorkflowExecutionResult(
                    workflow_id=graph.id,
                    execution_id=execution_id,
                    success=False,
                    total_latency_ms=total_latency,
                    error=str(e),
                )

        node_map: Dict[str, WorkflowNode] = {n.id: n for n in graph.nodes}
        in_degree: Dict[str, int] = {n.id: 0 for n in graph.nodes}
        adj: Dict[str, List[str]] = defaultdict(list)

        for edge in graph.edges:
            adj[edge.source].append(edge.target)
            in_degree[edge.target] += 1

        # Queue starting nodes (in-degree == 0)
        ready_queue = deque([node_id for node_id, deg in in_degree.items() if deg == 0])
        current_context: Dict[str, Any] = dict(initial_input)
        step_results: List[WorkflowStepResult] = []
        steps_executed = 0
        executed_nodes: Set[str] = set()

        while ready_queue:
            if steps_executed >= graph.max_steps:
                total_latency = (time.perf_counter() - start_time) * 1000.0
                return WorkflowExecutionResult(
                    workflow_id=graph.id,
                    execution_id=execution_id,
                    success=False,
                    final_output=current_context,
                    step_results=step_results,
                    total_latency_ms=total_latency,
                    error=f"Step budget exceeded ({graph.max_steps} steps max).",
                )

            node_id = ready_queue.popleft()
            node = node_map[node_id]
            node_start = time.perf_counter()
            steps_executed += 1
            executed_nodes.add(node_id)

            try:
                node_output = await self._execute_node(node, current_context)
                node_latency = (time.perf_counter() - node_start) * 1000.0
                step_results.append(
                    WorkflowStepResult(
                        node_id=node_id,
                        status=WorkflowNodeStatus.COMPLETED,
                        input_data=dict(current_context),
                        output_data=node_output,
                        latency_ms=node_latency,
                    )
                )
                current_context.update(node_output)
            except Exception as ex:
                node_latency = (time.perf_counter() - node_start) * 1000.0
                step_results.append(
                    WorkflowStepResult(
                        node_id=node_id,
                        status=WorkflowNodeStatus.FAILED,
                        input_data=dict(current_context),
                        output_data={},
                        latency_ms=node_latency,
                        error=str(ex),
                    )
                )
                total_latency = (time.perf_counter() - start_time) * 1000.0
                return WorkflowExecutionResult(
                    workflow_id=graph.id,
                    execution_id=execution_id,
                    success=False,
                    final_output=current_context,
                    step_results=step_results,
                    total_latency_ms=total_latency,
                    error=f"Node {node_id} execution failed: {ex}",
                )

            # Enqueue successors whose dependencies are fully resolved
            for neighbor in adj[node_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    ready_queue.append(neighbor)

        total_latency = (time.perf_counter() - start_time) * 1000.0
        record_workflow_execution(workflow_id=graph.id, success=True)
        return WorkflowExecutionResult(
            workflow_id=graph.id,
            execution_id=execution_id,
            success=True,
            final_output=current_context,
            step_results=step_results,
            total_latency_ms=total_latency,
        )

    async def _execute_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch node to custom handler or standard deterministic execution."""
        if node.handler and node.handler in self._custom_handlers:
            handler = self._custom_handlers[node.handler]
            if inspect.iscoroutinefunction(handler):
                res = await handler(context, node)
            else:
                res = handler(context, node)
            return res if isinstance(res, dict) else {"result": res}

        # Built-in deterministic handlers by node type
        if node.type == WorkflowNodeType.TRIGGER:
            return {"triggered": True, "directive": context.get("directive", "")}
        elif node.type == WorkflowNodeType.ROUTER:
            route = node.parameters.get("target", "default")
            return {"routed_target": route}
        elif node.type == WorkflowNodeType.SEAL:
            return {"sealed": True, "verified_at": time.time()}
        else:
            # Generic pass-through updating context with node parameters
            output = {f"{node.id}_completed": True}
            output.update(node.parameters)
            return output
