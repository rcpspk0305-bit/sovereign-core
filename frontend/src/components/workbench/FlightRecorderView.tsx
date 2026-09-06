'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import {
  ApprovalStatus,
  FlightEvent,
  FlightRecord,
  GeneratedArtifact,
  NetworkMode,
  RecordedError,
  RetrievedSource,
  ToolExecutionRecord,
} from '@/lib/types';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileCheck,
  FileCode,
  FileText,
  Hash,
  Layers,
  Lock,
  Play,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';

interface FlightRecorderViewProps {
  model: string;
}

export default function FlightRecorderView({ model }: FlightRecorderViewProps) {
  const [prompt, setPrompt] = useState<string>(
    'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.'
  );
  const [networkMode, setNetworkMode] = useState<NetworkMode>('AIR_GAPPED_LOCAL');
  const [maxSteps, setMaxSteps] = useState<number>(5);
  const [running, setRunning] = useState<boolean>(false);
  const [copiedTaskId, setCopiedTaskId] = useState<boolean>(false);
  const [copiedArtifact, setCopiedArtifact] = useState<boolean>(false);

  // Active record state
  const [currentRecord, setCurrentRecord] = useState<FlightRecord | null>(null);
  const [recordsHistory, setRecordsHistory] = useState<FlightRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Live WebSocket state & event stream
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [rawEvents, setRawEvents] = useState<FlightEvent[]>([]);
  const [activeTab, setActiveTab] = useState<
    'steps' | 'tools' | 'sources' | 'artifacts' | 'errors' | 'raw_stream'
  >('steps');

  // Real-time latency stopwatch during execution
  const [liveLatencyMs, setLiveLatencyMs] = useState<number>(0);
  const runStartTimeRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Load history on mount
  const fetchRecords = async () => {
    setLoadingHistory(true);
    try {
      const list = await api.getFlightRecords(20);
      setRecordsHistory(list);
      if (list.length > 0 && !currentRecord) {
        setCurrentRecord(list[0]);
      }
    } catch (err) {
      console.warn('Could not load flight records history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Real-time stopwatch ticker
  useEffect(() => {
    let timer: any = null;
    if (running) {
      runStartTimeRef.current = Date.now();
      timer = setInterval(() => {
        if (runStartTimeRef.current) {
          setLiveLatencyMs(Date.now() - runStartTimeRef.current);
        }
      }, 50);
    } else {
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [running]);

  // WebSocket Connection Management
  useEffect(() => {
    const wsUrl = api.getWebSocketUrl();
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
        };

        socket.onclose = () => {
          setWsConnected(false);
          // Try reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        socket.onerror = () => {
          setWsConnected(false);
        };

        socket.onmessage = (event) => {
          try {
            const data: FlightEvent = JSON.parse(event.data);
            handleIncomingFlightEvent(data);
          } catch (e) {
            // non-json or ping frame
          }
        };
      } catch (err) {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  // Handle incoming live telemetry events
  const handleIncomingFlightEvent = (ev: FlightEvent) => {
    setRawEvents((prev) => [...prev.slice(-100), ev]);

    // Auto-scroll raw stream if terminal is visible
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    if (ev.event_type === 'task_started') {
      setCurrentRecord((prev) => ({
        task_id: ev.task_id,
        model: ev.data.model || model,
        prompt: ev.data.prompt || '',
        network_mode: ev.data.network_mode || 'AIR_GAPPED_LOCAL',
        approval_status: ev.data.approval_status || 'PENDING',
        status: 'running',
        start_time: ev.timestamp,
        steps: [],
        tools_called: [],
        retrieved_sources: [],
        artifacts_generated: [],
        errors: [],
        metadata: {},
      }));
    } else if (ev.event_type === 'step_started') {
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        const exists = prev.steps.some((s) => s.step_number === ev.data.step_number);
        if (exists) return prev;
        return {
          ...prev,
          steps: [
            ...prev.steps,
            {
              step_number: ev.data.step_number,
              thought: ev.data.thought,
              timestamp: ev.timestamp,
              status: 'running',
            },
          ],
        };
      });
    } else if (ev.event_type === 'tool_called') {
      // Step update with tool call
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.step_number === ev.data.step_number
              ? { ...s, thought: ev.data.thought || s.thought }
              : s
          ),
        };
      });
    } else if (ev.event_type === 'tool_completed') {
      const toolRec: ToolExecutionRecord = {
        step_number: ev.data.step_number,
        tool_name: ev.data.tool_name,
        tool_arguments: ev.data.tool_arguments || {},
        execution_time_ms: ev.data.execution_time_ms || 0,
        success: ev.data.success !== false,
        error: ev.data.error,
        output_preview: ev.data.output_preview,
      };
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        return {
          ...prev,
          tools_called: [...prev.tools_called, toolRec],
        };
      });
    } else if (ev.event_type === 'sources_retrieved') {
      const sources: RetrievedSource[] = ev.data.sources || [];
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        return {
          ...prev,
          retrieved_sources: [...prev.retrieved_sources, ...sources],
        };
      });
    } else if (ev.event_type === 'artifact_generated') {
      const artifact: GeneratedArtifact = ev.data as GeneratedArtifact;
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        return {
          ...prev,
          artifacts_generated: [...prev.artifacts_generated, artifact],
        };
      });
    } else if (ev.event_type === 'error_recorded') {
      const errorRec: RecordedError = {
        step_number: ev.data.step_number,
        error_message: ev.data.error_message,
        severity: ev.data.severity || 'error',
        timestamp: ev.timestamp,
      };
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        return {
          ...prev,
          errors: [...prev.errors, errorRec],
        };
      });
    } else if (ev.event_type === 'task_completed') {
      setRunning(false);
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        const updated: FlightRecord = {
          ...prev,
          status: ev.data.status || 'completed',
          approval_status: ev.data.approval_status || prev.approval_status,
          total_latency_ms: ev.data.total_latency_ms,
          final_response: ev.data.final_response,
        };
        // Update history cache
        setRecordsHistory((old) => [
          updated,
          ...old.filter((r) => r.task_id !== updated.task_id),
        ]);
        return updated;
      });
    } else if (ev.event_type === 'approval_updated') {
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== ev.task_id) return prev;
        const updated: FlightRecord = {
          ...prev,
          approval_status: ev.data.approval_status,
          metadata: {
            ...prev.metadata,
            approval_notes: ev.data.notes,
          },
        };
        setRecordsHistory((old) =>
          old.map((r) => (r.task_id === updated.task_id ? updated : r))
        );
        return updated;
      });
    }
  };

  const handleLaunchMission = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setRawEvents([]);
    const generatedTaskId = `mission_${Math.random().toString(36).substring(2, 9)}`;

    // Set optimistic running record
    setCurrentRecord({
      task_id: generatedTaskId,
      model: model || 'gemma4:e2b',
      prompt: prompt.trim(),
      network_mode: networkMode,
      approval_status: 'PENDING',
      status: 'running',
      start_time: new Date().toISOString(),
      steps: [],
      tools_called: [],
      retrieved_sources: [],
      artifacts_generated: [],
      errors: [],
      metadata: {},
    });

    try {
      // Launch through REST endpoint which hooks manager and broadcasts through WebSocket
      const finishedRecord = await api.runFlightMission(
        prompt.trim(),
        model || 'gemma4:e2b',
        networkMode,
        generatedTaskId,
        maxSteps
      );
      setCurrentRecord(finishedRecord);
      setRecordsHistory((old) => [
        finishedRecord,
        ...old.filter((r) => r.task_id !== finishedRecord.task_id),
      ]);
    } catch (err: any) {
      console.error('Mission launch failed:', err);
      setCurrentRecord((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              approval_status: 'FAILED',
              errors: [
                ...prev.errors,
                {
                  error_message: err.message || 'Execution failed',
                  severity: 'error',
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : null
      );
    } finally {
      setRunning(false);
    }
  };

  const handleUpdateApproval = async (status: ApprovalStatus) => {
    if (!currentRecord) return;
    try {
      const updated = await api.updateFlightApproval(
        currentRecord.task_id,
        status,
        `Auditor manual disposition set to ${status}`
      );
      setCurrentRecord(updated);
      setRecordsHistory((old) =>
        old.map((r) => (r.task_id === updated.task_id ? updated : r))
      );
    } catch (err) {
      console.error('Failed to update approval:', err);
    }
  };

  const copyTaskId = () => {
    if (!currentRecord?.task_id) return;
    navigator.clipboard.writeText(currentRecord.task_id);
    setCopiedTaskId(true);
    setTimeout(() => setCopiedTaskId(false), 2000);
  };

  const copyArtifactContent = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedArtifact(true);
    setTimeout(() => setCopiedArtifact(false), 2000);
  };

  const getApprovalBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'AUTO_VERIFIED':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--accent-emerald)',
          border: 'rgba(16, 185, 129, 0.3)',
          icon: <ShieldCheck size={13} />,
          text: 'AUTO-VERIFIED',
        };
      case 'APPROVED':
        return {
          bg: 'rgba(6, 182, 212, 0.15)',
          color: 'var(--accent-cyan)',
          border: 'rgba(6, 182, 212, 0.3)',
          icon: <CheckCircle2 size={13} />,
          text: 'HUMAN APPROVED',
        };
      case 'PENDING':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: 'var(--accent-amber)',
          border: 'rgba(245, 158, 11, 0.3)',
          icon: <Clock size={13} />,
          text: 'PENDING AUDIT',
        };
      case 'POLICY_VIOLATION':
        return {
          bg: 'rgba(244, 63, 94, 0.2)',
          color: 'var(--accent-rose)',
          border: 'rgba(244, 63, 94, 0.4)',
          icon: <ShieldAlert size={13} />,
          text: 'POLICY VIOLATION',
        };
      case 'REJECTED':
      case 'FAILED':
      default:
        return {
          bg: 'rgba(244, 63, 94, 0.15)',
          color: 'var(--accent-rose)',
          border: 'rgba(244, 63, 94, 0.3)',
          icon: <XCircle size={13} />,
          text: status,
        };
    }
  };

  const approvalUI = getApprovalBadge(currentRecord?.approval_status || 'PENDING');

  const presets = [
    {
      label: 'Apollo99 Cold-Start Inspection',
      prompt:
        'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.',
    },
    {
      label: 'Air-Gapped Security Compliance',
      prompt:
        'Search the knowledge base for air-gapped security guidelines and summarize key findings.',
    },
    {
      label: 'Deterministic Calculation Audit',
      prompt:
        'Use the calculator tool to compute ((145 * 12) + 360) / 4 and show your work.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. FORENSIC TELEMETRY STATUS RIBBON */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Title & Live Connection Pulse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              <Radio size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.02em' }}>
                AI FLIGHT RECORDER & TELEMETRY
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Forensic blackbox audit logging with real-time WebSocket event emission
              </div>
            </div>
          </div>

          {/* Connection Status & Event counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '9999px',
                background: wsConnected
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(244, 63, 94, 0.12)',
                color: wsConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                border: `1px solid ${
                  wsConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
                }`,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: wsConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  boxShadow: wsConnected
                    ? '0 0 6px var(--accent-emerald)'
                    : '0 0 6px var(--accent-rose)',
                }}
              />
              <span>{wsConnected ? 'LIVE WEBSOCKET STREAM' : 'WS DISCONNECTED'}</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
              }}
            >
              {rawEvents.length} events
            </span>
          </div>
        </div>

        {/* Forensic Metadata Tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {/* TASK ID */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Task ID
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--accent-cyan)',
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={currentRecord?.task_id || 'None'}
              >
                {currentRecord?.task_id || 'No active task'}
              </span>
              {currentRecord?.task_id && (
                <button
                  onClick={copyTaskId}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedTaskId ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  title="Copy Task ID"
                >
                  {copiedTaskId ? <Check size={13} /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          {/* SELECTED MODEL */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Selected Model
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Cpu size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>
                {currentRecord?.model || model || 'gemma4:e2b'}
              </span>
            </div>
          </div>

          {/* NETWORK MODE */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Network Mode
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Lock size={13} style={{ color: 'var(--accent-emerald)' }} />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: 'var(--accent-emerald)',
                }}
              >
                {currentRecord?.network_mode || networkMode}
              </span>
            </div>
          </div>

          {/* APPROVAL STATUS */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Approval Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  background: approvalUI.bg,
                  color: approvalUI.color,
                  border: `1px solid ${approvalUI.border}`,
                }}
              >
                {approvalUI.icon}
                {approvalUI.text}
              </span>
            </div>
          </div>

          {/* EXECUTION LATENCY */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Mission Latency
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Clock size={14} style={{ color: running ? 'var(--accent-amber)' : 'var(--text-secondary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>
                {running
                  ? `${liveLatencyMs.toLocaleString()} ms (running)`
                  : currentRecord?.total_latency_ms != null
                  ? `${currentRecord.total_latency_ms.toLocaleString()} ms`
                  : '-- ms'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MISSION DISPATCHER & FORENSIC SELECTOR */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={15} style={{ color: 'var(--accent-cyan)' }} />
            Mission Parameter Deck
          </div>

          {/* Historical Record Replay Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Replay Record:</span>
            <select
              className="select"
              style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', minWidth: '180px' }}
              value={currentRecord?.task_id || ''}
              onChange={(e) => {
                const found = recordsHistory.find((r) => r.task_id === e.target.value);
                if (found) setCurrentRecord(found);
              }}
            >
              {recordsHistory.length === 0 ? (
                <option value="">No recorded missions</option>
              ) : (
                recordsHistory.map((rec) => (
                  <option key={rec.task_id} value={rec.task_id}>
                    {rec.task_id} [{rec.approval_status}] ({rec.tools_called.length} tools)
                  </option>
                ))
              )}
            </select>
            <button
              className="btn btn-secondary"
              onClick={fetchRecords}
              disabled={loadingHistory}
              style={{ padding: '4px 8px', fontSize: '12px' }}
              title="Refresh records"
            >
              <RefreshCw size={12} className={loadingHistory ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Preset Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {presets.map((p, idx) => (
            <button
              key={idx}
              disabled={running}
              onClick={() => setPrompt(p.prompt)}
              style={{
                background: prompt === p.prompt ? 'var(--accent-cyan-glow)' : 'var(--bg-tertiary)',
                color: prompt === p.prompt ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: `1px solid ${
                  prompt === p.prompt ? 'var(--accent-cyan)' : 'var(--border-subtle)'
                }`,
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Prompt Input & Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <textarea
            className="textarea"
            rows={2}
            value={prompt}
            disabled={running}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter mission prompt to execute under blackbox recording..."
            style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px' }}>
            {/* Network Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '60px' }}>Mode:</span>
              <select
                className="select"
                disabled={running}
                value={networkMode}
                onChange={(e) => setNetworkMode(e.target.value as NetworkMode)}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                <option value="AIR_GAPPED_LOCAL">AIR_GAPPED_LOCAL</option>
                <option value="NO_EGRESS">NO_EGRESS</option>
              </select>
            </div>

            {/* Launch Button */}
            <button
              className="btn btn-primary"
              disabled={running || !prompt.trim()}
              onClick={handleLaunchMission}
              style={{ width: '100%', fontSize: '13px', fontWeight: 600, padding: '8px 12px' }}
            >
              {running ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>RECORDING...</span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>LAUNCH MISSION</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Human-in-the-loop Disposition Buttons */}
        {currentRecord && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span>Auditor Disposition Controls:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--accent-emerald)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                }}
                onClick={() => handleUpdateApproval('APPROVED')}
                disabled={running}
              >
                <CheckCircle2 size={12} />
                <span>Mark Approved</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--accent-rose)',
                  borderColor: 'rgba(244, 63, 94, 0.3)',
                }}
                onClick={() => handleUpdateApproval('REJECTED')}
                disabled={running}
              >
                <XCircle size={12} />
                <span>Reject</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(6, 182, 212, 0.3)',
                }}
                onClick={() => handleUpdateApproval('AUTO_VERIFIED')}
                disabled={running}
              >
                <ShieldCheck size={12} />
                <span>Auto-Verify</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. EVIDENCE-ORIENTED FORENSIC PANELS */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '0px',
          overflow: 'hidden',
          minHeight: '440px',
        }}
      >
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            overflowX: 'auto',
          }}
        >
          {[
            {
              id: 'steps',
              label: 'Execution Steps',
              icon: <Layers size={14} />,
              count: currentRecord?.steps.length || 0,
            },
            {
              id: 'tools',
              label: 'Tools Called',
              icon: <Wrench size={14} />,
              count: currentRecord?.tools_called.length || 0,
            },
            {
              id: 'sources',
              label: 'Retrieved Sources',
              icon: <Database size={14} />,
              count: currentRecord?.retrieved_sources.length || 0,
            },
            {
              id: 'artifacts',
              label: 'Artifacts Generated',
              icon: <FileCheck size={14} />,
              count: currentRecord?.artifacts_generated.length || 0,
            },
            {
              id: 'errors',
              label: 'Errors & Violations',
              icon: <AlertTriangle size={14} />,
              count: currentRecord?.errors.length || 0,
              highlight: (currentRecord?.errors.length || 0) > 0,
            },
            {
              id: 'raw_stream',
              label: 'WebSocket Blackbox Log',
              icon: <Terminal size={14} />,
              count: rawEvents.length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  background: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive
                    ? 'var(--accent-cyan)'
                    : tab.highlight
                    ? 'var(--accent-rose)'
                    : 'var(--text-secondary)',
                  border: 'none',
                  borderBottom: isActive
                    ? '2px solid var(--accent-cyan)'
                    : '2px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: tab.highlight
                      ? 'rgba(244, 63, 94, 0.2)'
                      : 'var(--bg-tertiary)',
                    color: tab.highlight ? 'var(--accent-rose)' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {/* TAB 1: EXECUTION STEPS */}
          {activeTab === 'steps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!currentRecord?.steps || currentRecord.steps.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No execution steps recorded yet. Launch a mission or choose a recorded replay.
                </div>
              ) : (
                currentRecord.steps.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: 'var(--accent-cyan)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      STEP {step.step_number}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : 'Recorded'}
                        </span>
                        <span
                          className="badge badge-success"
                          style={{ fontSize: '10px', textTransform: 'uppercase' }}
                        >
                          {step.status || 'Completed'}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          background: 'var(--bg-tertiary)',
                          padding: '10px 12px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.5',
                        }}
                      >
                        {step.thought || 'Executing reasoning phase...'}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Final Synthesis Output Display */}
              {currentRecord?.final_response && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '16px',
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--accent-emerald)',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Final Synthesized Agent Output
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {currentRecord.final_response}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TOOLS CALLED */}
          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(!currentRecord?.tools_called || currentRecord.tools_called.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No tools called during this mission.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '8px 12px', width: '70px' }}>Step #</th>
                      <th style={{ padding: '8px 12px', width: '180px' }}>Tool Name</th>
                      <th style={{ padding: '8px 12px' }}>Arguments (JSON)</th>
                      <th style={{ padding: '8px 12px', width: '110px' }}>Latency</th>
                      <th style={{ padding: '8px 12px', width: '90px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecord.tools_called.map((tool, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                          #{tool.step_number}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: 'var(--accent-cyan)',
                              padding: '2px 6px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '4px',
                            }}
                          >
                            {tool.tool_name}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}>
                          <div
                            style={{
                              background: 'var(--bg-primary)',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              maxHeight: '80px',
                              overflowY: 'auto',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {JSON.stringify(tool.tool_arguments, null, 2)}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                          {tool.execution_time_ms} ms
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            className={`badge ${tool.success ? 'badge-success' : 'badge-error'}`}
                            style={{ fontSize: '10px' }}
                          >
                            {tool.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: RETRIEVED SOURCES */}
          {activeTab === 'sources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!currentRecord?.retrieved_sources || currentRecord.retrieved_sources.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No vector sources retrieved. Run a mission that queries the document repository.
                </div>
              ) : (
                currentRecord.retrieved_sources.map((src, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={14} style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>
                          {src.document_name}
                        </span>
                        {src.page_number && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '1px 6px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '4px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Page {src.page_number}
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: 'var(--accent-cyan)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                        }}
                      >
                        Similarity: {(src.similarity_score * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace',
                        background: 'var(--bg-primary)',
                        padding: '10px 12px',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {src.chunk_preview}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: ARTIFACTS GENERATED */}
          {activeTab === 'artifacts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(!currentRecord?.artifacts_generated || currentRecord.artifacts_generated.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No cryptographic artifacts generated during this mission.
                </div>
              ) : (
                currentRecord.artifacts_generated.map((art, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>
                          {art.title}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            marginTop: '2px',
                          }}
                        >
                          ID: {art.artifact_id} | Type: {art.artifact_type}
                        </div>
                      </div>

                      <button
                        className="btn btn-secondary"
                        onClick={() => copyArtifactContent(art.content)}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {copiedArtifact ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedArtifact ? 'Copied' : 'Copy Content'}</span>
                      </button>
                    </div>

                    {/* SHA-256 Checksum Provenance Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        background: 'var(--bg-primary)',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    >
                      <Hash size={13} style={{ color: 'var(--accent-emerald)' }} />
                      <span style={{ color: 'var(--text-muted)' }}>SHA-256:</span>
                      <span style={{ color: 'var(--accent-emerald)', wordBreak: 'break-all' }}>
                        {art.checksum_sha256}
                      </span>
                    </div>

                    {/* Artifact Content Viewer */}
                    <div
                      style={{
                        padding: '14px',
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        lineHeight: '1.6',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {art.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: ERRORS & VIOLATIONS */}
          {activeTab === 'errors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(!currentRecord?.errors || currentRecord.errors.length === 0) ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--accent-emerald)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ShieldCheck size={32} />
                  <span>Zero errors or policy violations recorded for this mission.</span>
                </div>
              ) : (
                currentRecord.errors.map((err, idx) => {
                  const isViolation = err.severity === 'policy_violation';
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isViolation ? 'rgba(244, 63, 94, 0.08)' : 'var(--bg-secondary)',
                        border: `1px solid ${
                          isViolation ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)'
                        }`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                      }}
                    >
                      {isViolation ? (
                        <ShieldAlert size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            className={`badge ${isViolation ? 'badge-error' : 'badge-warning'}`}
                            style={{ fontSize: '10px', textTransform: 'uppercase' }}
                          >
                            {err.severity}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {err.step_number ? `Step #${err.step_number} • ` : ''}
                            {new Date(err.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            color: isViolation ? 'var(--accent-rose)' : 'var(--text-primary)',
                            marginTop: '4px',
                          }}
                        >
                          {err.error_message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 6: RAW WEBSOCKET WIRE STREAM */}
          {activeTab === 'raw_stream' && (
            <div
              style={{
                background: '#07090e',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                padding: '14px',
                fontFamily: 'monospace',
                fontSize: '11px',
                minHeight: '350px',
                maxHeight: '450px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div
                style={{
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid #1a2235',
                  paddingBottom: '6px',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>[FASTAPI WEBSOCKET /api/v1/flight-recorder/ws TELEMETRY FEED]</span>
                <span>STATUS: {wsConnected ? 'STREAMING' : 'OFFLINE'}</span>
              </div>

              {rawEvents.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>
                  Awaiting live socket frames from FastAPI...
                </div>
              ) : (
                rawEvents.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      lineHeight: '1.4',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      paddingBottom: '4px',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      [{new Date(ev.timestamp).toLocaleTimeString()}]
                    </span>
                    <span
                      style={{
                        color:
                          ev.event_type === 'task_completed'
                            ? 'var(--accent-emerald)'
                            : ev.event_type === 'error_recorded'
                            ? 'var(--accent-rose)'
                            : ev.event_type === 'tool_called'
                            ? 'var(--accent-amber)'
                            : 'var(--accent-cyan)',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {ev.event_type}
                    </span>
                    <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>
                      {JSON.stringify(ev.data)}
                    </span>
                  </div>
                ))
              )}
              <div ref={terminalBottomRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
