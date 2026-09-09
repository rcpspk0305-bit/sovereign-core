'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  FileCode,
  FileText,
  FolderGit2,
  GitBranch,
  HardDrive,
  Info,
  Layers,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  X,
  Bot,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, MemoryBreakdown, SessionItem, SessionTurn } from '@/lib/types';

interface MemoryFlowBayProps {
  onError: (error: AppError) => void;
  activeSessionId?: string;
  onSelectSession?: (sessionId: string) => void;
}

const DEFAULT_TURNS_SAMPLE: SessionTurn[] = [
  {
    turn_id: 'turn-1',
    role: 'system',
    type: 'user_fact',
    content: 'User constraint: Air-gapped deployment, strictly zero cloud egress, military radar telemetry focus.',
    timestamp: '18:02:15',
    tokens: 240,
  },
  {
    turn_id: 'turn-2',
    role: 'system',
    type: 'tool_schema',
    content: 'Registered local schemas: sandbox_calculator, radar_telemetry_analyzer, sha256_verifier.',
    timestamp: '18:04:30',
    tokens: 1150,
  },
  {
    turn_id: 'turn-3',
    role: 'user',
    type: 'user_input',
    content: 'Analyze defense radar manual for subsystem telemetry anomalies and fuel budget.',
    timestamp: '18:08:45',
    tokens: 380,
  },
  {
    turn_id: 'turn-4',
    role: 'system',
    type: 'retrieved_fact',
    content: 'ChromaDB HNSW Chunk #18: Radar Subsystem Manual v4.2 Section 7: Nominal operating frequency 9.4 GHz, baseline SNR 28dB.',
    timestamp: '18:10:00',
    tokens: 1860,
  },
  {
    turn_id: 'turn-5',
    role: 'assistant',
    type: 'internal_chatter',
    content: '[THINKING] Cross-verifying retrieved frequency against zero-egress hardware constraints. Math check verifies SNR margin nominal.',
    timestamp: '18:12:18',
    tokens: 320,
  },
];

