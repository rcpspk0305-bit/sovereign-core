'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Bot,
  CircleDot,
  Compass,
  Cpu,
  Database,
  Lock,
  Orbit,
  Radio,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface CosmicHeroProps {
  onExploreWorkflow: () => void;
  onLaunchWorkbench: () => void;
  onOpenLauncher?: () => void;
}

export default function CosmicHero({
  onExploreWorkflow,
  onLaunchWorkbench,
  onOpenLauncher,
}: CosmicHeroProps) {
  return (
    <section className="cosmic-hero-section" id="mission">
      <div className="cosmic-hero-content">
        {/* Hackathon Badge */}
        <div className="cosmic-hero-badge">
          <Sparkles size={14} className="cosmic-sparkle-icon" />
          <span>SMART INDIA HACKATHON // SOVEREIGN AI FOUNDATION</span>
        </div>

        {/* Hero Title */}
        <h1 className="cosmic-hero-title">
          Launch Your Workflow
          <br />
          <span className="cosmic-gradient-text">Into Deep Orbit</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="cosmic-hero-subtitle">
          Supercharge mission-critical productivity with an air-gapped, local-first AI engine.
          Zero cloud data leaks, sub-second deterministic reasoning, and cryptographic blackbox provenance.
        </p>

        {/* Hero Action Buttons */}
        <div className="cosmic-hero-actions">
          {onOpenLauncher && (
            <button
              onClick={onOpenLauncher}
              className="cosmic-btn-primary"
              aria-label="Launch 3D Rocket Agent Mission"
            >
              <Rocket size={18} />
              <span>Launch Mission & Chat</span>
            </button>
          )}

          <button
            onClick={onLaunchWorkbench}
            className={onOpenLauncher ? 'cosmic-btn-secondary' : 'cosmic-btn-primary'}
            aria-label="Launch 3D Local AI Workbench"
          >
            <span>3D Workbench</span>
            <ArrowUpRight size={18} />
          </button>

          <button
            onClick={onExploreWorkflow}
            className="cosmic-btn-secondary"
            aria-label="Explore SIH Architecture Workflow"
          >
            <span>Explore SIH Workflow</span>
            <ArrowDown size={17} />
          </button>
        </div>
      </div>

      {/* Futuristic Telemetry HUD Control Bar (Inspired by ORION Spacecraft HUD) */}
      <div className="cosmic-hud-bar">
        <div className="cosmic-hud-col">
          <div className="cosmic-hud-label">
            <Radio size={12} />
            <span>LAUNCH NODE</span>
          </div>
          <div className="cosmic-hud-value">
            <strong>SOVEREIGN-01</strong>
            <small>AIR-GAPPED HOST</small>
          </div>
        </div>

        <div className="cosmic-hud-divider" />

        <div className="cosmic-hud-col">
          <div className="cosmic-hud-label">
            <ShieldCheck size={12} />
            <span>EGRESS PERIMETER</span>
          </div>
          <div className="cosmic-hud-value">
            <strong>NO EGRESS (0.00%)</strong>
            <small>ZERO CLOUD LEAKS</small>
          </div>
        </div>

        <div className="cosmic-hud-divider" />

        <div className="cosmic-hud-col">
          <div className="cosmic-hud-label">
            <Cpu size={12} />
            <span>REASONING CORE</span>
          </div>
          <div className="cosmic-hud-value">
            <strong>GEMMA-4 E2B</strong>
            <small>NATIVE OLLAMA</small>
          </div>
        </div>

        <div className="cosmic-hud-divider" />

        <div className="cosmic-hud-col">
          <div className="cosmic-hud-label">
            <Database size={12} />
            <span>VECTOR MEMORY</span>
          </div>
          <div className="cosmic-hud-value">
            <strong>CHROMADB HNSW</strong>
            <small>COSINE DISTANCE</small>
          </div>
        </div>

        <div className="cosmic-hud-divider" />

        <button
          onClick={onOpenLauncher || onLaunchWorkbench}
          className="cosmic-hud-action-btn"
          aria-label="Engage local AI workbench"
        >
          <Rocket size={15} />
          <span>ENGAGE LAUNCHER</span>
        </button>
      </div>

      {/* Bottom Scroll Indicator */}
      <div className="cosmic-scroll-cue" onClick={onExploreWorkflow}>
        <div className="scroll-pill-wheel" />
        <span>SCROLL TO TRAVERSE COSMIC WORKFLOW</span>
      </div>
    </section>
  );
}
