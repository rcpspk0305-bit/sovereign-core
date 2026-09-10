'use client';

import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  HardDrive,
  Lock,
  RefreshCw,
  Save,
  Server,
  Shield,
  ShieldCheck,
  Sliders,
  Terminal,
} from 'lucide-react';

export default function SettingsWorkspace() {
  const [airGapStrict, setAirGapStrict] = useState(true);
  const [cryptographicAudit, setCryptographicAudit] = useState(true);
  const [localSocketOnly, setLocalSocketOnly] = useState(true);
  const [maxContextTokens, setMaxContextTokens] = useState(8192);
  const [defaultTemperature, setDefaultTemperature] = useState(0.1);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="sovereign-stage-container">
      {/* Workspace Header */}
      <header className="sovereign-header-block">
        <div className="sovereign-header-left">
          <div className="sovereign-header-icon">
            <Lock size={22} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="sovereign-eyebrow-tag">
              <ShieldCheck size={12} className="text-emerald" />
              <span>SECURITY & AIR-GAP GOVERNANCE // SYSTEM CONFIG</span>
            </div>
            <h1 className="sovereign-title">System Policies & Air-Gap Settings</h1>
            <p className="sovereign-subtitle">
              Cryptographic guarantees, local socket isolation rules, memory retention policies, and runtime hardware parameters.
            </p>
          </div>
        </div>

        <div className="sovereign-header-badges">
          <div className="sovereign-badge-pill verified">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>POLICY STATUS: ENFORCED</span>
          </div>

          <button
            onClick={handleSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #00d2ff, #0088cc)',
              border: 'none',
              color: '#020617',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0, 210, 255, 0.35)',
            }}
          >
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            <span>{isSaved ? 'Policies Applied' : 'Save Policies'}</span>
          </button>
        </div>
      </header>

      {/* Settings Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Section 1: Air-Gap Network Boundary */}
        <div className="sovereign-glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={18} className="text-emerald" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>
              Air-Gap Network Boundary
            </h3>
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--sov-text-secondary)', lineHeight: 1.5 }}>
            Strict physical and software boundary enforcement ensuring no outbound network calls can escape the host machine.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, display: 'block' }}>
                  Zero Cloud Egress Shield
                </span>
                <span style={{ fontSize: '11px', color: 'var(--sov-text-muted)' }}>
                  Block any external TCP/UDP connections
                </span>
              </div>
              <input
                type="checkbox"
                checked={airGapStrict}
                onChange={(e) => setAirGapStrict(e.target.checked)}
                style={{ accentColor: '#00d2ff', width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, display: 'block' }}>
                  Loopback Only Sockets (127.0.0.1)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--sov-text-muted)' }}>
                  Restrict FastAPI & Ollama to localhost ports
                </span>
              </div>
              <input
                type="checkbox"
                checked={localSocketOnly}
                onChange={(e) => setLocalSocketOnly(e.target.checked)}
                style={{ accentColor: '#00d2ff', width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

        {/* Section 2: Cryptographic Audit Ledger */}
        <div className="sovereign-glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={18} className="text-cyan" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>
              Cryptographic Audit Ledger
            </h3>
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--sov-text-secondary)', lineHeight: 1.5 }}>
            Tamper-evident mission flight logs sealed using deterministic SHA-256 cryptographic hashes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, display: 'block' }}>
                  SHA-256 Flight Seals
                </span>
                <span style={{ fontSize: '11px', color: 'var(--sov-text-muted)' }}>
                  Sign all directives and agent responses
                </span>
              </div>
              <input
                type="checkbox"
                checked={cryptographicAudit}
                onChange={(e) => setCryptographicAudit(e.target.checked)}
                style={{ accentColor: '#00d2ff', width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </label>

            <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)', fontFamily: 'var(--font-mono)' }}>
                LOCAL LEDGER ANCHOR:
              </span>
              <span style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#10b981', marginTop: '2px' }}>
                sha256:7f83b165...verified
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Model Context & Temperature */}
        <div className="sovereign-glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={18} className="text-gold" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>
              Local Reasoning Parameters
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#fff', fontWeight: 600 }}>Default Temperature:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--sov-gold)' }}>{defaultTemperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={defaultTemperature}
                onChange={(e) => setDefaultTemperature(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#d4a843', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--sov-text-muted)' }}>
                Low temperature (0.1) enforces deterministic, repeatable mission analysis.
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#fff', fontWeight: 600 }}>Max Context Tokens:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--sov-cyan)' }}>{maxContextTokens}</span>
              </div>
              <input
                type="range"
                min="2048"
                max="32768"
                step="2048"
                value={maxContextTokens}
                onChange={(e) => setMaxContextTokens(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#00d2ff', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
