'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface Community {
  id: string;
  name: string;
  color: string;
  count: number;
  visible: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  communityId: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  degree: number;
  pinned?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

const INITIAL_COMMUNITIES: Community[] = [
  { id: 'apirouter', name: 'APIRouter', color: '#4F75B4', count: 96, visible: true },
  { id: 'securitybase', name: 'SecurityBase', color: '#E87223', count: 71, visible: true },
  { id: 'v2', name: 'v2', color: '#D63942', count: 56, visible: true },
  { id: 'fastapideprecation', name: 'FastAPIDeprecationWarning', color: '#3AA89D', count: 48, visible: true },
  { id: 'fastapi', name: 'FastAPI', color: '#46A851', count: 46, visible: true },
  { id: 'basemodel', name: 'BaseModelWithConfig', color: '#E5BF35', count: 40, visible: true },
  { id: 'scope', name: 'Scope', color: '#9D69B0', count: 31, visible: true },
  { id: 'httpexception', name: 'HTTPException', color: '#E87C95', count: 30, visible: true },
  { id: 'models', name: 'models', color: '#9C7A58', count: 29, visible: true },
  { id: 'issubclass', name: 'lenient issubclass()', color: '#A0A8B4', count: 22, visible: true },
  { id: 'signature', name: 'get typed signature()', color: '#4A8FE2', count: 21, visible: true },
  { id: 'utils', name: 'utils', color: '#EC8828', count: 22, visible: true },
  { id: 'modelfield', name: 'ModelField', color: '#E5433B', count: 21, visible: true },
  { id: 'placeholder', name: 'DefaultPlaceholder', color: '#44C7B8', count: 20, visible: true },
  { id: 'pathlike', name: 'PathLike', color: '#63C770', count: 15, visible: true },
];

