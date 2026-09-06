'use client';

import React, { useState } from 'react';
import { FlightRecord, ApprovalStatus } from '@/lib/types';
import { LiveLatencyCounter } from './LiveLatencyCounter';
import { getApprovalBadgeClass } from './types';
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
        // Fallback for non-secure / unsupported contexts
        window.prompt('Copy Task ID:', currentRecord.task_id);
      }
      setCopiedTaskId(true);
      setTimeout(() => setCopiedTaskId(false), 2000);
    } catch {
      window.prompt('Copy Task ID:', currentRecord.task_id);
    }
  };

  const badgeStyle = currentRecord
    ? getApprovalBadgeClass(currentRecord.approval_status)
    : { bg: 'bg-zinc-900', text: 'text-zinc-500', border: 'border-zinc-800' };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm shadow-sm">
      {/* 1. Task ID */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Hash className="w-3 h-3" /> Task ID
        </span>
        <div className="flex items-center gap-1.5 font-mono text-sm text-zinc-200">
          <span className="truncate max-w-[120px]" title={currentRecord?.task_id || 'No active task'}>
            {currentRecord?.task_id ? currentRecord.task_id : '—'}
          </span>
          {currentRecord?.task_id && (
            <button
              onClick={handleCopyTaskId}
              className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-200"
              title="Copy task ID"
              aria-label="Copy task ID"
            >
              {copiedTaskId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Model */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Cpu className="w-3 h-3" /> Active Model
        </span>
        <span className="font-mono text-sm text-zinc-200 truncate" title={currentRecord?.model || '—'}>
          {currentRecord?.model || '—'}
        </span>
      </div>

      {/* 3. Latency */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
          Total Latency
        </span>
        <LiveLatencyCounter
          running={running}
          finalLatencyMs={currentRecord?.total_latency_ms}
          startTime={currentRecord?.start_time}
        />
      </div>

      {/* 4. Approval Status */}
      <div className="flex flex-col gap-1 relative">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>Approval</span>
          {currentRecord && (
            <button
              onClick={() => setShowApprovalMenu(!showApprovalMenu)}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 underline font-normal cursor-pointer"
            >
              Change
            </button>
          )}
        </span>
        <div className="flex items-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
          >
            {currentRecord?.approval_status === 'APPROVED' && <ShieldCheck className="w-3.5 h-3.5" />}
            {currentRecord?.approval_status === 'AUTO_VERIFIED' && <Shield className="w-3.5 h-3.5" />}
            {currentRecord?.approval_status === 'POLICY_VIOLATION' && <ShieldAlert className="w-3.5 h-3.5" />}
            {currentRecord?.approval_status || 'PENDING'}
          </span>
        </div>

        {/* Approval dropdown menu */}
        {showApprovalMenu && currentRecord && (
          <div className="absolute top-full mt-1 right-0 z-50 w-44 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl py-1 text-xs">
            <button
              onClick={() => {
                onUpdateApproval('APPROVED', 'Human auditor verified');
                setShowApprovalMenu(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-emerald-400 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Approve (Verified)
            </button>
            <button
              onClick={() => {
                onUpdateApproval('REJECTED', 'Human auditor rejected');
                setShowApprovalMenu(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-amber-400 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => {
                onUpdateApproval('POLICY_VIOLATION', 'Flagged as policy violation');
                setShowApprovalMenu(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-red-400 flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Policy Violation
            </button>
          </div>
        )}
      </div>

      {/* 5. Network Mode */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Lock className="w-3 h-3" /> Network Boundary
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {currentRecord?.network_mode || 'AIR_GAPPED_LOCAL'}
        </span>
      </div>

      {/* 6. Stream Status */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Radio className="w-3 h-3" /> Telemetry Stream
        </span>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500'
            }`}
          />
          <span className={wsConnected ? 'text-zinc-300' : 'text-zinc-500'}>
            {wsConnected ? (running ? 'RECORDING' : 'READY') : 'CONNECTING'}
          </span>
        </div>
      </div>
    </div>
  );
}
