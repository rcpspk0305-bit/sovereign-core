"""Deterministic static security analyzer and policy enforcer for workflows."""

from collections import defaultdict, deque
import re
from typing import Any, Dict, List, Set

from app.core.workflows.models import (
    FindingSeverity,
    SecurityAnalysisReport,
    SecurityFinding,
    Workflow,
    WorkflowNodeType,
    WorkflowPolicy,
    WorkflowState,
)


class SecurityValidationError(Exception):
    """Raised when a workflow violates non-negotiable security boundaries."""
    pass


# Targeted high-risk patterns for static scanning
SHELL_PATTERNS = [
    re.compile(r"\b(bash|sh|zsh|csh|tcsh|powershell|cmd\.exe)\b", re.IGNORECASE),
    re.compile(r"\b(os\.system|subprocess\.(Popen|run|call)|posix\.system)\b", re.IGNORECASE),
    re.compile(r"(\||;|&&|`|\$\().*\b(rm|cat|nc|curl|wget|sh|bash)\b", re.IGNORECASE),
]

CODE_EXEC_PATTERNS = [
    re.compile(r"\b(eval|exec|compile|__import__|importlib)\s*\(", re.IGNORECASE),
    re.compile(r"\b(Function\(|setTimeout\(|setInterval\()\b", re.IGNORECASE),
    re.compile(r"\bimport\s+(os|sys|subprocess|socket|requests|urllib)\b", re.IGNORECASE),
]

EGRESS_PATTERNS = [
    re.compile(r"https?://(?!localhost|127\.0\.0\.1|host\.docker\.internal)[^\s'\"]+", re.IGNORECASE),
    re.compile(r"\b(curl|wget|fetch|axios|requests\.(get|post|put|delete))\b", re.IGNORECASE),
    re.compile(r"\b(\d{1,3}\.){3}\d{1,3}(?!:0)\b"),  # Raw external IPv4
]

FS_ESCAPE_PATTERNS = [
    re.compile(r"\.\./|\.\.\\", re.IGNORECASE),
    re.compile(r"(/etc/|/var/|/root/|C:\\Windows|C:\\Users)", re.IGNORECASE),
    re.compile(r"(\.ssh|\.aws|\.env|\.gnupg)", re.IGNORECASE),
]

INJECTION_PATTERNS = [
    re.compile(r"__class__|__mro__|__subclasses__|__globals__", re.IGNORECASE),
    re.compile(r"\{\{.*(__|import|os\.).*\}\}", re.IGNORECASE),
    re.compile(r"\$\{.*\}", re.IGNORECASE),
]


