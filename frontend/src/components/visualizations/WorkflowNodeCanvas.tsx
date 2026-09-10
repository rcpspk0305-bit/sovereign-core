'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Cpu,
  Database,
  Download,
  FileCode,
  FileSearch,
  FileText,
  Link2,
  Loader2,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';

import {
  CanonicalNodeType,
  CanonicalWorkflow,
  CanonicalWorkflowEdge,
  CanonicalWorkflowNode,
  CanonicalWorkflowState,
  SecurityAnalysisReport,
  SecurityFinding,
} from '@/lib/types';
import { api } from '@/lib/api-client';

const NODE_TYPE_META: Record<
  CanonicalNodeType,
  { label: string; role: string; icon: React.ReactNode; color: string; glow: string }
> = {
  START: {
    label: 'Mission Trigger',
    role: 'Air-Gapped Directive Intake',
    icon: <Radio size={16} />,
    color: '#00d2ff',
    glow: 'rgba(0, 210, 255, 0.4)',
  },
  RAG: {
    label: 'Vector Retrieval',
    role: 'Air-Gapped ChromaDB Evidence',
    icon: <Database size={16} />,
    color: '#00c896',
    glow: 'rgba(0, 200, 150, 0.4)',
  },
  TOOL: {
    label: 'Allowlisted Tool',
    role: 'Sandboxed Tool Execution',
    icon: <FileSearch size={16} />,
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.4)',
  },
  LLM: {
    label: 'Local LLM Inference',
    role: 'Air-Gapped Ollama Synthesis',
    icon: <Brain size={16} />,
    color: '#8b72ff',
    glow: 'rgba(139, 114, 255, 0.4)',
  },
  AGENT: {
    label: 'Autonomous Agent',
    role: 'LangGraph Reasoning Subsystem',
    icon: <Bot size={16} />,
    color: '#d4a843',
    glow: 'rgba(212, 168, 67, 0.4)',
  },
  CONDITION: {
    label: 'Deterministic Gate',
    role: 'Branch Condition Evaluator',
    icon: <Compass size={16} />,
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  APPROVAL: {
    label: 'Human Sign-off',
    role: 'Mandatory Operator Review',
    icon: <ShieldAlert size={16} />,
    color: '#ec4899',
    glow: 'rgba(236, 72, 153, 0.4)',
  },
  END: {
    label: 'Cryptographic Seal',
    role: 'SHA-256 Attested Output',
    icon: <ShieldCheck size={16} />,
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
};

const DEFAULT_WORKFLOW: CanonicalWorkflow = {
  id: 'tactical_inspection_wf',
  name: 'Tactical Air-Gapped Document Inspection',
  version: '1.0.0',
  description: 'Deterministic pipeline querying local vectors and synthesizing verified findings.',
  state: 'READY',
  approval_status: 'APPROVED',
  policy: {
    no_egress: true,
    tool_allowlist: ['document_retrieval', 'calculator', 'system_info', 'approval_note'],
    max_steps: 20,
    requires_approval: true,
  },
  nodes: [
    {
      id: 'n1',
      name: 'Directive Intake',
      type: 'START',
      config: {},
      inputs: ['directive', 'session_id'],
      position: { x: 50, y: 100 },
      status: 'idle',
    },
    {
      id: 'n2',
      name: 'Vector Spec Search',
      type: 'RAG',
      config: { top_k: 3, collection: 'system_specs' },
      position: { x: 280, y: 100 },
      status: 'idle',
    },
    {
      id: 'n3',
      name: 'System Diagnostics',
      type: 'TOOL',
      config: { tool_name: 'system_info' },
      position: { x: 510, y: 100 },
      status: 'idle',
    },
    {
      id: 'n4',
      name: 'Local LLM Synthesis',
      type: 'LLM',
      config: { model: 'llama3', provider: 'ollama' },
      position: { x: 740, y: 100 },
      status: 'idle',
    },
    {
      id: 'n5',
      name: 'Cryptographic Seal',
      type: 'END',
      config: {},
      outputs: ['sealed_response', 'provenance'],
      position: { x: 970, y: 100 },
      status: 'idle',
    },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2', label: 'Start -> RAG' },
    { id: 'e2-3', source: 'n2', target: 'n3', label: 'RAG -> Tool' },
    { id: 'e3-4', source: 'n3', target: 'n4', label: 'Tool -> LLM' },
    { id: 'e4-5', source: 'n4', target: 'n5', label: 'LLM -> Seal' },
  ],
};

export default function WorkflowNodeCanvas() {
  const [workflow, setWorkflow] = useState<CanonicalWorkflow>(DEFAULT_WORKFLOW);
  const [activeNodeId, setActiveNodeId] = useState<string>('n1');
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<SecurityAnalysisReport | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importFormat, setImportFormat] = useState<'auto' | 'dify' | 'sovereign'>('auto');
  const [exportFormat, setExportFormat] = useState<'sovereign' | 'dify'>('sovereign');
  const [exportJson, setExportJson] = useState<string>('');
  const [showAddEdgeModal, setShowAddEdgeModal] = useState<boolean>(false);
  const [newEdgeSource, setNewEdgeSource] = useState<string>('');
  const [newEdgeTarget, setNewEdgeTarget] = useState<string>('');
  const [newEdgeCondition, setNewEdgeCondition] = useState<string>('');

  // Load workflows on mount from backend
  useEffect(() => {
    async function loadInitial() {
      try {
        const list = await api.listWorkflows();
        if (list && list.length > 0) {
          setWorkflow(list[0]);
          if (list[0].nodes.length > 0) {
            setActiveNodeId(list[0].nodes[0].id);
          }
        }
      } catch (err) {
        // Fallback to offline default workflow
        console.warn('Backend offline, using default workflow', err);
      }
    }
    loadInitial();
  }, []);

  const selectedNode = workflow.nodes.find((n) => n.id === activeNodeId) || workflow.nodes[0] || null;

  const showNotice = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Validate workflow
  const handleValidate = async () => {
    try {
      const report = await api.validateWorkflow(workflow);
      setValidationReport(report);
      setWorkflow((prev) => ({
        ...prev,
        state: report.state,
        security_analysis: report,
      }));
      if (report.is_safe) {
        showNotice(`Workflow verified valid. Risk score: ${report.risk_score}`, 'success');
      } else {
        showNotice(`Security validation flagged ${report.findings.length} findings!`, 'error');
      }
    } catch (e: any) {
      showNotice(e.message || 'Validation failed', 'error');
    }
  };

  // Save & bump version
  const handleSave = async (bump?: 'patch' | 'minor' | 'major') => {
    try {
      const saved = await api.saveWorkflow(workflow, bump);
      setWorkflow(saved);
      showNotice(`Workflow saved as v${saved.version} [${saved.state}]`, 'success');
    } catch (e: any) {
      showNotice(e.message || 'Failed to save workflow', 'error');
    }
  };

  // Approve workflow
  const handleApprove = async () => {
    try {
      const approved = await api.approveWorkflow(workflow.id, 'sovereign-operator', 'Operator reviewed & approved.');
      setWorkflow(approved);
      showNotice('Workflow approved and marked READY for air-gapped execution.', 'success');
    } catch (e: any) {
      showNotice(e.message || 'Approval failed', 'error');
    }
  };

  // Run pipeline
  const handleRun = async () => {
    if (isRunningPipeline) return;
    setIsRunningPipeline(true);
    setWorkflow((prev) => ({ ...prev, state: 'RUNNING' }));

    // Reset node states
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => ({ ...n, status: 'idle' })),
    }));

    try {
      // Step simulation for visual progression
      for (let i = 0; i < workflow.nodes.length; i++) {
        const nid = workflow.nodes[i].id;
        setActiveNodeId(nid);
        setWorkflow((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n, idx) => {
            if (idx === i) return { ...n, status: 'running' };
            if (idx < i) return { ...n, status: 'completed' };
            return { ...n, status: 'idle' };
          }),
        }));
        await new Promise((r) => setTimeout(r, 450));
      }

      // Execute via backend runtime
      const res = await api.runWorkflow(workflow.id, { directive: 'Tactical air-gap diagnostic inspection' });
      setWorkflow((prev) => ({
        ...prev,
        state: res.state,
        nodes: prev.nodes.map((n) => ({ ...n, status: 'completed' })),
      }));
      showNotice(`Pipeline completed in ${res.total_latency_ms}ms (Flight ID: ${res.flight_record_id})`, 'success');
    } catch (err: any) {
      setWorkflow((prev) => ({
        ...prev,
        state: 'FAILED',
        nodes: prev.nodes.map((n) => (n.id === activeNodeId ? { ...n, status: 'failed' } : n)),
      }));
      showNotice(err.message || 'Pipeline execution failed', 'error');
    } finally {
      setIsRunningPipeline(false);
    }
  };

  // Add node
  const handleAddNode = (type: CanonicalNodeType) => {
    const newId = `node_${Date.now().toString().slice(-4)}`;
    const meta = NODE_TYPE_META[type];
    const newNode: CanonicalWorkflowNode = {
      id: newId,
      name: `${meta.label}`,
      type,
      config: type === 'LLM' ? { model: 'llama3', provider: 'ollama' } : type === 'TOOL' ? { tool_name: 'system_info' } : {},
      inputs: [],
      outputs: [],
      position: { x: 100, y: 100 },
      status: 'idle',
    };

    setWorkflow((prev) => {
      const updatedNodes = [...prev.nodes, newNode];
      // Automatically link to previous last node if exists
      let updatedEdges = [...prev.edges];
      if (prev.nodes.length > 0) {
        const lastNode = prev.nodes[prev.nodes.length - 1];
        updatedEdges.push({
          id: `e_${lastNode.id}_${newId}`,
          source: lastNode.id,
          target: newId,
        });
      }
      return {
        ...prev,
        nodes: updatedNodes,
        edges: updatedEdges,
        state: 'DRAFT',
      };
    });
    setActiveNodeId(newId);
    showNotice(`Added ${type} node: ${newNode.name}`, 'info');
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    if (workflow.nodes.length <= 1) {
      showNotice('Workflow must have at least one node.', 'error');
      return;
    }
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      state: 'DRAFT',
    }));
    const remaining = workflow.nodes.filter((n) => n.id !== nodeId);
    if (remaining.length > 0) setActiveNodeId(remaining[0].id);
    showNotice(`Node ${nodeId} deleted`, 'info');
  };

  // Move node order
  const handleMoveNode = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= workflow.nodes.length) return;
    const reordered = [...workflow.nodes];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setWorkflow((prev) => ({ ...prev, nodes: reordered, state: 'DRAFT' }));
  };

  // Connect edge
  const handleAddEdge = () => {
    if (!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget) {
      showNotice('Please select distinct source and target nodes.', 'error');
      return;
    }
    const edgeId = `e_${newEdgeSource}_${newEdgeTarget}`;
    if (workflow.edges.some((e) => e.source === newEdgeSource && e.target === newEdgeTarget)) {
      showNotice('Edge already exists between these nodes.', 'error');
      return;
    }
    const newEdge: CanonicalWorkflowEdge = {
      id: edgeId,
      source: newEdgeSource,
      target: newEdgeTarget,
      condition: newEdgeCondition || undefined,
    };
    setWorkflow((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
      state: 'DRAFT',
    }));
    setShowAddEdgeModal(false);
    setNewEdgeCondition('');
    showNotice(`Connected ${newEdgeSource} -> ${newEdgeTarget}`, 'success');
  };

  // Delete edge
  const handleDeleteEdge = (edgeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
      state: 'DRAFT',
    }));
  };

  // Import handler
  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    try {
      const parsed = JSON.parse(importText);
      const imported = await api.importWorkflow(parsed, importFormat);
      setWorkflow(imported);
      if (imported.nodes.length > 0) setActiveNodeId(imported.nodes[0].id);
      setShowImportModal(false);
      setImportText('');
      showNotice(`Successfully imported '${imported.name}'. State: APPROVAL REQUIRED`, 'success');
    } catch (e: any) {
      showNotice(e.message || 'Failed to import workflow', 'error');
    }
  };

  // Export handler
  const handleOpenExport = async (fmt: 'sovereign' | 'dify') => {
    setExportFormat(fmt);
    try {
      const exported = await api.exportWorkflow(workflow.id, fmt);
      setExportJson(JSON.stringify(exported, null, 2));
      setShowExportModal(true);
    } catch (e: any) {
      showNotice(e.message || 'Export failed', 'error');
    }
  };

  // State colors
  const getStateBadgeStyle = (state: CanonicalWorkflowState) => {
    switch (state) {
      case 'READY':
      case 'VALID':
      case 'COMPLETED':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.4)' };
      case 'APPROVAL REQUIRED':
        return { bg: 'rgba(212, 168, 67, 0.2)', text: '#f5cf68', border: 'rgba(212, 168, 67, 0.6)' };
      case 'RUNNING':
        return { bg: 'rgba(0, 210, 255, 0.2)', text: '#00d2ff', border: 'rgba(0, 210, 255, 0.5)' };
      case 'INVALID':
      case 'FAILED':
        return { bg: 'rgba(244, 63, 94, 0.2)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.5)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: '#94a3b8', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  const stateStyle = getStateBadgeStyle(workflow.state);

  return (
    <div className="sovereign-stage-container" style={{ position: 'relative' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            background: notification.type === 'error' ? 'rgba(244, 63, 94, 0.95)' : notification.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(18, 12, 45, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="sovereign-header-block">
        <div className="sovereign-header-left">
          <div className="sovereign-header-icon">
            <Zap size={22} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="sovereign-eyebrow-tag">
              <ShieldCheck size={12} className="text-emerald" />
              <span>SOVEREIGN WORKFLOW // DIFY INTEROPERABILITY LAYER</span>
            </div>
            <h1 className="sovereign-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{workflow.name}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--sov-text-secondary)',
                }}
              >
                v{workflow.version}
              </span>
            </h1>
            <p className="sovereign-subtitle">
              Portable, air-gapped deterministic workflow pipeline with fail-closed Dify DSL import/export adapters and AI Flight Recorder audit integration.
            </p>
          </div>
        </div>

        <div className="sovereign-header-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* State Indicator */}
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              background: stateStyle.bg,
              border: `1px solid ${stateStyle.border}`,
              color: stateStyle.text,
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stateStyle.text }} />
            <span>STATE: {workflow.state}</span>
          </div>

          {/* Validate Button */}
          <button
            onClick={handleValidate}
            className="sovereign-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer' }}
            title="Run topological and security policy validation"
          >
            <ShieldCheck size={14} className="text-cyan" />
            <span>Validate</span>
          </button>

          {/* Approve Button (when APPROVAL REQUIRED) */}
          {workflow.state === 'APPROVAL REQUIRED' && (
            <button
              onClick={handleApprove}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #d4a843, #f5cf68)',
                color: '#050212',
                border: 'none',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(212, 168, 67, 0.4)',
              }}
            >
              <Check size={14} />
              <span>Review & Approve</span>
            </button>
          )}

          {/* Save & Version */}
          <button
            onClick={() => handleSave('patch')}
            className="sovereign-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer' }}
            title="Save workflow and increment patch version"
          >
            <Save size={14} />
            <span>Save v{workflow.version}</span>
          </button>

          {/* Import Modal Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="sovereign-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer' }}
            title="Import workflow from Sovereign format or Dify DSL"
          >
            <Upload size={14} />
            <span>Import</span>
          </button>

          {/* Export Sovereign */}
          <button
            onClick={() => handleOpenExport('sovereign')}
            className="sovereign-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer' }}
            title="Export Sovereign format"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          {/* Export Dify */}
          <button
            onClick={() => handleOpenExport('dify')}
            className="sovereign-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer' }}
            title="Export Dify DSL format"
          >
            <FileCode size={14} />
            <span>Dify DSL</span>
          </button>

          {/* Run Pipeline Button */}
          <button
            onClick={handleRun}
            disabled={isRunningPipeline || workflow.state === 'APPROVAL REQUIRED' || workflow.state === 'INVALID'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9999px',
              background: isRunningPipeline || workflow.state === 'APPROVAL REQUIRED' || workflow.state === 'INVALID'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'linear-gradient(135deg, #00d2ff, #00c896)',
              border: 'none',
              color: isRunningPipeline ? 'rgba(255, 255, 255, 0.4)' : '#050212',
              fontWeight: 800,
              fontSize: '12px',
              cursor: isRunningPipeline || workflow.state === 'APPROVAL REQUIRED' || workflow.state === 'INVALID' ? 'not-allowed' : 'pointer',
              boxShadow: isRunningPipeline ? 'none' : '0 0 24px rgba(0, 210, 255, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {isRunningPipeline ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{isRunningPipeline ? 'Executing...' : 'Run Pipeline'}</span>
          </button>
        </div>
      </header>

      {/* Security Findings Alert Banner */}
      {validationReport && validationReport.findings.length > 0 && (
        <div
          style={{
            margin: '0 0 20px',
            padding: '16px 20px',
            borderRadius: '12px',
            background: validationReport.is_safe ? 'rgba(212, 168, 67, 0.1)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${validationReport.is_safe ? 'rgba(212, 168, 67, 0.3)' : 'rgba(244, 63, 94, 0.4)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={18} color={validationReport.is_safe ? '#f5cf68' : '#f43f5e'} />
            <span style={{ fontWeight: 800, fontSize: '13px', color: validationReport.is_safe ? '#f5cf68' : '#f43f5e' }}>
              Security Analysis Report ({validationReport.findings.length} findings) — Status: {validationReport.state}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {validationReport.findings.map((f, i) => (
              <div key={i} style={{ fontSize: '12px', color: 'var(--sov-text-secondary)', display: 'flex', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: f.severity === 'CRITICAL' ? '#f43f5e' : '#f5cf68' }}>
                  [{f.severity}]
                </span>
                <span>{f.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace: Visual Stage + Inspector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left: Interactive Living Pipeline Canvas */}
        <div
          className="sovereign-glass-panel"
          style={{
            padding: '28px',
            position: 'relative',
            minHeight: '620px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Canvas Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--sov-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Pipeline Sequence ({workflow.nodes.length} Nodes)
              </span>
            </div>

            {/* Quick Add Node Dropdown / Buttons */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['START', 'RAG', 'TOOL', 'LLM', 'AGENT', 'CONDITION', 'APPROVAL', 'END'] as CanonicalNodeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleAddNode(t)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: NODE_TYPE_META[t].color,
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`Add ${t} node`}
                >
                  <Plus size={10} />
                  <span>{t}</span>
                </button>
              ))}
              <button
                onClick={() => setShowAddEdgeModal(true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(0, 210, 255, 0.1)',
                  border: '1px solid rgba(0, 210, 255, 0.3)',
                  color: 'var(--sov-cyan)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Link2 size={11} />
                <span>Connect</span>
              </button>
            </div>
          </div>

          {/* Visual Node List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
            {workflow.nodes.map((node, idx) => {
              const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.TOOL;
              const isSelected = selectedNode?.id === node.id;
              const isRunning = node.status === 'running';
              const isCompleted = node.status === 'completed';
              const isFailed = node.status === 'failed';

              // Inbound and outbound edges
              const outboundEdges = workflow.edges.filter((e) => e.source === node.id);

              return (
                <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    onClick={() => setActiveNodeId(node.id)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      cursor: 'pointer',
                      padding: '12px 18px',
                      borderRadius: '12px',
                      background: isSelected
                        ? 'radial-gradient(circle at center, rgba(22, 14, 52, 0.95), rgba(10, 6, 28, 0.9))'
                        : isRunning
                        ? 'rgba(0, 210, 255, 0.12)'
                        : 'rgba(8, 4, 22, 0.7)',
                      border: isSelected
                        ? `1px solid ${meta.color}`
                        : isRunning
                        ? '1px solid var(--sov-cyan)'
                        : isFailed
                        ? '1px solid #f43f5e'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: isSelected
                        ? `0 0 24px ${meta.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                        : isRunning
                        ? '0 0 20px rgba(0, 210, 255, 0.3)'
                        : 'none',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: isSelected || isRunning ? 'translateX(6px)' : 'translateX(0)',
                    }}
                  >
                    {/* Node Type Glyph */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: isRunning ? meta.color : isCompleted ? '#10b981' : 'rgba(255, 255, 255, 0.06)',
                        color: isRunning ? '#050212' : meta.color,
                        border: `1px solid ${meta.color}`,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isRunning ? <Loader2 size={16} className="animate-spin text-dark" /> : meta.icon}
                    </div>

                    {/* Node Label & Subtext */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>{node.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: meta.color, fontWeight: 700 }}>
                          [{node.type}]
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--sov-text-muted)' }}>
                          id: {node.id}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--sov-text-secondary)' }}>
                        {node.type === 'LLM' && `Model: ${node.config.model || 'llama3'}`}
                        {node.type === 'TOOL' && `Tool: ${node.config.tool_name || 'system_info'}`}
                        {node.type === 'RAG' && `Top-K: ${node.config.top_k || 3}`}
                        {node.type === 'CONDITION' && `Condition: ${node.config.expression || 'true'}`}
                        {node.type === 'START' && 'Ingests mission directive & context'}
                        {node.type === 'APPROVAL' && 'Mandatory Human Sign-off'}
                        {node.type === 'END' && 'Cryptographic Seal & Provenance Envelope'}
                        {node.type === 'AGENT' && 'Controlled LangGraph Orchestration'}
                      </span>
                    </div>

                    {/* Reordering and Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveNode(idx, 'up');
                        }}
                        disabled={idx === 0}
                        style={{ background: 'none', border: 'none', color: 'var(--sov-text-muted)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '12px' }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveNode(idx, 'down');
                        }}
                        disabled={idx === workflow.nodes.length - 1}
                        style={{ background: 'none', border: 'none', color: 'var(--sov-text-muted)', cursor: idx === workflow.nodes.length - 1 ? 'default' : 'pointer', fontSize: '12px' }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(244, 63, 94, 0.7)', cursor: 'pointer', padding: '4px' }}
                        title="Delete Node"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Outbound Edge Connector visualization */}
                  {outboundEdges.map((edge) => (
                    <div
                      key={edge.id}
                      style={{
                        paddingLeft: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--sov-text-muted)',
                      }}
                    >
                      <ArrowRight size={12} className="text-cyan" />
                      <span>Connects to <strong>{edge.target}</strong></span>
                      {edge.condition && (
                        <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                          when: {edge.condition}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteEdge(edge.id)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer' }}
                        title="Remove Edge"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Node Inspector & Configuration Drawer */}
        <div className="sovereign-glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={16} className="text-gold" />
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Node Inspector</span>
            </div>
            {selectedNode && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: NODE_TYPE_META[selectedNode.type]?.color }}>
                {selectedNode.type}
              </span>
            )}
          </div>

          {selectedNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Node ID & Name */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Node Name</label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setWorkflow((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, name: newName } : n)),
                      state: 'DRAFT',
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '13px',
                    marginTop: '4px',
                  }}
                />
              </div>

              {/* Node Type Selector */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Node Type</label>
                <select
                  value={selectedNode.type}
                  onChange={(e) => {
                    const newType = e.target.value as CanonicalNodeType;
                    setWorkflow((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, type: newType } : n)),
                      state: 'DRAFT',
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(18, 12, 45, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '13px',
                    marginTop: '4px',
                  }}
                >
                  {(['START', 'RAG', 'TOOL', 'LLM', 'AGENT', 'CONDITION', 'APPROVAL', 'END'] as CanonicalNodeType[]).map((t) => (
                    <option key={t} value={t}>
                      {t} - {NODE_TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Node Specific Configs */}
              {selectedNode.type === 'LLM' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Local LLM Model</label>
                  <input
                    type="text"
                    value={selectedNode.config.model || 'llama3'}
                    onChange={(e) => {
                      const model = e.target.value;
                      setWorkflow((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, config: { ...n.config, model } } : n)),
                        state: 'DRAFT',
                      }));
                    }}
                    placeholder="llama3, gemma, deepseek"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '13px',
                      marginTop: '4px',
                    }}
                  />
                </div>
              )}

              {selectedNode.type === 'TOOL' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Allowlisted Tool Name</label>
                  <select
                    value={selectedNode.config.tool_name || 'system_info'}
                    onChange={(e) => {
                      const tool_name = e.target.value;
                      setWorkflow((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, config: { ...n.config, tool_name } } : n)),
                        state: 'DRAFT',
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(18, 12, 45, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '13px',
                      marginTop: '4px',
                    }}
                  >
                    <option value="system_info">system_info (Local OS Diagnostics)</option>
                    <option value="calculator">calculator (Deterministic AST Math)</option>
                    <option value="document_retrieval">document_retrieval (ChromaDB RAG)</option>
                    <option value="document_generation">document_generation (Local Report)</option>
                    <option value="approval_note">approval_note (Cryptographic Signoff)</option>
                  </select>
                </div>
              )}

              {selectedNode.type === 'RAG' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Top-K Chunks</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={selectedNode.config.top_k || 3}
                    onChange={(e) => {
                      const top_k = parseInt(e.target.value) || 3;
                      setWorkflow((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, config: { ...n.config, top_k } } : n)),
                        state: 'DRAFT',
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '13px',
                      marginTop: '4px',
                    }}
                  />
                </div>
              )}

              {selectedNode.type === 'CONDITION' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Branch Condition</label>
                  <input
                    type="text"
                    value={selectedNode.config.expression || 'true'}
                    onChange={(e) => {
                      const expression = e.target.value;
                      setWorkflow((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, config: { ...n.config, expression } } : n)),
                        state: 'DRAFT',
                      }));
                    }}
                    placeholder="e.g. status == 'success'"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '13px',
                      marginTop: '4px',
                    }}
                  />
                </div>
              )}

              {/* Policy Indicator */}
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--sov-text-muted)', marginBottom: '4px' }}>AIR-GAP POLICY INHERITANCE</div>
                <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={13} />
                  <span>NO_EGRESS Enforced (Local-Only)</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sov-text-secondary)', marginTop: '4px' }}>
                  Step Budget: {workflow.policy.max_steps} max steps
                </div>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--sov-text-muted)' }}>No node selected.</span>
          )}
        </div>
      </div>

      {/* Connect Nodes Modal */}
      {showAddEdgeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div className="sovereign-glass-panel" style={{ width: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Connect Workflow Nodes</h3>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700 }}>Source Node</label>
              <select
                value={newEdgeSource}
                onChange={(e) => setNewEdgeSource(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(18, 12, 45, 0.9)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '4px' }}
              >
                <option value="">-- Select Source --</option>
                {workflow.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700 }}>Target Node</label>
              <select
                value={newEdgeTarget}
                onChange={(e) => setNewEdgeTarget(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(18, 12, 45, 0.9)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '4px' }}
              >
                <option value="">-- Select Target --</option>
                {workflow.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--sov-text-muted)', fontWeight: 700 }}>Condition (Optional)</label>
              <input
                type="text"
                placeholder="e.g. status == 'completed'"
                value={newEdgeCondition}
                onChange={(e) => setNewEdgeCondition(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setShowAddEdgeModal(false)} className="sovereign-btn-secondary" style={{ padding: '6px 14px', borderRadius: '6px' }}>
                Cancel
              </button>
              <button onClick={handleAddEdge} style={{ padding: '6px 16px', borderRadius: '6px', background: 'var(--sov-cyan)', border: 'none', color: '#050212', fontWeight: 800 }}>
                Add Edge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div className="sovereign-glass-panel" style={{ width: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} className="text-cyan" />
                <span>Import Workflow (Untrusted Entrypoint)</span>
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['auto', 'dify', 'sovereign'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setImportFormat(fmt)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: importFormat === fmt ? 'var(--sov-cyan)' : 'rgba(255, 255, 255, 0.05)',
                      color: importFormat === fmt ? '#050212' : '#94a3b8',
                      border: 'none',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--sov-text-secondary)', margin: 0 }}>
              Paste Sovereign workflow JSON or Dify DSL format below. Imported workflows are untrusted and automatically gated under <strong>APPROVAL REQUIRED</strong>.
            </p>

            <textarea
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste workflow JSON here..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#38bdf8',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowImportModal(false)} className="sovereign-btn-secondary" style={{ padding: '6px 14px', borderRadius: '6px' }}>
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                style={{
                  padding: '6px 18px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #00d2ff, #00c896)',
                  border: 'none',
                  color: '#050212',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Import & Analyze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div className="sovereign-glass-panel" style={{ width: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={18} className="text-cyan" />
                <span>Export Workflow ({exportFormat.toUpperCase()})</span>
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportJson);
                  showNotice('Copied export payload to clipboard!', 'success');
                }}
                className="sovereign-btn-secondary"
                style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Copy size={12} />
                <span>Copy JSON</span>
              </button>
            </div>

            <textarea
              rows={14}
              readOnly
              value={exportJson}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#a78bfa',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowExportModal(false)} className="sovereign-btn-secondary" style={{ padding: '6px 14px', borderRadius: '6px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
