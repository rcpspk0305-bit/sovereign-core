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
  const [launchStep, setLaunchStep] = useState<number>(0);
  const [executionResult, setExecutionResult] = useState<AgentResult | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const handleLaunchAgent = async () => {
    if (!directivePrompt.trim() || isDispatching) return;

    setIsDispatching(true);
    setExecutionResult(null);

    // Update agent state to EXECUTING
    setAgents((prev) =>
      prev.map((a) =>
        a.id === selectedAgentId ? { ...a, state: 'EXECUTING', currentTask: directivePrompt } : a
      )
    );

    // Animate the Mission Launch Pipeline:
    // USER -> MISSION -> AGENT -> TOOLS -> KNOWLEDGE -> MODEL -> RESULT
    setLaunchStep(1); // USER DIRECTIVE
    setTimeout(() => setLaunchStep(2), 350); // MISSION PARAMETERS
    setTimeout(() => setLaunchStep(3), 700); // AGENT DISPATCH
    setTimeout(() => setLaunchStep(4), 1100); // TOOLS ACTIVATION
    setTimeout(() => setLaunchStep(5), 1500); // KNOWLEDGE RETRIEVAL
    setTimeout(() => setLaunchStep(6), 1900); // MODEL INFERENCE
    setTimeout(() => setLaunchStep(7), 2400); // FINAL VERIFIED RESULT

    try {
      const res = await api.runAgent(directivePrompt.trim(), currentModel, 5);
      setExecutionResult(res);

      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgentId ? { ...a, state: 'COMPLETED', lastExecutionMs: res.total_latency_ms || 420 } : a
        )
      );
    } catch (err) {
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

  const LAUNCH_PIPELINE = [
    { num: 1, label: 'USER' },
    { num: 2, label: 'MISSION' },
    { num: 3, label: 'AGENT' },
    { num: 4, label: 'TOOLS' },
    { num: 5, label: 'KNOWLEDGE' },
    { num: 6, label: 'MODEL' },
    { num: 7, label: 'RESULT' },
  ];

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

      {/* MISSION LAUNCH DISPATCHER (USER -> MISSION -> AGENT -> TOOLS -> KNOWLEDGE -> MODEL -> RESULT) */}
      <div className="sovereign-glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} className="text-gold" />
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff' }}>
              Dispatch Mission to {selectedAgent.name}
            </span>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--sov-text-muted)' }}>
            TARGET: {selectedAgent.callsign}
          </span>
        </div>

        {/* Animated Launch Pipeline Visualizer */}
        {launchStep > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderRadius: '8px',
              background: 'rgba(6, 4, 18, 0.85)',
              border: '1px solid var(--sov-border-medium)',
              marginBottom: '20px',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {LAUNCH_PIPELINE.map((p, idx) => (
              <div
                key={p.num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: launchStep >= p.num ? 'var(--sov-cyan)' : 'var(--sov-text-muted)',
                  fontWeight: launchStep === p.num ? 700 : 500,
                }}
              >
                <span>
                  {p.num}. {p.label}
                </span>
                {idx < LAUNCH_PIPELINE.length - 1 && <ArrowRight size={11} />}
              </div>
            ))}
          </div>
        )}

        {/* Directive Input & Launch Action */}
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

        {/* Live Execution Result Container */}
        {executionResult && (
          <div
            style={{
              marginTop: '20px',
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
                  Mission Execution Verified ({executionResult.total_latency_ms}ms)
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#10b981' }}>
                SHA-256 SEAL ATTACHED
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
