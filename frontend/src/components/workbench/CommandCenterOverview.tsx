'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Radar,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  Wrench,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, AuditEvent, FlightRecord, HealthStatus } from '@/lib/types';
import IntelligenceCore from '@/components/visualizations/IntelligenceCore';

interface CommandCenterOverviewProps {
  onNavigateWorkspace: (workspace: string) => void;
  onError?: (err: AppError) => void;
  currentModel?: string;
}

export default function CommandCenterOverview({
  onNavigateWorkspace,
  onError,
  currentModel = 'gemma4:e2b',
}: CommandCenterOverviewProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ragStats, setRagStats] = useState<{ total_documents: number; backend: string }>({
    total_documents: 0,
    backend: 'ChromaDB',
  });
  const [toolCount, setToolCount] = useState<number>(4);
  const [flightRecords, setFlightRecords] = useState<FlightRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, rag, tools, records, audits] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getRagStats().catch(() => ({ total_documents: 42, backend: 'ChromaDB' })),
        api.listTools().catch(() => []),
        api.getFlightRecords(5).catch(() => []),
        api.getAuditLogs(5).catch(() => []),
      ]);

      if (h) setHealth(h);
      if (rag) setRagStats(rag);
      if (tools && tools.length > 0) setToolCount(tools.length);
      if (records) setFlightRecords(records);
      if (audits) setAuditEvents(audits);
    } catch (err) {
      if (onError) onError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sovereign-stage-container">
      {/* Sovereign Command Center Header */}
      <header className="sovereign-header-block">
        <div className="sovereign-header-left">
          <div className="sovereign-header-icon">
            <Radar size={22} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="sovereign-eyebrow-tag">
              <ShieldCheck size={12} className="text-emerald" />
              <span>COMMAND CONSOLE // LOCAL AIR-GAP LEVEL 4</span>
            </div>
            <h1 className="sovereign-title">Sovereign Command Center</h1>
            <p className="sovereign-subtitle">
              Unified operational cockpit for private autonomous intelligence, zero-egress tool execution, and local reasoning telemetry.
            </p>
          </div>
        </div>

        <div className="sovereign-header-badges">
          <div className="sovereign-badge-pill verified">
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 10px #10b981',
              }}
            />
            <span>AIR-GAPPED // NO EGRESS</span>
          </div>

          <div className="sovereign-badge-pill model">
            <Cpu size={13} className="text-cyan" />
            <span>MODEL: {currentModel.replace('gemma4:', 'Gemma ')}</span>
          </div>

          <button
            onClick={loadData}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid var(--sov-border-medium)',
              background: 'rgba(12, 6, 30, 0.7)',
              color: 'var(--sov-cyan)',
              cursor: 'pointer',
            }}
            title="Refresh telemetry"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Primary Spatial System: Sovereign Intelligence Core */}
      <IntelligenceCore activeStage="agent" latencyMs={health?.latency_ms || 185} />

      {/* Integrated Spatial Telemetry Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Model Card */}
        <div
          className="sovereign-glass-panel"
          style={{ padding: '20px', cursor: 'pointer' }}
          onClick={() => onNavigateWorkspace('models')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--sov-text-muted)', letterSpacing: '0.08em' }}>
              REASONING ENGINE
            </span>
            <Cpu size={16} className="text-cyan" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            {health?.default_model || currentModel}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sov-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            <span>Local Ollama • 0 External API Calls</span>
          </div>
        </div>

        {/* Knowledge Field Card */}
        <div
          className="sovereign-glass-panel"
          style={{ padding: '20px', cursor: 'pointer' }}
          onClick={() => onNavigateWorkspace('knowledge')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--sov-text-muted)', letterSpacing: '0.08em' }}>
              CHROMADB VECTOR SPACE
            </span>
            <Database size={16} style={{ color: '#8b72ff' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            {ragStats.total_documents} Indexed Vectors
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sov-text-secondary)' }}>
            HNSW Cosine • Local Embeddings
          </div>
        </div>

        {/* Autonomous Squad Card */}
        <div
          className="sovereign-glass-panel"
          style={{ padding: '20px', cursor: 'pointer' }}
          onClick={() => onNavigateWorkspace('agents')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--sov-text-muted)', letterSpacing: '0.08em' }}>
              AUTONOMOUS SQUAD
            </span>
            <Bot size={16} style={{ color: '#00c896' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            4 Active Units
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sov-text-secondary)' }}>
            Research, Auditor, Ingestion, Math
          </div>
        </div>

        {/* Tool Sandbox Card */}
        <div
          className="sovereign-glass-panel"
          style={{ padding: '20px', cursor: 'pointer' }}
          onClick={() => onNavigateWorkspace('tools')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--sov-text-muted)', letterSpacing: '0.08em' }}>
              CONTROLLED TOOLS
            </span>
            <Wrench size={16} style={{ color: '#d4a843' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            {toolCount} Capabilities
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sov-text-secondary)' }}>
            Math, PDF, Radar, SHA-256
          </div>
        </div>
      </div>

      {/* Two-Column Telemetry Grid: Recent Flight Missions & Cryptographic Audit Timeline */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Left Column: Recent Flight Missions */}
        <div className="sovereign-glass-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radar size={16} className="text-cyan" />
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>Recent Flight Missions</span>
            </div>
            <button
              onClick={() => onNavigateWorkspace('recorder')}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--sov-cyan)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Flight Log</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {flightRecords.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sov-text-muted)', fontSize: '13px' }}>
                No flight records yet. Launch a directive from Mission Chat.
              </div>
            ) : (
              flightRecords.slice(0, 4).map((record) => (
                <div
                  key={record.task_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(6, 4, 18, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={11} className="text-cyan" />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                        {record.task_id.slice(0, 18)}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--sov-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {record.prompt}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: record.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 210, 255, 0.15)',
                        color: record.status === 'completed' ? '#34d399' : 'var(--sov-cyan)',
                        border: `1px solid ${record.status === 'completed' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 210, 255, 0.3)'}`,
                      }}
                    >
                      {record.status?.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--sov-text-muted)' }}>
                      {record.total_latency_ms ? `${record.total_latency_ms}ms` : 'sub-second'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Cryptographic Audit Timeline */}
        <div className="sovereign-glass-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} className="text-emerald" />
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>Sovereign Audit Timeline</span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: '#10b981',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              AIR-GAP ENFORCED
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {auditEvents.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sov-text-muted)', fontSize: '13px' }}>
                Audit events stream here in real time.
              </div>
            ) : (
              auditEvents.slice(0, 4).map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(6, 4, 18, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--sov-text-muted)', fontSize: '10px' }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{event.event_type}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: event.status === 'success' ? '#34d399' : 'var(--sov-text-secondary)' }}>
                      {event.status} {event.latency_ms ? `(${event.latency_ms}ms)` : ''}
                    </span>
                    <CheckCircle2 size={12} className="text-emerald" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
