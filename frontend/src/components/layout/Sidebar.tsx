'use client';

import React from 'react';
import {
  Bot,
  Database,
  FileText,
  Layers,
  MessageSquare,
  Radio,
  Wrench,
} from 'lucide-react';

export type TabId = 'chat' | 'rag' | 'tools' | 'agents' | 'flight-recorder' | 'audit';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const navItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat Playground', icon: <MessageSquare size={18} /> },
    { id: 'rag', label: 'RAG Knowledge', icon: <Database size={18} /> },
    { id: 'tools', label: 'Tool Registry', icon: <Wrench size={18} /> },
    { id: 'agents', label: 'Agent Loops', icon: <Bot size={18} /> },
    { id: 'flight-recorder', label: 'Flight Recorder', icon: <Radio size={18} /> },
    { id: 'audit', label: 'Audit Trail', icon: <FileText size={18} /> },
  ];

  return (
    <aside
      style={{
        width: '220px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          padding: '8px 12px',
        }}
      >
        Workbench Navigation
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div>Sovereign-Core v0.1.0</div>
        <div style={{ color: 'var(--accent-emerald)', marginTop: '4px' }}>Privacy Guaranteed</div>
      </div>
    </aside>
  );
}