export default function RealisticKnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [communities, setCommunities] = useState<Community[]>(INITIAL_COMMUNITIES);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Transform state: Pan and Zoom
  const transformRef = useRef({ x: 30, y: 10, scale: 1.15 });
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<GraphNode | null>(null);

  // Graph Data
  const graphDataRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[]; adj: Map<string, Set<string>> }>({
    nodes: [],
    edges: [],
    adj: new Map(),
  });

  // Generate realistic force-directed graph matching the layout in the image
  useEffect(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const adj = new Map<string, Set<string>>();

    const addEdge = (s: string, t: string, weight = 1) => {
      edges.push({ source: s, target: t, weight });
      if (!adj.has(s)) adj.set(s, new Set());
      if (!adj.has(t)) adj.set(t, new Set());
      adj.get(s)!.add(t);
      adj.get(t)!.add(s);
    };

    // Centroid layout coordinates calibrated directly to user's screenshot
    const centroids: Record<string, { x: number; y: number; spread: number }> = {
      apirouter: { x: 70, y: -5, spread: 80 },          // dense blue nucleus (center-right)
      securitybase: { x: -65, y: 65, spread: 85 },       // prominent orange cloud (lower-left)
      v2: { x: -15, y: -130, spread: 70 },              // crimson red cluster (top center)
      fastapideprecation: { x: -115, y: -20, spread: 55 }, // teal cluster connecting left & center
      fastapi: { x: -285, y: 5, spread: 40 },           // far-left green tree & dandelion
      basemodel: { x: 115, y: -130, spread: 55 },       // top-right radiating gold crown
      scope: { x: 145, y: 80, spread: 52 },             // mid/lower-right purple cluster
      httpexception: { x: 85, y: 140, spread: 45 },     // lower-right pink cluster
      models: { x: 65, y: 55, spread: 42 },             // mid-right brown cluster
      issubclass: { x: 15, y: -75, spread: 38 },        // top-center silver/grey nodes
      signature: { x: -45, y: -80, spread: 40 },        // top-center azure blue nodes
      utils: { x: -40, y: 145, spread: 45 },            // bottom warm orange cluster
      modelfield: { x: 45, y: -165, spread: 35 },       // top crimson cluster
      placeholder: { x: -165, y: -10, spread: 38 },     // teal bridge nodes
      pathlike: { x: -105, y: 185, spread: 32 },        // bottom lime green nodes
    };

    // Build Nodes & Local Clusters
    INITIAL_COMMUNITIES.forEach((comm) => {
      const cent = centroids[comm.id] || { x: 0, y: 0, spread: 60 };
      const count = comm.count;

      // Primary Hub Node for this community
      const hubId = `${comm.id}_hub`;
      nodes.push({
        id: hubId,
        label: `${comm.name} Hub`,
        communityId: comm.id,
        color: comm.color,
        x: cent.x,
        y: cent.y,
        vx: 0,
        vy: 0,
        radius: comm.id === 'apirouter' ? 6.5 : comm.id === 'securitybase' ? 5.8 : 4.8,
        degree: 0,
      });

      // Special cluster structures
      if (comm.id === 'fastapi') {
        // FastAPI Far-Left Dandelion Rosette Wheel (as seen in screenshot)
        const wheelCenterX = -305;
        const wheelCenterY = 8;
        const wheelHubId = 'fastapi_wheel_hub';
        nodes.push({
          id: wheelHubId,
          label: 'FastAPI::WheelCore',
          communityId: 'fastapi',
          color: comm.color,
          x: wheelCenterX,
          y: wheelCenterY,
          vx: 0,
          vy: 0,
          radius: 4.2,
          degree: 0,
        });
        addEdge(hubId, wheelHubId, 1.2);

        // 18 spoke nodes radiating in a circle
        const spokeCount = 18;
        for (let s = 0; s < spokeCount; s++) {
          const spokeAngle = (s / spokeCount) * Math.PI * 2;
          const spokeDist = 26 + (s % 3) * 3;
          const spokeId = `fastapi_spoke_${s}`;
          nodes.push({
            id: spokeId,
            label: `FastAPI::spoke_${s}`,
            communityId: 'fastapi',
            color: comm.color,
            x: wheelCenterX + Math.cos(spokeAngle) * spokeDist,
            y: wheelCenterY + Math.sin(spokeAngle) * spokeDist,
            vx: 0,
            vy: 0,
            radius: 2.2,
            degree: 0,
          });
          addEdge(wheelHubId, spokeId, 1);
        }

        // Upward dendritic branch
        const upBranchIds = ['fastapi_up_1', 'fastapi_up_2', 'fastapi_up_3'];
        const upCoords = [
          { x: -285, y: -45 },
          { x: -265, y: -90 },
          { x: -245, y: -135 },
        ];
        upBranchIds.forEach((id, idx) => {
          nodes.push({
            id,
            label: `FastAPI::branch_up_${idx + 1}`,
            communityId: 'fastapi',
            color: comm.color,
            x: upCoords[idx].x,
            y: upCoords[idx].y,
            vx: 0,
            vy: 0,
            radius: 2.8,
            degree: 0,
          });
          if (idx === 0) addEdge(hubId, id, 1);
          else addEdge(upBranchIds[idx - 1], id, 1);

          // Sub-leaf pair
          const leaf1 = `${id}_leaf_a`;
          const leaf2 = `${id}_leaf_b`;
          nodes.push({
            id: leaf1,
            label: `FastAPI::leaf_${idx}_a`,
            communityId: 'fastapi',
            color: comm.color,
            x: upCoords[idx].x - 14,
            y: upCoords[idx].y - 8,
            vx: 0,
            vy: 0,
            radius: 2.0,
            degree: 0,
          });
          nodes.push({
            id: leaf2,
            label: `FastAPI::leaf_${idx}_b`,
            communityId: 'fastapi',
            color: comm.color,
            x: upCoords[idx].x + 14,
            y: upCoords[idx].y - 12,
            vx: 0,
            vy: 0,
            radius: 2.0,
            degree: 0,
          });
          addEdge(id, leaf1, 0.9);
          addEdge(id, leaf2, 0.9);
        });

        // Downward dendritic branch
        const downBranchIds = ['fastapi_down_1', 'fastapi_down_2'];
        const downCoords = [
          { x: -275, y: 65 },
          { x: -250, y: 120 },
        ];
        downBranchIds.forEach((id, idx) => {
          nodes.push({
            id,
            label: `FastAPI::branch_down_${idx + 1}`,
            communityId: 'fastapi',
            color: comm.color,
            x: downCoords[idx].x,
            y: downCoords[idx].y,
            vx: 0,
            vy: 0,
            radius: 2.6,
            degree: 0,
          });
          if (idx === 0) addEdge(hubId, id, 1);
          else addEdge(downBranchIds[idx - 1], id, 1);

          // Sub leaf
          const dLeaf = `${id}_leaf`;
          nodes.push({
            id: dLeaf,
            label: `FastAPI::dleaf_${idx}`,
            communityId: 'fastapi',
            color: comm.color,
            x: downCoords[idx].x - 12,
            y: downCoords[idx].y + 14,
            vx: 0,
            vy: 0,
            radius: 2.0,
            degree: 0,
          });
          addEdge(id, dLeaf, 0.9);
        });
        return;
      }

      if (comm.id === 'basemodel') {
        // BaseModelWithConfig Top-Right Radiating Crown
        const crownRays = 8;
        for (let r = 0; r < crownRays; r++) {
          const angle = -Math.PI * 0.75 + (r / crownRays) * (Math.PI * 0.55);
          for (let step = 1; step <= 4; step++) {
            const dist = 18 * step;
            const nid = `basemodel_ray_${r}_${step}`;
            nodes.push({
              id: nid,
              label: `BaseModel::ray_${r}_${step}`,
              communityId: 'basemodel',
              color: comm.color,
              x: cent.x + Math.cos(angle) * dist,
              y: cent.y + Math.sin(angle) * dist,
              vx: 0,
              vy: 0,
              radius: step === 4 ? 2.6 : 2.0,
              degree: 0,
            });
            if (step === 1) addEdge(hubId, nid, 1);
            else addEdge(`basemodel_ray_${r}_${step - 1}`, nid, 1);

            // Cross-arc connection between rays
            if (r > 0 && step === 3) {
              addEdge(`basemodel_ray_${r - 1}_3`, nid, 0.6);
            }
          }
        }
        return;
      }

      // Standard Community: Distribute member nodes around centroid
      for (let i = 1; i < count; i++) {
        const id = `${comm.id}_${i}`;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.pow(Math.random(), 0.7) * cent.spread;
        const x = cent.x + Math.cos(angle) * dist;
        const y = cent.y + Math.sin(angle) * dist;

        const isSecondaryHub = i % 10 === 0;
        nodes.push({
          id,
          label: `${comm.name}::item_${i}`,
          communityId: comm.id,
          color: comm.color,
          x,
          y,
          vx: 0,
          vy: 0,
          radius: isSecondaryHub ? 4.0 : 2.4,
          degree: 0,
        });

        // Intra-community edges
        if (Math.random() > 0.3) {
          addEdge(hubId, id, 1);
        } else if (i > 1) {
          const prevId = `${comm.id}_${Math.max(1, i - Math.floor(Math.random() * 5))}`;
          addEdge(prevId, id, 0.8);
        }
      }
    });

    // Authentic isolated outlier dots placed around margins (visible in user's image)
    const outliers = [
      { id: 'outlier_orange_top', comm: 'securitybase', color: '#E87223', x: 20, y: -225 },
      { id: 'outlier_red_topleft', comm: 'v2', color: '#D63942', x: -310, y: -90 },
      { id: 'outlier_brown_right', comm: 'models', color: '#9C7A58', x: 215, y: -45 },
      { id: 'outlier_pink_right', comm: 'httpexception', color: '#E87C95', x: 245, y: 12 },
      { id: 'outlier_yellow_bottom', comm: 'basemodel', color: '#E5BF35', x: 25, y: 215 },
      { id: 'outlier_blue_bottomright', comm: 'apirouter', color: '#4F75B4', x: 185, y: 135 },
      { id: 'outlier_green_left', comm: 'fastapi', color: '#46A851', x: -335, y: -75 },
    ];
    outliers.forEach((o) => {
      nodes.push({
        id: o.id,
        label: `${o.comm}::outlier`,
        communityId: o.comm,
        color: o.color,
        x: o.x,
        y: o.y,
        vx: 0,
        vy: 0,
        radius: 2.2,
        degree: 1,
      });
      addEdge(`${o.comm}_hub`, o.id, 0.4);
    });

    // Inter-community bridging edges (the delicate spiderweb between clusters)
    const bridgePairs: [string, string][] = [
      ['apirouter_hub', 'securitybase_hub'],
      ['apirouter_hub', 'basemodel_hub'],
      ['apirouter_hub', 'v2_hub'],
      ['apirouter_hub', 'scope_hub'],
      ['apirouter_hub', 'models_hub'],
      ['apirouter_hub', 'httpexception_hub'],
      ['securitybase_hub', 'fastapi_hub'],
      ['securitybase_hub', 'fastapideprecation_hub'],
      ['securitybase_hub', 'utils_hub'],
      ['v2_hub', 'modelfield_hub'],
      ['v2_hub', 'signature_hub'],
      ['v2_hub', 'issubclass_hub'],
      ['basemodel_hub', 'modelfield_hub'],
      ['scope_hub', 'httpexception_hub'],
      ['fastapi_hub', 'placeholder_hub'],
      ['fastapideprecation_hub', 'placeholder_hub'],
      ['fastapideprecation_hub', 'securitybase_hub'],
      ['models_hub', 'issubclass_hub'],
      ['utils_hub', 'pathlike_hub'],
    ];

    bridgePairs.forEach(([s, t]) => {
      addEdge(s, t, 0.85);
      // Add cross-leaf mesh
      const prefixS = s.split('_')[0];
      const prefixT = t.split('_')[0];
      for (let b = 1; b <= 5; b++) {
        addEdge(`${prefixS}_${b}`, `${prefixT}_${b}`, 0.45);
      }
    });

    // Update node degrees
    nodes.forEach((n) => {
      n.degree = adj.get(n.id)?.size || 1;
    });

    graphDataRef.current = { nodes, edges, adj };
  }, []);

  // Community visibility map
  const visibleCommunityMap = useMemo(() => {
    const map = new Set<string>();
    communities.forEach((c) => {
      if (c.visible) map.add(c.id);
    });
    return map;
  }, [communities]);

  const allSelected = useMemo(
    () => communities.every((c) => c.visible),
    [communities],
  );

  const toggleSelectAll = useCallback(() => {
    const nextVal = !allSelected;
    setCommunities((prev) => prev.map((c) => ({ ...c, visible: nextVal })));
  }, [allSelected]);

  const toggleCommunity = useCallback((id: string) => {
    setCommunities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    );
  }, []);

  // Simulation & Rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let iteration = 0;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      iteration++;

      const { nodes, edges, adj } = graphDataRef.current;
      const { x: panX, y: panY, scale } = transformRef.current;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Deep dark navy-black background matching user's image exactly
      ctx.fillStyle = '#0B0D19';
      ctx.fillRect(0, 0, w, h);

      // Apply pan & zoom centered
      ctx.save();
      ctx.translate(w / 2 + panX, h / 2 + panY);
      ctx.scale(scale, scale);

      // Subtle force relaxation (stabilizes quickly to be "real, not as animated")
      if (iteration < 200 || isDraggingCanvasRef.current || draggedNodeRef.current) {
        const cooling = Math.max(0.02, 1.0 - iteration * 0.005);
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          const n1 = nodes.find((n) => n.id === e.source);
          const n2 = nodes.find((n) => n.id === e.target);
          if (!n1 || !n2) continue;
          if (!visibleCommunityMap.has(n1.communityId) || !visibleCommunityMap.has(n2.communityId)) continue;

          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 24 * e.weight;
          const force = (dist - targetDist) * 0.0012 * cooling;

          if (!n1.pinned) {
            n1.x += (dx / dist) * force;
            n1.y += (dy / dist) * force;
          }
          if (!n2.pinned) {
            n2.x -= (dx / dist) * force;
            n2.y -= (dy / dist) * force;
          }
        }
      }

      // Draw Delicate Edges
      const hoveredId = hoveredNode?.id;
      const neighbors = hoveredId ? adj.get(hoveredId) : null;

      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const n1 = nodes.find((n) => n.id === e.source);
        const n2 = nodes.find((n) => n.id === e.target);
        if (!n1 || !n2) continue;
        if (!visibleCommunityMap.has(n1.communityId) || !visibleCommunityMap.has(n2.communityId)) continue;

        const isHighlighted =
          hoveredId && (e.source === hoveredId || e.target === hoveredId);
        const isDimmed = hoveredId && !isHighlighted;

        if (isHighlighted) {
          ctx.strokeStyle = '#00F0FF';
          ctx.globalAlpha = 0.95;
          ctx.lineWidth = 1.5;
        } else if (isDimmed) {
          ctx.strokeStyle = '#232D42';
          ctx.globalAlpha = 0.05;
          ctx.lineWidth = 0.5;
        } else {
          // Intra-community vs Inter-community edges
          if (n1.communityId === n2.communityId) {
            ctx.strokeStyle = n1.color;
            ctx.globalAlpha = 0.24;
          } else {
            ctx.strokeStyle = '#4A5B78';
            ctx.globalAlpha = 0.16;
          }
          ctx.lineWidth = 0.65;
        }

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      }

      // Draw Nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!visibleCommunityMap.has(node.communityId)) continue;

        const isHovered = hoveredId === node.id;
        const isNeighbor = neighbors && neighbors.has(node.id);
        const isDimmed = hoveredId && !isHovered && !isNeighbor;

        ctx.globalAlpha = isDimmed ? 0.1 : isHovered ? 1.0 : 0.92;

        // Hub halo glow
        if (node.radius >= 4.0 || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * (isHovered ? 2.5 : 1.7), 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.globalAlpha = isHovered ? 0.4 : 0.18;
          ctx.fill();
        }

        // Solid node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#FFFFFF' : node.color;
        ctx.globalAlpha = isDimmed ? 0.12 : 1.0;
        ctx.fill();

        // White border on hovered node
        if (isHovered) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      ctx.restore();
      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [visibleCommunityMap, hoveredNode]);

  // Mouse Interactions: Pan, Zoom, Hover, Node Drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { nodes } = graphDataRef.current;
    const { x: panX, y: panY, scale } = transformRef.current;
    const graphX = (clickX - canvas.clientWidth / 2 - panX) / scale;
    const graphY = (clickY - canvas.clientHeight / 2 - panY) / scale;

    let clickedNode: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!visibleCommunityMap.has(node.communityId)) continue;
      const dist = Math.hypot(node.x - graphX, node.y - graphY);
      if (dist <= Math.max(6, node.radius + 4)) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.pinned = true;
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x: panX, y: panY, scale } = transformRef.current;
    const graphX = (mouseX - canvas.clientWidth / 2 - panX) / scale;
    const graphY = (mouseY - canvas.clientHeight / 2 - panY) / scale;

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = graphX;
      draggedNodeRef.current.y = graphY;
      return;
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x;
      transformRef.current.y = e.clientY - dragStartRef.current.y;
      return;
    }

    const { nodes } = graphDataRef.current;
    let found: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!visibleCommunityMap.has(node.communityId)) continue;
      const dist = Math.hypot(node.x - graphX, node.y - graphY);
      if (dist <= Math.max(6, node.radius + 4)) {
        found = node;
        break;
      }
    }

    if (found) {
      setHoveredNode(found);
      setTooltipPos({ x: mouseX + 14, y: mouseY + 14 });
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredNode(null);
      setTooltipPos(null);
      canvas.style.cursor = isDraggingCanvasRef.current ? 'grabbing' : 'default';
    }
  };

  const handleMouseUp = () => {
    isDraggingCanvasRef.current = false;
    if (draggedNodeRef.current) {
      draggedNodeRef.current.pinned = false;
      draggedNodeRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newScale = Math.max(0.4, Math.min(4.0, transformRef.current.scale * zoomFactor));
    transformRef.current.scale = newScale;
  };

  const handleResetZoom = () => {
    transformRef.current = { x: 30, y: 10, scale: 1.15 };
  };

  return (
    <div className="real-knowledge-graph-wrapper" ref={containerRef}>
      {/* Left Main Force-Directed Graph Viewport */}
      <div className="graph-canvas-viewport">
        <canvas
          ref={canvasRef}
          className="graph-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Floating Zoom & Pan Controls */}
        <div className="graph-floating-controls">
          <button
            onClick={() => {
              transformRef.current.scale = Math.min(4.0, transformRef.current.scale * 1.25);
            }}
            className="control-btn"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => {
              transformRef.current.scale = Math.max(0.4, transformRef.current.scale * 0.8);
            }}
            className="control-btn"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={handleResetZoom}
            className="control-btn"
            title="Reset View"
            aria-label="Reset View"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Hover Inspection Tooltip */}
        {hoveredNode && tooltipPos && (
          <div
            className="graph-tooltip"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          >
            <div className="tooltip-header">
              <span
                className="tooltip-dot"
                style={{ backgroundColor: hoveredNode.color }}
              />
              <strong className="tooltip-node-name">{hoveredNode.label}</strong>
            </div>
            <div className="tooltip-sub">
              <span>Community: {hoveredNode.communityId}</span>
              <span>•</span>
              <span>Degree: {hoveredNode.degree} links</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar: EXACT COMMUNITIES PANEL FROM USER'S SCREENSHOT */}
      <aside className="communities-sidebar">
        <h3 className="communities-title">COMMUNITIES</h3>

        {/* Select All Checkbox */}
        <div
          className="community-checkbox-row select-all-row"
          onClick={toggleSelectAll}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              toggleSelectAll();
            }
          }}
        >
          <span className={`checkbox-custom ${allSelected ? 'checked' : 'unchecked'}`}>
            {allSelected && <Check size={11} strokeWidth={3} className="text-white" />}
          </span>
          <span className="community-name select-all-label">Select All</span>
        </div>

        {/* Community Rows List */}
        <div className="communities-list">
          {communities.map((comm) => (
            <div
              key={comm.id}
              className="community-checkbox-row"
              onClick={() => toggleCommunity(comm.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggleCommunity(comm.id);
                }
              }}
            >
              <span className={`checkbox-custom ${comm.visible ? 'checked' : 'unchecked'}`}>
                {comm.visible && <Check size={11} strokeWidth={3} className="text-white" />}
              </span>

              {/* Color Dot */}
              <span
                className="community-color-dot"
                style={{ backgroundColor: comm.color }}
              />

              {/* Community Name */}
              <span className="community-name" title={comm.name}>
                {comm.name}
              </span>

              {/* Count */}
              <span className="community-count">{comm.count}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
