'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Radio,
  Sparkles,
  ShieldCheck,
  Cpu,
  Database,
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
        {/* Minimal Hackathon / Foundation Tag */}
        <div className="cosmic-hero-badge">
          <Sparkles size={13} className="cosmic-sparkle-icon" />
          <span>SOVEREIGN FOUNDATION // LOCAL INTELLIGENCE</span>
        </div>

        {/* Hero Title — Astra Thin Majestic Display */}
        <h1 className="cosmic-hero-title">
          Intelligence in
          <br />
          <span className="cosmic-gradient-text">Pure Orbit</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="cosmic-hero-subtitle">
          Supercharge mission-critical productivity with an air-gapped, local-first neural engine.
          Zero cloud data egress, deterministic sub-second reasoning, and verifiable blackbox provenance.
        </p>

        {/* Minimalist Hero Actions */}
        <div className="cosmic-hero-actions">
          {onOpenLauncher && (
            <button
              onClick={onOpenLauncher}
              className="cosmic-btn-primary"
              aria-label="Launch AI Agent Mission & Chat"
            >
              <Radio size={16} />
              <span>Launch Mission</span>
            </button>
          )}

          <button
            onClick={onLaunchWorkbench}
            className="cosmic-btn-secondary"
            aria-label="Launch 3D Local AI Workbench"
          >
            <span>Open Workbench</span>
            <ArrowUpRight size={16} />
          </button>

          <button
            onClick={onExploreWorkflow}
            className="cosmic-btn-ghost"
            aria-label="Explore System Architecture"
          >
            <span>Explore Architecture</span>
            <ArrowDown size={15} />
          </button>
        </div>

        {/* Sleek Floating Key Attributes Strip (Astra Minimalist Specs) */}
        <div className="cosmic-specs-strip">
          <div className="spec-item">
            <ShieldCheck size={14} className="text-emerald" />
            <span>0.00% EGRESS</span>
          </div>
          <span className="spec-divider">•</span>
          <div className="spec-item">
            <Cpu size={14} className="text-gold" />
            <span>LOCAL GEMMA-4 CORE</span>
          </div>
          <span className="spec-divider">•</span>
          <div className="spec-item">
            <Database size={14} className="text-teal" />
            <span>HNSW VECTOR RETRIEVAL</span>
          </div>
        </div>
      </div>
    </section>
  );
}
