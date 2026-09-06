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
        width: '230px',
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        gap: '8px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          padding: '8px 12px',
        }}
      >
        Navigation Console
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
                border: isActive ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
                background: isActive
                  ? 'linear-gradient(90deg, rgba(0, 240, 255, 0.15), rgba(99, 102, 241, 0.05))'
                  : 'transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? '0 0 14px var(--accent-cyan-glow)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)', display: 'flex' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          padding: '14px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sovereign Node v0.1.0</div>
        <div style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-emerald)',
              boxShadow: '0 0 8px var(--accent-emerald-glow)',
              display: 'inline-block',
            }}
          />
          Air-Gapped Shield Active
        </div>
      </div>
    </aside>
  );
}
