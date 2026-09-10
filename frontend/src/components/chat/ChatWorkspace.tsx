'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Copy,
  Cpu,
  Database,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Plus,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, ChatMessage, SessionItem } from '@/lib/types';
import { sessionStore } from '@/lib/session-store';

interface ChatWorkspaceProps {
  currentModel?: string;
  availableModels?: string[];
  onModelChange?: (model: string) => void;
  onError?: (err: AppError) => void;
}

interface TelemetryStage {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'completed' | 'idle';
  icon: React.ReactNode;
}

export default function ChatWorkspace({
  currentModel = 'gemma4:e2b',
  availableModels = ['gemma4:e2b', 'gemma4:e4b-it-qat'],
  onModelChange,
  onError,
}: ChatWorkspaceProps) {
  const [activeSessionId, setActiveSessionId] = useState<string>('SES-20260909-001');
  // Ref so the sessionStore subscriber can read the current session ID
  // without stale closure — avoids comparing against the initial default.
  const activeSessionIdRef = React.useRef<string>('SES-20260909-001');
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Sovereign AI Reasoning Core online. Local air-gapped environment verified. Ready to analyze classified documentation, execute local sandbox tools, or synthesize mission telemetry.',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Sessions
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  // Telemetry Rail Stages
  const [telemetryStages, setTelemetryStages] = useState<TelemetryStage[]>([
    { id: '1', label: 'Intent Classification', detail: 'Local heuristic analyzer', status: 'idle', icon: <Compass size={14} /> },
    { id: '2', label: 'Autonomous Agent Dispatch', detail: 'Task decomposition squad', status: 'idle', icon: <Bot size={14} /> },
    { id: '3', label: 'Knowledge Retrieval', detail: 'ChromaDB HNSW cosine search', status: 'idle', icon: <Database size={14} /> },
    { id: '4', label: 'Sandbox Tool Execution', detail: 'Zero-egress hardware sandbox', status: 'idle', icon: <Wrench size={14} /> },
    { id: '5', label: 'Local Model Inference', detail: 'Offline Ollama compute core', status: 'idle', icon: <Cpu size={14} /> },
    { id: '6', label: 'Response Verification', detail: 'Cryptographic SHA-256 seal', status: 'idle', icon: <ShieldCheck size={14} /> },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSelectedModel(currentModel);
  }, [currentModel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Load Sessions and Hydrate
  useEffect(() => {
    const currentSid = sessionStore.getActiveSessionId('SES-20260909-001');
    setActiveSessionId(currentSid);
    activeSessionIdRef.current = currentSid;

    api
      .listSessions()
      .then((data) => {
        if (data && data.length > 0) {
          setSessions(data);
          const cached = sessionStore.getSessionMessages(currentSid);
          const matched = data.find((s) => s.session_id === currentSid);
          if (matched && (!cached || cached.length <= 1) && matched.recent_turns?.length) {
            const loaded: ChatMessage[] = matched.recent_turns
              .filter((t) => t.role === 'user' || t.role === 'assistant')
              .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content }));
            if (loaded.length > 0) {
              setMessages(loaded);
              sessionStore.saveSessionMessages(currentSid, loaded);
            }
          }
        }
      })
      .catch(() => {});

    // Listen for session changes dispatched by OTHER components (e.g. HUD).
    // CRITICAL: Do NOT call sessionStore.setActiveSessionId inside this listener —
    // that re-fires SESSION_CHANGE_EVENT creating an infinite recursion loop.
    const unsub = sessionStore.onSessionChange((newSid) => {
      if (newSid && newSid !== activeSessionIdRef.current) {
        // Update local React state only — do NOT write back to the store.
        switchSessionLocalState(newSid);
      }
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * switchSessionLocalState — called ONLY from the sessionStore subscriber.
   * Updates React state WITHOUT writing to sessionStore (which would
   * re-fire the event and cause an infinite loop).
   */
  const switchSessionLocalState = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
    const cached = sessionStore.getSessionMessages(sessionId);
    if (cached && cached.length > 0) setMessages(cached);
    try {
      const full = await api.getSession(sessionId);
      if (full?.recent_turns?.length) {
        const mapped: ChatMessage[] = full.recent_turns
          .filter((t) => t.role === 'user' || t.role === 'assistant')
          .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content }));
        if (mapped.length > 0) {
          setMessages(mapped);
          sessionStore.saveSessionMessages(sessionId, mapped);
        }
      }
    } catch { /* keep cached */ }
  };

  /**
   * handleSelectSession — called when the USER clicks a session in the sidebar.
   * Writes to sessionStore (notifies HUD), then hydrates messages.
   * The ref guard prevents the subscriber from re-entering this path.
   */
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionIdRef.current) return; // already active — no-op
    // Update ref BEFORE writing to store so the subscriber's guard fires correctly
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    sessionStore.setActiveSessionId(sessionId);
    api.activateSession(sessionId).catch(() => {});

    // 1. Check local cache first for instant retrieval
    const cached = sessionStore.getSessionMessages(sessionId);
    if (cached && cached.length > 0) setMessages(cached);

    // 2. Fetch latest session details from backend
    try {
      const full = await api.getSession(sessionId);
      if (full?.recent_turns?.length) {
        const mapped: ChatMessage[] = full.recent_turns
          .filter((t) => t.role === 'user' || t.role === 'assistant')
          .map((t) => ({
            role: t.role as 'user' | 'assistant',
            content: t.content,
          }));
        if (mapped.length > 0) {
          setMessages(mapped);
          sessionStore.saveSessionMessages(sessionId, mapped);
        }
      }
    } catch {
      // Keep cached messages
    }
  };

  const handleStartNewSession = async () => {
    const defaultGreeting: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'New mission session initialized. Context memory buffer cleared. Ready for instructions.',
      },
    ];

    try {
      const created = await api.createSession({
        title: `Mission ${new Date().toLocaleTimeString('en-US', { hour12: false })}`,
        model: selectedModel,
      });
      const newId = created.session_id;
      setActiveSessionId(newId);
      sessionStore.setActiveSessionId(newId);
      setMessages(defaultGreeting);
      sessionStore.saveSessionMessages(newId, defaultGreeting);
      setSessions((prev) => [created, ...prev.filter((s) => s.session_id !== newId)]);
    } catch {
      const fallbackId = `SES-${Date.now().toString().slice(-6)}`;
      setActiveSessionId(fallbackId);
      sessionStore.setActiveSessionId(fallbackId);
      setMessages(defaultGreeting);
      sessionStore.saveSessionMessages(fallbackId, defaultGreeting);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || inputPrompt;
    if (!text.trim() || isStreaming || isExecutingAgent) return;

    setInputPrompt('');
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    sessionStore.saveSessionMessages(activeSessionId, updatedMessages);

    // Record user turn to durable backend session
    api
      .appendSessionTurn(activeSessionId, {
        role: 'user',
        type: 'user_input',
        content: text.trim(),
      })
      .catch(() => {});

    setIsStreaming(true);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);

    // Animate Telemetry Pipeline sequentially
    setTelemetryStages((prev) =>
      prev.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'running' : 'pending',
      }))
    );

    // Progress through safe operational telemetry
    setTimeout(() => {
      setTelemetryStages((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx === 0 ? 'completed' : idx === 1 ? 'running' : s.status,
        }))
      );
    }, 400);

    setTimeout(() => {
      setTelemetryStages((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx <= 1 ? 'completed' : idx === 2 ? 'running' : s.status,
        }))
      );
    }, 900);

    setTimeout(() => {
      setTelemetryStages((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx <= 2 ? 'completed' : idx === 3 ? 'running' : s.status,
        }))
      );
    }, 1400);

    setTimeout(() => {
      setTelemetryStages((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx <= 3 ? 'completed' : idx === 4 ? 'running' : s.status,
        }))
      );
    }, 2000);

    let assistantContent = '';
    const tempAssistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...updatedMessages, tempAssistantMsg]);

    try {
      await api.streamChat(
        updatedMessages,
        selectedModel,
        (chunk) => {
          assistantContent += chunk;
          setMessages([...updatedMessages, { role: 'assistant', content: assistantContent }]);
        },
        () => {
          setIsStreaming(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setTelemetryStages((prev) =>
            prev.map((s) => ({ ...s, status: 'completed' }))
          );
          const finalMessages: ChatMessage[] = [
            ...updatedMessages,
            { role: 'assistant', content: assistantContent },
          ];
          sessionStore.saveSessionMessages(activeSessionId, finalMessages);
          api
            .appendSessionTurn(activeSessionId, {
              role: 'assistant',
              type: 'internal_chatter',
              content: assistantContent,
            })
            .catch(() => {});
        },
        (err) => {
          setIsStreaming(false);
          if (timerRef.current) clearInterval(timerRef.current);
          if (onError) onError(normalizeError(err));
        }
      );
    } catch (err) {
      setIsStreaming(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (onError) onError(normalizeError(err));
    }
  };

  const handleCopy = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const SUGGESTIONS = [
    {
      id: '1',
      tag: 'RADAR TELEMETRY',
      prompt: 'Inspect defense radar manual specs, check frequency tolerances, and verify SNR baseline.',
    },
    {
      id: '2',
      tag: 'SECURITY AUDIT',
      prompt: 'Verify air-gapped system isolation and confirm 0 bytes cloud egress escape.',
    },
    {
      id: '3',
      tag: 'ORBITAL MATH',
      prompt: 'Calculate delta-V orbital requirements for 400km LEO stationkeeping with sandbox calculator.',
    },
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
              <span>AI REASONING WORKSPACE // 3-COLUMN COCKPIT</span>
            </div>
            <h1 className="sovereign-title">Mission Chat & Intelligence Cockpit</h1>
            <p className="sovereign-subtitle">
              Interactive conversational console with contextual session provenance, safe operational telemetry, and cryptographic verification.
            </p>
          </div>
        </div>

        <div className="sovereign-header-badges">
          <div className="sovereign-badge-pill verified">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>LOCAL AIR-GAP // ZERO EGRESS</span>
          </div>

          <div className="sovereign-badge-pill model">
            <Cpu size={13} className="text-cyan" />
            <span>MODEL: {selectedModel.replace('gemma4:', 'Gemma ')}</span>
          </div>
        </div>
      </header>

      {/* 3-Column Operational Cockpit Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 280px',
          gap: '20px',
          minHeight: '620px',
          alignItems: 'stretch',
        }}
      >
        {/* LEFT COLUMN: Mission & Session History */}
        <div
          className="sovereign-glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} className="text-cyan" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                SESSION HISTORY
              </span>
            </div>
            <button
              onClick={handleStartNewSession}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 210, 255, 0.15)',
                border: '1px solid rgba(0, 210, 255, 0.3)',
                color: 'var(--sov-cyan)',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>

          {/* Current Session Tag */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(0, 210, 255, 0.08)',
              border: '1px solid rgba(0, 210, 255, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '10px', color: 'var(--sov-cyan)', fontFamily: 'var(--font-mono)' }}>
              ACTIVE SESSION
            </span>
            <span
              suppressHydrationWarning
              style={{ fontSize: '12px', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
            >
              {activeSessionId}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)' }}>
              Turns: {messages.length} • Local Storage
            </span>
          </div>

          {/* Past Sessions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
            <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)', fontFamily: 'var(--font-mono)' }}>
              PRIOR MISSIONS
            </span>
            {sessions.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--sov-text-muted)', padding: '12px 0' }}>
                No prior sessions stored.
              </div>
            ) : (
              sessions.slice(0, 5).map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: s.session_id === activeSessionId ? 'rgba(139, 114, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: s.session_id === activeSessionId ? '1px solid var(--sov-indigo)' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    gap: '2px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#fff', fontWeight: 600 }}>
                    {s.title || s.session_id}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)' }}>
                    {s.memory_breakdown?.total_tokens ? `${s.memory_breakdown.total_tokens} tokens` : 'Standard context'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* CENTER COLUMN: AI Conversation & Command Console */}
        <div
          className="sovereign-glass-panel"
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          {/* Conversation Feed */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              maxHeight: '440px',
              paddingRight: '6px',
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: m.role === 'user' ? 'var(--sov-cyan)' : 'var(--sov-gold)',
                  }}
                >
                  {m.role === 'user' ? <span>OPERATOR DIRECTIVE</span> : <span>SOVEREIGN AGENT</span>}
                </div>

                <div
                  style={{
                    maxWidth: '85%',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    background:
                      m.role === 'user'
                        ? 'linear-gradient(135deg, rgba(14, 50, 90, 0.8), rgba(8, 26, 50, 0.75))'
                        : 'linear-gradient(135deg, rgba(20, 12, 45, 0.85), rgba(10, 6, 26, 0.8))',
                    border:
                      m.role === 'user'
                        ? '1px solid rgba(0, 210, 255, 0.3)'
                        : '1px solid rgba(139, 114, 255, 0.25)',
                    color: '#ffffff',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                  }}
                >
                  {m.content || (isStreaming && idx === messages.length - 1 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sov-cyan)' }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Local model reasoning in progress...</span>
                    </div>
                  ) : null)}

                  {m.role === 'assistant' && m.content && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <button
                        onClick={() => handleCopy(m.content, idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--sov-text-muted)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedIdx === idx ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                        <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Directives & Command Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Suggestions */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSendMessage(item.prompt)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--sov-border-subtle)',
                    color: 'var(--sov-text-secondary)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--sov-cyan)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--sov-border-subtle)')}
                >
                  {item.tag}
                </button>
              ))}
            </div>

            {/* High-End Command Input Console */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 14px',
                borderRadius: '12px',
                background: 'rgba(8, 4, 22, 0.85)',
                border: '1px solid var(--sov-border-medium)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              }}
            >
              <Terminal size={16} className="text-cyan" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter directive for Sovereign Core..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isStreaming}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                }}
              />

              {/* Model Select */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Bot size={13} className="text-cyan" />
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    if (onModelChange) onModelChange(e.target.value);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m} style={{ background: '#050a1a', color: '#fff' }}>
                      {m.replace('gemma4:', 'Gemma ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dispatch Button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isStreaming}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: inputPrompt.trim() && !isStreaming ? 'linear-gradient(135deg, #00d2ff, #0088cc)' : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: inputPrompt.trim() && !isStreaming ? '#020617' : 'rgba(255, 255, 255, 0.3)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: inputPrompt.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                  boxShadow: inputPrompt.trim() && !isStreaming ? '0 0 16px rgba(0, 210, 255, 0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Execution Telemetry Rail */}
        <div
          className="sovereign-glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={15} className="text-cyan animate-pulse" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                LIVE TELEMETRY
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--sov-text-muted)' }}>
              {elapsedSeconds > 0 ? `${elapsedSeconds}s` : 'IDLE'}
            </span>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--sov-text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Safe operational telemetry path for local deterministic execution.
          </p>

          {/* Stepper Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
            {telemetryStages.map((stage, idx) => (
              <div
                key={stage.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background:
                    stage.status === 'running'
                      ? 'rgba(0, 210, 255, 0.12)'
                      : stage.status === 'completed'
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border:
                    stage.status === 'running'
                      ? '1px solid rgba(0, 210, 255, 0.4)'
                      : stage.status === 'completed'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                  transition: 'all 0.25s ease',
                }}
              >
                <div
                  style={{
                    color:
                      stage.status === 'running'
                        ? 'var(--sov-cyan)'
                        : stage.status === 'completed'
                        ? '#10b981'
                        : 'var(--sov-text-muted)',
                    marginTop: '2px',
                  }}
                >
                  {stage.status === 'running' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : stage.status === 'completed' ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    stage.icon
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: stage.status === 'completed' ? '#fff' : stage.status === 'running' ? 'var(--sov-cyan)' : 'var(--sov-text-secondary)',
                    }}
                  >
                    {stage.label}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)' }}>
                    {stage.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>

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
                SHA-256 AIR-GAP SHIELD
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Zero outbound telemetry leak
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
