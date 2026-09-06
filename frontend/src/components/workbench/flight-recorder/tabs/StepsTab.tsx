'use client';

import React from 'react';
import { StepRecord } from '@/lib/types';
import { Activity, Clock, Cpu, Orbit, Sparkles, Wrench } from 'lucide-react';

interface StepsTabProps {
  steps: StepRecord[];
  finalResponse?: string;
  running: boolean;
}

export function StepsTab({ steps, finalResponse, running }: StepsTabProps) {
  if (steps.length === 0) {
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
        <Orbit size={36} color="var(--border-highlight)" style={{ animation: 'radar-pulse 3s infinite' }} />
        <span style={{ color: 'var(--text-secondary)' }}>No telemetry reasoning steps in orbit yet.</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Launch a mission trajectory from the dispatcher above.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          Trajectory Execution Log ({steps.length} {steps.length === 1 ? 'checkpoint' : 'checkpoints'})
        </span>
        {running && (
          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
            Autonomous Reasoning Active
          </span>
        )}
      </div>

      <div style={{ position: 'relative', borderLeft: '2px solid var(--border-subtle)', marginLeft: '12px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {steps.map((step, idx) => (
          <div key={idx} style={{ position: 'relative' }}>
            {/* Orbital Node Indicator */}
            <div
              style={{
                position: 'absolute',
                left: '-28px',
                top: '4px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: 'var(--space-dark)',
                border: '2px solid var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px var(--accent-cyan-glow)',
              }}
            >
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
            </div>

            <div
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
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.04em' }}>
                  CHECKPOINT #{step.step_number}
                </span>
                {step.timestamp && (
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {step.thought && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    backgroundColor: 'rgba(3, 7, 18, 0.7)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                    lineHeight: '1.5',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-indigo)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                    Neural Reasoning:
                  </span>
                  {step.thought}
                </div>
              )}

              {step.tool_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={13} color="var(--accent-emerald)" /> Subsystem Dispatched:
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--accent-emerald)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    {step.tool_name}
                  </span>
                </div>
              )}

              {step.observation && (
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#94a3b8',
                    backgroundColor: 'rgba(3, 7, 18, 0.9)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    maxHeight: '180px',
                    overflowX: 'auto',
                    overflowY: 'auto',
                  }}
                >
                  <span style={{ fontSize: '9px', fontFamily: 'sans-serif', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                    Telemetry Sensor Feedback:
                  </span>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{step.observation}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {finalResponse && (
        <div
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: '8px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--accent-cyan)" /> Final Autonomous Forensic Analysis & Verdict
          </span>
          <div style={{ fontSize: '13px', color: '#f8fafc', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {finalResponse}
          </div>
        </div>
      )}
    </div>
  );
}
