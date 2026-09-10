'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Compass,
  Bot,
  Wrench,
  Cpu,
  Database,
  Play,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export type PipelineNodeId =
  | 'user'
  | 'intent'
  | 'agent'
  | 'tools'
  | 'memory'
  | 'model'
  | 'execution';

interface IntelligenceCoreProps {
  activeStage?: PipelineNodeId;
  latencyMs?: number;
  interactive?: boolean;
}

export default function IntelligenceCore({
  activeStage = 'agent',
  latencyMs = 185,
  interactive = true,
}: IntelligenceCoreProps) {
  const [currentStage, setCurrentStage] = useState<PipelineNodeId>(activeStage);
  const [pulsePos, setPulsePos] = useState(0);

  useEffect(() => {
    setCurrentStage(activeStage);
  }, [activeStage]);

  // Ambient traveling energy pulse simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setPulsePos((prev) => (prev + 1) % 100);
    }, 40);
    return () => clearInterval(timer);
  }, []);

  const stages: {
    id: PipelineNodeId;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
  }[] = [
    {
      id: 'user',
      label: 'OPERATOR DIRECTIVE',
      sublabel: 'Local Air-Gap Input',
      icon: <User size={18} />,
      color: '#00d2ff',
      glow: 'rgba(0, 210, 255, 0.4)',
    },
    {
      id: 'intent',
      label: 'INTENT ROUTER',
      sublabel: 'Deterministic Classification',
      icon: <Compass size={18} />,
      color: '#8b72ff',
      glow: 'rgba(139, 114, 255, 0.4)',
    },
    {
      id: 'agent',
      label: 'AUTONOMOUS SQUAD',
      sublabel: 'Task Planning & Execution',
      icon: <Bot size={18} />,
      color: '#d4a843',
      glow: 'rgba(212, 168, 67, 0.4)',
    },
    {
      id: 'tools',
      label: 'TOOL SANDBOX',
      sublabel: 'Zero-Egress Execution',
      icon: <Wrench size={18} />,
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)',
    },
    {
      id: 'memory',
      label: '4-TIER MEMORY',
      sublabel: 'ChromaDB + Working RAM',
      icon: <Database size={18} />,
      color: '#00c896',
      glow: 'rgba(0, 200, 150, 0.4)',
    },
    {
      id: 'model',
      label: 'LOCAL MODEL CORE',
      sublabel: 'Ollama Offline Reasoner',
      icon: <Cpu size={18} />,
      color: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.4)',
    },
    {
      id: 'execution',
      label: 'VERIFIED DISPATCH',
      sublabel: 'Cryptographic SHA-256 Seal',
      icon: <CheckCircle2 size={18} />,
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.4)',
    },
  ];

  const handleNodeClick = (id: PipelineNodeId) => {
    if (interactive) setCurrentStage(id);
  };

  return (
    <div className="sovereign-glass-panel" style={{ padding: '32px 28px' }}>
      {/* Top Telemetry & Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#00c896',
              boxShadow: '0 0 12px #00c896',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              color: '#d4a843',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            SOVEREIGN INTELLIGENCE CORE // LIVE ARCHITECTURE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#7dd3fc',
              background: 'rgba(3, 16, 35, 0.65)',
              padding: '4px 10px',
              borderRadius: '9999px',
              border: '1px solid rgba(0, 210, 255, 0.25)',
            }}
          >
            <Zap size={12} className="text-cyan animate-pulse" />
            <span>LATENCY: {latencyMs}ms</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#00c896',
              background: 'rgba(4, 24, 20, 0.65)',
              padding: '4px 10px',
              borderRadius: '9999px',
              border: '1px solid rgba(0, 200, 150, 0.25)',
            }}
          >
            <ShieldCheck size={12} />
            <span>0.00% EGRESS ESCAPE</span>
          </div>
        </div>
      </div>

      {/* Spatial Architecture Flow Diagram */}
      <div
        style={{
          position: 'relative',
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* Background Subtle SVG Connection Lines with Pulse */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {/* Vertical spine */}
          <line
            x1="50%"
            y1="40"
            x2="50%"
            y2="340"
            stroke="rgba(160, 140, 255, 0.2)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          {/* Animated signal circle traveling down spine */}
          <circle
            cx="50%"
            cy={40 + (pulsePos / 100) * 300}
            r="3.5"
            fill="#00d2ff"
            filter="drop-shadow(0 0 6px #00d2ff)"
          />
        </svg>

        {/* Level 1: Operator Directive */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SpatialNodeCard
            node={stages[0]}
            isActive={currentStage === 'user'}
            onClick={() => handleNodeClick('user')}
          />
        </div>

        {/* Arrow Down */}
        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(160, 140, 255, 0.4)' }}>
          ↓
        </div>

        {/* Level 2: Intent Router */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SpatialNodeCard
            node={stages[1]}
            isActive={currentStage === 'intent'}
            onClick={() => handleNodeClick('intent')}
          />
        </div>

        {/* Arrow Down */}
        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(160, 140, 255, 0.4)' }}>
          ↓
        </div>

        {/* Level 3: Autonomous Agent Squad */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SpatialNodeCard
            node={stages[2]}
            isActive={currentStage === 'agent'}
            onClick={() => handleNodeClick('agent')}
            highlight
          />
        </div>

        {/* Branching Connectors: ↙ ↓ ↘ */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '680px',
            color: 'rgba(160, 140, 255, 0.5)',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            padding: '0 40px',
          }}
        >
          <span>↙</span>
          <span>↓</span>
          <span>↘</span>
        </div>

        {/* Level 4: Tri-Cluster: Tools | Memory | Model */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            width: '100%',
            maxWidth: '820px',
          }}
        >
          <SpatialNodeCard
            node={stages[3]}
            isActive={currentStage === 'tools'}
            onClick={() => handleNodeClick('tools')}
          />
          <SpatialNodeCard
            node={stages[4]}
            isActive={currentStage === 'memory'}
            onClick={() => handleNodeClick('memory')}
          />
          <SpatialNodeCard
            node={stages[5]}
            isActive={currentStage === 'model'}
            onClick={() => handleNodeClick('model')}
          />
        </div>

        {/* Converging Indicators: ↓ ↓ ↓ */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-around',
            width: '100%',
            maxWidth: '720px',
            color: 'rgba(160, 140, 255, 0.4)',
          }}
        >
          <span>↓</span>
          <span>↓</span>
          <span>↓</span>
        </div>

        {/* Level 5: Verified Execution Outcome */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SpatialNodeCard
            node={stages[6]}
            isActive={currentStage === 'execution'}
            onClick={() => handleNodeClick('execution')}
          />
        </div>
      </div>
    </div>
  );
}

interface SpatialNodeCardProps {
  node: {
    id: PipelineNodeId;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
  };
  isActive: boolean;
  onClick: () => void;
  highlight?: boolean;
}

function SpatialNodeCard({ node, isActive, onClick, highlight }: SpatialNodeCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '12px 20px',
        borderRadius: '10px',
        background: isActive
          ? `radial-gradient(circle at center, rgba(16, 12, 40, 0.95), rgba(8, 4, 24, 0.9))`
          : 'rgba(10, 6, 26, 0.7)',
        border: isActive
          ? `1px solid ${node.color}`
          : highlight
          ? '1px solid rgba(212, 168, 67, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.09)',
        boxShadow: isActive
          ? `0 0 30px ${node.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          : '0 8px 24px rgba(0, 0, 0, 0.5)',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isActive ? 'scale(1.03)' : 'scale(1)',
        textAlign: 'left',
        minWidth: '220px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: isActive ? node.color : 'rgba(255, 255, 255, 0.05)',
          color: isActive ? '#050212' : node.color,
          display: 'grid',
          placeItems: 'center',
          boxShadow: isActive ? `0 0 16px ${node.color}` : 'none',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
      >
        {node.icon}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
          }}
        >
          {node.label}
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {node.sublabel}
        </span>
      </div>
    </button>
  );
}
