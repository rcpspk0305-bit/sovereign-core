'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Database, Search, Sparkles, Sliders, Layers, Eye, Compass, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api-client';

interface VectorPoint {
  id: string;
  x: number;
  y: number;
  cluster: string;
  filename: string;
  similarity: number;
  color: string;
  tokens: number;
  preview: string;
}

const DEFAULT_POINTS: VectorPoint[] = [
  {
    id: 'p1',
    x: 180,
    y: 140,
    cluster: 'Radar Telemetry',
    filename: 'Defense_Radar_Subsystem_Manual.pdf',
    similarity: 0.94,
    color: '#00d2ff',
    tokens: 280,
    preview: 'Nominal operating frequency 9.4 GHz with baseline SNR 28dB under air-gapped calibration.',
  },
  {
    id: 'p2',
    x: 230,
    y: 190,
    cluster: 'Radar Telemetry',
    filename: 'Defense_Radar_Subsystem_Manual.pdf',
    similarity: 0.89,
    color: '#00d2ff',
    tokens: 310,
    preview: 'Subsystem telemetry anomaly threshold defined at delta > 3.2 sigma with automatic cutoff.',
  },
  {
    id: 'p3',
    x: 480,
    y: 120,
    cluster: 'Orbital Dynamics',
    filename: 'Orbital_LEO_Trajectory_Specs.pdf',
    similarity: 0.91,
    color: '#d4a843',
    tokens: 240,
    preview: 'Delta-V stationkeeping reserve margin calculated at 142 m/s per operational quarter.',
  },
  {
    id: 'p4',
    x: 520,
    y: 170,
    cluster: 'Orbital Dynamics',
    filename: 'Orbital_LEO_Trajectory_Specs.pdf',
    similarity: 0.85,
    color: '#d4a843',
    tokens: 290,
    preview: 'Inclination angle 51.6 degrees, altitude nominal 408km apogee with active perigee drag control.',
  },
  {
    id: 'p5',
    x: 310,
    y: 320,
    cluster: 'Zero-Egress Security',
    filename: 'AirGapped_Zero_Egress_Protocol.pdf',
    similarity: 0.96,
    color: '#8b72ff',
    tokens: 195,
    preview: 'Hardware boundary isolation enforcers: socket interception layer drops all non-loopback packets.',
  },
  {
    id: 'p6',
    x: 370,
    y: 350,
    cluster: 'Zero-Egress Security',
    filename: 'AirGapped_Zero_Egress_Protocol.pdf',
    similarity: 0.92,
    color: '#8b72ff',
    tokens: 215,
    preview: 'Cryptographic SHA-256 seal generator ensures verifiable integrity across mission logs.',
  },
  {
    id: 'p7',
    x: 620,
    y: 300,
    cluster: 'Cryptographic Audit',
    filename: 'Sovereign_Cryptographic_Audit.pdf',
    similarity: 0.88,
    color: '#00c896',
    tokens: 340,
    preview: 'Audit ledger merkle root anchored locally. Zero external sync tokens required.',
  },
];

interface VectorSpaceCanvasProps {
  onSelectPoint?: (point: VectorPoint) => void;
}

