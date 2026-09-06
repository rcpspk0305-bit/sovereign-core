'use client';

import React from 'react';
import { NetworkMode } from '@/lib/types';
import { Layers, Play, RefreshCw } from 'lucide-react';

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
    title: 'Forensic System Inspection',
    prompt:
      'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.',
  },
  {
    title: 'Pressure Anomaly Check',
    prompt:
      'Perform calculation of pressure variance: nominal 450 psi vs observed 482 psi. Validate against safety limits in compliance documentation.',
  },
  {
    title: 'Formal Approval Note',
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
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label htmlFor="mission-prompt" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Mission Objective & Instructions
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-zinc-500">Quick Scenarios:</span>
          {PRESET_MISSIONS.map((preset, idx) => (
            <button
              key={idx}
              disabled={running}
              onClick={() => setPrompt(preset.prompt)}
              className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
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
        placeholder="Enter forensic mission objectives, document requirements, or calculation instructions..."
        className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors font-sans resize-y"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Network Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Network:</span>
            <select
              value={networkMode}
              onChange={(e) => setNetworkMode(e.target.value as NetworkMode)}
              disabled={running}
              className="px-2.5 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              <option value="AIR_GAPPED_LOCAL">AIR_GAPPED_LOCAL (Strict)</option>
              <option value="NO_EGRESS">NO_EGRESS (Zero Outbound)</option>
            </select>
          </div>

          {/* Max Steps Slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Step Limit:</span>
            <input
              type="range"
              min={1}
              max={10}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              disabled={running}
              className="w-20 accent-blue-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-zinc-200 font-semibold">{maxSteps}</span>
          </div>
        </div>

        {/* Dispatch Button */}
        <button
          onClick={onRunMission}
          disabled={running || !prompt.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-900/20"
        >
          {running ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Recording Blackbox Telemetry...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Launch Inspection Mission
            </>
          )}
        </button>
      </div>
    </div>
  );
}
