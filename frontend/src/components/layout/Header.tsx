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
    <header className="topbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 30px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(13, 16, 21, 0.92)',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            background: 'var(--accent)',
            borderRadius: '9px',
            padding: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'none',
          }}
        >
          <Shield size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              Sovereign-Core
            </h1>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(120, 209, 188, .22)',
              }}
            >
              AIR-GAPPED v0.1.0
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Local intelligence operations
          </p>
        </div>
      </div>

      <div className="status-cluster" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><SystemStatus /></div>
      <div className="model-picker" style={{ display: 'flex', alignItems: 'center' }}><ModelSelector
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
        /></div>
    </header>
  );
}
