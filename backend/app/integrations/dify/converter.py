"""Two-way interoperability converter between Sovereign-Core workflows and Dify DSL."""

import datetime
from typing import Any, Dict, List

from app.core.workflows.models import (
    Workflow,
    WorkflowEdge,
    WorkflowNode,
    WorkflowNodeType,
    WorkflowState,
)
from app.core.workflows.security import (
    SecurityValidationError,
    WorkflowSecurityAnalyzer,
)

DIFY_TO_SOVEREIGN_TYPE_MAP: Dict[str, WorkflowNodeType] = {
    "start": WorkflowNodeType.START,
    "llm": WorkflowNodeType.LLM,
    "agent": WorkflowNodeType.AGENT,
    "tool": WorkflowNodeType.TOOL,
    "knowledge-retrieval": WorkflowNodeType.RAG,
    "knowledge_retrieval": WorkflowNodeType.RAG,
    "if-else": WorkflowNodeType.CONDITION,
    "if_else": WorkflowNodeType.CONDITION,
    "question-classifier": WorkflowNodeType.CONDITION,
    "human-in-the-loop": WorkflowNodeType.APPROVAL,
    "approval": WorkflowNodeType.APPROVAL,
    "end": WorkflowNodeType.END,
}

SOVEREIGN_TO_DIFY_TYPE_MAP: Dict[WorkflowNodeType, str] = {
    WorkflowNodeType.START: "start",
    WorkflowNodeType.LLM: "llm",
    WorkflowNodeType.AGENT: "agent",
    WorkflowNodeType.TOOL: "tool",
    WorkflowNodeType.RAG: "knowledge-retrieval",
    WorkflowNodeType.CONDITION: "if-else",
    WorkflowNodeType.APPROVAL: "human-in-the-loop",
    WorkflowNodeType.END: "end",
}

FORBIDDEN_DIFY_NODES = {
    "code": "arbitrary code execution is strictly prohibited under Sovereign-Core air-gap policy.",
    "http-request": "unrestricted HTTP egress violates NO_EGRESS air-gap policy.",
    "http_request": "unrestricted HTTP egress violates NO_EGRESS air-gap policy.",
    "webhook": "arbitrary outbound webhook is strictly prohibited.",
}


def export_sovereign_format(workflow: Workflow) -> Dict[str, Any]:
    """Export workflow in documented Sovereign-Core canonical JSON format."""
    return {
        "format": "sovereign-workflow",
        "version": "1.0",
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "workflow": workflow.model_dump(),
    }


def import_sovereign_format(payload: Dict[str, Any]) -> Workflow:
    """Import workflow from Sovereign-Core canonical format.
    
    Untrusted import: enforced in APPROVAL REQUIRED state and sanitized.
    """
    if not isinstance(payload, dict):
        raise ValueError("Invalid Sovereign format payload: expected JSON object.")

    if payload.get("format") != "sovereign-workflow":
        raise ValueError(f"Unrecognized format '{payload.get('format')}'. Expected 'sovereign-workflow'.")

    raw_wf = payload.get("workflow")
    if not isinstance(raw_wf, dict):
        raise ValueError("Missing 'workflow' object in Sovereign payload.")

    wf = Workflow(**raw_wf)
    analyzer = WorkflowSecurityAnalyzer()
    sanitized = analyzer.enforce_sovereign_policy(wf)
    sanitized.state = WorkflowState.APPROVAL_REQUIRED
    sanitized.approval_status = "PENDING"
    sanitized.metadata["imported"] = True
    sanitized.metadata["source"] = "sovereign_json"
    sanitized.security_analysis = analyzer.analyze(sanitized)
    return sanitized


def export_dify_dsl(workflow: Workflow) -> Dict[str, Any]:
    """Export Sovereign-Core workflow into compatible Dify Workflow DSL format."""
    dify_nodes: List[Dict[str, Any]] = []

    for idx, node in enumerate(workflow.nodes):
        dify_type = SOVEREIGN_TO_DIFY_TYPE_MAP.get(node.type, "tool")
        node_data: Dict[str, Any] = {
            "title": node.name or f"Node {node.id}",
            "type": dify_type,
            "desc": f"Exported from Sovereign-Core node {node.id}",
        }

        # Map node-specific configs into Dify data structures
        if node.type == WorkflowNodeType.START:
            node_data["variables"] = [
                {"variable": k, "label": k, "type": "string", "required": False}
                for k in (node.inputs if isinstance(node.inputs, dict) else {})
            ]
        elif node.type == WorkflowNodeType.LLM:
            node_data["model"] = {
                "provider": node.config.get("provider", "ollama"),
                "name": node.config.get("model", "llama3"),
                "mode": "chat",
            }
            node_data["prompt_template"] = [
                {"role": "user", "text": node.config.get("prompt_template", "{{#start.query#}}")}
            ]
        elif node.type == WorkflowNodeType.RAG:
            node_data["dataset_ids"] = node.config.get("collection", ["sovereign-docs"])
            node_data["top_k"] = node.config.get("top_k", 4)
        elif node.type == WorkflowNodeType.TOOL:
            node_data["provider_name"] = "sovereign_tools"
            node_data["tool_name"] = node.config.get("tool_name", node.name)
            node_data["tool_parameters"] = node.config
        elif node.type == WorkflowNodeType.CONDITION:
            node_data["conditions"] = [{"expression": node.config.get("expression", "")}]
        elif node.type == WorkflowNodeType.END:
            node_data["outputs"] = [
                {"variable": "result", "value_selector": ["llm", "text"]}
            ]

        dify_nodes.append({
            "id": node.id,
            "data": node_data,
            "position": node.position or {"x": 100 + (idx * 220), "y": 200},
        })

    dify_edges: List[Dict[str, Any]] = []
    for edge in workflow.edges:
        dify_edges.append({
            "id": edge.id,
            "source": edge.source,
            "target": edge.target,
            "data": {"condition": edge.condition} if edge.condition else {},
        })

    return {
        "app": {
            "name": workflow.name,
            "mode": "workflow",
            "icon": "🛡️",
            "icon_type": "emoji",
            "description": workflow.description or "Sovereign-Core exported workflow",
        },
        "workflow": {
            "version": "0.1.0",
            "graph": {
                "nodes": dify_nodes,
                "edges": dify_edges,
            },
        },
    }


