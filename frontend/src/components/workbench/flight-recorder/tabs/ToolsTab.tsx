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
      <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
        <Wrench className="w-8 h-8 opacity-30 text-zinc-400" />
        <span>No tool executions dispatched in this flight record.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        Authorized Tool Calls ({toolsCalled.length})
      </span>

      <div className="grid grid-cols-1 gap-3">
        {toolsCalled.map((tool, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-zinc-200 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                  {tool.tool_name}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">Step #{tool.step_number}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  {tool.execution_time_ms.toFixed(1)} ms
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                    tool.success
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
                      : 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
                  }`}
                >
                  {tool.success ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Success
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> Failed
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Arguments */}
            <div className="bg-zinc-950/70 p-2 rounded border border-zinc-900 text-xs font-mono text-zinc-300">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-sans mb-0.5">
                Parameters Dispatched:
              </span>
              <pre className="whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(tool.tool_arguments, null, 2)}
              </pre>
            </div>

            {/* Output or Error */}
            {tool.error ? (
              <div className="bg-rose-950/20 p-2 rounded border border-rose-900/40 text-xs font-mono text-rose-300">
                <span className="text-[10px] uppercase tracking-wider text-rose-400 block font-sans mb-0.5">
                  Execution Error:
                </span>
                {tool.error}
              </div>
            ) : tool.output_preview ? (
              <div className="bg-zinc-950/50 p-2 rounded border border-zinc-900 text-xs font-mono text-zinc-400 max-h-32 overflow-y-auto">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-sans mb-0.5">
                  Output Preview:
                </span>
                <pre className="whitespace-pre-wrap">{tool.output_preview}</pre>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
