'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  FileSearch,
  Loader2,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  label?: string;
}

interface WorkflowNode {
  id: string;
  stepNumber: number;
  label: string;
  role: string;
  type: 'trigger' | 'router' | 'agent' | 'retrieval' | 'eval' | 'model' | 'seal' | 'tool';
  tool?: string;
  agent?: string;
  input?: string;
  output?: string;
  condition?: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  latencyMs: number;
  schema: string;
}

const INITIAL_EDGES: WorkflowEdge[] = [
  { id: 'e1-2', source: 'n1', target: 'n2', condition: 'task.valid == true', label: 'Intake -> Planner' },
  { id: 'e2-3', source: 'n2', target: 'n3', condition: 'requires_tools == true', label: 'Planner -> Routing' },
  { id: 'e3-4', source: 'n3', target: 'n4', condition: 'tool == "document_retrieval"', label: 'ChromaDB Query' },
  { id: 'e3-5', source: 'n3', target: 'n5', condition: 'tool == "calculator"', label: 'Safe Calculator' },
  { id: 'e4-6', source: 'n4', target: 'n6', condition: 'evidence.collected == true', label: 'Evidence -> Verifier' },
  { id: 'e5-6', source: 'n5', target: 'n6', condition: 'calc.completed == true', label: 'Result -> Verifier' },
  { id: 'e6-7', source: 'n6', target: 'n7', condition: 'approval_required == false', label: 'Verified -> Signed Seal' },
];

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: 'n1',
    stepNumber: 1,
    label: 'Mission Trigger',
    role: 'Air-Gapped Directive Intake',
    type: 'trigger',
    agent: 'IntakeSentinel',
    input: 'directive: string, session_id: string',
    output: 'validated_mission: MissionContext',
    condition: 'directive.trim().length > 0',
    icon: <Radio size={16} />,
    color: '#00d2ff',
    glow: 'rgba(0, 210, 255, 0.4)',
    status: 'idle',
    latencyMs: 0,
    schema: 'directive: string, priority: "CRITICAL" | "ROUTINE"',
  },
  {
    id: 'n2',
    stepNumber: 2,
    label: 'Task Planner',
    role: 'Deterministic Task Graph Decomposition',
    type: 'router',
    agent: 'PlannerAgent',
    input: 'mission: MissionContext, model: string',
    output: 'tool_decision: ToolCall | null, thought: string',
    condition: 'current_step < max_steps',
    icon: <Compass size={16} />,
    color: '#8b72ff',
    glow: 'rgba(139, 114, 255, 0.4)',
    status: 'idle',
    latencyMs: 0,
    schema: 'target_module: "RAG" | "MATH" | "AUDIT"',
  },
  {
    id: 'n3',
    stepNumber: 3,
    label: 'Routing & Decision',
    role: 'Controlled Tool Allowlist Routing',
    type: 'agent',
    agent: 'ToolRegistryRouter',
    input: 'tool_name: string, tool_arguments: dict',
    output: 'routed_adapter: SovereignToolAdapter',
    condition: 'tool_name in tool_registry.allowlist',
    icon: <Bot size={16} />,
    color: '#d4a843',
    glow: 'rgba(212, 168, 67, 0.4)',
    status: 'idle',
    latencyMs: 0,
    schema: 'action_plan: Array<{ tool: string, query: string }>',
  },
  {
    id: 'n4',
    stepNumber: 4,
    label: 'Vector Retrieval',
    role: 'Air-Gapped ChromaDB Cosine Evidence',
    type: 'retrieval',
    tool: 'document_retrieval',
    input: 'query: string, top_k: int',
    output: 'chunks: Array<SourceChunk>, similarity_scores',
    condition: 'collection.count > 0',
    icon: <Database size={16} />,
    color: '#00c896',
    glow: 'rgba(0, 200, 150, 0.4)',
    status: 'idle',
    latencyMs: 78,
    schema: 'top_k: 4, embedding_model: "nomic-embed-text"',
  },
  {
    id: 'n5',
    stepNumber: 5,
    label: 'Sandboxed Calculator',
    role: 'AST-Bounded Arithmetic Evaluation',
    type: 'tool',
    tool: 'calculator',
    input: 'operation: string, a: float, b: float',
    output: 'result: float, execution_time_ms: float',
    condition: 'a != null && b != null',
    icon: <FileSearch size={16} />,
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.4)',
    status: 'idle',
    latencyMs: 92,
    schema: 'operation: "add"|"subtract"|"multiply"|"divide"',
  },
  {
    id: 'n6',
    stepNumber: 6,
    label: 'Claim Verifier',
    role: 'Provenance Cross-Check & Fact Grounding',
    type: 'eval',
    agent: 'VerificationAgent',
    input: 'evidence: Array<Evidence>, output_claim: string',
    output: 'verification_status: "verified" | "rejected"',
    condition: 'evidence.length >= 1',
    icon: <Cpu size={16} />,
    color: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.4)',
    status: 'idle',
    latencyMs: 410,
    schema: 'verification: "verified" | "rejected", confidence: float',
  },
  {
    id: 'n7',
    stepNumber: 7,
    label: 'Signed Response & Seal',
    role: 'Cryptographic SHA-256 Air-Gap Attestation',
    type: 'seal',
    input: 'final_response: string, provenance: ProvenanceRecord',
    output: 'signed_envelope: SignedResponseEnvelope',
    condition: 'verification_status == "verified"',
    icon: <ShieldCheck size={16} />,
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
    status: 'idle',
    latencyMs: 14,
    schema: 'provenance_hash: "sha256:verified"',
  },
];