class WorkflowSecurityAnalyzer:
    """Air-gapped static security inspection engine for workflows."""

    def __init__(self, base_policy: WorkflowPolicy | None = None) -> None:
        self.base_policy = base_policy or WorkflowPolicy()

    def analyze(self, workflow: Workflow) -> SecurityAnalysisReport:
        """Analyze a workflow for security risks, structural validity, and policy adherence."""
        findings: List[SecurityFinding] = []

        # 1. Structural / Topological Validation
        self._validate_topology(workflow, findings)

        # 2. Deep Content & Parameter Inspection
        self._inspect_nodes_and_configs(workflow, findings)

        # 3. Policy & Resource Checks
        self._check_policy_compliance(workflow, findings)

        # Calculate risk score and determine state
        has_critical = any(f.severity == FindingSeverity.CRITICAL for f in findings)
        has_high = any(f.severity == FindingSeverity.HIGH for f in findings)
        has_medium = any(f.severity == FindingSeverity.MEDIUM for f in findings)

        if has_critical:
            risk_score = 1.0
            is_safe = False
            state = WorkflowState.INVALID
            requires_approval = True
        elif has_high:
            risk_score = 0.8
            is_safe = False
            state = WorkflowState.INVALID
            requires_approval = True
        elif has_medium:
            risk_score = 0.4
            is_safe = True
            state = WorkflowState.APPROVAL_REQUIRED
            requires_approval = True
        else:
            risk_score = 0.0
            is_safe = True
            # Imported workflows require user review/approval even if structurally clean
            if workflow.metadata.get("imported", False) or workflow.state == WorkflowState.APPROVAL_REQUIRED:
                state = WorkflowState.APPROVAL_REQUIRED
                requires_approval = True
            else:
                state = WorkflowState.VALID if workflow.state != WorkflowState.READY else WorkflowState.READY
                requires_approval = False

        return SecurityAnalysisReport(
            is_safe=is_safe,
            state=state,
            risk_score=risk_score,
            requires_approval=requires_approval,
            findings=findings,
        )

    def enforce_sovereign_policy(self, workflow: Workflow) -> Workflow:
        """Enforce immutable baseline Sovereign-Core policy constraints.
        
        External metadata can NEVER weaken air-gap or inflate resource quotas.
        """
        sanitized = workflow.model_copy(deep=True)
        sanitized.policy.no_egress = True  # Non-negotiable air-gap
        sanitized.policy.max_steps = min(sanitized.policy.max_steps, self.base_policy.max_steps)
        sanitized.policy.requires_approval = True

        # Tool allowlist must be a subset of Sovereign-Core allowlisted tools
        allowed_tools = set(self.base_policy.tool_allowlist)
        sanitized.policy.tool_allowlist = [
            tool for tool in sanitized.policy.tool_allowlist if tool in allowed_tools
        ]
        if not sanitized.policy.tool_allowlist:
            sanitized.policy.tool_allowlist = list(self.base_policy.tool_allowlist)

        return sanitized

    def _validate_topology(self, workflow: Workflow, findings: List[SecurityFinding]) -> None:
        """Ensure DAG correctness, START node presence, and END node reachability."""
        if not workflow.nodes:
            findings.append(
                SecurityFinding(
                    severity=FindingSeverity.CRITICAL,
                    message="Workflow contains zero nodes.",
                    rule_violated="TOPOLOGY_EMPTY",
                )
            )
            return

        node_ids = {n.id for n in workflow.nodes}
        if len(node_ids) != len(workflow.nodes):
            findings.append(
                SecurityFinding(
                    severity=FindingSeverity.CRITICAL,
                    message="Duplicate node IDs detected in workflow graph.",
                    rule_violated="TOPOLOGY_DUPLICATE_IDS",
                )
            )

        start_nodes = [n for n in workflow.nodes if n.type == WorkflowNodeType.START]
        end_nodes = [n for n in workflow.nodes if n.type == WorkflowNodeType.END]

        if not start_nodes:
            findings.append(
                SecurityFinding(
                    severity=FindingSeverity.CRITICAL,
                    message="Workflow missing required START node.",
                    rule_violated="TOPOLOGY_NO_START",
                )
            )

        if not end_nodes:
            findings.append(
                SecurityFinding(
                    severity=FindingSeverity.CRITICAL,
                    message="Workflow missing required END node.",
                    rule_violated="TOPOLOGY_NO_END",
                )
            )

        # In-degree & Out-degree checking + Cycle detection
        in_degree: Dict[str, int] = {node_id: 0 for node_id in node_ids}
        adj: Dict[str, List[str]] = defaultdict(list)

        for edge in workflow.edges:
            if edge.source not in node_ids:
                findings.append(
                    SecurityFinding(
                        severity=FindingSeverity.CRITICAL,
                        message=f"Edge references unknown source node: '{edge.source}'",
                        rule_violated="TOPOLOGY_UNKNOWN_SOURCE",
                        node_id=edge.source,
                    )
                )
                continue
            if edge.target not in node_ids:
                findings.append(
                    SecurityFinding(
                        severity=FindingSeverity.CRITICAL,
                        message=f"Edge references unknown target node: '{edge.target}'",
                        rule_violated="TOPOLOGY_UNKNOWN_TARGET",
                        node_id=edge.target,
                    )
                )
                continue

            adj[edge.source].append(edge.target)
            in_degree[edge.target] += 1

        # Kahn's algorithm for cycles
        queue = deque([n_id for n_id, deg in in_degree.items() if deg == 0])
        visited_count = 0

        while queue:
            curr = queue.popleft()
            visited_count += 1
            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited_count != len(node_ids):
            findings.append(
                SecurityFinding(
                    severity=FindingSeverity.CRITICAL,
                    message="Cycle detected in directed workflow graph.",
                    rule_violated="TOPOLOGY_CYCLE_DETECTED",
                )
            )

    def _inspect_nodes_and_configs(self, workflow: Workflow, findings: List[SecurityFinding]) -> None:
        """Deep scan for dangerous code, command execution, egress, and unknown tools."""
        for node in workflow.nodes:
            # Flatten node fields for text scanning
            text_blobs = self._extract_text_blobs(node.config)
            text_blobs.append(node.name)

            for text in text_blobs:
                # 1. Shell detection
                for pat in SHELL_PATTERNS:
                    if pat.search(text):
                        findings.append(
                            SecurityFinding(
                                severity=FindingSeverity.CRITICAL,
                                message=f"Arbitrary shell command detected in node '{node.id}': '{text[:80]}'",
                                rule_violated="SECURITY_ARBITRARY_SHELL",
                                node_id=node.id,
                            )
                        )
                        break

                # 2. Arbitrary code execution
                for pat in CODE_EXEC_PATTERNS:
                    if pat.search(text):
                        findings.append(
                            SecurityFinding(
                                severity=FindingSeverity.CRITICAL,
                                message=f"Arbitrary code execution pattern detected in node '{node.id}': '{text[:80]}'",
                                rule_violated="SECURITY_CODE_EXECUTION",
                                node_id=node.id,
                            )
                        )
                        break

                # 3. Unrestricted HTTP / Egress
                for pat in EGRESS_PATTERNS:
                    if pat.search(text):
                        findings.append(
                            SecurityFinding(
                                severity=FindingSeverity.CRITICAL,
                                message=f"Unrestricted HTTP / network egress detected in node '{node.id}': '{text[:80]}'",
                                rule_violated="SECURITY_EGRESS_VIOLATION",
                                node_id=node.id,
                            )
                        )
                        break

                # 4. Filesystem escape
                for pat in FS_ESCAPE_PATTERNS:
                    if pat.search(text):
                        findings.append(
                            SecurityFinding(
                                severity=FindingSeverity.HIGH,
                                message=f"Filesystem escape or traversal detected in node '{node.id}': '{text[:80]}'",
                                rule_violated="SECURITY_FS_ESCAPE",
                                node_id=node.id,
                            )
                        )
                        break

                # 5. Template injection / unsafe expressions
                for pat in INJECTION_PATTERNS:
                    if pat.search(text):
                        findings.append(
                            SecurityFinding(
                                severity=FindingSeverity.HIGH,
                                message=f"Unsafe template or expression detected in node '{node.id}': '{text[:80]}'",
                                rule_violated="SECURITY_UNSAFE_EXPRESSION",
                                node_id=node.id,
                            )
                        )
                        break

            # 6. Tool allowlist enforcement
            if node.type == WorkflowNodeType.TOOL:
                tool_name = node.config.get("tool_name") or node.config.get("tool") or node.name
                allowlist = workflow.policy.tool_allowlist or self.base_policy.tool_allowlist
                if tool_name not in allowlist:
                    findings.append(
                        SecurityFinding(
                            severity=FindingSeverity.HIGH,
                            message=f"Unknown or unallowlisted tool '{tool_name}' in node '{node.id}'.",
                            rule_violated="SECURITY_UNKNOWN_TOOL",
                            node_id=node.id,
                        )
                    )

            # 7. Model provider check
            if node.type in (WorkflowNodeType.LLM, WorkflowNodeType.AGENT):
                provider = node.config.get("provider", "local").lower()
                allowed_providers = [p.lower() for p in workflow.policy.allowed_providers]
                if provider not in allowed_providers and not any(p in provider for p in allowed_providers):
                    findings.append(
                        SecurityFinding(
                            severity=FindingSeverity.HIGH,
                            message=f"Disallowed model provider '{provider}' in node '{node.id}'. Enforcing air-gapped local model.",
                            rule_violated="SECURITY_UNKNOWN_PROVIDER",
                            node_id=node.id,
                        )
                    )

    def _check_policy_compliance(self, workflow: Workflow, findings: List[SecurityFinding]) -> None:
        """Validate step budget, condition syntax, and metadata."""
        if len(workflow.nodes) > workflow.policy.max_steps:
            findings.append(
                SecurityFinding(
                    severity=FindingSeverity.HIGH,
                    message=f"Workflow node count ({len(workflow.nodes)}) exceeds policy max_steps budget ({workflow.policy.max_steps}).",
                    rule_violated="POLICY_STEP_BUDGET_EXCEEDED",
                )
            )

        # Validate edge conditions
        for edge in workflow.edges:
            if edge.condition:
                for pat in CODE_EXEC_PATTERNS + SHELL_PATTERNS:
                    if pat.search(edge.condition):
                        findings.append(
                            SecurityFinding(
                                severity=FindingSeverity.CRITICAL,
                                message=f"Unsafe condition expression on edge '{edge.id}': '{edge.condition}'",
                                rule_violated="SECURITY_UNSAFE_CONDITION",
                            )
                        )

    def _extract_text_blobs(self, data: Any) -> List[str]:
        """Recursively extract all string values from configuration dictionaries/lists."""
        strings: List[str] = []
        if isinstance(data, str):
            strings.append(data)
        elif isinstance(data, dict):
            for k, v in data.items():
                strings.append(str(k))
                strings.extend(self._extract_text_blobs(v))
        elif isinstance(data, (list, tuple, set)):
            for item in data:
                strings.extend(self._extract_text_blobs(item))
        return strings
