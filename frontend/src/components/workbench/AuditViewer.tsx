'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { AuditEvent } from '@/lib/types';
import { Clock, FileText, RefreshCw, Zap } from 'lucide-react';

export default function AuditViewer() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getBadgeStyle = (eventType: string) => {
    switch (eventType) {
      case 'llm_request':
      case 'llm_response':
        return 'badge-success';
      case 'tool_execution':
        return 'badge-warning';
      case 'llm_error':
        return 'badge-error';
      default:
        return 'badge-success';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Structured Audit Trail</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Zero-loss audit stream capturing prompts, tokens, tool invocations, and latencies.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {events.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No audit events recorded yet. Start a chat or run a tool to generate audit logs.
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`badge ${getBadgeStyle(ev.event_type)}`}>
                  {ev.event_type}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  {ev.prompt_preview || ev.response_preview || ev.id}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                {ev.latency_ms && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {ev.latency_ms} ms
                  </span>
                )}
                {ev.tokens?.total && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} /> {ev.tokens.total} tok
                  </span>
                )}
                <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
