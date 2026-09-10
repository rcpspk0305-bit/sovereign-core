'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  Layers,
  Radar,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, ApprovalStatus, FlightEvent, FlightRecord } from '@/lib/types';
import { apply3DTilt, reset3DTilt } from '@/lib/animations';

interface FlightRecorderBayProps {
  onError: (error: AppError) => void;
  selectedTaskId?: string | null;
}

export default function FlightRecorderBay({ onError, selectedTaskId }: FlightRecorderBayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<FlightRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<FlightRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveEvents, setLiveEvents] = useState<FlightEvent[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getFlightRecords(20);
      setRecords(data);
      if (data.length > 0) {
        if (selectedTaskId) {
          const matched = data.find((r) => r.task_id === selectedTaskId);
          setActiveRecord(matched || data[0]);
        } else if (!activeRecord) {
          setActiveRecord(data[0]);
        }
      }
    } catch (err) {
      onError(normalizeError(err, 'VALIDATION_ERROR'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedTaskId]);

  // Subscribe to live WebSocket flight telemetry
  useEffect(() => {
    const unsubscribe = api.subscribeToFlightTelemetry(
      activeRecord?.task_id,
      (event: FlightEvent) => {
        setWsConnected(true);
        setLiveEvents((prev) => [event, ...prev.slice(0, 19)]);
      },
      () => setWsConnected(false),
    );

    return () => unsubscribe();
  }, [activeRecord?.task_id]);

  const handleApproval = async (status: ApprovalStatus) => {
    if (!activeRecord) return;
    try {
      const updated = await api.updateFlightApproval(activeRecord.task_id, status);
      setActiveRecord(updated);
      setRecords((prev) => prev.map((r) => (r.task_id === updated.task_id ? updated : r)));
    } catch (err) {
      onError(normalizeError(err, 'VALIDATION_ERROR'));
    }
  };

  return (
    <div
      className="workbench-bay-card"
      ref={cardRef}
      onMouseMove={(e) => apply3DTilt(cardRef.current, e, 4, 6)}
      onMouseLeave={() => reset3DTilt(cardRef.current)}
    >
      <div className="bay-header">
        <div className="bay-title-group">
          <Radar className="bay-icon" size={20} />
          <div>
            <h3>Durable Flight Recorder & Audit Telemetry</h3>
            <p>Cryptographically verifiable mission telemetry, source provenance, and air-gap approvals.</p>
          </div>
        </div>

        <div className="bay-stats-cluster">
          <div className="stat-pill">
            <Radio size={14} className={wsConnected ? 'online-pulse' : 'offline-pulse'} />
            <span>TELEMETRY FEED</span>
            <strong>{wsConnected ? 'STREAMING' : 'IDLE'}</strong>
          </div>
          <button
            type="button"
            className="stat-refresh-btn"
            onClick={fetchRecords}
            disabled={loading}
            aria-label="Refresh flight records"
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      <div className="bay-content-grid">
        {/* Missions list */}
        <div className="bay-subcard">
          <h4>Recorded Mission Sessions</h4>
          <div className="flight-records-list">
            {records.length === 0 ? (
              <p className="empty-subtext">No flight records logged yet. Run a mission from Mission Control.</p>
            ) : (
              records.map((rec) => (
                <button
                  key={rec.task_id}
                  type="button"
                  className={`flight-record-item ${activeRecord?.task_id === rec.task_id ? 'active' : ''}`}
                  onClick={() => setActiveRecord(rec)}
                >
                  <div className="record-item-top">
                    <span className="task-id-text">Task {rec.task_id.slice(0, 8)}...</span>
                    <span className={`approval-pill ${rec.approval_status}`}>
                      {rec.approval_status}
                    </span>
                  </div>
                  <p className="record-prompt-preview">{rec.prompt}</p>
                  <div className="record-item-meta">
                    <span>{rec.model}</span>
                    <span>{rec.total_latency_ms ? `${(rec.total_latency_ms / 1000).toFixed(1)}s` : 'active'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Record Telemetry Details */}
        <div className="bay-subcard">
          {activeRecord ? (
            <div className="record-detail-container">
              <div className="record-detail-header">
                <div>
                  <h4>Mission: {activeRecord.task_id.slice(0, 12)}</h4>
                  <p className="record-time-text">
                    Started: {new Date(activeRecord.start_time).toLocaleString()}
                  </p>
                </div>

                {/* Approval Action Controls */}
                <div className="approval-controls">
                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() => handleApproval('APPROVED')}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="reject-btn"
                    onClick={() => handleApproval('REJECTED')}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>

              {/* Status Meta Cards & OpenTelemetry Span Indicators */}
              <div className="telemetry-badges-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="telemetry-chip">
                  <span>TRACE ID</span>
                  <strong title={activeRecord.trace_id || activeRecord.metadata?.trace_id || 'LOCAL_SPAN'}>
                    {activeRecord.trace_id ? `${activeRecord.trace_id.slice(0, 10)}...` : activeRecord.metadata?.trace_id ? `${String(activeRecord.metadata.trace_id).slice(0, 10)}...` : 'LOCAL_SPAN'}
                  </strong>
                </div>
                <div className="telemetry-chip">
                  <span>SPAN</span>
                  <strong>{activeRecord.span_id ? `span-${activeRecord.span_id.slice(0, 8)}` : 'mission.root'}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>STATUS</span>
                  <strong className={activeRecord.status}>{activeRecord.status.toUpperCase()}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>LATENCY</span>
                  <strong>{activeRecord.total_latency_ms ? `${activeRecord.total_latency_ms} ms` : 'N/A'}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>MODEL</span>
                  <strong>{activeRecord.model}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>TOKENS</span>
                  <strong>{activeRecord.metadata?.total_tokens ?? activeRecord.metadata?.tokens ?? 'N/A'}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>AIR-GAP MODE</span>
                  <strong>{activeRecord.network_mode}</strong>
                </div>
              </div>

              {/* OpenTelemetry Distributed Trace Spans */}
              <div className="record-section">
                <h5>
                  <Layers size={14} />
                  OPENTELEMETRY TRACE SPANS ({activeRecord.tools_called?.length || 0 + (activeRecord.steps?.length || 0)})
                </h5>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                }}>
                  {/* Root Mission Span */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 0.8fr 1fr 0.8fr 1fr 0.7fr',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    background: 'rgba(0, 210, 255, 0.08)',
                    border: '1px solid rgba(0, 210, 255, 0.25)',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ color: 'var(--sov-cyan)', fontWeight: 700 }}>
                      TRACE: {activeRecord.trace_id ? activeRecord.trace_id.slice(0, 8) : 'root'}
                    </span>
                    <span style={{ color: '#fff' }}>SPAN: mission</span>
                    <span style={{ color: '#e2e8f0' }}>{activeRecord.total_latency_ms ? `${activeRecord.total_latency_ms}ms` : '-'}</span>
                    <span style={{ color: '#f59e0b' }}>{activeRecord.model}</span>
                    <span style={{ color: '#94a3b8' }}>{activeRecord.metadata?.total_tokens ?? '-'} tok</span>
                    <span style={{ color: '#a78bfa' }}>TOOL: orchestrator</span>
                    <span style={{ color: activeRecord.status === 'completed' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                      {activeRecord.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Tool Spans */}
                  {activeRecord.tools_called?.map((tool, idx) => (
                    <div key={`tool-${idx}`} style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 0.8fr 1fr 0.8fr 1fr 0.7fr',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      background: 'rgba(0, 6, 18, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <span style={{ color: '#64748b' }}>
                        {tool.trace_id ? tool.trace_id.slice(0, 8) : activeRecord.trace_id ? activeRecord.trace_id.slice(0, 8) : 'trace'}
                      </span>
                      <span style={{ color: '#38bdf8' }}>SPAN: tool.{tool.tool_name}</span>
                      <span style={{ color: '#e2e8f0' }}>{tool.execution_time_ms ? `${tool.execution_time_ms}ms` : '-'}</span>
                      <span style={{ color: '#94a3b8' }}>-</span>
                      <span style={{ color: '#94a3b8' }}>-</span>
                      <span style={{ color: '#a78bfa' }}>TOOL: {tool.tool_name}</span>
                      <span style={{ color: tool.success ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {tool.success ? 'OK' : 'ERROR'}
                      </span>
                    </div>
                  ))}

                  {/* Step Spans */}
                  {activeRecord.steps?.map((step, idx) => (
                    <div key={`step-${idx}`} style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 0.8fr 1fr 0.8fr 1fr 0.7fr',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      background: 'rgba(0, 6, 18, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <span style={{ color: '#64748b' }}>
                        {step.trace_id ? step.trace_id.slice(0, 8) : activeRecord.trace_id ? activeRecord.trace_id.slice(0, 8) : 'trace'}
                      </span>
                      <span style={{ color: '#93c5fd' }}>SPAN: step.{step.step_number}</span>
                      <span style={{ color: '#e2e8f0' }}>{step.latency_ms ? `${step.latency_ms}ms` : '-'}</span>
                      <span style={{ color: '#f59e0b' }}>{activeRecord.model}</span>
                      <span style={{ color: '#94a3b8' }}>{step.tokens ? `${step.tokens} tok` : '-'}</span>
                      <span style={{ color: '#a78bfa' }}>TOOL: {step.tool_name || 'none'}</span>
                      <span style={{ color: step.status === 'error' ? '#ef4444' : '#10b981' }}>
                        {(step.status || 'OK').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-subtext">Select a mission record from the list to view its black-box flight telemetry.</p>
          )}
        </div>
      </div>
    </div>
  );
}
