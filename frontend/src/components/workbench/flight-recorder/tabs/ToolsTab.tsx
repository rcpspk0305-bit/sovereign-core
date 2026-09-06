'use client';

import React from 'react';
import { ToolExecutionRecord } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Clock, Wrench } from 'lucide-react';

interface ToolsTabProps {
  toolsCalled: ToolExecutionRecord[];
}

export function ToolsTab({ toolsCalled }: ToolsTabProps) {
  if (toolsCalled.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Wrench size={36} color="var(--border-highlight)" />
        <span style={{ color: 'var(--text-secondary)' }}>No automated tool dispatches recorded in this trajectory.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        Dispatched Subsystem Tools ({toolsCalled.length})
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {toolsCalled.map((tool, idx) => (
          <div
            key={idx}
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--accent-cyan)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                  }}
                >
                  {tool.tool_name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Checkpoint #{tool.step_number}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} color="var(--text-muted)" />
                  {tool.execution_time_ms.toFixed(1)} ms
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: tool.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    color: tool.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    border: tool.success ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)',
                  }}
                >
                  {tool.success ? (
                    <>
                      <CheckCircle2 size={12} /> Success
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} /> Fault
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Arguments */}
            <div
              style={{
                backgroundColor: 'rgba(3, 7, 18, 0.8)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#cbd5e1',
              }}
            >
              <span style={{ fontSize: '9px', fontFamily: 'sans-serif', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                Telemetry Input Payload:
              </span>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                {JSON.stringify(tool.tool_arguments, null, 2)}
              </pre>
            </div>

            {/* Error or Output */}
            {tool.error ? (
              <div
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.12)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#fda4af',
                }}
              >
                <span style={{ fontSize: '9px', fontFamily: 'sans-serif', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-rose)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Execution Fault:
                </span>
                {tool.error}
              </div>
            ) : tool.output_preview ? (
              <div
                style={{
                  backgroundColor: 'rgba(3, 7, 18, 0.6)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                <span style={{ fontSize: '9px', fontFamily: 'sans-serif', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Telemetry Output Preview:
                </span>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{tool.output_preview}</pre>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
