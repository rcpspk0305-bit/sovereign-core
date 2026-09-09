'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  CircleDot,
  Database,
  FileSearch,
  Orbit,
  Radar,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, FlightRecord } from '@/lib/types';
import { initOrbitalStage } from '@/lib/animations';

import MissionConsole3D from '@/components/workbench/MissionConsole3D';
import KnowledgeBay from '@/components/workbench/KnowledgeBay';
import ToolBay from '@/components/workbench/ToolBay';
import FlightRecorderBay from '@/components/workbench/FlightRecorderBay';
import ErrorDiagnosticModal from '@/components/workbench/ErrorDiagnosticModal';

type Section = 'mission' | 'knowledge' | 'tools' | 'recorder';

const sections: Array<{
  id: Section;
  label: string;
  icon: typeof Orbit;
  eyebrow: string;
  title: string;
  detail: string;
}> = [
  {
    id: 'mission',
    label: 'Mission control',
    icon: Orbit,
    eyebrow: 'ORBITAL COMMAND',
    title: 'Reason locally.\nOperate deliberately.',
    detail: 'A private control plane for grounded analysis, controlled tools, and auditable local inference.',
  },
  {
    id: 'knowledge',
    label: 'Knowledge field',
    icon: Database,
    eyebrow: 'VECTOR MEMORY',
    title: 'Turn documents\ninto a navigable field.',
    detail: 'Index local PDFs, retrieve their context, and retain page-level provenance for every source.',
  },
  {
    id: 'tools',
    label: 'Tool bay',
    icon: Wrench,
    eyebrow: 'CONTROLLED ACTIONS',
    title: 'Every action\nstays inside the boundary.',
    detail: 'Execute only registered local tools with schema validation, timing, and structured audit events.',
  },
  {
    id: 'recorder',
    label: 'Flight recorder',
    icon: Radar,
    eyebrow: 'MISSION TELEMETRY',
    title: 'Nothing important\nleaves the black box.',
    detail: 'Trace decisions, sources, artifacts, errors, and review status in a durable mission record.',
  },
];

