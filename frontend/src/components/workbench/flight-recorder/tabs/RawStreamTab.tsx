'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FlightEvent } from '@/lib/types';
import { Check, Copy, Terminal, Trash2 } from 'lucide-react';

interface RawStreamTabProps {
  rawEvents: FlightEvent[];
  onClearEvents: () => void;
}

export function RawStreamTab({ rawEvents, onClearEvents }: RawStreamTabProps) {
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawEvents.length]);

  const handleCopy = async () => {
    const text = JSON.stringify(rawEvents, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        window.prompt('Copy Stream:', text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy Stream:', text);
    }
  };

  if (rawEvents.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
        <Terminal className="w-8 h-8 opacity-30 text-zinc-400" />
        <span>No WebSocket telemetry packets received in this session.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Blackbox WebSocket Telemetry Stream ({rawEvents.length} events)
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copy JSON
          </button>
          <button
            onClick={onClearEvents}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-900 font-mono text-xs text-zinc-300 max-h-96 overflow-y-auto space-y-1.5 leading-relaxed">
        {rawEvents.map((ev, idx) => (
          <div key={idx} className="hover:bg-zinc-900/50 p-1.5 rounded transition-colors flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="text-zinc-600">#{idx + 1}</span>
              <span className="text-blue-400 font-semibold uppercase">{ev.event_type}</span>
              <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
              {ev.task_id && <span className="text-zinc-500">[{ev.task_id}]</span>}
            </div>
            <pre className="text-zinc-300 text-[11px] overflow-x-auto whitespace-pre-wrap pl-4">
              {JSON.stringify(ev.data, null, 2)}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