def import_dify_dsl(payload: Dict[str, Any]) -> Workflow:
    """Import and translate a Dify DSL workflow into Sovereign-Core internal workflow.
    
    Untrusted import: strict security analysis performed, marked APPROVAL REQUIRED.
    """
    if not isinstance(payload, dict):
        raise ValueError("Invalid Dify DSL: expected dictionary root.")

    app_meta = payload.get("app", {})
    workflow_block = payload.get("workflow", {})
    graph_block = workflow_block.get("graph", {})
    raw_nodes = graph_block.get("nodes", [])
    raw_edges = graph_block.get("edges", [])

    wf_name = app_meta.get("name", "Imported Dify Workflow")
    wf_id = f"dify_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    sovereign_nodes: List[WorkflowNode] = []
    sovereign_edges: List[WorkflowEdge] = []

    # Map nodes
    for raw_node in raw_nodes:
        n_id = raw_node.get("id")
        n_data = raw_node.get("data", {})
        dify_type = n_data.get("type", "").lower()

        # Reject explicitly forbidden/dangerous nodes
        if dify_type in FORBIDDEN_DIFY_NODES:
            reason = FORBIDDEN_DIFY_NODES[dify_type]
            raise SecurityValidationError(
                f"Unsupported or dangerous Dify node '{dify_type}': {reason}"
            )

        if dify_type not in DIFY_TO_SOVEREIGN_TYPE_MAP:
            raise SecurityValidationError(
                f"Unsupported or dangerous Dify node '{dify_type}': node type cannot be safely mapped to Sovereign-Core primitives."
            )

        sov_type = DIFY_TO_SOVEREIGN_TYPE_MAP[dify_type]
        title = n_data.get("title", n_id)

        # Map config parameters
        config: Dict[str, Any] = {}
        if sov_type == WorkflowNodeType.LLM:
            model_info = n_data.get("model", {})
            config["provider"] = model_info.get("provider", "ollama")
            config["model"] = model_info.get("name", "llama3")
            prompt_list = n_data.get("prompt_template", [])
            if prompt_list and isinstance(prompt_list, list):
                config["prompt_template"] = prompt_list[0].get("text", "")
            elif isinstance(prompt_list, str):
                config["prompt_template"] = prompt_list
        elif sov_type == WorkflowNodeType.RAG:
            config["top_k"] = n_data.get("top_k", 4)
            config["collection"] = n_data.get("dataset_ids", ["default"])
        elif sov_type == WorkflowNodeType.TOOL:
            config["tool_name"] = n_data.get("tool_name") or title.lower().replace(" ", "_")
            config.update(n_data.get("tool_parameters", {}))
        elif sov_type == WorkflowNodeType.CONDITION:
            conditions = n_data.get("conditions", [])
            if conditions and isinstance(conditions, list):
                config["expression"] = conditions[0].get("expression", "")
        else:
            config.update({k: v for k, v in n_data.items() if k not in ("title", "type", "desc")})

        position = raw_node.get("position")

        sovereign_nodes.append(
            WorkflowNode(
                id=n_id,
                name=title,
                type=sov_type,
                config=config,
                position=position,
            )
        )

    # Map edges
    for raw_edge in raw_edges:
        e_id = raw_edge.get("id", f"{raw_edge.get('source')}->{raw_edge.get('target')}")
        cond = raw_edge.get("data", {}).get("condition")
        sovereign_edges.append(
            WorkflowEdge(
                id=e_id,
                source=raw_edge.get("source"),
                target=raw_edge.get("target"),
                condition=cond,
            )
        )

    wf = Workflow(
        id=wf_id,
        name=wf_name,
        description=app_meta.get("description", "Imported from external Dify DSL"),
        nodes=sovereign_nodes,
        edges=sovereign_edges,
        state=WorkflowState.APPROVAL_REQUIRED,
        approval_status="PENDING",
        metadata={
            "imported": True,
            "source": "dify_dsl",
            "original_app_mode": app_meta.get("mode"),
        },
    )

    analyzer = WorkflowSecurityAnalyzer()
    sanitized = analyzer.enforce_sovereign_policy(wf)
    sanitized.security_analysis = analyzer.analyze(sanitized)
    return sanitized


class DifyInteroperabilityLayer:
    """Interoperability facade for exporting and importing Sovereign and Dify workflows."""

    @staticmethod
    def export_sovereign(workflow: Workflow) -> Dict[str, Any]:
        return export_sovereign_format(workflow)

    @staticmethod
    def import_sovereign(payload: Dict[str, Any]) -> Workflow:
        return import_sovereign_format(payload)

    @staticmethod
    def export_dify(workflow: Workflow) -> Dict[str, Any]:
        return export_dify_dsl(workflow)

    @staticmethod
    def import_dify(payload: Dict[str, Any]) -> Workflow:
        return import_dify_dsl(payload)
