'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CircleDot,
  Database,
  Orbit,
  Radar,
  Radio,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, FlightRecord } from '@/lib/types';
import { initOrbitalStage } from '@/lib/animations';

import CosmicCanvas3D from '@/components/landing/CosmicCanvas3D';
import SpaceNavigation from '@/components/landing/SpaceNavigation';
import CosmicHero from '@/components/landing/CosmicHero';
import WorkflowSection from '@/components/landing/WorkflowSection';
import SpaceFooter from '@/components/landing/SpaceFooter';
import AgentChatLauncher from '@/components/chat/AgentChatLauncher';

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
    label: 'Mission Launcher',
    icon: Radio,
    eyebrow: 'ORBITAL COMMAND',
    title: 'Autonomous Local Agents.\nAuditable Execution.',
    detail: 'Air-gapped mission launcher with grounded document intelligence, sandbox tools, and cryptographic flight notes.',
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
  // Default to chat/agent launcher as requested: "Replace the mission control page with the chat + agent launcher page"
  const [viewMode, setViewMode] = useState<'chat' | 'workbench' | 'landing'>('chat');
  const [active, setActive] = useState<Section>('mission');
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [model, setModel] = useState<string>('gemma4:e2b');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemma4:e2b',
    'gemma4:e4b-it-qat',
  ]);
  const [activeError, setActiveError] = useState<AppError | null>(null);
  const [lastCompletedTask, setLastCompletedTask] = useState<string | null>(null);

  const orbitalContainerRef = useRef<HTMLDivElement>(null);
  const current = useMemo(
    () => sections.find((section) => section.id === active) ?? sections[0],
    [active],
  );

  // Check health and available models on mount
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

  const handleExploreWorkflow = () => {
    setViewMode('landing');
    setTimeout(() => {
      const el = document.getElementById('ingestion');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleOpenLauncher = () => {
    setViewMode('chat');
    setActive('mission');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchWorkbench = (bay: Section = 'knowledge') => {
    setActive(bay);
    setViewMode('workbench');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLanding = () => {
    setViewMode('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="constellation-shell">
      {/* Background Aurora Lighting Overlays */}
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />

      {viewMode === 'chat' && (
        /* ============================================================ */
        /* PRIMARY VIEW: CHAT INTERFACE & AGENT MISSION LAUNCHER       */
        /* (Photorealistic Planet & Stars, Clean Modern Design)         */
        /* ============================================================ */
        <AgentChatLauncher
          onBackToLanding={handleBackToLanding}
          onOpenWorkbench={(tab) => {
            if (tab === 'mission' || !tab) {
              setViewMode('chat');
            } else {
              handleLaunchWorkbench(tab as Section);
            }
          }}
          availableModels={availableModels}
          currentModel={model}
          onModelChange={(m) => setModel(m)}
          activeBay="mission"
        />
      )}

      {viewMode === 'workbench' && (
        /* ============================================================ */
        /* INTERACTIVE WORKBENCH BAYS (KNOWLEDGE, TOOLS, RECORDER)      */
        /* ============================================================ */
        <div className="workbench-experience-wrapper">
          {/* Top Bar with Navigation Toggles */}
          <header className="topbar">
            <div className="topbar-left-cluster">
              <button
                onClick={handleBackToLanding}
                className="back-to-landing-btn"
                aria-label="Return to Cosmic Landing Page"
              >
                <ArrowLeft size={16} />
                <span>Overview</span>
              </button>

              <button
                onClick={handleOpenLauncher}
                className="back-to-landing-btn text-cyan"
                aria-label="Open Agent Launcher"
              >
                <Radio size={15} />
                <span>Chat & Launcher</span>
              </button>

              <a className="wordmark" href="#mission" aria-label="Sovereign Core home">
                <span className="wordmark-mark">
                  <Sparkles size={16} />
                </span>
                SOVEREIGN<span>/</span>CORE
              </a>
            </div>

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
                      {m.replace('gemma4:', 'Gemma ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          {/* If the user is on the mission tab inside workbench, render the modern launcher */}
          {active === 'mission' ? (
            <div className="workbench-launcher-frame">
              <AgentChatLauncher
                onBackToLanding={handleBackToLanding}
                onOpenWorkbench={(tab) => {
                  if (tab && tab !== 'mission') {
                    setActive(tab as Section);
                  }
                }}
                availableModels={availableModels}
                currentModel={model}
                onModelChange={(m) => setModel(m)}
                activeBay="mission"
              />
            </div>
          ) : (
            <div className="orbital-layout">
              {/* Left Navigation Sidebar */}
              <aside className="navigation-panel">
                <p className="panel-label">WORKBENCH BAYS</p>
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
                        onClick={() => {
                          if (section.id === 'mission') {
                            handleOpenLauncher();
                          } else {
                            setActive(section.id);
                          }
                        }}
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

              {/* Center Bay View */}
              <div className="workbench-bay-center">
                <section
                  id={`panel-${active}`}
                  className="active-workbench-view"
                  role="tabpanel"
                  aria-labelledby={`tab-${active}`}
                >
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
              </div>

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
          )}
        </div>
      )}

      {viewMode === 'landing' && (
        /* ============================================================ */
        /* 3D COSMIC OVERVIEW & ARCHITECTURE SHOWCASE                   */
        /* ============================================================ */
        <div className="landing-experience-wrapper">
          <CosmicCanvas3D />

          <SpaceNavigation
            onLaunchWorkbench={() => handleLaunchWorkbench('knowledge')}
            onOpenLauncher={handleOpenLauncher}
            currentMode={viewMode}
          />

          <CosmicHero
            onExploreWorkflow={handleExploreWorkflow}
            onLaunchWorkbench={() => handleLaunchWorkbench('knowledge')}
            onOpenLauncher={handleOpenLauncher}
          />

          <WorkflowSection onLaunchWorkbench={() => handleLaunchWorkbench('knowledge')} />

          <SpaceFooter
            onBackToTop={handleBackToTop}
            onLaunchWorkbench={() => handleLaunchWorkbench('knowledge')}
          />
        </div>
      )}

      {/* 3D Holographic Error Diagnostic Modal */}
      <ErrorDiagnosticModal
        error={activeError}
        onDismiss={() => setActiveError(null)}
        onRetry={() => {
          setActiveError(null);
          api.getHealth().catch((e) => setActiveError(normalizeError(e)));
        }}
      />
    </main>
  );
}
