'use client';

import React from 'react';
import { NetworkMode } from '@/lib/types';
import { Compass, Layers, Play, RefreshCw, Sliders } from 'lucide-react';

interface MissionDispatcherProps {
  prompt: string;
  setPrompt: (p: string) => void;
  networkMode: NetworkMode;
  setNetworkMode: (m: NetworkMode) => void;
  maxSteps: number;
  setMaxSteps: (s: number) => void;
  running: boolean;
  onRunMission: () => void;
}

const PRESET_MISSIONS = [
  {
    title: 'Apollo99 Telemetry Audit',
    prompt:
      'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.',
  },
  {
    title: 'Pressure Variance Analysis',
    prompt:
      'Perform calculation of pressure variance: nominal 450 psi vs observed 482 psi. Validate against safety limits in compliance documentation.',
  },
  {
    title: 'Flight Approval Note (DOCX)',
    prompt:
      'Conduct complete audit of Apollo99 telemetry, verify all tolerance limits, and produce a formal DOCX approval note with evidence citations.',
  },
];

export function MissionDispatcher({
  prompt,
  setPrompt,
  networkMode,
  setNetworkMode,
  maxSteps,
  setMaxSteps,
  running,
  onRunMission,
}: MissionDispatcherProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'rgba(11, 17, 32, 0.75)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <label
          htmlFor="mission-prompt"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--accent-cyan)',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Compass size={14} color="var(--accent-cyan)" /> Mission Trajectory & Telemetry Objectives
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Flight Scenarios:</span>
          {PRESET_MISSIONS.map((preset, idx) => (
            <button
              key={idx}
              disabled={running}
              onClick={() => setPrompt(preset.prompt)}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                cursor: running ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!running) {
                  e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                }
              }}
              onMouseLeave={(e) => {
                if (!running) {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.7)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }
              }}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      <textarea
        id="mission-prompt"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={running}
        placeholder="Enter orbital forensic objectives, document queries, telemetry delta equations, or approval requirements..."
        style={{
          width: '100%',
          padding: '12px 14px',
          backgroundColor: 'rgba(3, 7, 18, 0.85)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          color: '#ffffff',
          fontSize: '13px',
          fontFamily: 'inherit',
          lineHeight: '1.5',
          outline: 'none',
          resize: 'vertical',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent-cyan)';
          e.target.style.boxShadow = '0 0 12px var(--accent-cyan-glow)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-subtle)';
          e.target.style.boxShadow = 'none';
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Network Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>Perimeter:</span>
            <select
              value={networkMode}
              onChange={(e) => setNetworkMode(e.target.value as NetworkMode)}
              disabled={running}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="AIR_GAPPED_LOCAL">AIR_GAPPED_LOCAL (Hardened)</option>
              <option value="NO_EGRESS">NO_EGRESS (Zero Telemetry Leak)</option>
            </select>
          </div>

          {/* Max Steps Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <Sliders size={13} color="var(--accent-cyan)" />
            <span>Step Budget:</span>
            <input
              type="range"
              min={1}
              max={10}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              disabled={running}
              style={{ width: '90px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)', minWidth: '16px' }}>
              {maxSteps}
            </span>
          </div>
        </div>

        {/* Launch Button */}
        <button
          onClick={onRunMission}
          disabled={running || !prompt.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            background: running
              ? 'rgba(30, 41, 59, 0.8)'
              : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: running ? 'none' : '0 4px 20px rgba(0, 240, 255, 0.35)',
            cursor: running || !prompt.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {running ? (
            <>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Recording Blackbox Stream...
            </>
          ) : (
            <>
              <Play size={14} fill="#ffffff" />
              Engage Mission Trajectory
            </>
          )}
        </button>
      </div>
    </div>
  );
}
