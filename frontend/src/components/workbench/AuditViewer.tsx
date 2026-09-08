'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { AuditEvent, AuditEventType } from '@/lib/types';
import { Check, ChevronDown, ChevronRight, Clock, Copy, RefreshCw, Zap } from 'lucide-react';

type FilterType = 'ALL' | 'LLM' | 'TOOL' | 'AGENT' | 'RAG';

interface AuditViewerProps {
  isActive?: boolean;
}

export default function AuditViewer({ isActive = true }: AuditViewerProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logs = await api.getAuditLogs(50);
      setEvents(logs);
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch logs on mount and whenever the tab becomes active
  useEffect(() => {
    if (isActive) {
      fetchLogs();
    }
  }, [isActive]);

  // Periodic interval polling while active and auto-refresh is enabled
  useEffect(() => {
    if (!isActive || !autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [isActive, autoRefresh]);

  const handleCopyPayload = (id: string, payload: any) => {
    const text = JSON.stringify(payload, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      window.prompt('Copy Audit Payload:', text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getBadgeStyle = (eventType: AuditEventType | string) => {
    switch (eventType) {
      case 'llm_request':
        return 'badge-cyan';
      case 'llm_response':
        return 'badge-success';
      case 'tool_execution':
        return 'badge-warning';
      case 'llm_error':
        return 'badge-error';
      case 'rag_ingest':
      case 'rag_query':
        return 'badge-cyan';
      case 'agent_run':
        return 'badge-success';
      case 'system_event':
        return 'badge-warning';
      default:
        return 'badge-secondary';
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    if (filter === 'LLM') return ev.event_type.startsWith('llm_');
    if (filter === 'TOOL') return ev.event_type === 'tool_execution';
    if (filter === 'AGENT') return ev.event_type === 'agent_run';
    if (filter === 'RAG') return ev.event_type.startsWith('rag_');
    return true;
  });

  const filterOptions: { id: FilterType; label: string }[] = [
    { id: 'ALL', label: `All (${events.length})` },
    { id: 'LLM', label: 'LLM Chat' },
    { id: 'TOOL', label: 'Tools' },
    { id: 'AGENT', label: 'Agents' },
    { id: 'RAG', label: 'RAG Ingest/Query' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Structured Audit Trail</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Zero-loss cryptographic audit stream capturing prompts, tokens, tool invocations, and latencies.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              aria-label="Toggle auto-refresh every 5 seconds"
            />
            Auto-refresh (5s)
          </label>
          <button
            className="btn btn-secondary"
            onClick={fetchLogs}
            disabled={loading}
            aria-label="Refresh audit logs"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {filterOptions.map((opt) => {
          const isActive = filter === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              aria-label={`Filter by ${opt.label}`}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '9999px',
                cursor: 'pointer',
                border: isActive ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                backgroundColor: isActive ? 'rgba(0, 240, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 10px var(--accent-cyan-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredEvents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No audit events matched the selected filter.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const isExpanded = expandedId === ev.id;
            return (
              <div
                key={ev.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                    <span className={`badge ${getBadgeStyle(ev.event_type)}`}>
                      {ev.event_type}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {ev.prompt_preview || ev.response_preview || ev.id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {ev.latency_ms !== undefined && ev.latency_ms !== null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {ev.latency_ms.toFixed(1)} ms
                      </span>
                    )}
                    {ev.tokens?.total !== undefined && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={12} /> {ev.tokens.total} tok
                      </span>
                    )}
                    <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Expanded JSON payload details */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(3, 7, 18, 0.9)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
                        Event Payload & Telemetry (ID: {ev.id})
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleCopyPayload(ev.id, ev)}
                        aria-label="Copy JSON payload"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        {copiedId === ev.id ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                        <span>{copiedId === ev.id ? 'Copied' : 'Copy Payload'}</span>
                      </button>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#cbd5e1',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {JSON.stringify(ev, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
