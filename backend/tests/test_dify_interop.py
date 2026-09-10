"""Comprehensive tests for Dify interoperability layer, security analyzer, and workflow engine."""

import asyncio
import pytest
from typing import Any, Dict

from app.core.workflows.models import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowNodeType,
    WorkflowState,
    WorkflowPolicy,
)
from app.core.workflows.security import (
    WorkflowSecurityAnalyzer,
    SecurityValidationError,
)
from app.integrations.dify.converter import (
    DifyInteroperabilityLayer,
    export_sovereign_format,
    import_sovereign_format,
    export_dify_dsl,
    import_dify_dsl,
)
from app.core.workflows.store import WorkflowStore
from app.core.workflows.runtime import SovereignWorkflowRuntime


# ============================================================================
# 1. WORKFLOW SCHEMA & VALIDATION TESTS
# ============================================================================

def test_workflow_schema_valid():
    """Verify clean construction of valid Sovereign-Core internal workflow."""
    wf = Workflow(
        id="wf_sample_01",
        name="Tactical Inspection Workflow",
        version="1.0.0",
        nodes=[
            WorkflowNode(id="start_node", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="rag_node",
                name="Spec Search",
                type=WorkflowNodeType.RAG,
                config={"query": "pressure limits", "top_k": 3},
            ),
            WorkflowNode(
                id="llm_node",
                name="Summarizer",
                type=WorkflowNodeType.LLM,
                config={"model": "llama3", "prompt_template": "Summarize {{rag_node.output}}"},
            ),
            WorkflowNode(id="end_node", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start_node", target="rag_node"),
            WorkflowEdge(id="e2", source="rag_node", target="llm_node"),
            WorkflowEdge(id="e3", source="llm_node", target="end_node"),
        ],
    )

    assert wf.id == "wf_sample_01"
    assert len(wf.nodes) == 4
    assert len(wf.edges) == 3
    assert wf.policy.no_egress is True
    assert wf.state == WorkflowState.DRAFT


def test_workflow_cycle_detection():
    """Topological cycle detection must raise error."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_cycle",
        name="Cyclic Workflow",
        nodes=[
            WorkflowNode(id="n1", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(id="n2", name="LLM", type=WorkflowNodeType.LLM),
            WorkflowNode(id="n3", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="n1", target="n2"),
            WorkflowEdge(id="e2", source="n2", target="n1"),  # Cycle
            WorkflowEdge(id="e3", source="n2", target="n3"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Cycle detected" in f.message for f in report.findings)


def test_workflow_missing_start_or_end():
    """Workflows lacking START or END node must be invalid."""
    analyzer = WorkflowSecurityAnalyzer()
    wf_no_start = Workflow(
        id="wf_no_start",
        name="No Start",
        nodes=[
            WorkflowNode(id="n1", name="LLM", type=WorkflowNodeType.LLM),
            WorkflowNode(id="n2", name="End", type=WorkflowNodeType.END),
        ],
        edges=[WorkflowEdge(id="e1", source="n1", target="n2")],
    )
    report = analyzer.analyze(wf_no_start)
    assert report.is_safe is False
    assert any("START node" in f.message for f in report.findings)


# ============================================================================
# 2. MALICIOUS WORKFLOW REJECTION & SECURITY ANALYSIS
# ============================================================================

def test_reject_arbitrary_shell():
    """Workflows attempting shell/bash execution must be rejected."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_malicious_shell",
        name="Malicious Shell",
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="exec_node",
                name="Tool Node",
                type=WorkflowNodeType.TOOL,
                config={"command": "bash -c 'cat /etc/passwd'"},
            ),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start", target="exec_node"),
            WorkflowEdge(id="e2", source="exec_node", target="end"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Arbitrary shell command detected" in f.message for f in report.findings)


def test_reject_arbitrary_code():
    """Workflows with eval, exec, or python injection must be rejected."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_malicious_code",
        name="Malicious Code",
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="code_node",
                name="Eval Node",
                type=WorkflowNodeType.TOOL,
                config={"script": "import os; eval('os.system(\"id\")')"},
            ),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start", target="code_node"),
            WorkflowEdge(id="e2", source="code_node", target="end"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Arbitrary code execution pattern detected" in f.message for f in report.findings)


def test_reject_unrestricted_http():
    """Workflows violating NO_EGRESS with outbound URLs must be rejected."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_malicious_egress",
        name="Malicious Egress",
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="tool_node",
                name="HTTP Tool",
                type=WorkflowNodeType.TOOL,
                config={"url": "https://api.exfiltrate-data.com/upload"},
            ),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start", target="tool_node"),
            WorkflowEdge(id="e2", source="tool_node", target="end"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Unrestricted HTTP / network egress detected" in f.message for f in report.findings)


def test_reject_unknown_tools():
    """Workflows referencing unknown tools outside allowlist must be rejected."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_unknown_tool",
        name="Unknown Tool",
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="tool_node",
                name="Disallowed Tool",
                type=WorkflowNodeType.TOOL,
                config={"tool_name": "arbitrary_remote_shell"},
            ),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start", target="tool_node"),
            WorkflowEdge(id="e2", source="tool_node", target="end"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Unknown or unallowlisted tool" in f.message for f in report.findings)


def test_reject_filesystem_escape():
    """Workflows attempting directory traversal or system paths must be rejected."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_fs_escape",
        name="Filesystem Escape",
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="tool_node",
                name="File Search",
                type=WorkflowNodeType.TOOL,
                config={"path": "../../etc/shadow"},
            ),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start", target="tool_node"),
            WorkflowEdge(id="e2", source="tool_node", target="end"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Filesystem escape or traversal detected" in f.message for f in report.findings)


def test_reject_unsafe_template_expressions():
    """Template expressions containing __class__ or __import__ injection must be rejected."""
    analyzer = WorkflowSecurityAnalyzer()
    wf = Workflow(
        id="wf_unsafe_expr",
        name="Unsafe Expression",
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(
                id="llm_node",
                name="LLM Prompt",
                type=WorkflowNodeType.LLM,
                config={"prompt_template": "{{''.__class__.__mro__[1].__subclasses__()}}"},
            ),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="start", target="llm_node"),
            WorkflowEdge(id="e2", source="llm_node", target="end"),
        ],
    )

    report = analyzer.analyze(wf)
    assert report.is_safe is False
    assert any("Unsafe template or expression detected" in f.message for f in report.findings)


