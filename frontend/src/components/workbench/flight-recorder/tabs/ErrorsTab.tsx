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
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        Recorded Errors & Exceptions ({errors.length})
      </span>

      <div className="flex flex-col gap-2.5">
        {errors.map((err, idx) => {
          const isViolation = err.severity === 'policy_violation';
          const isWarning = err.severity === 'warning';

          const cardStyle = isViolation
            ? 'bg-red-950/20 border-red-900/40 text-red-300'
            : isWarning
            ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
            : 'bg-rose-950/20 border-rose-900/40 text-rose-300';

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border flex flex-col gap-1.5 ${cardStyle}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isViolation ? (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {err.severity.replace('_', ' ')}
                  </span>
                  {err.step_number !== undefined && (
                    <span className="text-[11px] font-mono opacity-70">
                      Step #{err.step_number}
                    </span>
                  )}
                </div>

                {err.timestamp && (
                  <span className="text-[11px] font-mono opacity-60 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {err.error_message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