export default function VectorSpaceCanvas({ onSelectPoint }: VectorSpaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<VectorPoint[]>(DEFAULT_POINTS);
  const [hoveredPoint, setHoveredPoint] = useState<VectorPoint | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStep, setSearchStep] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);

  const clusters = ['All', 'Radar Telemetry', 'Orbital Dynamics', 'Zero-Egress Security', 'Cryptographic Audit'];

  // Handle Search Animation: Query -> Embedding -> Vector Space -> Nearest Neighbors -> Documents
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setSearchStep(1); // 1: Query Input

    setTimeout(() => setSearchStep(2), 350); // 2: Embedding (nomic-embed-text)
    setTimeout(() => setSearchStep(3), 750); // 3: Vector Space Projection
    setTimeout(() => setSearchStep(4), 1150); // 4: Nearest Neighbors Cosine Search
    setTimeout(() => {
      setSearchStep(5); // 5: Retrieved Chunks
      setIsSearching(false);
    }, 1600);

    try {
      const results = await api.searchRag(searchQuery.trim(), 4);
      if (results && results.length > 0) {
        // Highlight closest point
        setHoveredPoint(points[0]);
      }
    } catch {
      // Fallback to local points
      setHoveredPoint(points[0]);
    }
  };

  // Canvas drawing loop with celestial animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let angle = 0;

    const render = () => {
      angle += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep space subtle gradient background
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        50,
        canvas.width / 2,
        canvas.height / 2,
        400
      );
      bgGrad.addColorStop(0, 'rgba(18, 12, 42, 0.4)');
      bgGrad.addColorStop(1, 'rgba(4, 2, 14, 0.9)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw faint constellation connection lines between points of the same cluster
      const visiblePoints =
        selectedCluster === 'All'
          ? points
          : points.filter((p) => p.cluster === selectedCluster);

      for (let i = 0; i < visiblePoints.length; i++) {
        for (let j = i + 1; j < visiblePoints.length; j++) {
          const p1 = visiblePoints[i];
          const p2 = visiblePoints[j];
          if (p1.cluster === p2.cluster) {
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < 220) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${p1.color}22`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }

      // Draw orbital ambient center ring
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 140, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(160, 140, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Points
      visiblePoints.forEach((p) => {
        const isHovered = hoveredPoint?.id === p.id;
        const driftX = Math.sin(angle + p.x) * 2;
        const driftY = Math.cos(angle + p.y) * 2;

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x + driftX, p.y + driftY, isHovered ? 14 : 7, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}33`;
        ctx.fill();

        // Inner solid core
        ctx.beginPath();
        ctx.arc(p.x + driftX, p.y + driftY, isHovered ? 6 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#ffffff' : p.color;
        ctx.fill();

        // Label if hovered
        if (isHovered) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '11px "DM Mono", monospace';
          ctx.fillText(`${(p.similarity * 100).toFixed(1)}% match`, p.x + 18, p.y - 6);
        }
      });

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animFrame);
  }, [points, hoveredPoint, selectedCluster]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const visiblePoints =
      selectedCluster === 'All' ? points : points.filter((p) => p.cluster === selectedCluster);

    let found: VectorPoint | null = null;
    for (const p of visiblePoints) {
      const dist = Math.hypot(p.x - mouseX, p.y - mouseY);
      if (dist < 18) {
        found = p;
        break;
      }
    }

    setHoveredPoint(found);
    if (found && onSelectPoint) onSelectPoint(found);
  };

  return (
    <div className="sovereign-glass-panel" style={{ padding: '24px' }}>
      {/* Top Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Semantic Query Search Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '480px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(8, 4, 22, 0.75)',
              border: '1px solid var(--sov-border-medium)',
              flex: 1,
            }}
          >
            <Search size={14} className="text-cyan" />
            <input
              type="text"
              placeholder="Simulate semantic vector query (e.g., radar SNR baseline)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '12px',
                width: '100%',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.3), rgba(139, 114, 255, 0.2))',
              border: '1px solid var(--sov-border-bright)',
              color: '#fff',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={12} className="text-cyan" />
            <span>Search</span>
          </button>
        </form>

        {/* Cluster Filter Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {clusters.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCluster(c)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: selectedCluster === c ? 'rgba(0, 210, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                border: selectedCluster === c ? '1px solid var(--sov-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: selectedCluster === c ? '#fff' : 'var(--sov-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Semantic Query Progression Visualizer */}
      {searchStep > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(6, 4, 18, 0.8)',
            border: '1px solid var(--sov-border-medium)',
            marginBottom: '16px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: searchStep >= 1 ? '#00d2ff' : 'var(--sov-text-muted)' }}>
            <span>1. QUERY</span>
            <ArrowRight size={11} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: searchStep >= 2 ? '#8b72ff' : 'var(--sov-text-muted)' }}>
            <span>2. EMBEDDING</span>
            <ArrowRight size={11} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: searchStep >= 3 ? '#d4a843' : 'var(--sov-text-muted)' }}>
            <span>3. VECTOR SPACE</span>
            <ArrowRight size={11} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: searchStep >= 4 ? '#00c896' : 'var(--sov-text-muted)' }}>
            <span>4. NEAREST NEIGHBORS</span>
            <ArrowRight size={11} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: searchStep >= 5 ? '#10b981' : 'var(--sov-text-muted)' }}>
            <span>5. RETRIEVED CHUNKS</span>
          </div>
        </div>
      )}

      {/* Canvas Area with Inspector Overlay */}
      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <canvas
          ref={canvasRef}
          width={840}
          height={420}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          style={{ width: '100%', height: '420px', display: 'block', cursor: 'crosshair' }}
        />

        {/* Hovered Vector Chunk Inspector Overlay */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              maxWidth: '340px',
              padding: '14px 16px',
              borderRadius: '8px',
              background: 'rgba(8, 4, 24, 0.92)',
              border: `1px solid ${hoveredPoint.color}`,
              boxShadow: `0 8px 30px rgba(0, 0, 0, 0.8)`,
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              pointerEvents: 'none',
              animation: 'sovFadeIn 0.2s ease forwards',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: hoveredPoint.color, fontWeight: 700 }}>
                {hoveredPoint.cluster.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#10b981' }}>
                Cosine: {(hoveredPoint.similarity * 100).toFixed(1)}%
              </span>
            </div>

            <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 600 }}>
              {hoveredPoint.filename}
            </span>

            <p style={{ fontSize: '11px', color: 'var(--sov-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              &ldquo;{hoveredPoint.preview}&rdquo;
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: 'var(--sov-text-muted)' }}>
              <span>Tokens: {hoveredPoint.tokens}</span>
              <span>ChromaDB HNSW</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