# ============================================================================
# 3. POLICY INHERITANCE TESTS
# ============================================================================

def test_policy_cannot_be_overridden_by_external_metadata():
    """External metadata attempting to disable no_egress or inflate step budget is overridden."""
    analyzer = WorkflowSecurityAnalyzer()
    malicious_policy = WorkflowPolicy(
        no_egress=False,          # Trying to disable air-gap
        max_steps=45,             # Attempting to exceed default step budget
        requires_approval=False,  # Bypassing human review
    )
    wf = Workflow(
        id="wf_policy_bypass",
        name="Policy Bypass Attempt",
        policy=malicious_policy,
        nodes=[
            WorkflowNode(id="start", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(id="end", name="End", type=WorkflowNodeType.END),
        ],
        edges=[WorkflowEdge(id="e1", source="start", target="end")],
    )

    sanitized_wf = analyzer.enforce_sovereign_policy(wf)
    assert sanitized_wf.policy.no_egress is True
    assert sanitized_wf.policy.max_steps <= 20
    assert sanitized_wf.policy.requires_approval is True


# ============================================================================
# 4. EXPORT & IMPORT TESTS (SOVEREIGN & DIFY FORMATS)
# ============================================================================

def test_sovereign_export_and_import():
    """Documented Sovereign export format can be exported and imported losslessly."""
    wf = Workflow(
        id="wf_export_test",
        name="Baseline Export",
        version="1.0.0",
        nodes=[
            WorkflowNode(id="s", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(id="l", name="LLM", type=WorkflowNodeType.LLM, config={"model": "llama3"}),
            WorkflowNode(id="e", name="End", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="s", target="l"),
            WorkflowEdge(id="e2", source="l", target="e"),
        ],
    )

    exported = export_sovereign_format(wf)
    assert exported["format"] == "sovereign-workflow"
    assert exported["version"] == "1.0"
    assert "workflow" in exported

    imported = import_sovereign_format(exported)
    assert imported.name == "Baseline Export"
    assert len(imported.nodes) == 3
    # Untrusted import starts in APPROVAL REQUIRED state
    assert imported.state == WorkflowState.APPROVAL_REQUIRED


def test_dify_dsl_export_and_import():
    """Dify-compatible DSL format mapping."""
    wf = Workflow(
        id="wf_dify_test",
        name="Dify Bridge Workflow",
        version="1.0.0",
        nodes=[
            WorkflowNode(id="node_start", name="Start Node", type=WorkflowNodeType.START),
            WorkflowNode(
                id="node_rag",
                name="Vector Search",
                type=WorkflowNodeType.RAG,
                config={"top_k": 4},
            ),
            WorkflowNode(
                id="node_llm",
                name="Ollama LLM",
                type=WorkflowNodeType.LLM,
                config={"model": "gemma", "prompt_template": "Draft analysis"},
            ),
            WorkflowNode(id="node_end", name="End Node", type=WorkflowNodeType.END),
        ],
        edges=[
            WorkflowEdge(id="e1", source="node_start", target="node_rag"),
            WorkflowEdge(id="e2", source="node_rag", target="node_llm"),
            WorkflowEdge(id="e3", source="node_llm", target="node_end"),
        ],
    )

    dify_export = export_dify_dsl(wf)
    assert "app" in dify_export
    assert "workflow" in dify_export
    assert dify_export["app"]["mode"] == "workflow"
    nodes = dify_export["workflow"]["graph"]["nodes"]
    assert any(n["data"]["type"] == "start" for n in nodes)
    assert any(n["data"]["type"] == "knowledge-retrieval" for n in nodes)
    assert any(n["data"]["type"] == "llm" for n in nodes)
    assert any(n["data"]["type"] == "end" for n in nodes)

    # Import back from Dify DSL
    imported_from_dify = import_dify_dsl(dify_export)
    assert imported_from_dify.name == "Dify Bridge Workflow"
    assert len(imported_from_dify.nodes) == 4
    assert imported_from_dify.state == WorkflowState.APPROVAL_REQUIRED
    assert imported_from_dify.metadata.get("source") == "dify_dsl"


def test_dify_import_rejects_unsupported_dangerous_nodes():
    """Importing Dify workflow containing 'code' or 'http-request' must fail or be flagged."""
    dify_raw = {
        "app": {"name": "Dangerous Dify", "mode": "workflow"},
        "workflow": {
            "version": "0.1.0",
            "graph": {
                "nodes": [
                    {"id": "1", "data": {"type": "start", "title": "Start"}},
                    {"id": "2", "data": {"type": "code", "title": "Run Python", "code": "import os; os.system('ls')"}},
                    {"id": "3", "data": {"type": "end", "title": "End"}},
                ],
                "edges": [
                    {"id": "e1", "source": "1", "target": "2"},
                    {"id": "e2", "source": "2", "target": "3"},
                ],
            },
        },
    }

    with pytest.raises(SecurityValidationError, match="Unsupported or dangerous Dify node"):
        import_dify_dsl(dify_raw)


# ============================================================================
# 5. EXECUTION & FLIGHT RECORDER INTEGRATION TESTS
# ============================================================================

def test_unapproved_imported_workflow_cannot_execute():
    """Imported workflows cannot be executed before explicit approval."""
    async def _run():
        runtime = SovereignWorkflowRuntime()
        wf = Workflow(
            id="wf_unapproved",
            name="Unapproved Workflow",
            state=WorkflowState.APPROVAL_REQUIRED,
            nodes=[
                WorkflowNode(id="s", name="Start", type=WorkflowNodeType.START),
                WorkflowNode(id="e", name="End", type=WorkflowNodeType.END),
            ],
            edges=[WorkflowEdge(id="e1", source="s", target="e")],
        )

        with pytest.raises(PermissionError, match="Workflow requires human approval"):
            await runtime.execute(wf, initial_input={})

    asyncio.run(_run())


def test_approved_workflow_execution():
    """Approved workflow executes through Sovereign-Core runtime and records steps."""
    async def _run():
        runtime = SovereignWorkflowRuntime()
        wf = Workflow(
            id="wf_exec_valid",
            name="Safe Execution Workflow",
            state=WorkflowState.READY,
            approval_status="APPROVED",
            nodes=[
                WorkflowNode(id="s", name="Start", type=WorkflowNodeType.START),
                WorkflowNode(
                    id="t",
                    name="System Diagnostic",
                    type=WorkflowNodeType.TOOL,
                    config={"tool_name": "system_info"},
                ),
                WorkflowNode(id="e", name="End", type=WorkflowNodeType.END),
            ],
            edges=[
                WorkflowEdge(id="e1", source="s", target="t"),
                WorkflowEdge(id="e2", source="t", target="e"),
            ],
        )

        result = await runtime.execute(wf, initial_input={"query": "system check"})
        assert result.success is True
        assert result.workflow_id == "wf_exec_valid"
        assert len(result.step_results) >= 2
        assert "execution_id" in result.model_dump()

    asyncio.run(_run())


# ============================================================================
# 6. VERSIONING & STORE TESTS
# ============================================================================

def test_workflow_versioning():
    """Workflow store supports saving updates with automatic or explicit version bump."""
    store = WorkflowStore()
    wf = Workflow(
        id="wf_version_test",
        name="Versioned Task",
        version="1.0.0",
        nodes=[
            WorkflowNode(id="s", name="Start", type=WorkflowNodeType.START),
            WorkflowNode(id="e", name="End", type=WorkflowNodeType.END),
        ],
        edges=[WorkflowEdge(id="e1", source="s", target="e")],
    )

    store.save(wf)
    retrieved = store.get("wf_version_test")
    assert retrieved is not None
    assert retrieved.version == "1.0.0"

    # Update with version bump
    updated_wf = retrieved.model_copy(deep=True)
    updated_wf.nodes.append(
        WorkflowNode(id="n2", name="LLM Node", type=WorkflowNodeType.LLM)
    )
    bumped = store.save_version(updated_wf, bump="patch")
    assert bumped.version == "1.0.1"
    assert len(bumped.nodes) == 3


# ============================================================================
# 7. FASTAPI REST ENDPOINTS INTEGRATION TESTS
# ============================================================================

def test_api_list_and_get_workflows(test_client):
    """Test listing workflows and getting specific workflow via REST API."""
    res = test_client.get("/api/v1/workflows")
    assert res.status_code == 200
    workflows = res.json()
    assert isinstance(workflows, list)
    assert len(workflows) >= 1

    # Check tactical workflow exists
    tactical_id = workflows[0]["id"]
    res_get = test_client.get(f"/api/v1/workflows/{tactical_id}")
    assert res_get.status_code == 200
    wf_data = res_get.json()
    assert wf_data["id"] == tactical_id
    assert "policy" in wf_data


def test_api_validate_workflow(test_client):
    """Test validating workflow via REST API."""
    payload = {
        "id": "wf_test_api",
        "name": "API Test",
        "nodes": [
            {"id": "s", "name": "Start", "type": "START"},
            {"id": "e", "name": "End", "type": "END"},
        ],
        "edges": [{"id": "e1", "source": "s", "target": "e"}],
    }
    res = test_client.post("/api/v1/workflows/validate", json=payload)
    assert res.status_code == 200
    report = res.json()
    assert report["is_safe"] is True


def test_api_import_approve_and_run_lifecycle(test_client):
    """Test complete security lifecycle: import -> validate -> review -> approve -> execute."""
    dify_payload = {
        "content": {
            "app": {"name": "Imported REST Dify", "mode": "workflow"},
            "workflow": {
                "version": "0.1.0",
                "graph": {
                    "nodes": [
                        {"id": "n1", "data": {"type": "start", "title": "Start"}},
                        {"id": "n2", "data": {"type": "tool", "title": "System Diagnostic", "tool_name": "system_info"}},
                        {"id": "n3", "data": {"type": "end", "title": "End"}},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},
                    ],
                },
            },
        },
        "format": "dify",
    }

    # 1. IMPORT
    res_import = test_client.post("/api/v1/workflows/import", json=dify_payload)
    assert res_import.status_code == 200
    wf = res_import.json()
    wf_id = wf["id"]
    assert wf["state"] == "APPROVAL REQUIRED"

    # 2. RUN BEFORE APPROVAL MUST BE FORBIDDEN (403)
    res_run_blocked = test_client.post(f"/api/v1/workflows/{wf_id}/run", json={"inputs": {}})
    assert res_run_blocked.status_code == 403

    # 3. APPROVE
    res_approve = test_client.post(
        f"/api/v1/workflows/{wf_id}/approve",
        json={"operator_name": "security-lead", "notes": "Inspected and verified safe."},
    )
    assert res_approve.status_code == 200
    approved_wf = res_approve.json()
    assert approved_wf["approval_status"] == "APPROVED"
    assert approved_wf["state"] == "READY"

    # 4. RUN AFTER APPROVAL MUST SUCCEED (200)
    res_run = test_client.post(f"/api/v1/workflows/{wf_id}/run", json={"inputs": {}})
    assert res_run.status_code == 200
    exec_res = res_run.json()
    assert exec_res["success"] is True
    assert exec_res["state"] == "COMPLETED"

    # 5. EXPORT
    res_export_sov = test_client.get(f"/api/v1/workflows/{wf_id}/export?format=sovereign")
    assert res_export_sov.status_code == 200
    assert res_export_sov.json()["format"] == "sovereign-workflow"

    res_export_dify = test_client.get(f"/api/v1/workflows/{wf_id}/export?format=dify")
    assert res_export_dify.status_code == 200
    assert "app" in res_export_dify.json()

