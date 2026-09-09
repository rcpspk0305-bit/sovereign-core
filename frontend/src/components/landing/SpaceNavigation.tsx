'use client';

import React from 'react';
import { ArrowUpRight, Bot, Orbit, ShieldCheck, Sparkles, Terminal } from 'lucide-react';

interface SpaceNavigationProps {
  onLaunchWorkbench?: () => void;
  currentMode?: 'landing' | 'workbench';
}

export default function SpaceNavigation({
  onLaunchWorkbench,
  currentMode = 'landing',
}: SpaceNavigationProps) {
  return (
    <header className="space-nav-header">
      <div className="space-nav-pill">
        {/* Brand Logo */}
        <a href="#mission" className="space-nav-brand">
          <div className="space-nav-logo-icon">
            <Orbit size={18} className="space-nav-spin" />
            <span className="space-nav-pulse-dot" />
          </div>
          <div className="space-nav-brand-text">
            SOVEREIGN<span>/</span>CORE
          </div>
        </a>

        {/* Center Navigation Links */}
        <nav className="space-nav-links" aria-label="Landing Navigation">
          <a href="#mission" className="space-nav-link active">
            Mission
          </a>
          <a href="#ingestion" className="space-nav-link">
            Ingestion
          </a>
          <a href="#engine" className="space-nav-link">
            Solar Core
          </a>
          <a href="#tools" className="space-nav-link">
            Tool Belt
          </a>
          <a href="#audit" className="space-nav-link">
            Milky Way Audit
          </a>
          <a href="#workbench-preview" className="space-nav-link">
            Workbench
          </a>
        </nav>

        {/* Right CTA Cluster */}
        <div className="space-nav-right">
          <div className="space-nav-badge">
            <span className="space-nav-status-indicator" />
            <span>AIR-GAPPED // NO EGRESS</span>
          </div>

          <button
            onClick={onLaunchWorkbench}
            className="space-nav-cta-btn"
            aria-label="Launch interactive 3D workbench"
          >
            <span>{currentMode === 'workbench' ? 'View Journey' : 'Launch Workbench'}</span>
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
