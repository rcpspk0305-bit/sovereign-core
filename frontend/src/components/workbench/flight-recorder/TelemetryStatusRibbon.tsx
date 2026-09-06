'use client';

import React, { useState } from 'react';
import { FlightRecord, ApprovalStatus } from '@/lib/types';
import { LiveLatencyCounter } from './LiveLatencyCounter';
import { getApprovalBadgeStyle } from './types';
import {
  Check,
  Copy,
  Cpu,
  Hash,
  Lock,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface TelemetryStatusRibbonProps {
  currentRecord: FlightRecord | null;
  running: boolean;
  wsConnected: boolean;
  onUpdateApproval: (status: ApprovalStatus, notes?: string) => void;
}

export function TelemetryStatusRibbon({
  currentRecord,
  running,
  wsConnected,
  onUpdateApproval,
}: TelemetryStatusRibbonProps) {
  const [copiedTaskId, setCopiedTaskId] = useState(false);
  const [showApprovalMenu, setShowApprovalMenu] = useState(false);

  const handleCopyTaskId = async () => {
    if (!currentRecord?.task_id) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentRecord.task_id);
      } else {
        window.prompt('Copy Task ID:', currentRecord.task_id);
      }
      setCopiedTaskId(true);
      setTimeout(() => setCopiedTaskId(false), 2000);
    } catch {
      window.prompt('Copy Task ID:', currentRecord.task_id);
    }
  };

  const badgeStyle = currentRecord
    ? getApprovalBadgeStyle(currentRecord.approval_status)
    : { backgroundColor: 'rgba(30, 41, 59, 0.5)', color: 'var(--text-muted)' };

  const tileStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    backgroundColor: 'rgba(11, 17, 32, 0.75)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    backdropFilter: 'blur(8px)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '10px',
        padding: '14px',
        backgroundColor: 'rgba(8, 12, 24, 0.85)',
        border: '1px solid var(--border-highlight)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.6), inset 0 0 16px rgba(56, 189, 248, 0.05)',
      }}
    >
      {/* 1. Task ID */}
      <div style={tileStyle}>
        <span style={labelStyle}>
          <Hash size={12} color="var(--accent-cyan)" /> Mission ID
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentRecord?.task_id || 'No active mission'}>
            {currentRecord?.task_id || '—'}
          </span>
          {currentRecord?.task_id && (
            <button
              onClick={handleCopyTaskId}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Copy mission ID"
            >
              {copiedTaskId ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Model */}
      <div style={tileStyle}>
        <span style={labelStyle}>
          <Cpu size={12} color="var(--accent-indigo)" /> Neural Engine
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentRecord?.model || '—'}
        </span>
      </div>

      {/* 3. Latency */}
      <div style={tileStyle}>
        <span style={labelStyle}>Execution Latency</span>
        <LiveLatencyCounter
          running={running}
          finalLatencyMs={currentRecord?.total_latency_ms}
          startTime={currentRecord?.start_time}
        />
      </div>

      {/* 4. Approval Status */}
      <div style={{ ...tileStyle, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={labelStyle}>
            <Shield size={12} color="var(--accent-amber)" /> Status
          </span>
          {currentRecord && (
            <button
              onClick={() => setShowApprovalMenu(!showApprovalMenu)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '10px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Modify
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              ...badgeStyle,
            }}
          >
            {currentRecord?.approval_status === 'APPROVED' && <ShieldCheck size={13} />}
            {currentRecord?.approval_status === 'AUTO_VERIFIED' && <Shield size={13} />}
            {currentRecord?.approval_status === 'POLICY_VIOLATION' && <ShieldAlert size={13} />}
            {currentRecord?.approval_status || 'PENDING'}
          </span>
        </div>

        {/* Modal / Menu */}
        {showApprovalMenu && currentRecord && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              zIndex: 50,
              width: '180px',
              backgroundColor: 'var(--space-dark)',
              border: '1px solid var(--border-highlight)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
              padding: '4px 0',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <button
              onClick={() => {
                onUpdateApproval('APPROVED', 'Human auditor verified');
                setShowApprovalMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                color: 'var(--accent-emerald)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Check size={13} /> Approve (Verified)
            </button>
            <button
              onClick={() => {
                onUpdateApproval('REJECTED', 'Human auditor rejected');
                setShowApprovalMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                color: 'var(--accent-amber)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <UserCheck size={13} /> Reject
            </button>
            <button
              onClick={() => {
                onUpdateApproval('POLICY_VIOLATION', 'Flagged as policy violation');
                setShowApprovalMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                color: 'var(--accent-rose)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <ShieldAlert size={13} /> Policy Violation
            </button>
          </div>
        )}
      </div>

      {/* 5. Network Mode */}
      <div style={tileStyle}>
        <span style={labelStyle}>
          <Lock size={12} color="var(--accent-emerald)" /> Network Perimeter
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 600 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', boxShadow: '0 0 8px var(--accent-emerald)' }} />
          {currentRecord?.network_mode || 'AIR_GAPPED_LOCAL'}
        </span>
      </div>

      {/* 6. Telemetry Link */}
      <div style={tileStyle}>
        <span style={labelStyle}>
          <Radio size={12} color="var(--accent-cyan)" /> Telemetry Beacon
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: wsConnected ? 'var(--accent-cyan)' : 'var(--accent-rose)',
              boxShadow: wsConnected ? '0 0 10px var(--accent-cyan)' : '0 0 6px var(--accent-rose)',
              animation: wsConnected && running ? 'radar-pulse 1.2s infinite' : 'none',
            }}
          />
          <span style={{ color: wsConnected ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
            {wsConnected ? (running ? 'ACTIVE ORBIT' : 'STANDBY') : 'DISCONNECTED'}
          </span>
        </div>
      </div>
    </div>
  );
}
