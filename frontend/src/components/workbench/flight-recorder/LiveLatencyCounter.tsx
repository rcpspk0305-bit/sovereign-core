'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';

interface LiveLatencyCounterProps {
  running: boolean;
  finalLatencyMs?: number;
  startTime?: string;
}

export function LiveLatencyCounter({ running, finalLatencyMs, startTime }: LiveLatencyCounterProps) {
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
    <div className="flex items-center gap-1.5 font-mono text-sm">
      <Clock className={`w-3.5 h-3.5 ${running ? 'text-amber-400 animate-spin' : 'text-zinc-400'}`} />
      <span className={running ? 'text-amber-400 font-semibold' : 'text-zinc-200'}>
        {displayMs > 0 ? `${displayMs.toLocaleString()} ms` : '—'}
      </span>
      {running && (
        <span className="text-[10px] uppercase font-sans tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
          live
        </span>
      )}
    </div>
  );
}
