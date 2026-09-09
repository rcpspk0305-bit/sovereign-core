'use client';

import React from 'react';
import { ArrowUpRight, Cpu, Radio, Sparkles } from 'lucide-react';

interface SpaceNavigationProps {
  onLaunchWorkbench?: (bay?: string) => void;
  onOpenLauncher?: () => void;
  currentMode?: 'landing' | 'chat' | 'workbench';
}

export default function SpaceNavigation({
  onLaunchWorkbench,
  onOpenLauncher,
  currentMode = 'landing',
}: SpaceNavigationProps) {
  return (
    <header className="space-nav-header">
      <div className="space-nav-pill">
        {/* Brand Logo - Astra Minimal */}
        <a href="#mission" className="space-nav-brand">
          <span className="space-nav-logo-icon">
            <Sparkles size={14} />
          </span>
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
            Reasoning Core
          </a>
          <a href="#tools" className="space-nav-link">
            Tool Sandbox
          </a>
          <a href="#audit" className="space-nav-link">
            Provenance Audit
          </a>
          {onLaunchWorkbench && (
            <button
              onClick={() => onLaunchWorkbench('memory')}
              className="space-nav-link-btn"
              aria-label="Open Memory Flow"
            >
              <Cpu size={13} />
              <span>Memory Flow</span>
            </button>
          )}
        </nav>

        {/* Right CTA Cluster */}
        <div className="space-nav-right">
          <div className="space-nav-badge">
            <span className="space-nav-status-indicator" />
            <span>AIR-GAPPED // 0% EGRESS</span>
          </div>

          {onOpenLauncher && (
            <button
              onClick={onOpenLauncher}
              className="space-nav-rocket-btn"
              aria-label="Launch Agent & Chat"
            >
              <Radio size={13} />
              <span>Launch Mission</span>
            </button>
          )}

          <button
            onClick={() => onLaunchWorkbench?.()}
            className="space-nav-cta-btn"
            aria-label="Launch interactive 3D workbench"
          >
            <span>{currentMode === 'workbench' ? 'Overview' : 'Workbench'}</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
