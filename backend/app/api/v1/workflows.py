"""FastAPI REST routes for Sovereign-Core workflows and Dify interoperability."""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.workflows.models import (
    SecurityAnalysisReport,
    Workflow,
    WorkflowExecutionResponse,
)
from app.core.workflows.runtime import SovereignWorkflowRuntime
from app.core.workflows.security import (
    SecurityValidationError,
    WorkflowSecurityAnalyzer,
)
from app.core.workflows.store import WorkflowStore
from app.integrations.dify.converter import (
    export_dify_dsl,
    export_sovereign_format,
    import_dify_dsl,
    import_sovereign_format,
)

router = APIRouter(prefix="/workflows", tags=["Workflows"])

_store = WorkflowStore()
_runtime = SovereignWorkflowRuntime()
_analyzer = WorkflowSecurityAnalyzer()


def get_workflow_store() -> WorkflowStore:
    return _store


def get_workflow_runtime() -> SovereignWorkflowRuntime:
    return _runtime


class WorkflowSaveRequest(BaseModel):
    workflow: Workflow
    bump_version: Optional[str] = None  # None, "patch", "minor", "major"


class WorkflowApproveRequest(BaseModel):
    operator_name: str = "sovereign-operator"
    notes: Optional[str] = None


class WorkflowRunRequest(BaseModel):
    inputs: Dict[str, Any] = Field(default_factory=dict)
    execution_id: Optional[str] = None


class WorkflowImportRequest(BaseModel):
    content: Dict[str, Any] | str
    format: Optional[str] = "auto"  # "auto", "sovereign", "dify"


@router.get("", response_model=List[Workflow])
async def list_workflows(
    store: WorkflowStore = Depends(get_workflow_store),
) -> List[Workflow]:
    """List all registered workflows in the Sovereign-Core store."""
    return store.list_all()


@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: str,
    store: WorkflowStore = Depends(get_workflow_store),
) -> Workflow:
    """Retrieve details, status, and security analysis of a specific workflow."""
    wf = store.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")
    return wf


@router.post("", response_model=Workflow)
async def save_workflow(
    request: WorkflowSaveRequest,
    store: WorkflowStore = Depends(get_workflow_store),
) -> Workflow:
    """Save or update a workflow with automatic validation and optional semantic version bumping."""
    if request.bump_version:
        saved = store.save_version(request.workflow, bump=request.bump_version)
    else:
        saved = store.save(request.workflow)
    return saved


@router.post("/validate", response_model=SecurityAnalysisReport)
async def validate_workflow(
    workflow: Workflow,
) -> SecurityAnalysisReport:
    """Perform static topological and security analysis against Sovereign-Core air-gap policies."""
    return _analyzer.analyze(workflow)


@router.post("/{workflow_id}/approve", response_model=Workflow)
async def approve_workflow(
    workflow_id: str,
    request: WorkflowApproveRequest,
    store: WorkflowStore = Depends(get_workflow_store),
) -> Workflow:
    """Human-in-the-loop review and approval gate for untrusted or imported workflows."""
    try:
        approved_wf = store.approve(workflow_id, operator_name=request.operator_name)
        if not approved_wf:
            raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")
        return approved_wf
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex))


@router.post("/{workflow_id}/run", response_model=WorkflowExecutionResponse)
async def run_workflow(
    workflow_id: str,
    request: WorkflowRunRequest,
    store: WorkflowStore = Depends(get_workflow_store),
    runtime: SovereignWorkflowRuntime = Depends(get_workflow_runtime),
) -> WorkflowExecutionResponse:
    """Execute a validated and approved workflow through the Sovereign-Core runtime."""
    wf = store.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    try:
        res = await runtime.execute(
            wf,
            initial_input=request.inputs,
            execution_id=request.execution_id,
        )
        return res
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Execution error: {ex}")


@router.post("/import", response_model=Workflow)
async def import_workflow(
    request: WorkflowImportRequest,
    store: WorkflowStore = Depends(get_workflow_store),
) -> Workflow:
    """Import an untrusted workflow in Sovereign format or Dify DSL format."""
    payload = request.content
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Malformed JSON in import payload: {e}")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Import payload must be a JSON object.")

    fmt = request.format.lower()
    is_dify = "workflow" in payload and "app" in payload
    is_sovereign = payload.get("format") == "sovereign-workflow"

    try:
        if fmt == "dify" or (fmt == "auto" and is_dify):
            imported_wf = import_dify_dsl(payload)
        elif fmt == "sovereign" or (fmt == "auto" and is_sovereign):
            imported_wf = import_sovereign_format(payload)
        else:
            # Fallback attempt
            if is_dify:
                imported_wf = import_dify_dsl(payload)
            else:
                imported_wf = import_sovereign_format(payload)

        # Persist as untrusted / APPROVAL REQUIRED
        saved = store.save(imported_wf)
        return saved
    except SecurityValidationError as sve:
        raise HTTPException(status_code=422, detail=f"Security rejection: {sve}")
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Import failed: {ex}")


@router.get("/{workflow_id}/export")
async def export_workflow(
    workflow_id: str,
    format: str = Query("sovereign", pattern="^(sovereign|dify)$"),
    store: WorkflowStore = Depends(get_workflow_store),
) -> Dict[str, Any]:
    """Export a workflow in canonical Sovereign format or Dify DSL."""
    wf = store.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    if format.lower() == "dify":
        return export_dify_dsl(wf)
    return export_sovereign_format(wf)