export default function MemoryFlowBay({
  onError,
  activeSessionId,
  onSelectSession,
}: MemoryFlowBayProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'matrix' | 'sessions'>('pipeline');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<{
    title: string;
    type: string;
    tokens: number;
    description: string;
    sampleContent: string;
    source: string;
  } | null>(null);

  // Live real-time clock
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Fetch sessions and current memory state
  const loadSessionData = async () => {
    setLoading(true);
    try {
      const [sessionsList, current] = await Promise.all([
        api.listSessions().catch(() => []),
        api.getCurrentSession().catch(() => null),
      ]);
      setSessions(sessionsList);
      if (current) {
        setCurrentSession(current);
      } else if (sessionsList.length > 0) {
        setCurrentSession(sessionsList[0]);
      }
    } catch (err) {
      onError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, []);

  // Create new session
  const handleCreateNewSession = async () => {
    try {
      const created = await api.createSession({
        title: `Orbital Mission ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        model: 'gemma4:e2b',
      });
      setCurrentSession(created);
      setSessions((prev) => [created, ...prev]);
      if (onSelectSession) onSelectSession(created.session_id);
    } catch (err) {
      onError(normalizeError(err));
    }
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete session ${sessionId}?`)) return;
    try {
      await api.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (currentSession?.session_id === sessionId) {
        const remaining = sessions.filter((s) => s.session_id !== sessionId);
        setCurrentSession(remaining[0] || null);
      }
    } catch (err) {
      onError(normalizeError(err));
    }
  };

  // Memory breakdown numbers
  const breakdown: MemoryBreakdown = currentSession?.memory_breakdown || {
    user_input_tokens: 380,
    tools_tokens: 1150,
    user_facts_tokens: 240,
    internal_chatter_tokens: 320,
    retrieved_facts_tokens: 1860,
    total_tokens: 3950,
    max_context_window: 8192,
  };

  const pctUsage = Math.min(100, Math.round((breakdown.total_tokens / breakdown.max_context_window) * 100));

  // Formatted date and time strings
  const formattedDate = useMemo(() => {
    if (!currentTime) return 'Wednesday, September 9, 2026';
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [currentTime]);

  const formattedTime = useMemo(() => {
    if (!currentTime) return '18:15:00 IST';
    return currentTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [currentTime]);

  return (
    <div className="memory-flow-universe-root">
      {/* Top Aerospace Session & Memory Header */}
      <header className="memory-top-header">
        <div className="memory-header-left">
          <div className="memory-brand-cluster">
            <div className="memory-brain-icon">
              <Cpu size={22} className="text-cyan animate-pulse" />
            </div>
            <div>
              <div className="memory-eyebrow-tag">
                <ShieldCheck size={12} className="text-emerald" />
                <span>SOVEREIGN AGENT RUNTIME • ZERO EGRESS</span>
              </div>
              <h2 className="memory-title">Agent Memory Flow & Session State</h2>
              <p className="memory-subtitle">
                The 4 Memory Tiers • Real-Time Context Builder • Session Temporal Provenance
              </p>
            </div>
          </div>
        </div>

        {/* Live Date & Time Real-Time Readout Pill */}
        <div className="live-clock-pill-cluster">
          <div className="clock-item">
            <Calendar size={13} className="text-cyan" />
            <span className="clock-label">{formattedDate}</span>
          </div>
          <div className="clock-divider">•</div>
          <div className="clock-item">
            <Clock size={13} className="text-emerald" />
            <strong className="clock-time font-mono">{formattedTime}</strong>
            <small className="clock-tz">IST (UTC+5:30)</small>
          </div>
        </div>

        {/* Center Tab Navigation */}
        <nav className="memory-nav-tabs">
          <button
            className={`memory-tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            <GitBranch size={15} />
            <span>1. The 4 Memory Types</span>
          </button>
          <button
            className={`memory-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <Layers size={15} />
            <span>2. Memory vs State</span>
          </button>
          <button
            className={`memory-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <Clock size={15} />
            <span>3. Sessions ({sessions.length})</span>
          </button>
        </nav>

        {/* Action Button: Start New Session */}
        <div className="memory-top-actions">
          <button
            onClick={handleCreateNewSession}
            className="new-session-btn"
            title="Initialize brand-new session with clean context buffer"
          >
            <Plus size={14} />
            <span>New Session</span>
          </button>
          <button
            onClick={loadSessionData}
            className="memory-refresh-btn"
            title="Refresh session states"
            aria-label="Refresh session states"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="memory-tab-content">
        {/* ============================================================ */}
        {/* TAB 1: INTERACTIVE MEMORY FLOW PIPELINE (THE 4 MEMORY TYPES) */}
        {/* ============================================================ */}
        {activeTab === 'pipeline' && (
          <div className="memory-pipeline-stage">
            {/* Top Context Window Budget Strip */}
            <div className="context-budget-banner">
              <div className="budget-info-row">
                <div className="budget-title-cluster">
                  <Activity size={16} className="text-cyan" />
                  <span className="budget-title">
                    Context Window Token Allocation ({breakdown.total_tokens.toLocaleString()} /{' '}
                    {breakdown.max_context_window.toLocaleString()} tokens — {pctUsage}% used)
                  </span>
                </div>
                <div className="budget-legend">
                  <span className="legend-chip">
                    <i style={{ backgroundColor: '#38bdf8' }} /> User Input ({breakdown.user_input_tokens}t)
                  </span>
                  <span className="legend-chip">
                    <i style={{ backgroundColor: '#94a3b8' }} /> Tools Schemas ({breakdown.tools_tokens}t)
                  </span>
                  <span className="legend-chip">
                    <i style={{ backgroundColor: '#f87171' }} /> User Facts ({breakdown.user_facts_tokens}t)
                  </span>
                  <span className="legend-chip">
                    <i style={{ backgroundColor: '#c084fc' }} /> Internal Chatter ({breakdown.internal_chatter_tokens}t)
                  </span>
                  <span className="legend-chip">
                    <i style={{ backgroundColor: '#fbbf24' }} /> Retrieved Facts ({breakdown.retrieved_facts_tokens}t)
                  </span>
                  <span className="legend-chip text-muted">
                    <i style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} /> Free Budget ({breakdown.max_context_window - breakdown.total_tokens}t)
                  </span>
                </div>
              </div>

              {/* Segmented Token Progress Track */}
              <div className="budget-segmented-track">
                <div
                  className="seg-bar seg-user-input"
                  style={{ width: `${(breakdown.user_input_tokens / breakdown.max_context_window) * 100}%` }}
                  title={`User Input: ${breakdown.user_input_tokens} tokens`}
                />
                <div
                  className="seg-bar seg-tools"
                  style={{ width: `${(breakdown.tools_tokens / breakdown.max_context_window) * 100}%` }}
                  title={`Tools Schemas: ${breakdown.tools_tokens} tokens`}
                />
                <div
                  className="seg-bar seg-user-facts"
                  style={{ width: `${(breakdown.user_facts_tokens / breakdown.max_context_window) * 100}%` }}
                  title={`User Facts: ${breakdown.user_facts_tokens} tokens`}
                />
                <div
                  className="seg-bar seg-chatter"
                  style={{ width: `${(breakdown.internal_chatter_tokens / breakdown.max_context_window) * 100}%` }}
                  title={`Internal Chatter: ${breakdown.internal_chatter_tokens} tokens`}
                />
                <div
                  className="seg-bar seg-retrieved"
                  style={{ width: `${(breakdown.retrieved_facts_tokens / breakdown.max_context_window) * 100}%` }}
                  title={`Retrieved Facts: ${breakdown.retrieved_facts_tokens} tokens`}
                />
              </div>
            </div>

            {/* The 3-Column Memory Flow Pipeline Diagram (Directly Modeling User's Image 1) */}
            <div className="flow-pipeline-grid">
              {/* ---------------------------------------------------- */}
              {/* COLUMN 1: INTERNAL LLM MEMORY & CONTEXT WINDOW      */}
              {/* ---------------------------------------------------- */}
              <div className="flow-column internal-memory-col">
                <div className="column-header">
                  <Cpu size={16} className="text-cyan" />
                  <div>
                    <h3 className="column-title">Internal LLM Memory</h3>
                    <span className="column-subtitle">Active In-Context Attention</span>
                  </div>
                </div>

                {/* Context Window Container */}
                <div className="context-window-capsule">
                  <div className="capsule-label">Context Window</div>

                  {/* Context Block Stack */}
                  <div className="capsule-slots">
                    <button
                      className="slot-block block-user-input"
                      onClick={() =>
                        setSelectedBlock({
                          title: 'User Input',
                          type: 'user_input',
                          tokens: breakdown.user_input_tokens,
                          description: 'The raw user prompt submitted in the current interaction turn.',
                          sampleContent: 'Analyze defense radar manual for subsystem telemetry anomalies and fuel budget.',
                          source: 'Live Chat Dispatch',
                        })
                      }
                    >
                      <span className="slot-dot" />
                      <span className="slot-name">User Input</span>
                      <span className="slot-tokens">{breakdown.user_input_tokens}t</span>
                    </button>

                    <button
                      className="slot-block block-tools"
                      onClick={() =>
                        setSelectedBlock({
                          title: 'Tools Schemas',
                          type: 'tool_schema',
                          tokens: breakdown.tools_tokens,
                          description: 'Strict JSON schemas for local sandbox tools (calculator, radar, SHA-256 verifier).',
                          sampleContent: '{"type":"function","function":{"name":"sandbox_calculator","parameters":{"type":"object","properties":{"expression":{"type":"string"}}}}}',
                          source: 'Local Tool Registry',
                        })
                      }
                    >
                      <span className="slot-dot" />
                      <span className="slot-name">Tools Schemas</span>
                      <span className="slot-tokens">{breakdown.tools_tokens}t</span>
                    </button>

                    <button
                      className="slot-block block-user-facts"
                      onClick={() =>
                        setSelectedBlock({
                          title: 'User Facts & Policies',
                          type: 'user_fact',
                          tokens: breakdown.user_facts_tokens,
                          description: 'Persistent user constraints, security policies, and mission parameters.',
                          sampleContent: 'AIR-GAP EGRESS LOCK: Mandatory zero outbound network sockets. Human confirmation required for write ops.',
                          source: 'System Sovereign Policy',
                        })
                      }
                    >
                      <span className="slot-dot" />
                      <span className="slot-name">User Facts</span>
                      <span className="slot-tokens">{breakdown.user_facts_tokens}t</span>
                    </button>

                    <button
                      className="slot-block block-chatter"
                      onClick={() =>
                        setSelectedBlock({
                          title: 'Internal Chatter',
                          type: 'internal_chatter',
                          tokens: breakdown.internal_chatter_tokens,
                          description: 'Agent scratchpad, chain-of-thought, and sub-agent step coordination.',
                          sampleContent: '[THINKING] Executed step 1 of 4: Grounded PDF chunk matches nominal 9.4 GHz radar frequency.',
                          source: 'Agent Reasoner Scratchpad',
                        })
                      }
                    >
                      <span className="slot-dot" />
                      <span className="slot-name">Internal Chatter</span>
                      <span className="slot-tokens">{breakdown.internal_chatter_tokens}t</span>
                    </button>

                    <button
                      className="slot-block block-retrieved"
                      onClick={() =>
                        setSelectedBlock({
                          title: 'Retrieved Facts (RAG)',
                          type: 'retrieved_fact',
                          tokens: breakdown.retrieved_facts_tokens,
                          description: 'Relevant semantic context chunks retrieved from ChromaDB HNSW vector store.',
                          sampleContent: 'Radar Subsystem Manual v4.2 Section 7: Nominal operating frequency 9.4 GHz, baseline SNR 28dB.',
                          source: 'ChromaDB Vector Store',
                        })
                      }
                    >
                      <span className="slot-dot" />
                      <span className="slot-name">Retrieved Facts</span>
                      <span className="slot-tokens">{breakdown.retrieved_facts_tokens}t</span>
                    </button>
                  </div>
                </div>

                {/* Downward Stream to Local LLM */}
                <div className="flow-down-connector">
                  <div className="flow-pulse-line" />
                  <ArrowDown size={14} className="text-cyan" />
                </div>

                {/* Local LLM Inference Engine */}
                <div className="llm-node-box">
                  <div className="llm-header">
                    <span className="llm-pulse" />
                    <strong>LOCAL LLM</strong>
                  </div>
                  <span className="llm-name">Gemma 4:e2b</span>
                  <small>Local Workstation Enclave</small>
                </div>

                <div className="flow-down-connector">
                  <ArrowDown size={14} className="text-emerald" />
                </div>

                {/* Answer Output */}
                <div className="answer-node-box">
                  <CheckCircle2 size={15} className="text-emerald" />
                  <span>Answer / Output Action</span>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* COLUMN 2: SHORT-TERM MEMORY (SESSION BUFFER)        */}
              {/* ---------------------------------------------------- */}
              <div className="flow-column short-term-memory-col">
                <div className="column-header">
                  <Layers size={16} className="text-emerald" />
                  <div>
                    <h3 className="column-title">Short-Term Memory</h3>
                    <span className="column-subtitle">Sequential Interaction Buffer</span>
                  </div>
                </div>

                {/* Vertical Stream of Interaction Turns */}
                <div className="short-term-buffer-tube">
                  <div className="tube-top-feed">
                    <span className="feed-tag">CONTEXT BUILDER FEED</span>
                    <ArrowRight size={13} className="text-cyan" />
                  </div>

                  <div className="buffer-turns-list">
                    {(currentSession?.recent_turns && currentSession.recent_turns.length > 0
                      ? currentSession.recent_turns
                      : DEFAULT_TURNS_SAMPLE
                    ).map((turn, idx) => {
                      const colorMap: Record<string, string> = {
                        user_input: '#38bdf8',
                        tool_schema: '#94a3b8',
                        user_fact: '#f87171',
                        internal_chatter: '#c084fc',
                        retrieved_fact: '#fbbf24',
                      };
                      const color = colorMap[turn.type] || '#38bdf8';
                      return (
                        <div
                          key={turn.turn_id || idx}
                          className="buffer-turn-card"
                          style={{ borderLeftColor: color }}
                          onClick={() =>
                            setSelectedBlock({
                              title: `${turn.role.toUpperCase()} (${turn.type})`,
                              type: turn.type,
                              tokens: turn.tokens,
                              description: turn.content,
                              sampleContent: turn.content,
                              source: `Turn #${idx + 1} at ${turn.timestamp}`,
                            })
                          }
                        >
                          <div className="turn-card-top">
                            <span className="turn-type-pill" style={{ color }}>
                              {turn.type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="turn-time font-mono">{turn.timestamp}</span>
                          </div>
                          <p className="turn-snippet">{turn.content}</p>
                          <div className="turn-card-bottom">
                            <span>Role: {turn.role}</span>
                            <span className="font-mono text-cyan">{turn.tokens}t</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Downward Persistence Connector */}
                  <div className="buffer-persistence-connector">
                    <ArrowDown size={14} className="text-amber" />
                    <span className="persist-label">STORED ON DISK</span>
                  </div>

                  {/* Stored Icon & Disk Persistence */}
                  <div className="stored-disk-box">
                    <HardDrive size={18} className="text-amber" />
                    <div>
                      <strong>Stored Persistence</strong>
                      <small>Session Log • SQLite Ledger</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* COLUMN 3: LONG-TERM MEMORY (DATABASES & MCP SERVERS) */}
              {/* ---------------------------------------------------- */}
              <div className="flow-column long-term-memory-col">
                <div className="column-header">
                  <Database size={16} className="text-amber" />
                  <div>
                    <h3 className="column-title">Long-Term Memory</h3>
                    <span className="column-subtitle">Durable Repositories & Tooling</span>
                  </div>
                </div>

                <div className="long-term-container">
                  {/* Databases Section */}
                  <div className="long-term-subgroup">
                    <div className="subgroup-title">
                      <Database size={14} className="text-amber" />
                      <span>DATABASES</span>
                    </div>

                    <div className="db-cards-grid">
                      <div className="db-item-tile">
                        <div className="db-tile-icon vector">
                          <Brain size={16} />
                        </div>
                        <div>
                          <strong>Vector Store</strong>
                          <p>ChromaDB HNSW embeddings (768-D)</p>
                          <span className="badge-tag">HNSW Cosine</span>
                        </div>
                      </div>

                      <div className="db-item-tile">
                        <div className="db-tile-icon sql">
                          <Database size={16} />
                        </div>
                        <div>
                          <strong>SQL Store</strong>
                          <p>Local SQLite metadata & sessions</p>
                          <span className="badge-tag">ACID Compliant</span>
                        </div>
                      </div>

                      <div className="db-item-tile">
                        <div className="db-tile-icon graph">
                          <Network size={16} />
                        </div>
                        <div>
                          <strong>Graph Store</strong>
                          <p>Communities network & AST relations</p>
                          <span className="badge-tag">Force Network</span>
                        </div>
                      </div>

                      <div className="db-item-tile">
                        <div className="db-tile-icon document">
                          <FileText size={16} />
                        </div>
                        <div>
                          <strong>Document Store</strong>
                          <p>PDF parsed chapters & attachments</p>
                          <span className="badge-tag">Page-Level Provenance</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MCP Servers Section */}
                  <div className="long-term-subgroup">
                    <div className="subgroup-title">
                      <Server size={14} className="text-cyan" />
                      <span>MCP SERVERS & LOCAL TOOL BELT</span>
                    </div>

                    <div className="mcp-servers-grid">
                      <div className="mcp-tile">
                        <FileCode size={15} className="text-cyan" />
                        <div>
                          <strong>Filesystem MCP</strong>
                          <small>Air-gapped local sandbox I/O</small>
                        </div>
                      </div>

                      <div className="mcp-tile">
                        <Wrench size={15} className="text-emerald" />
                        <div>
                          <strong>Local Tools MCP</strong>
                          <small>Deterministic python math & hash</small>
                        </div>
                      </div>

                      <div className="mcp-tile">
                        <Activity size={15} className="text-amber" />
                        <div>
                          <strong>Telemetry Sensors MCP</strong>
                          <small>Zero egress network monitors</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flow Arrow to Short-Term Memory */}
                  <div className="long-term-export-strip">
                    <span>Retrieved Facts Inject into Context Window</span>
                    <ArrowRight size={14} className="text-cyan" />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Block Inspector Modal */}
            {selectedBlock && (
              <div className="inspector-modal-backdrop" onClick={() => setSelectedBlock(null)}>
                <div className="inspector-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="inspector-header">
                    <div className="inspector-title-cluster">
                      <span className="inspector-dot" />
                      <h4>{selectedBlock.title}</h4>
                      <span className="inspector-tokens font-mono">{selectedBlock.tokens} tokens</span>
                    </div>
                    <button
                      onClick={() => setSelectedBlock(null)}
                      className="inspector-close-btn"
                      aria-label="Close Inspector"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <p className="inspector-desc">{selectedBlock.description}</p>

                  <div className="inspector-content-box">
                    <span className="content-box-label">PAYLOAD SAMPLE ({selectedBlock.source}):</span>
                    <pre className="inspector-pre">{selectedBlock.sampleContent}</pre>
                  </div>

                  <div className="inspector-footer">
                    <span className="security-tag">
                      <ShieldCheck size={13} className="text-emerald" />
                      <span>Zero Cloud Egress Guaranteed</span>
                    </span>
                    <button onClick={() => setSelectedBlock(null)} className="inspector-done-btn">
                      Close Inspector
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: AGENT RUNTIME & MEMORY VS STATE MATRIX (IMAGE 3)      */}
        {/* ============================================================ */}
        {activeTab === 'matrix' && (
          <div className="memory-matrix-stage">
            {/* 5 Pillars Diagram Centered Around Agent Runtime */}
            <div className="agent-runtime-topology-card">
              <div className="runtime-card-header">
                <h3 className="runtime-headline">AI Agent Memory vs State Architecture</h3>
                <p className="runtime-tagline">
                  What should be remembered, stored, or recomputed at runtime?
                </p>
              </div>

              <div className="runtime-diagram-grid">
                {/* 1. Memory (Preferences) */}
                <div className="pillar-tile pillar-memory">
                  <div className="pillar-header">
                    <div className="pillar-num">1</div>
                    <div>
                      <h4 className="pillar-name">Memory</h4>
                      <span className="pillar-motto">Improves future behavior</span>
                    </div>
                    <Brain size={18} className="text-emerald" />
                  </div>
                  <ul className="pillar-list">
                    <li>User preferences & constraints</li>
                    <li>Stable environmental facts</li>
                    <li>Approved operational procedures</li>
                  </ul>
                </div>

                {/* 2. Session State */}
                <div className="pillar-tile pillar-session">
                  <div className="pillar-header">
                    <div className="pillar-num">2</div>
                    <div>
                      <h4 className="pillar-name">Session State</h4>
                      <span className="pillar-motto">Continues the current interaction</span>
                    </div>
                    <Radio size={18} className="text-cyan" />
                  </div>
                  <ul className="pillar-list">
                    <li>Current conversation transcript</li>
                    <li>Recent interaction turns</li>
                    <li>Temporary local tool outputs</li>
                  </ul>
                </div>

                {/* Center: Agent Runtime Core */}
                <div className="pillar-tile pillar-runtime-center">
                  <div className="agent-robot-icon">
                    <Bot size={28} className="text-cyan" />
                  </div>
                  <h4 className="runtime-title">Agent Runtime</h4>
                  <div className="context-builder-badge">
                    <strong>Context Builder</strong>
                    <p>Assembles the right context from the right sources</p>
                  </div>
                </div>

                {/* 3. Workflow State */}
                <div className="pillar-tile pillar-workflow">
                  <div className="pillar-header">
                    <div className="pillar-num">3</div>
                    <div>
                      <h4 className="pillar-name">Workflow State</h4>
                      <span className="pillar-motto">Completes the task safely</span>
                    </div>
                    <GitBranch size={18} className="text-amber" />
                  </div>
                  <ul className="pillar-list">
                    <li>Current execution step (1-5)</li>
                    <li>Pending human approvals</li>
                    <li>Step retries & timeout guards</li>
                  </ul>
                </div>

                {/* 4. Audit Records */}
                <div className="pillar-tile pillar-audit">
                  <div className="pillar-header">
                    <div className="pillar-num">4</div>
                    <div>
                      <h4 className="pillar-name">Audit Records</h4>
                      <span className="pillar-motto">Proves what happened</span>
                    </div>
                    <FileText size={18} className="text-purple" />
                  </div>
                  <ul className="pillar-list">
                    <li>Who acted & what changed</li>
                    <li>Exact ISO timestamps (Date/Time)</li>
                    <li>Tool called & approval status</li>
                  </ul>
                </div>

                {/* 5. Retrieval / Knowledge */}
                <div className="pillar-tile pillar-retrieval full-width">
                  <div className="pillar-header">
                    <div className="pillar-num">5</div>
                    <div>
                      <h4 className="pillar-name">Retrieval / Knowledge (RAG)</h4>
                      <span className="pillar-motto">Retrieved dynamically at runtime</span>
                    </div>
                    <Database size={18} className="text-cyan" />
                  </div>
                  <ul className="pillar-list horizontal">
                    <li>Policies & security constraints</li>
                    <li>Document manuals & specs</li>
                    <li>HNSW vector index & graph communities</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* The Matrix Table & Golden Architectural Rules */}
            <div className="matrix-table-card">
              <h4 className="table-headline">Memory vs State Decision Matrix</h4>

              <div className="matrix-table-wrapper">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>DATA CATEGORY</th>
                      <th className="text-center">REMEMBER (MEMORY)</th>
                      <th className="text-center">STORE AS SESSION</th>
                      <th className="text-center">STORE AS WORKFLOW</th>
                      <th className="text-center">AUDIT LOG</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="row-label">
                        <strong>User preference / Policy</strong>
                        <small>E.g. air-gap rules, model selection</small>
                      </td>
                      <td className="text-center check-cell green">
                        <Check size={16} />
                      </td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center dash-cell">—</td>
                    </tr>
                    <tr>
                      <td className="row-label">
                        <strong>Current conversation turn</strong>
                        <small>E.g. recent prompt & response</small>
                      </td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center check-cell blue">
                        <Check size={16} />
                      </td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center dash-cell">—</td>
                    </tr>
                    <tr>
                      <td className="row-label">
                        <strong>Pending human approval</strong>
                        <small>E.g. radar calibration confirmation</small>
                      </td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center check-cell amber">
                        <Check size={16} />
                      </td>
                      <td className="text-center dash-cell">—</td>
                    </tr>
                    <tr>
                      <td className="row-label">
                        <strong>Completed action / tool execution</strong>
                        <small>E.g. SHA-256 seal, file creation</small>
                      </td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center dash-cell">—</td>
                      <td className="text-center check-cell purple">
                        <Check size={16} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Crucial Architectural Warning & Info Callouts (Image 3) */}
              <div className="callouts-grid">
                <div className="callout-card warning">
                  <AlertTriangle size={18} className="text-amber" />
                  <div>
                    <strong>Do not treat all context as memory.</strong>
                    <p>
                      Ephemeral conversation turns and tool results should not contaminate long-term
                      procedural memory. Keep transient session state isolated.
                    </p>
                  </div>
                </div>

                <div className="callout-card info">
                  <Info size={18} className="text-cyan" />
                  <div>
                    <strong>RAG is not memory. Audit is not memory.</strong>
                    <p>
                      Vector retrieval (RAG) fetches static source facts at runtime. Audit records
                      prove forensic history. Neither alters agent persona or learned weights.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SESSION INTELLIGENCE & HISTORY (DATE, TIME, SESSIONS) */}
        {/* ============================================================ */}
        {activeTab === 'sessions' && (
          <div className="memory-sessions-stage">
            {/* Active Session Readout Card */}
            {currentSession && (
              <div className="active-session-spotlight">
                <div className="spotlight-header">
                  <div className="spotlight-title-cluster">
                    <span className="pulse-dot-green" />
                    <div>
                      <span className="spotlight-tag">ACTIVE MISSION SESSION</span>
                      <h3 className="spotlight-name">{currentSession.title}</h3>
                    </div>
                  </div>
                  <span className="session-id-pill font-mono">{currentSession.session_id}</span>
                </div>

                <div className="spotlight-metrics-grid">
                  <div className="spotlight-metric">
                    <span className="metric-label">SESSION DATE</span>
                    <strong className="metric-value text-cyan">
                      {currentSession.date_formatted}
                    </strong>
                    <small>{formattedDate}</small>
                  </div>

                  <div className="spotlight-metric">
                    <span className="metric-label">SESSION TIME</span>
                    <strong className="metric-value text-emerald font-mono">
                      {currentSession.time_formatted}
                    </strong>
                    <small>Live: {formattedTime}</small>
                  </div>

                  <div className="spotlight-metric">
                    <span className="metric-label">TOTAL TURNS</span>
                    <strong className="metric-value text-amber">
                      {currentSession.turns_count} steps
                    </strong>
                    <small>Sequential buffer</small>
                  </div>

                  <div className="spotlight-metric">
                    <span className="metric-label">CONTEXT BUDGET</span>
                    <strong className="metric-value text-cyan font-mono">
                      {currentSession.memory_breakdown.total_tokens} /{' '}
                      {currentSession.memory_breakdown.max_context_window}
                    </strong>
                    <small>{pctUsage}% consumed</small>
                  </div>
                </div>
              </div>
            )}

            {/* Sessions History Table */}
            <div className="sessions-table-card">
              <div className="table-card-header">
                <div>
                  <h4 className="sessions-headline">All Sovereign Mission Sessions</h4>
                  <p className="sessions-sub">
                    Temporal session provenance with exact dates, times, and memory allocations
                  </p>
                </div>
                <button onClick={handleCreateNewSession} className="new-session-btn small">
                  <Plus size={13} />
                  <span>Start New Session</span>
                </button>
              </div>

              <div className="sessions-table-container">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>SESSION ID</th>
                      <th>TITLE</th>
                      <th>DATE</th>
                      <th>START TIME</th>
                      <th>MODEL</th>
                      <th>TURNS</th>
                      <th>TOKENS</th>
                      <th>STATUS</th>
                      <th className="text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((sess) => {
                      const isCurrent = sess.session_id === currentSession?.session_id;
                      return (
                        <tr
                          key={sess.session_id}
                          className={`session-row ${isCurrent ? 'current-active' : ''}`}
                          onClick={() => {
                            setCurrentSession(sess);
                            if (onSelectSession) onSelectSession(sess.session_id);
                          }}
                        >
                          <td className="session-id-cell font-mono">
                            {isCurrent && <span className="active-marker" />}
                            {sess.session_id}
                          </td>
                          <td className="session-title-cell">
                            <strong>{sess.title}</strong>
                          </td>
                          <td className="session-date-cell">
                            <span className="date-badge">
                              <Calendar size={11} className="text-cyan" />
                              <span>{sess.date_formatted}</span>
                            </span>
                          </td>
                          <td className="session-time-cell font-mono">
                            <span className="time-badge">
                              <Clock size={11} className="text-emerald" />
                              <span>{sess.time_formatted}</span>
                            </span>
                          </td>
                          <td className="session-model-cell font-mono text-muted">
                            {sess.model.replace('gemma4:', 'Gemma ')}
                          </td>
                          <td className="session-turns-cell font-mono">{sess.turns_count}</td>
                          <td className="session-tokens-cell font-mono text-cyan">
                            {sess.memory_breakdown?.total_tokens?.toLocaleString() || 0}t
                          </td>
                          <td className="session-status-cell">
                            <span className={`status-pill ${sess.status}`}>
                              {sess.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="session-actions-cell text-right">
                            <button
                              onClick={(e) => handleDeleteSession(sess.session_id, e)}
                              className="delete-session-btn"
                              title="Delete Session"
                              aria-label={`Delete ${sess.session_id}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
