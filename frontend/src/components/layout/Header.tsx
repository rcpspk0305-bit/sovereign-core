'use client';

import React from 'react';
import SystemStatus from '../workbench/SystemStatus';
import ModelSelector from '../workbench/ModelSelector';
import { Shield } from 'lucide-react';

interface HeaderProps {
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export default function Header({ selectedModel, onSelectModel }: HeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(17, 23, 38, 0.8)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={20} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Sovereign-Core
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Local AI Operations Workbench
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <SystemStatus />
        <ModelSelector
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
        />
      </div>
    </header>
  );
}
