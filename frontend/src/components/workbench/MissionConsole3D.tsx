'use client';

import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Layers,
  Orbit,
  Sparkles,
  StopCircle,
  Terminal,
  Wrench,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AgentStep, AppError, FlightRecord, MissionPhase } from '@/lib/types';
import { apply3DTilt, magneticButton, releaseMagneticButton, reset3DTilt } from '@/lib/animations';

interface MissionConsole3DProps {
  model: string;
  onError: (error: AppError) => void;
  onMissionCompleted?: (record: FlightRecord) => void;
}

const PRESET_MISSIONS = [
  'Inspect local system health, available models, and vector database status.',
  'Analyze ingested documents and generate a concise air-gapped briefing.',
  'Execute local security inspection tools and trace execution telemetry.',
];

export default function MissionConsole3D({
  model,
  onError,
  onMissionCompleted,
}: MissionConsole3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const launchBtnRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [prompt, setPrompt] = useState(PRESET_MISSIONS[0]);
  const [phase, setPhase] = useState<MissionPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [result, setResult] = useState<string>('Ready for a local mission. Your requests remain strictly inside the air-gapped workbench.');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Timer while running
  useEffect(() => {
    let timer: any = null;
    if (phase === 'transmitting' || phase === 'streaming') {
      const start = Date.now() - elapsedMs;
      timer = setInterval(() => {
        setElapsedMs(Date.now() - start);
      }, 50);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleLaunch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || phase === 'transmitting' || phase === 'streaming') return;

    // Reset state
    setPhase('transmitting');
    setElapsedMs(0);
    setSteps([
      {
        step_number: 1,
        thought: 'Dispatching controlled agent with air-gapped constraint (NO_EGRESS)...',
      },
    ]);
    setResult('Mission uplink engaged. Agent is reasoning locally...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Step simulation for realistic feedback while waiting for local inference
      const stepTimer1 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setPhase('streaming');
        setSteps((prev) => [
          ...prev,
          {
            step_number: 2,
            thought: 'Reading vector memory and querying available tool definitions...',
            tool_name: 'vector_search_local',
          },
        ]);
      }, 900);

      const stepTimer2 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setSteps((prev) => [
          ...prev,
          {
            step_number: 3,
            thought: 'Validating safety and air-gap provenance constraints...',
          },
        ]);
      }, 2100);

      const record = await api.runFlightMission(
        prompt.trim(),
        model,
        'AIR_GAPPED_LOCAL',
        undefined,
        5,
        controller.signal,
      );

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setCurrentTaskId(record.task_id);
      if (record.steps && record.steps.length > 0) {
        setSteps(record.steps);
      }
      setResult(record.final_response || `Mission ${record.task_id} completed successfully.`);
      setPhase('completed');
      if (onMissionCompleted) onMissionCompleted(record);
    } catch (err: any) {
      if (controller.signal.aborted) {
        setPhase('aborted');
        setResult('Mission transmission aborted by operator.');
        return;
      }
      setPhase('failed');
      const normalized = normalizeError(err, 'AGENT_EXECUTION_FAILED');
      setResult(`Mission link error: ${normalized.message}`);
      onError(normalized);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setPhase('aborted');
      setResult('Mission aborted by operator.');
    }
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = phase === 'transmitting' || phase === 'streaming';

  return (
    <div
      className="mission-console-3d"
      ref={cardRef}
      onMouseMove={(e) => apply3DTilt(cardRef.current, e, 6, 8)}
      onMouseLeave={() => reset3DTilt(cardRef.current)}
    >
      {/* 3D Glass Header */}
      <div className="console-heading-3d">
        <div className="heading-copy">
          <p className="eyebrow">
            <Orbit size={14} className={isRunning ? 'spin-icon' : ''} />
            MISSION UPLINK // AIR-GAPPED PROTOCOL
          </p>
          <h2>Send a Controlled Request</h2>
        </div>

        <div className="status-cluster">
          {isRunning && (
            <div className="live-timer-chip">
              <Clock size={13} />
              <span>{(elapsedMs / 1000).toFixed(2)}s</span>
            </div>
          )}
          <span className={`console-phase-badge ${phase}`}>
            <span className={`status-pulse ${isRunning ? 'online' : phase === 'completed' ? 'online' : phase === 'failed' ? 'offline' : ''}`} />
            {phase.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Preset suggestions */}
      <div className="mission-presets">
        <span className="preset-label">PRESETS:</span>
        {PRESET_MISSIONS.map((presetText, idx) => (
          <button
            key={idx}
            type="button"
            className="preset-pill"
            disabled={isRunning}
            onClick={() => setPrompt(presetText)}
          >
            {presetText.length > 42 ? presetText.slice(0, 42) + '...' : presetText}
          </button>
        ))}
      </div>

      {/* Interactive Request Form */}
      <form onSubmit={handleLaunch} className="mission-form-3d">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe an inspection, retrieval, or analysis mission..."
          rows={3}
          disabled={isRunning}
          aria-label="Mission prompt"
        />

        <div className="mission-actions-bar">
          <div className="model-indicator">
            <Bot size={15} />
            <span>Target Node: <strong>{model}</strong></span>
          </div>

          <div className="action-buttons-group">
            {isRunning ? (
              <button
                type="button"
                className="abort-mission-btn"
                onClick={handleAbort}
              >
                <StopCircle size={16} />
                Abort Mission
              </button>
            ) : (
              <button
                ref={launchBtnRef}
                type="submit"
                className="launch-button-3d"
                disabled={!prompt.trim()}
                onMouseMove={(e) => magneticButton(launchBtnRef.current, e, 0.3)}
                onMouseLeave={() => releaseMagneticButton(launchBtnRef.current)}
              >
                <Sparkles size={16} />
                Launch Mission
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Live Step Progression Telemetry */}
      {steps.length > 0 && (
        <div className="telemetry-steps-tray" aria-live="polite">
          <div className="steps-tray-header">
            <Layers size={14} />
            <span>AGENT REASONING TRACE ({steps.length} STEPS)</span>
            {currentTaskId && <span className="task-id-badge">ID: {currentTaskId.slice(0, 8)}</span>}
          </div>
          <div className="steps-timeline">
            {steps.map((step, index) => (
              <div key={index} className="step-item-card">
                <div className="step-num-bubble">{step.step_number}</div>
                <div className="step-content">
                  {step.thought && <p className="step-thought">{step.thought}</p>}
                  {step.tool_name && (
                    <div className="step-tool-call">
                      <Wrench size={13} />
                      <span>Tool called: <strong>{step.tool_name}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mission Result Feed */}
      <div className="result-line-3d">
        <div className="result-line-header">
          <div className="result-tag">
            <Terminal size={14} />
            <span>MISSION FEED</span>
          </div>
          <button
            type="button"
            className="copy-feed-btn"
            onClick={handleCopyResult}
            aria-label="Copy mission result"
          >
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="result-text">{result}</p>
      </div>
    </div>
  );
}
