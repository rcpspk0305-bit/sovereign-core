'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';

interface LiveLatencyCounterProps {
  running: boolean;
  finalLatencyMs?: number;
  startTime?: string;
}

export function LiveLatencyCounter({ running, finalLatencyMs }: LiveLatencyCounterProps) {
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (running) {
      startRef.current = Date.now();
      setElapsedMs(0);
      timer = setInterval(() => {
        if (startRef.current) {
          setElapsedMs(Date.now() - startRef.current);
        }
      }, 50);
    } else {
      if (timer) clearInterval(timer);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [running]);

  const displayMs = running
    ? elapsedMs
    : finalLatencyMs !== undefined && finalLatencyMs !== null
    ? finalLatencyMs
    : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
      <Clock
        size={14}
        color={running ? 'var(--accent-cyan)' : 'var(--text-muted)'}
        style={{ animation: running ? 'radar-pulse 1.5s infinite' : 'none' }}
      />
      <span style={{ color: running ? 'var(--accent-cyan)' : 'var(--text-primary)', fontWeight: 600 }}>
        {displayMs > 0 ? `${displayMs.toLocaleString()} ms` : '—'}
      </span>
      {running && (
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 240, 255, 0.15)',
            color: 'var(--accent-cyan)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            boxShadow: '0 0 8px var(--accent-cyan-glow)',
          }}
        >
          LIVE ORBIT
        </span>
      )}
    </div>
  );
}
