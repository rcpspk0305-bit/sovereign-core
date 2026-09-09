'use client';

import React from 'react';
import { ArrowUp, Bot, Github, Orbit, ShieldCheck, Sparkles, Terminal } from 'lucide-react';

interface SpaceFooterProps {
  onBackToTop: () => void;
  onLaunchWorkbench: () => void;
}

export default function SpaceFooter({ onBackToTop, onLaunchWorkbench }: SpaceFooterProps) {
  return (
    <footer className="space-footer-container">
      <div className="space-footer-inner">
        <div className="footer-top-row">
          <div className="footer-brand-col">
            <div className="footer-logo">
              <div className="footer-logo-orbit">
                <Orbit size={18} className="space-nav-spin" />
              </div>
              <span className="footer-brand-name">
                SOVEREIGN<span>/</span>CORE
              </span>
            </div>
            <p className="footer-tagline">
              Production-Quality Local AI Workbench Foundation with Real-Time Telemetry & 3D Interactive Workbench.
              Engineered for the Smart India Hackathon.
            </p>
            <div className="footer-security-seal">
              <ShieldCheck size={16} />
              <span>AIR-GAPPED BY DESIGN // ZERO EXTERNAL EGRESS</span>
            </div>
          </div>

          <div className="footer-links-grid">
            <div className="footer-link-col">
              <h4>ARCHITECTURE</h4>
              <a href="#mission">Orbital Mission</a>
              <a href="#ingestion">PyMuPDF & ChromaDB</a>
              <a href="#engine">Gemma 4 & Ollama</a>
              <a href="#tools">Bounded Tool Bay</a>
              <a href="#audit">Flight Recorder</a>
            </div>

            <div className="footer-link-col">
              <h4>TECHNOLOGY</h4>
              <span>FastAPI (Python 3.11+)</span>
              <span>Next.js 14 & React 18</span>
              <span>Three.js WebGL Engine</span>
              <span>Anime.js v4 Physics</span>
              <span>Docker Compose</span>
            </div>

            <div className="footer-link-col">
              <h4>DEPLOYMENT</h4>
              <button onClick={onLaunchWorkbench} className="footer-text-btn">
                Launch 3D Workbench
              </button>
              <span>Localhost:3000 (UI)</span>
              <span>Localhost:8000 (API)</span>
              <span>Localhost:11434 (Ollama)</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom-row">
          <div className="footer-copy">
            <span>© 2026 Sovereign-Core Foundation. Smart India Hackathon. All rights reserved.</span>
          </div>

          <div className="footer-bottom-actions">
            <button
              onClick={onBackToTop}
              className="back-to-top-btn"
              aria-label="Back to top of cosmic journey"
            >
              <span>BACK TO TOP</span>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