export default function WorkflowNodeCanvas() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
  const [edges] = useState<WorkflowEdge[]>(INITIAL_EDGES);
  const [activeNodeId, setActiveNodeId] = useState<string>('n3');
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);

  const selectedNode = nodes.find((n) => n.id === activeNodeId) || nodes[0];

  const handleRunPipeline = () => {
    if (isRunningPipeline) return;
    setIsRunningPipeline(true);

    // Reset all nodes to idle
    setNodes((prev) => prev.map((n) => ({ ...n, status: 'idle' })));

    // Sequential propagation across all 7 nodes
    nodes.forEach((node, idx) => {
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n, i) => {
            if (i === idx) return { ...n, status: 'running' };
            if (i < idx) return { ...n, status: 'completed' };
            return { ...n, status: 'idle' };
          })
        );
        setActiveNodeId(node.id);

        if (idx === nodes.length - 1) {
          setTimeout(() => {
            setNodes((prev) => prev.map((n) => ({ ...n, status: 'completed' })));
            setIsRunningPipeline(false);
          }, 800);
        }
      }, idx * 600);
    });
  };

  return (
    <div className="sovereign-stage-container">
      {/* Workspace Header */}
      <header className="sovereign-header-block">
        <div className="sovereign-header-left">
          <div className="sovereign-header-icon">
            <Zap size={22} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="sovereign-eyebrow-tag">
              <ShieldCheck size={12} className="text-emerald" />
              <span>ORCHESTRATION GRAPH // AUTONOMOUS WORKFLOW</span>
            </div>
            <h1 className="sovereign-title">Autonomous Mission Orchestration</h1>
            <p className="sovereign-subtitle">
              Living execution graph detailing how high-priority tactical directives propagate deterministically from trigger to cryptographically sealed response.
            </p>
          </div>
        </div>

        <div className="sovereign-header-badges">
          <div className="sovereign-badge-pill verified">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>7 CONNECTED NODES</span>
          </div>

          <button
            onClick={handleRunPipeline}
            disabled={isRunningPipeline}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9999px',
              background: isRunningPipeline ? 'rgba(255, 255, 255, 0.08)' : 'linear-gradient(135deg, #d4a843, #f5cf68)',
              border: 'none',
              color: isRunningPipeline ? 'rgba(255, 255, 255, 0.4)' : '#050212',
              fontWeight: 800,
              fontSize: '12px',
              cursor: isRunningPipeline ? 'not-allowed' : 'pointer',
              boxShadow: isRunningPipeline ? 'none' : '0 0 24px rgba(212, 168, 67, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {isRunningPipeline ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{isRunningPipeline ? 'Signal Propagating...' : 'Run Pipeline Simulation'}</span>
          </button>

          <button
            onClick={() => {
              setNodes(INITIAL_NODES.map((n) => ({ ...n, status: 'idle', latencyMs: 0 })));
              setIsRunningPipeline(false);
            }}
            disabled={isRunningPipeline}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--sov-text-secondary, #94a3b8)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: isRunningPipeline ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Reset workflow simulation state to idle"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* Main Orchestration Stage: Node Canvas + Inspector Drawer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left: Living Node Canvas with Curved Beziers & Glowing Signals */}
        <div
          className="sovereign-glass-panel"
          style={{
            padding: '36px 28px',
            position: 'relative',
            minHeight: '620px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          {/* Subtle Vertical Spine Connection Line */}
          <div
            style={{
              position: 'absolute',
              left: '42px',
              top: '50px',
              bottom: '50px',
              width: '2px',
              background: 'linear-gradient(to bottom, #00d2ff, #8b72ff, #d4a843, #00c896, #10b981)',
              opacity: 0.3,
              zIndex: 0,
            }}
          />

          {/* Nodes Stack */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedNode.id;
            const isRunning = node.status === 'running';
            const isCompleted = node.status === 'completed';

            return (
              <div
                key={node.id}
                onClick={() => setActiveNodeId(node.id)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  cursor: 'pointer',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  background: isSelected
                    ? 'radial-gradient(circle at center, rgba(18, 12, 45, 0.95), rgba(8, 4, 24, 0.9))'
                    : isRunning
                    ? 'rgba(0, 210, 255, 0.12)'
                    : 'rgba(8, 4, 22, 0.7)',
                  border: isSelected
                    ? `1px solid ${node.color}`
                    : isRunning
                    ? '1px solid var(--sov-cyan)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isSelected
                    ? `0 0 28px ${node.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.18)`
                    : isRunning
                    ? '0 0 24px rgba(0, 210, 255, 0.3)'
                    : 'none',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isSelected || isRunning ? 'translateX(8px) scale(1.01)' : 'translateX(0)',
                }}
              >
                {/* Node Number Circle */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isRunning ? node.color : isCompleted ? '#10b981' : 'rgba(255, 255, 255, 0.06)',
                    color: isRunning ? '#050212' : '#ffffff',
                    border: `1px solid ${node.color}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 800,
                    boxShadow: isRunning ? `0 0 16px ${node.color}` : 'none',
                    flexShrink: 0,
                  }}
                >
                  {isRunning ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    node.stepNumber
                  )}
                </div>

                {/* Node Identity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>{node.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: node.color }}>
                      [{node.type.toUpperCase()}]
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--sov-text-secondary)' }}>{node.role}</span>
                </div>

                {/* Status Indicator Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isRunning ? 'rgba(0, 210, 255, 0.2)' : isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: isRunning ? 'var(--sov-cyan)' : isCompleted ? '#10b981' : 'var(--sov-text-muted)',
                      border: `1px solid ${isRunning ? 'var(--sov-cyan)' : isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    {node.status.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--sov-text-muted)' }}>
                    {node.latencyMs}ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Node Telemetry & Schema Inspector Drawer */}
        <div className="sovereign-glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="text-gold" />
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Node Inspector</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: selectedNode.color }}>
              STEP 0{selectedNode.stepNumber}
            </span>
          </div>

          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              {selectedNode.label}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--sov-text-secondary)' }}>{selectedNode.role}</span>
          </div>

          {/* Telemetry Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)', display: 'block' }}>BENCHMARK LATENCY</span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#fff' }}>{selectedNode.latencyMs}ms</strong>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)', display: 'block' }}>FAIL RECOVERY</span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#10b981' }}>EXPONENTIAL</strong>
            </div>
          </div>

          {/* Node Model Spec (Agent, Tool, Condition, Input, Output) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: 'var(--sov-text-muted)' }}>AGENT:</span>
              <span style={{ color: selectedNode.agent ? 'var(--sov-gold)' : 'rgba(255, 255, 255, 0.4)' }}>{selectedNode.agent || 'None (Handler)'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: 'var(--sov-text-muted)' }}>TOOL:</span>
              <span style={{ color: selectedNode.tool ? 'var(--sov-cyan)' : 'rgba(255, 255, 255, 0.4)' }}>{selectedNode.tool || 'None'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: 'var(--sov-text-muted)' }}>CONDITION:</span>
              <span style={{ color: '#a78bfa' }}>{selectedNode.condition || 'always'}</span>
            </div>

            <div style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: 'var(--sov-text-muted)', display: 'block', marginBottom: '2px' }}>INPUT:</span>
              <span style={{ color: '#7dd3fc', wordBreak: 'break-all' }}>{selectedNode.input || 'None'}</span>
            </div>

            <div style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: 'var(--sov-text-muted)', display: 'block', marginBottom: '2px' }}>OUTPUT:</span>
              <span style={{ color: '#10b981', wordBreak: 'break-all' }}>{selectedNode.output || 'None'}</span>
            </div>

            {/* Outbound Edges */}
            <div style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: 'var(--sov-text-muted)', display: 'block', marginBottom: '4px' }}>CONNECTED OUTBOUND EDGES:</span>
              {edges.filter((e) => e.source === selectedNode.id).length > 0 ? (
                edges
                  .filter((e) => e.source === selectedNode.id)
                  .map((e) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#fff', marginBottom: '2px' }}>
                      <span>&rarr; {nodes.find((n) => n.id === e.target)?.label || e.target}</span>
                      <span style={{ color: 'var(--sov-cyan)' }}>[{e.condition}]</span>
                    </div>
                  ))
              ) : (
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>Terminal Node (No outgoing edges)</span>
              )}
            </div>
          </div>

          {/* Schema Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
              NODE CONTRACT / SCHEMA:
            </span>
            <pre
              style={{
                margin: 0,
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(4, 2, 14, 0.8)',
                border: '1px solid var(--sov-border-medium)',
                color: '#7dd3fc',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {selectedNode.schema}
            </pre>
          </div>

          {/* Verification Badge */}
          <div
            style={{
              marginTop: 'auto',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(4, 20, 16, 0.65)',
              border: '1px solid rgba(0, 200, 150, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldCheck size={18} className="text-emerald" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
                DETERMINISTIC ASSURANCE
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Zero non-deterministic external calls
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
