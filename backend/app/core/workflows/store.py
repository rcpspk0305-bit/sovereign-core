"""Thread-safe in-memory and persistent repository for Sovereign-Core workflows."""

import datetime
import threading
from typing import List, Optional

from app.core.workflows.models import (
    Workflow,
    WorkflowEdge,
    WorkflowNode,
    WorkflowNodeType,
    WorkflowPolicy,
    WorkflowState,
)
from app.core.workflows.security import WorkflowSecurityAnalyzer


class WorkflowStore:
    """Repository storing workflows with lifecycle versioning and security gates."""

    _instance: Optional["WorkflowStore"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls) -> "WorkflowStore":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(WorkflowStore, cls).__new__(cls)
                cls._instance._workflows = {}
                cls._instance._init_defaults()
            return cls._instance

    def _init_defaults(self) -> None:
        """Preload canonical reference workflows into the store."""
        tactical_wf = Workflow(
            id="tactical_inspection_wf",
            name="Tactical Air-Gapped Document Inspection",
            version="1.0.0",
            description="Deterministic pipeline querying local ChromaDB vectors and synthesizing verified findings.",
            state=WorkflowState.READY,
            approval_status="APPROVED",
            policy=WorkflowPolicy(no_egress=True, max_steps=10),
            nodes=[
                WorkflowNode(
                    id="n1",
                    name="Directive Intake",
                    type=WorkflowNodeType.START,
                    inputs=["directive", "session_id"],
                    position={"x": 50, "y": 200},
                ),
                WorkflowNode(
                    id="n2",
                    name="Vector Spec Search",
                    type=WorkflowNodeType.RAG,
                    config={"top_k": 3, "collection": "system_specs"},
                    position={"x": 280, "y": 200},
                ),
                WorkflowNode(
                    id="n3",
                    name="Diagnostic Verification",
                    type=WorkflowNodeType.TOOL,
                    config={"tool_name": "system_info"},
                    position={"x": 510, "y": 200},
                ),
                WorkflowNode(
                    id="n4",
                    name="Local LLM Synthesis",
                    type=WorkflowNodeType.LLM,
                    config={"model": "llama3", "provider": "ollama"},
                    position={"x": 740, "y": 200},
                ),
                WorkflowNode(
                    id="n5",
                    name="Cryptographic Seal",
                    type=WorkflowNodeType.END,
                    outputs=["sealed_response", "provenance"],
                    position={"x": 970, "y": 200},
                ),
            ],
            edges=[
                WorkflowEdge(id="e1-2", source="n1", target="n2"),
                WorkflowEdge(id="e2-3", source="n2", target="n3"),
                WorkflowEdge(id="e3-4", source="n3", target="n4"),
                WorkflowEdge(id="e4-5", source="n4", target="n5"),
            ],
            metadata={"system_reference": True},
        )
        analyzer = WorkflowSecurityAnalyzer()
        tactical_wf.security_analysis = analyzer.analyze(tactical_wf)
        self._workflows[tactical_wf.id] = tactical_wf

    def get(self, workflow_id: str) -> Optional[Workflow]:
        return self._workflows.get(workflow_id)

    def list_all(self) -> List[Workflow]:
        return list(self._workflows.values())

    def save(self, workflow: Workflow) -> Workflow:
        """Save or overwrite a workflow, validating and maintaining security state."""
        analyzer = WorkflowSecurityAnalyzer()
        sanitized = analyzer.enforce_sovereign_policy(workflow)
        sanitized.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        sanitized.security_analysis = analyzer.analyze(sanitized)

        # Retain state consistency
        if not sanitized.security_analysis.is_safe:
            sanitized.state = WorkflowState.INVALID
        elif sanitized.approval_status == "APPROVED":
            sanitized.state = WorkflowState.READY
        elif sanitized.state not in (WorkflowState.READY, WorkflowState.RUNNING):
            sanitized.state = sanitized.security_analysis.state

        self._workflows[sanitized.id] = sanitized
        return sanitized

    def save_version(self, workflow: Workflow, bump: str = "patch") -> Workflow:
        """Bump semantic version string and persist."""
        parts = workflow.version.split(".")
        try:
            major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
        except Exception:
            major, minor, patch = 1, 0, 0

        if bump == "major":
            major += 1
            minor = 0
            patch = 0
        elif bump == "minor":
            minor += 1
            patch = 0
        else:
            patch += 1

        updated = workflow.model_copy(deep=True)
        updated.version = f"{major}.{minor}.{patch}"
        return self.save(updated)

    def approve(self, workflow_id: str, operator_name: str = "sovereign-operator") -> Optional[Workflow]:
        """Grant human approval for an untrusted or approval-required workflow."""
        wf = self._workflows.get(workflow_id)
        if not wf:
            return None

        analyzer = WorkflowSecurityAnalyzer()
        report = analyzer.analyze(wf)
        if not report.is_safe:
            raise ValueError("Cannot approve an INVALID or insecure workflow. Resolve critical security findings first.")

        wf.approval_status = "APPROVED"
        wf.approved_by = operator_name
        wf.approved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        wf.state = WorkflowState.READY
        wf.updated_at = wf.approved_at
        self._workflows[workflow_id] = wf
        return wf

    def delete(self, workflow_id: str) -> bool:
        if workflow_id in self._workflows:
            del self._workflows[workflow_id]
            return True
        return False
