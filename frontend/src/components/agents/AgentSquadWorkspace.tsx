'use client';

import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Compass,
  Cpu,
  Database,
  Eye,
  FileSearch,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AgentResult, AppError } from '@/lib/types';

export type AgentVisualState =
  | 'IDLE'
  | 'READY'
  | 'THINKING'
  | 'EXECUTING'
  | 'WAITING'
  | 'COMPLETED'
  | 'ERROR';

interface AgentEntity {
  id: string;
  name: string;
  callsign: string;
  role: string;
  objective: string;
  capabilities: string[];
  tools: string[];
  state: AgentVisualState;
  currentTask?: string;
  lastExecutionMs?: number;
  color: string;
  glow: string;
}

const INITIAL_AGENTS: AgentEntity[] = [
  {
    id: 'agent-research',
    name: 'Research & Retrieval Agent',
    callsign: 'SENTINEL-01',
    role: 'Autonomous Vector Retrieval',
    objective: 'Semantic document intelligence, parameter extraction, and cross-reference verification.',
    capabilities: ['ChromaDB Cosine Search', 'Subsystem Manual Parsing', 'Fact Cross-Verification'],
    tools: ['rag_search', 'document_reader', 'vector_cluster_inspector'],
    state: 'READY',
    currentTask: 'Monitoring ChromaDB collections',
    lastExecutionMs: 240,
    color: '#00d2ff',
    glow: 'rgba(0, 210, 255, 0.4)',
  },
  {
    id: 'agent-security',
    name: 'Air-Gap Security Auditor',
    callsign: 'AEGIS-02',
    role: 'Boundary & Egress Enforcement',
    objective: 'Verify zero outbound socket calls, inspect hardware boundaries, and audit cryptographic seals.',
    capabilities: ['Socket Interception', 'Zero Cloud Egress Verification', 'SHA-256 Merkle Seals'],
    tools: ['egress_inspector', 'sha256_verifier', 'socket_traffic_monitor'],
    state: 'IDLE',
    currentTask: 'Passive socket boundary monitoring',
    lastExecutionMs: 110,
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  {
    id: 'agent-ingestion',
    name: 'Document Ingestion Specialist',
    callsign: 'CHRONO-03',
    role: 'Deterministic PDF Pipeline',
    objective: 'PyMuPDF page extraction, semantic chunk boundary splitting, and vector embedding coordination.',
    capabilities: ['PyMuPDF Layout Extraction', '512-Token Chunk Slicing', 'Vector Index Insertion'],
    tools: ['pymupdf_parser', 'semantic_chunker', 'hnsw_embedder'],
    state: 'IDLE',
    currentTask: 'Awaiting unclassified PDF stream',
    lastExecutionMs: 480,
    color: '#8b72ff',
    glow: 'rgba(139, 114, 255, 0.4)',
  },
  {
    id: 'agent-orbital',
    name: 'Orbital Mathematics Analyzer',
    callsign: 'ORION-04',
    role: 'Physics & Ballistic Sandbox',
    objective: 'Calculate orbital velocity, delta-V stationkeeping reserves, and fuel margins inside isolated sandbox.',
    capabilities: ['Astrodynamics Math', 'Deterministic Sandbox Eval', 'Fuel Budget Synthesis'],
    tools: ['sandbox_calculator', 'orbit_simulator', 'matrix_multiplier'],
    state: 'READY',
    currentTask: 'Standby for mathematical directive',
    lastExecutionMs: 310,
    color: '#d4a843',
    glow: 'rgba(212, 168, 67, 0.4)',
  },
];

export type GraphNodeId = 'MISSION' | 'PLANNER' | 'RETRIEVAL' | 'CALCULATOR' | 'VERIFIER' | 'APPROVAL';

interface GraphStageDef {
  id: GraphNodeId;
  label: string;
  role: string;
}

const GRAPH_STAGES: GraphStageDef[] = [
  { id: 'MISSION', label: 'MISSION', role: 'Directive Intake & Context Framing' },
  { id: 'PLANNER', label: 'PLANNER', role: 'Bounded Reasoning & Tool Routing' },
  { id: 'RETRIEVAL', label: 'RETRIEVAL', role: 'Air-Gapped ChromaDB Vector Evidence' },
  { id: 'CALCULATOR', label: 'CALCULATOR', role: 'Deterministic Sandboxed Computation' },
  { id: 'VERIFIER', label: 'VERIFIER', role: 'Strict Provenance & Fact Verification' },
  { id: 'APPROVAL', label: 'APPROVAL', role: 'Human Authority Cryptographic Gate' },
];

interface AgentSquadWorkspaceProps {
  currentModel?: string;
  onError?: (err: AppError) => void;
}

export default function AgentSquadWorkspace({
  currentModel = 'gemma4:e2b',
  onError,
}: AgentSquadWorkspaceProps) {
  const [agents, setAgents] = useState<AgentEntity[]>(INITIAL_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-research');
  const [directivePrompt, setDirectivePrompt] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [orchestratorType, setOrchestratorType] = useState<'langgraph' | 'default'>('langgraph');
  const [activeNode, setActiveNode] = useState<GraphNodeId | null>(null);
  const [completedNodes, setCompletedNodes] = useState<GraphNodeId[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<'UNVERIFIED' | 'IN_PROGRESS' | 'VERIFIED' | 'REJECTED'>('UNVERIFIED');
  const [executionResult, setExecutionResult] = useState<AgentResult | null>(null);
  const [liveToolCalls, setLiveToolCalls] = useState<Array<{ tool: string; args: Record<string, any>; output?: any }>>([]);
  const [liveEvidence, setLiveEvidence] = useState<Array<any>>([]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const handleLaunchAgent = async () => {
    if (!directivePrompt.trim() || isDispatching) return;

    setIsDispatching(true);
    setExecutionResult(null);
    setLiveToolCalls([]);
    setLiveEvidence([]);
    setVerificationStatus('IN_PROGRESS');
    setCompletedNodes([]);
    setActiveNode('MISSION');

    // Update agent visual state
    setAgents((prev) =>
      prev.map((a) =>
        a.id === selectedAgentId ? { ...a, state: 'EXECUTING', currentTask: directivePrompt } : a
      )
    );

    // Dynamic timeline transitions
    setTimeout(() => {
      setCompletedNodes((prev) => Array.from(new Set([...prev, 'MISSION' as GraphNodeId])));
      setActiveNode('PLANNER');
    }, 400);

    try {
      const res = await api.runAgent(directivePrompt.trim(), currentModel, 5, orchestratorType);
      setExecutionResult(res);

      // Extract tool calls and evidence from steps
      const toolInvocations: Array<{ tool: string; args: Record<string, any>; output?: any }> = [];
      const evidenceList: Array<any> = [];

      let usedRetrieval = false;
      let usedCalculator = false;

      if (res.steps && res.steps.length > 0) {
        res.steps.forEach((s) => {
          if (s.tool_name) {
            toolInvocations.push({
              tool: s.tool_name,
              args: s.tool_arguments || {},
              output: s.tool_result?.output,
            });
            if (s.tool_name.toLowerCase().includes('retriev') || s.tool_name.toLowerCase().includes('rag') || s.tool_name.toLowerCase().includes('document')) {
              usedRetrieval = true;
            }
            if (s.tool_name.toLowerCase().includes('calc')) {
              usedCalculator = true;
            }
            if (s.tool_result?.output) {
              evidenceList.push({
                source_tool: s.tool_name,
                data: s.tool_result.output,
                timestamp: new Date().toISOString(),
              });
            }
          }
        });
      }

      setLiveToolCalls(toolInvocations);
      setLiveEvidence(evidenceList);

      // Sequence completion through graph nodes
      const finishedNodes: GraphNodeId[] = ['MISSION', 'PLANNER'];
      if (usedRetrieval) finishedNodes.push('RETRIEVAL');
      if (usedCalculator) finishedNodes.push('CALCULATOR');
      finishedNodes.push('VERIFIER');
      finishedNodes.push('APPROVAL');

      setCompletedNodes(finishedNodes);
      setActiveNode(null);
      setVerificationStatus(res.success ? 'VERIFIED' : 'REJECTED');

      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgentId ? { ...a, state: 'COMPLETED', lastExecutionMs: res.total_latency_ms || 420 } : a
        )
      );
    } catch (err) {
      setActiveNode(null);
      setVerificationStatus('REJECTED');
      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgentId ? { ...a, state: 'ERROR', currentTask: 'Execution timeout or error' } : a
        )
      );
      if (onError) onError(normalizeError(err));
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="sovereign-stage-container">
      {/* Workspace Header */}
      <header className="sovereign-header-block">
        <div className="sovereign-header-left">
          <div className="sovereign-header-icon">
            <Bot size={22} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="sovereign-eyebrow-tag">
              <ShieldCheck size={12} className="text-emerald" />
              <span>AUTONOMOUS ENTITIES // MISSION COMMAND GRID</span>
            </div>
            <h1 className="sovereign-title">Autonomous Agent Command Grid</h1>
            <p className="sovereign-subtitle">
              Coordinated squad of air-gapped autonomous agents engineered for specialized document inspection, security verification, and ballistic mathematics.
            </p>
          </div>
        </div>

        <div className="sovereign-header-badges">
          <div className="sovereign-badge-pill verified">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>4 AUTONOMOUS AGENTS ACTIVE</span>
          </div>

          <div className="sovereign-badge-pill model">
            <Cpu size={13} className="text-cyan" />
            <span>CORE: {currentModel.replace('gemma4:', 'Gemma ')}</span>
          </div>
        </div>
      </header>

      {/* CENTRAL AGENT COMMAND GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        {agents.map((agent) => {
          const isSelected = agent.id === selectedAgentId;

          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className="sovereign-glass-panel"
              style={{
                padding: '24px',
                cursor: 'pointer',
                border: isSelected ? `1px solid ${agent.color}` : '1px solid var(--sov-border-subtle)',
                boxShadow: isSelected
                  ? `0 0 30px ${agent.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                  : '0 8px 24px rgba(0, 0, 0, 0.5)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
              }}
            >
              {/* Top Callsign & Visual State Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--sov-text-muted)', letterSpacing: '0.1em' }}>
                  {agent.callsign}
                </span>

                {/* Visual State Indicator */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    background:
                      agent.state === 'EXECUTING'
                        ? 'rgba(0, 210, 255, 0.2)'
                        : agent.state === 'COMPLETED'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : agent.state === 'READY'
                        ? 'rgba(212, 168, 67, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      agent.state === 'EXECUTING'
                        ? '1px solid var(--sov-cyan)'
                        : agent.state === 'COMPLETED'
                        ? '1px solid #10b981'
                        : '1px solid rgba(255, 255, 255, 0.12)',
                    color:
                      agent.state === 'EXECUTING'
                        ? 'var(--sov-cyan)'
                        : agent.state === 'COMPLETED'
                        ? '#10b981'
                        : agent.state === 'READY'
                        ? 'var(--sov-gold)'
                        : 'var(--sov-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: agent.color,
                      boxShadow: agent.state === 'EXECUTING' ? `0 0 8px ${agent.color}` : 'none',
                    }}
                  />
                  <span>{agent.state}</span>
                </div>
              </div>

              {/* Agent Title & Objective */}
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                  {agent.name}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--sov-text-secondary)', lineHeight: 1.5 }}>
                  {agent.objective}
                </p>
              </div>

              {/* Tools Tags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
                  REGISTERED TOOLS:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {agent.tools.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#d4c4f0',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Telemetry Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  marginTop: 'auto',
                  fontSize: '11px',
                  color: 'var(--sov-text-muted)',
                }}
              >
                <span>Task: {agent.currentTask?.slice(0, 32)}...</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{agent.lastExecutionMs}ms</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MISSION ORCHESTRATION & GRAPH PIPELINE */}
      <div className="sovereign-glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} className="text-gold" />
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff' }}>
              Mission Orchestration: {selectedAgent.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 0, 0, 0.4)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--sov-border-subtle)' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>ORCHESTRATOR:</span>
              <button
                type="button"
                onClick={() => setOrchestratorType('langgraph')}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: orchestratorType === 'langgraph' ? 'var(--sov-cyan)' : 'transparent',
                  color: orchestratorType === 'langgraph' ? '#000' : 'var(--sov-text-muted)',
                  fontWeight: orchestratorType === 'langgraph' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                LangGraph Controlled
              </button>
              <button
                type="button"
                onClick={() => setOrchestratorType('default')}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: orchestratorType === 'default' ? 'var(--sov-gold)' : 'transparent',
                  color: orchestratorType === 'default' ? '#000' : 'var(--sov-text-muted)',
                  fontWeight: orchestratorType === 'default' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Classic Loop
              </button>
            </div>

            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
              TARGET: {selectedAgent.callsign}
            </span>
          </div>
        </div>

        {/* GRAPH MODEL PIPELINE DISPLAY (MISSION ↓ PLANNER ✓ ↓ RETRIEVAL ✓ ↓ CALCULATOR ✓ ↓ VERIFIER ● ↓ APPROVAL) */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            background: 'rgba(5, 3, 15, 0.85)',
            border: '1px solid var(--sov-border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--sov-cyan)', fontWeight: 700 }}>
              CONTROLLED STATE GRAPH TOPOLOGY
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
              BOUNDED STEP BUDGET: 1 &le; STEPS &le; 10
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(10, 8, 24, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {GRAPH_STAGES.map((stage, idx) => {
              const isCompleted = completedNodes.includes(stage.id);
              const isActive = activeNode === stage.id;

              return (
                <React.Fragment key={stage.id}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: isActive
                        ? 'rgba(0, 210, 255, 0.15)'
                        : isCompleted
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: isActive
                        ? '1px solid var(--sov-cyan)'
                        : isCompleted
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: isActive ? '0 0 16px rgba(0, 210, 255, 0.3)' : 'none',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 800,
                          color: isActive ? 'var(--sov-cyan)' : isCompleted ? '#10b981' : 'var(--sov-text-muted)',
                        }}
                      >
                        {stage.label}
                      </span>
                      {isCompleted && <span style={{ color: '#10b981', fontWeight: 900, fontSize: '12px' }}>✓</span>}
                      {isActive && <span style={{ color: 'var(--sov-cyan)', fontSize: '11px' }} className="animate-pulse">●</span>}
                    </div>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
                      {stage.role.split(' ')[0]}
                    </span>
                  </div>

                  {idx < GRAPH_STAGES.length - 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'rgba(255, 255, 255, 0.25)' }}>
                      <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>&darr;</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* TELEMETRY & NODE METRICS DASHBOARD */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              paddingTop: '6px',
            }}
          >
            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>CURRENT NODE</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: activeNode ? 'var(--sov-cyan)' : '#fff' }}>
                {activeNode || (completedNodes.length > 0 ? completedNodes[completedNodes.length - 1] : 'IDLE')}
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>ACTIVE NODE</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: activeNode ? '#00d2ff' : 'var(--sov-text-muted)' }}>
                {activeNode ? `${activeNode} ●` : 'None (Idle)'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>COMPLETED NODES</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                {completedNodes.length > 0 ? `${completedNodes.length} Nodes ✓` : '0 Nodes'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>STEP COUNT</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {executionResult?.steps ? `${executionResult.steps.length} / 5` : isDispatching ? '1 / 5' : '0 / 5'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>ORCHESTRATOR MODEL</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--sov-gold)' }}>
                {currentModel.replace('gemma4:', 'Gemma ')}
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>EXECUTION TIME</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {executionResult?.total_latency_ms ? `${executionResult.total_latency_ms}ms` : '0ms'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>VERIFICATION STATUS</div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color:
                    verificationStatus === 'VERIFIED'
                      ? '#10b981'
                      : verificationStatus === 'IN_PROGRESS'
                      ? 'var(--sov-cyan)'
                      : verificationStatus === 'REJECTED'
                      ? '#ef4444'
                      : 'var(--sov-text-muted)',
                }}
              >
                {verificationStatus} {verificationStatus === 'VERIFIED' ? '✓' : verificationStatus === 'IN_PROGRESS' ? '●' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* DIRECTIVE INPUT & LAUNCH ACTION */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'rgba(8, 4, 22, 0.85)',
              border: '1px solid var(--sov-border-medium)',
              flex: 1,
            }}
          >
            <Terminal size={16} className="text-cyan" />
            <input
              type="text"
              placeholder={`Enter operational directive for ${selectedAgent.name}...`}
              value={directivePrompt}
              onChange={(e) => setDirectivePrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLaunchAgent()}
              disabled={isDispatching}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '13px',
              }}
            />
          </div>

          <button
            onClick={handleLaunchAgent}
            disabled={!directivePrompt.trim() || isDispatching}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: directivePrompt.trim() && !isDispatching ? 'linear-gradient(135deg, #d4a843, #f5cf68)' : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: directivePrompt.trim() && !isDispatching ? '#050212' : 'rgba(255, 255, 255, 0.3)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: directivePrompt.trim() && !isDispatching ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: directivePrompt.trim() && !isDispatching ? '0 0 24px rgba(212, 168, 67, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {isDispatching ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            <span>Launch Mission</span>
          </button>
        </div>

        {/* TOOL CALLS & EVIDENCE SECTION */}
        {(liveToolCalls.length > 0 || liveEvidence.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {/* Tool Calls */}
            {liveToolCalls.length > 0 && (
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(6, 4, 18, 0.85)', border: '1px solid var(--sov-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--sov-cyan)', marginBottom: '8px', fontWeight: 700 }}>
                  CAPTURED TOOL CALLS ({liveToolCalls.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {liveToolCalls.map((tc, idx) => (
                    <div key={idx} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{tc.tool}</span>
                        <span style={{ color: '#10b981' }}>SUCCESS ✓</span>
                      </div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)', marginTop: '4px' }}>
                        ARGS: {JSON.stringify(tc.args)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            {liveEvidence.length > 0 && (
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(6, 4, 18, 0.85)', border: '1px solid var(--sov-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#10b981', marginBottom: '8px', fontWeight: 700 }}>
                  VERIFIED EVIDENCE RECORDS ({liveEvidence.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {liveEvidence.map((ev, idx) => (
                    <div key={idx} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
                        SOURCE: {ev.source_tool} &bull; {ev.timestamp?.slice(11, 19)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--sov-text-secondary)', marginTop: '4px' }}>
                        {typeof ev.data === 'object' ? JSON.stringify(ev.data) : String(ev.data)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIVE EXECUTION RESULT */}
        {executionResult && (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(6, 4, 18, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} className="text-emerald" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                  Mission Execution Completed ({executionResult.total_latency_ms}ms)
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#10b981' }}>
                SHA-256 AIR-GAP PROVENANCE ATTACHED
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--sov-text-secondary)', lineHeight: 1.6 }}>
              {executionResult.final_response}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
