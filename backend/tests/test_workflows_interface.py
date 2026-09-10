import asyncio
import pytest
from app.core.interfaces.workflows import (
    WorkflowEdge,
    WorkflowGraph,
    WorkflowNode,
    WorkflowNodeStatus,
    WorkflowNodeType,
)
from app.core.workflows.engine import (
    DeterministicLocalWorkflowEngine,
    WorkflowExecutionError,
)


def test_workflow_graph_cycle_detection():
    engine = DeterministicLocalWorkflowEngine()
    # Cyclic graph: A -> B -> C -> A
    graph = WorkflowGraph(
        id="cycle_wf",
        name="Cyclic Workflow",
        nodes=[
            WorkflowNode(id="A", label="A"),
            WorkflowNode(id="B", label="B"),
            WorkflowNode(id="C", label="C"),
        ],
        edges=[
            WorkflowEdge(source="A", target="B"),
            WorkflowEdge(source="B", target="C"),
            WorkflowEdge(source="C", target="A"),
        ],
    )

    with pytest.raises(WorkflowExecutionError, match="Cycle detected"):
        engine.validate_graph(graph)


def test_workflow_graph_invalid_edge_references():
    engine = DeterministicLocalWorkflowEngine()
    graph = WorkflowGraph(
        id="bad_edge_wf",
        name="Bad Edge",
        nodes=[WorkflowNode(id="A", label="A")],
        edges=[WorkflowEdge(source="A", target="NON_EXISTENT")],
    )

    with pytest.raises(WorkflowExecutionError, match="non-existent target"):
        engine.validate_graph(graph)


def test_deterministic_workflow_execution():
    async def _run():
        engine = DeterministicLocalWorkflowEngine()

        def custom_eval(context, node):
            return {"eval_score": 0.98, "passed": True}

        engine.register_handler("custom_eval", custom_eval)

        graph = WorkflowGraph(
            id="sample_wf",
            name="Sample Linear Pipeline",
            nodes=[
                WorkflowNode(id="n1", label="Trigger", type=WorkflowNodeType.TRIGGER),
                WorkflowNode(id="n2", label="Router", type=WorkflowNodeType.ROUTER, parameters={"target": "RAG"}),
                WorkflowNode(id="n3", label="Eval", type=WorkflowNodeType.EVAL, handler="custom_eval"),
                WorkflowNode(id="n4", label="Seal", type=WorkflowNodeType.SEAL),
            ],
            edges=[
                WorkflowEdge(source="n1", target="n2"),
                WorkflowEdge(source="n2", target="n3"),
                WorkflowEdge(source="n3", target="n4"),
            ],
        )

        result = await engine.execute(graph, initial_input={"directive": "Analyze local audit log"})

        assert result.success is True
        assert len(result.step_results) == 4
        assert result.final_output["triggered"] is True
        assert result.final_output["routed_target"] == "RAG"
        assert result.final_output["eval_score"] == 0.98
        assert result.final_output["sealed"] is True

    asyncio.run(_run())


def test_workflow_step_budget_enforcement():
    async def _run():
        engine = DeterministicLocalWorkflowEngine()
        # Graph with 4 sequential steps, but max_steps capped at 2
        graph = WorkflowGraph(
            id="budget_wf",
            name="Budget Test",
            max_steps=2,
            nodes=[
                WorkflowNode(id="n1", label="Step 1"),
                WorkflowNode(id="n2", label="Step 2"),
                WorkflowNode(id="n3", label="Step 3"),
            ],
            edges=[
                WorkflowEdge(source="n1", target="n2"),
                WorkflowEdge(source="n2", target="n3"),
            ],
        )

        result = await engine.execute(graph, initial_input={})
        assert result.success is False
        assert "Step budget exceeded" in (result.error or "")

    asyncio.run(_run())
