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
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          Blackbox Telemetry Packet Stream ({rawEvents.length} events)
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
            Copy JSON
          </button>
          <button
            onClick={onClearEvents}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(3, 7, 18, 0.9)',
          border: '1px solid var(--border-subtle)',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#cbd5e1',
          maxHeight: '400px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        {rawEvents.map((ev, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 10px',
              borderRadius: '4px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span style={{ color: '#475569' }}>#{idx + 1}</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ev.event_type}</span>
              <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
              {ev.task_id && <span style={{ color: 'var(--accent-indigo)' }}>[{ev.task_id}]</span>}
            </div>
            <pre style={{ margin: 0, color: '#94a3b8', fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre-wrap', paddingLeft: '8px' }}>
              {JSON.stringify(ev.data, null, 2)}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