export default function Home() {
  const [active, setActive] = useState<Section>('mission');
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [model, setModel] = useState<string>('gemma4:e2b');
  const [availableModels, setAvailableModels] = useState<string[]>(['gemma4:e2b', 'gemma4:e4b-it-qat']);
  const [activeError, setActiveError] = useState<AppError | null>(null);
  const [lastCompletedTask, setLastCompletedTask] = useState<string | null>(null);

  const orbitalContainerRef = useRef<HTMLDivElement>(null);
  const current = useMemo(
    () => sections.find((section) => section.id === active) ?? sections[0],
    [active],
  );

  // Initialize continuous Anime.js 3D orbital physics
  useEffect(() => {
    if (orbitalContainerRef.current) {
      initOrbitalStage(orbitalContainerRef.current);
    }
  }, []);

  // Check health and available models
  useEffect(() => {
    let mounted = true;

    api
      .getHealth()
      .then((health) => {
        if (!mounted) return;
        setStatus(health.ollama_connected ? 'online' : 'offline');
        if (health.default_model) {
          setModel(health.default_model);
        }
        if (health.available_models && health.available_models.length > 0) {
          setAvailableModels(health.available_models);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus('offline');
        setActiveError(normalizeError(err, 'NETWORK_OFFLINE'));
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleMissionCompleted = (record: FlightRecord) => {
    setLastCompletedTask(record.task_id);
  };

  return (
    <main className="constellation-shell">
      {/* 3D Star Canvas & Aurora Backdrops */}
      <div className="star-canvas" aria-hidden="true" />
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />

      {/* Top Navigation Bar */}
      <header className="topbar">
        <a className="wordmark" href="#mission" aria-label="Sovereign Core home">
          <span className="wordmark-mark">
            <Sparkles size={16} />
          </span>
          SOVEREIGN<span>/</span>CORE
        </a>

        <div className="topbar-right-cluster">
          {/* Node Health Chip */}
          <div className="system-chip">
            <span className={`status-pulse ${status}`} />
            {status === 'checking'
              ? 'Checking local node'
              : status === 'online'
              ? 'Local node online'
              : 'Offline simulation'}
          </div>

          {/* Dynamic Model Selector */}
          <div className="model-selector-chip">
            <Bot size={14} />
            <span>MODEL:</span>
            <select
              className="model-select-dropdown"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Select AI reasoning model"
            >
              {availableModels.map((m) => (
                <option key={m} value={m} style={{ background: '#030d22', color: '#fff' }}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Orbital Layout Grid */}
      <div className="orbital-layout">
        {/* Left Navigation Sidebar */}
        <aside className="navigation-panel">
          <p className="panel-label">WORKBENCH</p>
          <nav role="tablist" aria-label="Workbench Pillars">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isSelected = active === section.id;
              return (
                <button
                  key={section.id}
                  role="tab"
                  id={`tab-${section.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${section.id}`}
                  className={`nav-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setActive(section.id)}
                >
                  <span className="nav-index">0{index + 1}</span>
                  <Icon size={17} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="nav-footnote">
            <ShieldCheck size={16} />
            <span>
              Air-gapped by design
              <br />
              Local-first execution
            </span>
          </div>
        </aside>

        {/* Center Hero Stage with 3D Anime.js Orbit Graphic */}
        <section className="hero-stage" id="mission">
          <div className="hero-copy">
            <p className="eyebrow">
              <CircleDot size={13} /> {current.eyebrow}
            </p>
            <h1>
              {current.title.split('\n').map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <p className="hero-detail">{current.detail}</p>
            <div className="hero-actions">
              <button
                className="primary-action"
                onClick={() => {
                  setActive('mission');
                  document.querySelector('.active-workbench-view')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Start a mission <ArrowUpRight size={17} />
              </button>
              <button
                className="quiet-action"
                onClick={() => {
                  setActive('recorder');
                  document.querySelector('.active-workbench-view')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore telemetry <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* 3D Animated Orbital Stage */}
          <div
            className="orbital-visual"
            ref={orbitalContainerRef}
            aria-label="Animated local intelligence orbital graphic"
          >
            <div className="orbit orbit-a orbit-ring" />
            <div className="orbit orbit-b orbit-ring-reverse" />
            <div className="orbit orbit-c orbit-ring" />
            <div className="orbital-node node-one" />
            <div className="orbital-node node-two" />
            <div className="orbital-node node-three" />
            <div className="core-sphere">
              <div className="sphere-glint" />
              <span>SC</span>
            </div>
            <div className="signal-tag">
              <span className="status-pulse online" /> PRIVATE INFERENCE
            </div>
          </div>
        </section>

        {/* Right Readout Panel */}
        <aside className="readout-panel">
          <p className="panel-label">LIVE READOUT</p>
          <div className="metric">
            <span>NETWORK MODE</span>
            <strong>NO EGRESS</strong>
            <i />
          </div>
          <div className="metric">
            <span>VECTOR STORE</span>
            <strong>READY</strong>
            <i />
          </div>
          <div className="metric">
            <span>MISSION LOG</span>
            <strong>ARMED</strong>
            <i />
          </div>
          <div className="coordinate-card">
            <span>COORDINATES</span>
            <strong>
              19.0760° N
              <br />
              72.8777° E
            </strong>
            <small>LOCAL EXECUTION NODE</small>
          </div>
        </aside>
      </div>

      {/* Active Workbench Pillar Bay View */}
      <section id={`panel-${active}`} className="active-workbench-view" role="tabpanel" aria-labelledby={`tab-${active}`}>
        {active === 'mission' && (
          <MissionConsole3D
            model={model}
            onError={(err) => setActiveError(err)}
            onMissionCompleted={handleMissionCompleted}
          />
        )}
        {active === 'knowledge' && (
          <KnowledgeBay onError={(err) => setActiveError(err)} />
        )}
        {active === 'tools' && (
          <ToolBay onError={(err) => setActiveError(err)} />
        )}
        {active === 'recorder' && (
          <FlightRecorderBay
            onError={(err) => setActiveError(err)}
            selectedTaskId={lastCompletedTask}
          />
        )}
      </section>

      {/* 3D Holographic Error Diagnostic Modal */}
      <ErrorDiagnosticModal
        error={activeError}
        onDismiss={() => setActiveError(null)}
        onRetry={() => {
          setActiveError(null);
          // re-trigger active view or health check
          api.getHealth().catch((e) => setActiveError(normalizeError(e)));
        }}
      />
    </main>
  );
}
