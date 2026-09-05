'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { HealthStatus } from '@/lib/types';
import { Activity, Cpu, ShieldCheck } from 'lucide-react';

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Offline');
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="badge badge-error">
        <Activity size={12} />
        <span>Backend Disconnected</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="badge badge-warning">
        <Activity size={12} />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="badge badge-success">
        <ShieldCheck size={12} />
        <span>Backend Online</span>
      </div>
      <div className={health.ollama_connected ? 'badge badge-success' : 'badge badge-warning'}>
        <Cpu size={12} />
        <span>Ollama: {health.ollama_connected ? 'Connected' : 'Unreachable'}</span>
      </div>
    </div>
  );
}
