'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface KnowledgeNodeItem {
  id: string;
  filename: string;
  type: 'doc' | 'chunk';
  chunksCount: number;
  pagesCount: number;
  similarity?: number;
  snippet?: string;
  color?: string;
}

interface CosmicBrainGraph3DProps {
  documents: Array<{
    id: string;
    filename: string;
    total_chunks: number;
    total_pages: number;
    uploaded_at?: string;
  }>;
  activeQuery?: string;
  searchResults?: Array<{
    document: {
      id: string;
      content: string;
      metadata?: Record<string, any>;
    };
    score: number;
  }>;
  onSelectDocument?: (filename: string) => void;
}

export default function CosmicBrainGraph3D({
  documents,
  activeQuery,
  searchResults = [],
  onSelectDocument,
}: CosmicBrainGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{
    name: string;
    type: string;
    chunks: number;
    pages: number;
    snippet?: string;
    score?: number;
    x: number;
    y: number;
  } | null>(null);

  const docsRef = useRef(documents);
  const searchRef = useRef(searchResults);

  useEffect(() => {
    docsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    searchRef.current = searchResults;
  }, [searchResults]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- 1. Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020718, 0.002);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 35, 110);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // --- 2. Ambient & Neural Lighting ---
    const ambientLight = new THREE.AmbientLight(0x0a1e3f, 1.4);
    scene.add(ambientLight);

    const brainCoreLight = new THREE.PointLight(0x00f0ff, 3.5, 300);
    brainCoreLight.position.set(0, 0, 0);
    scene.add(brainCoreLight);

    const secondaryLight = new THREE.PointLight(0xa855f7, 2.0, 250);
    secondaryLight.position.set(0, 20, 0);
    scene.add(secondaryLight);

    // --- 3. Star Canvas Texture Generator ---
    const makePointTexture = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.2, 'rgba(180,235,255,0.9)');
        grad.addColorStop(0.5, 'rgba(100,180,255,0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(c);
    };
    const pointTexture = makePointTexture();

    // =============================================================
    // 4. CENTRAL MILKY WAY / NEURAL BRAIN CORE
    // =============================================================
    const brainGroup = new THREE.Group();

    // A. Swirling Milky Way Galactic Accretion Disk (2,400 Stars)
    const galaxyCount = 2400;
    const galaxyGeo = new THREE.BufferGeometry();
    const galaxyPos = new Float32Array(galaxyCount * 3);
    const galaxyCols = new Float32Array(galaxyCount * 3);

    const coreColor = new THREE.Color(0xffe4a0); // Solar amber core
    const armColor1 = new THREE.Color(0x00f0ff); // Electric cyan
    const armColor2 = new THREE.Color(0xa855f7); // Neural violet

    for (let i = 0; i < galaxyCount; i++) {
      const i3 = i * 3;
      const r = Math.pow(Math.random(), 1.6) * 32;
      const branches = 3;
      const branchAngle = ((i % branches) * 2 * Math.PI) / branches;
      const spin = r * 0.22;

      const spread = (Math.random() - 0.5) * (1.2 + r * 0.15);
      const ySpread = (Math.random() - 0.5) * (1.0 + r * 0.08);

      galaxyPos[i3] = Math.cos(branchAngle + spin) * r + spread;
      galaxyPos[i3 + 1] = ySpread;
      galaxyPos[i3 + 2] = Math.sin(branchAngle + spin) * r + spread;

      const t = r / 32;
      const col = t < 0.35
        ? coreColor.clone().lerp(armColor1, t / 0.35)
        : armColor1.clone().lerp(armColor2, (t - 0.35) / 0.65);

      galaxyCols[i3] = col.r;
      galaxyCols[i3 + 1] = col.g;
      galaxyCols[i3 + 2] = col.b;
    }

    galaxyGeo.setAttribute('position', new THREE.BufferAttribute(galaxyPos, 3));
    galaxyGeo.setAttribute('color', new THREE.BufferAttribute(galaxyCols, 3));

    const galaxyMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      map: pointTexture,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const galaxyPoints = new THREE.Points(galaxyGeo, galaxyMat);
    brainGroup.add(galaxyPoints);

    // B. Pulsating Neural Synaptic Brain Sphere Core
    const brainCoreGeo = new THREE.SphereGeometry(6.5, 32, 32);
    const brainCoreMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float pulse = sin(time * 2.5) * 0.15 + 0.85;
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.4);
          vec3 coreCyan = vec3(0.0, 0.94, 1.0);
          vec3 coreViolet = vec3(0.68, 0.35, 0.98);
          vec3 c = mix(coreCyan, coreViolet, sin(vPosition.y * 0.5 + time) * 0.5 + 0.5);
          gl_FragColor = vec4(c * pulse * 1.5, fresnel * 0.92);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const brainCoreMesh = new THREE.Mesh(brainCoreGeo, brainCoreMat);
    brainGroup.add(brainCoreMesh);

    // C. Glowing Synaptic Neural Energy Rings
    const ring1Geo = new THREE.TorusGeometry(9.5, 0.12, 16, 80);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI * 0.35;
    brainGroup.add(ring1);

    const ring2 = ring1.clone();
    ring2.scale.setScalar(1.28);
    ring2.rotation.x = -Math.PI * 0.28;
    ring2.rotation.y = Math.PI * 0.3;
    (ring2.material as THREE.MeshBasicMaterial).color = new THREE.Color(0xa855f7);
    brainGroup.add(ring2);

    scene.add(brainGroup);

    // =============================================================
    // 5. KNOWLEDGE NODES & SYNAPTIC NEURAL BEAMS
    // =============================================================
    const nodesGroup = new THREE.Group();
    const lasersGroup = new THREE.Group();
    const pulseBeamsGroup = new THREE.Group();

    scene.add(nodesGroup);
    scene.add(lasersGroup);
    scene.add(pulseBeamsGroup);

    // Dynamic Mesh interactive targets for raycasting
    interface NodeData {
      mesh: THREE.Mesh;
      filename: string;
      totalChunks: number;
      totalPages: number;
      orbitRadius: number;
      orbitSpeed: number;
      orbitAngle: number;
      orbitInclination: number;
      laserLine: THREE.Line;
      childChunkMeshes: THREE.Mesh[];
    }

    let activeNodes: NodeData[] = [];

    // Energy Traveling Synapse Pulse
    interface SynapsePulse {
      laserLine: THREE.Line;
      mesh: THREE.Mesh;
      progress: number;
      speed: number;
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
    }
    const synapsePulses: SynapsePulse[] = [];

    const buildKnowledgeField = () => {
      // Clear previous nodes
      while (nodesGroup.children.length > 0) {
        const obj = nodesGroup.children[0];
        nodesGroup.remove(obj);
      }
      while (lasersGroup.children.length > 0) {
        const obj = lasersGroup.children[0];
        lasersGroup.remove(obj);
      }
      while (pulseBeamsGroup.children.length > 0) {
        const obj = pulseBeamsGroup.children[0];
        pulseBeamsGroup.remove(obj);
      }
      activeNodes = [];
      synapsePulses.length = 0;

      const currentDocs = docsRef.current.length > 0
        ? docsRef.current
        : [
            { id: '1', filename: 'Defense_Radar_Manual.pdf', total_chunks: 14, total_pages: 8 },
            { id: '2', filename: 'Orbital_LEO_Trajectory_Specs.pdf', total_chunks: 19, total_pages: 12 },
            { id: '3', filename: 'AirGapped_Zero_Egress_Protocol.pdf', total_chunks: 11, total_pages: 6 },
            { id: '4', filename: 'Sovereign_Cryptographic_Audit.pdf', total_chunks: 16, total_pages: 10 },
          ];

      const palette = [
        0x00f0ff, // Cyan
        0x10b981, // Emerald
        0xf59e0b, // Amber
        0xa855f7, // Violet
        0x38bdf8, // Sky
        0xec4899, // Pink
      ];

      currentDocs.forEach((doc, idx) => {
        const colorHex = palette[idx % palette.length];
        const orbitRadius = 26 + idx * 7.5;
        const orbitAngle = (idx * 2 * Math.PI) / currentDocs.length;
        const orbitInclination = (idx % 2 === 0 ? 1 : -1) * (0.15 + (idx * 0.08));
        const orbitSpeed = 0.08 / (1 + idx * 0.25);

        // Document Satellite Node Mesh
        const nodeRadius = 2.2 + Math.min(2.0, doc.total_chunks * 0.08);
        const nodeGeo = new THREE.SphereGeometry(nodeRadius, 24, 24);
        const nodeMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.85,
          roughness: 0.35,
          metalness: 0.5,
        });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);

        // Compute initial coordinates
        const x = Math.cos(orbitAngle) * orbitRadius;
        const y = Math.sin(orbitAngle * 2) * (orbitRadius * orbitInclination * 0.4);
        const z = Math.sin(orbitAngle) * orbitRadius;
        nodeMesh.position.set(x, y, z);
        nodeMesh.userData = { doc, isDocument: true };
        nodesGroup.add(nodeMesh);

        // Outer Atmosphere Glow for Document Node
        const glowGeo = new THREE.SphereGeometry(nodeRadius * 1.35, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        nodeMesh.add(glowMesh);

        // Synaptic Laser Beam Connecting Center Brain to Document Node
        const laserGeo = new THREE.BufferGeometry();
        const laserPos = new Float32Array([0, 0, 0, x, y, z]);
        laserGeo.setAttribute('position', new THREE.BufferAttribute(laserPos, 3));

        const laserMat = new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
        });
        const laserLine = new THREE.Line(laserGeo, laserMat);
        lasersGroup.add(laserLine);

        // Subordinate Chunk Satellites
        const childChunkMeshes: THREE.Mesh[] = [];
        const chunkCount = Math.min(6, Math.max(3, Math.floor(doc.total_chunks / 3)));
        for (let c = 0; c < chunkCount; c++) {
          const cRadius = 0.75;
          const cGeo = new THREE.SphereGeometry(cRadius, 12, 12);
          const cMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
          });
          const cMesh = new THREE.Mesh(cGeo, cMat);

          const cDist = nodeRadius + 2.4 + (c * 1.1);
          const cAngle = (c * 2 * Math.PI) / chunkCount;
          cMesh.position.set(
            Math.cos(cAngle) * cDist,
            Math.sin(cAngle * 1.5) * 1.2,
            Math.sin(cAngle) * cDist,
          );
          cMesh.userData = { chunkIndex: c + 1, parentDoc: doc.filename };
          nodeMesh.add(cMesh);
          childChunkMeshes.push(cMesh);
        }

        // Energy Traveling Pulse along the Synapse
        const pulseGeo = new THREE.SphereGeometry(0.85, 12, 12);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          blending: THREE.AdditiveBlending,
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        pulseBeamsGroup.add(pulseMesh);

        synapsePulses.push({
          laserLine,
          mesh: pulseMesh,
          progress: Math.random(),
          speed: 0.4 + Math.random() * 0.3,
          startPos: new THREE.Vector3(0, 0, 0),
          endPos: nodeMesh.position,
        });

        activeNodes.push({
          mesh: nodeMesh,
          filename: doc.filename,
          totalChunks: doc.total_chunks,
          totalPages: doc.total_pages,
          orbitRadius,
          orbitSpeed,
          orbitAngle,
          orbitInclination,
          laserLine,
          childChunkMeshes,
        });
      });
    };

    buildKnowledgeField();

    // =============================================================
    // 6. INTERACTIVE RAYCASTING & MOUSE ORBIT
    // =============================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let cameraAngleX = 0;
    let cameraAngleY = 0.35;
    let cameraDistance = 105;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMousePos.x;
        const deltaY = e.clientY - prevMousePos.y;
        cameraAngleX += deltaX * 0.008;
        cameraAngleY = Math.max(-0.6, Math.min(1.1, cameraAngleY + deltaY * 0.008));
        prevMousePos = { x: e.clientX, y: e.clientY };
      }

      // Raycast for hover tooltips
      raycaster.setFromCamera(mouse, camera);
      const meshesToTest = activeNodes.map((n) => n.mesh);
      const intersects = raycaster.intersectObjects(meshesToTest, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = activeNodes.find((n) => n.mesh === hitMesh);
        if (matched) {
          setHoveredNode({
            name: matched.filename,
            type: 'Knowledge Document',
            chunks: matched.totalChunks,
            pages: matched.totalPages,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredNode(null);
      container.style.cursor = isDragging ? 'grabbing' : 'grab';
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshesToTest = activeNodes.map((n) => n.mesh);
      const intersects = raycaster.intersectObjects(meshesToTest, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = activeNodes.find((n) => n.mesh === hitMesh);
        if (matched && onSelectDocument) {
          onSelectDocument(matched.filename);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(50, Math.min(180, cameraDistance + e.deltaY * 0.08));
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // =============================================================
    // 7. ANIMATION TICKER LOOP
    // =============================================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animateLoop = () => {
      animationFrameId = requestAnimationFrame(animateLoop);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Camera orbital positioning with inertia
      if (!isDragging) {
        cameraAngleX += delta * 0.04; // Gentle continuous auto-spin
      }
      const camX = Math.sin(cameraAngleX) * Math.cos(cameraAngleY) * cameraDistance;
      const camY = Math.sin(cameraAngleY) * cameraDistance;
      const camZ = Math.cos(cameraAngleX) * Math.cos(cameraAngleY) * cameraDistance;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, 0, 0);

      // Rotate Galactic Milky Way & Core
      galaxyPoints.rotation.y = elapsed * 0.08;
      brainCoreMat.uniforms.time.value = elapsed;
      ring1.rotation.z = elapsed * 0.25;
      ring2.rotation.z = -elapsed * 0.18;

      // Rotate Knowledge Document Satellites & Update Laser Synapses
      activeNodes.forEach((nodeData, idx) => {
        const curAngle = nodeData.orbitAngle + elapsed * nodeData.orbitSpeed;
        const x = Math.cos(curAngle) * nodeData.orbitRadius;
        const y = Math.sin(curAngle * 2.0) * (nodeData.orbitRadius * nodeData.orbitInclination * 0.4);
        const z = Math.sin(curAngle) * nodeData.orbitRadius;

        nodeData.mesh.position.set(x, y, z);
        nodeData.mesh.rotation.y = elapsed * 0.3;

        // Update child chunks orbit
        nodeData.childChunkMeshes.forEach((cMesh, cIdx) => {
          cMesh.rotation.y = elapsed * 0.8;
        });

        // Update Laser Beam to follow node in orbit
        const lPos = nodeData.laserLine.geometry.attributes.position.array as Float32Array;
        lPos[3] = x;
        lPos[4] = y;
        lPos[5] = z;
        nodeData.laserLine.geometry.attributes.position.needsUpdate = true;

        // Update Synapse Energy Pulse position
        const pulse = synapsePulses[idx];
        if (pulse) {
          pulse.progress = (pulse.progress + delta * pulse.speed) % 1.0;
          pulse.mesh.position.lerpVectors(new THREE.Vector3(0, 0, 0), nodeData.mesh.position, pulse.progress);
        }
      });

      renderer.render(scene, camera);
    };

    animateLoop();

    // =============================================================
    // 8. CLEANUP
    // =============================================================
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      galaxyGeo.dispose();
      galaxyMat.dispose();
      brainCoreGeo.dispose();
      brainCoreMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      renderer.dispose();
    };
  }, [documents]);

  return (
    <div className="cosmic-brain-graph-container" ref={containerRef}>
      {/* Visual Overlay Instructions & Orbit Controls Hint */}
      <div className="brain-graph-hud-overlay">
        <div className="brain-graph-pill">
          <span className="brain-pulse-dot" />
          <span>NEURAL MILKY WAY // EMBEDDING SPACE</span>
        </div>
        <div className="brain-graph-controls-hint">
          <span>Drag to Orbit • Scroll to Zoom • Hover Nodes to Inspect</span>
        </div>
      </div>

      {/* Holographic Tooltip on Node Hover */}
      {hoveredNode && (
        <div
          className="brain-node-tooltip"
          style={{
            left: `${hoveredNode.x + 16}px`,
            top: `${hoveredNode.y - 32}px`,
          }}
        >
          <div className="tooltip-title">{hoveredNode.name}</div>
          <div className="tooltip-meta">
            <span>{hoveredNode.chunks} Chunks</span>
            <span>•</span>
            <span>{hoveredNode.pages} Pages</span>
          </div>
          <div className="tooltip-status">HNSW Cosine Synapse Active</div>
        </div>
      )}
    </div>
  );
}
