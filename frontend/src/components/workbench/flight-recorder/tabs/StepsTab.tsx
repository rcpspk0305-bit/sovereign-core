'use client';

import React from 'react';
import { StepRecord } from '@/lib/types';
import { Activity, Clock, Wrench } from 'lucide-react';

interface StepsTabProps {
  steps: StepRecord[];
  finalResponse?: string;
  running: boolean;
}

export function StepsTab({ steps, finalResponse, running }: StepsTabProps) {
  if (steps.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
        <Activity className="w-8 h-8 opacity-30 text-zinc-400 animate-pulse" />
        <span>No execution steps recorded yet. Launch a mission above.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Execution Timeline ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
        </span>
        {running && (
          <span className="text-[11px] text-blue-400 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Agent reasoning active
          </span>
        )}
      </div>

      <div className="relative border-l border-zinc-800 ml-3.5 space-y-4 pl-4">
        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Step marker pin */}
            <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 border-blue-500 flex items-center justify-center shadow-sm">
              <span className="w-1 h-1 rounded-full bg-blue-400" />
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-zinc-200">
                  Step {step.step_number}
                </span>
                {step.timestamp && (
                  <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {step.thought && (
                <div className="text-xs text-zinc-300 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/60 font-sans">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold mb-1">
                    Agent Thought / Reasoning:
                  </span>
                  {step.thought}
                </div>
              )}

              {step.tool_name && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-emerald-400" /> Dispatched Tool:
                  </span>
                  <span className="font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 text-[11px]">
                    {step.tool_name}
                  </span>
                </div>
              )}

              {step.observation && (
                <div className="text-xs font-mono text-zinc-400 bg-zinc-950/80 p-2.5 rounded border border-zinc-900 overflow-x-auto max-h-40">
                  <span className="text-[10px] font-sans text-zinc-500 uppercase tracking-wider block font-semibold mb-1">
                    Observation Output:
                  </span>
                  <pre className="whitespace-pre-wrap">{step.observation}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {finalResponse && (
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/50 flex flex-col gap-2 mt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Final Agent Synthesis & Verdict
          </span>
          <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
            {finalResponse}
          </div>
        </div>
      )}
    </div>
  );
}
