'use client';

import React from 'react';
import { RecordedError } from '@/lib/types';
import { AlertTriangle, Clock, ShieldAlert, XCircle } from 'lucide-react';

interface ErrorsTabProps {
  errors: RecordedError[];
}

export function ErrorsTab({ errors }: ErrorsTabProps) {
  if (errors.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
          ✓
        </div>
        <span className="text-zinc-300 font-medium">Clean Execution Record</span>
        <span className="text-xs text-zinc-500">Zero errors or policy violations encountered.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        Recorded Errors & Exceptions ({errors.length})
      </span>

      <div className="flex flex-col gap-2.5">
        {errors.map((err, idx) => {
          const isViolation = err.severity === 'policy_violation';
          const isWarning = err.severity === 'warning';

          const cardBg = isViolation
            ? 'rgba(244, 63, 94, 0.12)'
            : isWarning
            ? 'rgba(245, 158, 11, 0.12)'
            : 'rgba(244, 63, 94, 0.08)';

          const cardBorder = isViolation
            ? '1px solid rgba(244, 63, 94, 0.4)'
            : isWarning
            ? '1px solid rgba(245, 158, 11, 0.4)'
            : '1px solid rgba(244, 63, 94, 0.25)';

          const textColor = isViolation
            ? 'var(--accent-rose)'
            : isWarning
            ? 'var(--accent-amber)'
            : '#fda4af';

          return (
            <div
              key={idx}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: cardBg,
                border: cardBorder,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isViolation ? (
                    <ShieldAlert size={16} color="var(--accent-rose)" />
                  ) : isWarning ? (
                    <AlertTriangle size={16} color="var(--accent-amber)" />
                  ) : (
                    <XCircle size={16} color="var(--accent-rose)" />
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: textColor }}>
                    {err.severity.replace('_', ' ')}
                  </span>
                  {err.step_number !== undefined && (
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      Step #{err.step_number}
                    </span>
                  )}
                </div>

                {err.timestamp && (
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#f1f5f9' }}>
                {err.error_message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
