'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RocketLaunchState = 'idle' | 'igniting' | 'launching' | 'completed';

interface InteractiveCosmicChatCanvasProps {
  launchState?: RocketLaunchState;
  onLaunchComplete?: () => void;
}

// -----------------------------------------------------------------------
// Star sprite texture factory — controls how individual stars look
// -----------------------------------------------------------------------
function makeStarSprite(
  innerColor: string,
  hazeColor: string,
  size = 64,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const half = size / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, innerColor);
  g.addColorStop(0.12, innerColor);
  g.addColorStop(0.38, hazeColor);
  g.addColorStop(0.72, 'rgba(0,0,0,0.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// -----------------------------------------------------------------------
// Gaussian sample (Box-Muller)
// -----------------------------------------------------------------------
function gaussian(): number {
  const u = Math.random() + 1e-10;
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// -----------------------------------------------------------------------
// Main Photorealistic Milky Way Spiral Galaxy Component
// -----------------------------------------------------------------------
export default function InteractiveCosmicChatCanvas({
  launchState = 'idle',
  onLaunchComplete,
}: InteractiveCosmicChatCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<RocketLaunchState>(launchState);

  useEffect(() => {
    launchRef.current = launchState;
  }, [launchState]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ----------------------------------------------------------------
    // Scene & Renderer — pure black void
    // ----------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      6000,
    );
    camera.position.set(0, 48, 135);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ----------------------------------------------------------------
    // Star textures (multiple spectral types)
    // ----------------------------------------------------------------
    const whiteTex   = makeStarSprite('rgba(255,255,255,1)', 'rgba(210,230,255,0.5)', 64);
    const goldTex    = makeStarSprite('rgba(255,245,190,1)', 'rgba(255,210,100,0.4)', 64);
    const blueTex    = makeStarSprite('rgba(190,210,255,1)', 'rgba(130,165,255,0.35)', 64);

    // ----------------------------------------------------------------
    // Galaxy Parameters
    // ----------------------------------------------------------------
    const GALAXY_RADIUS  = 68;   // max radius in world units
    const ARM_TURNS      = 2.5;  // full rotations per spiral arm
    const B_LOG          = 0.32; // logarithmic tightness (smaller = tighter)
    const A_START        = 3.2;  // inner start radius
    const ARMS           = 2;    // barred spiral has 2 major arms

    // Particle budget
    const CORE_COUNT     = 3200;
    const BAR_COUNT      = 1100;
    const ARM_COUNT      = 4800; // per arm
    const DUST_COUNT     = 1800; // inter-arm dust / outer halo
    const TOTAL          = CORE_COUNT + BAR_COUNT + ARMS * ARM_COUNT + DUST_COUNT;

    const positions = new Float32Array(TOTAL * 3);
    const colors    = new Float32Array(TOTAL * 3);
    const sizes     = new Float32Array(TOTAL);

    // Reusable palette
    const C_CORE_BRIGHT = new THREE.Color(0xfffae8);  // warm white centre
    const C_CORE_GOLD   = new THREE.Color(0xffcc66);  // gold inner
    const C_WHITE       = new THREE.Color(0xffffff);  // pure white
    const C_BLUE_WHITE  = new THREE.Color(0xd8e8ff);  // Class A/B
    const C_BLUE        = new THREE.Color(0xb0ccff);  // Class B
    const C_GOLD_WARM   = new THREE.Color(0xffe0a0);  // Class G-K
    const C_ORANGE      = new THREE.Color(0xffb870);  // Class M / H-II

    let ptr = 0;

    const put = (
      x: number, y: number, z: number,
      col: THREE.Color,
      sz: number,
    ) => {
      if (ptr >= TOTAL) return;
      positions[ptr * 3]     = x;
      positions[ptr * 3 + 1] = y;
      positions[ptr * 3 + 2] = z;
      colors[ptr * 3]     = col.r;
      colors[ptr * 3 + 1] = col.g;
      colors[ptr * 3 + 2] = col.b;
      sizes[ptr] = sz;
      ptr++;
    };

    // ---- 1. Galactic Nucleus (tight dense core) ----
    for (let i = 0; i < CORE_COUNT; i++) {
      const sigma = 3.8 + Math.random() * 2.5;
      const x = gaussian() * sigma * 0.55;
      const y = gaussian() * sigma * 0.55;
      const z = gaussian() * sigma * 0.22;
      const d = Math.sqrt(x * x + y * y);
      const t = Math.max(0, 1 - d / 9);
      const col = C_CORE_GOLD.clone().lerp(C_CORE_BRIGHT, t);
      const sz  = 1.6 + t * 2.8 + Math.random() * 1.4;
      put(x, y, z, col, sz);
    }

    // ---- 2. Central Bar ----
    const BAR_LENGTH = 24;
    const BAR_WIDTH  = 2.8;
    for (let i = 0; i < BAR_COUNT; i++) {
      const t  = (Math.random() - 0.5) * 2;   // –1..1
      const bx = t * BAR_LENGTH + gaussian() * BAR_WIDTH;
      const by = gaussian() * BAR_WIDTH * 0.55;
      const bz = gaussian() * 1.2;
      const col = C_CORE_GOLD.clone().lerp(C_WHITE, Math.abs(t));
      put(bx, by, bz, col, 1.1 + Math.random() * 1.2);
    }

    // ---- 3. Logarithmic Spiral Arms ----
    for (let arm = 0; arm < ARMS; arm++) {
      const armOffset = (arm / ARMS) * Math.PI * 2;
      const barShift  = arm === 0 ? BAR_LENGTH * 0.3 : -BAR_LENGTH * 0.3;

      for (let i = 0; i < ARM_COUNT; i++) {
        const frac  = Math.random();           // 0..1 along arm length
        const theta = frac * ARM_TURNS * Math.PI * 2;
        const r     = A_START * Math.exp(B_LOG * theta);

        // Gaussian spread grows with distance
        const spread = 1.4 + frac * 13;
        const angle  = theta + armOffset;

        const sx = gaussian() * spread * 0.7;
        const sy = gaussian() * spread * 0.7;

        const x = r * Math.cos(angle) + sx + barShift;
        const y = r * Math.sin(angle) + sy;
        const z = gaussian() * (1.2 + frac * 3.5);

        // Skip particles outside galaxy bounds
        if (Math.sqrt(x * x + y * y) > GALAXY_RADIUS * 1.12) continue;

        // Star colour along arm: core white → blue-white → outer variety
        let col: THREE.Color;
        if (frac < 0.12) {
          col = C_WHITE.clone().lerp(C_GOLD_WARM, 0.4);
        } else if (frac < 0.42) {
          col = C_WHITE.clone().lerp(C_BLUE_WHITE, (frac - 0.12) / 0.3);
        } else if (frac < 0.72) {
          col = C_BLUE_WHITE.clone().lerp(C_BLUE, (frac - 0.42) / 0.3);
        } else {
          // Outer arm — mix blue-white with occasional warm spots (H-II regions)
          const rng = Math.random();
          if (rng < 0.06) {
            col = C_ORANGE.clone();  // bright H-II region
          } else if (rng < 0.18) {
            col = C_GOLD_WARM.clone();
          } else {
            col = C_BLUE.clone().lerp(C_BLUE_WHITE, Math.random() * 0.5);
          }
        }

        const bright = Math.pow(Math.random(), 2.2);
        const sz = 0.7 + bright * 3.0 + (frac < 0.18 ? 1.2 : 0);
        put(x, y, z, col, sz);
      }
    }

    // ---- 4. Inter-arm dust & outer halo ----
    for (let i = 0; i < DUST_COUNT; i++) {
      const r     = GALAXY_RADIUS * (0.15 + Math.random() * 0.88);
      const angle = Math.random() * Math.PI * 2;
      const x     = r * Math.cos(angle) + gaussian() * 12;
      const y     = r * Math.sin(angle) + gaussian() * 12;
      const z     = gaussian() * 5;
      const t     = r / GALAXY_RADIUS;
      const col   = C_BLUE_WHITE.clone().lerp(C_BLUE, t).multiplyScalar(0.65);
      put(x, y, z, col, 0.5 + Math.random() * 0.85);
    }

    // Build BufferGeometry
    const count = ptr;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors.slice(0, count * 3),    3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes.slice(0, count),         1));

    const mat = new THREE.PointsMaterial({
      size: 2.1,
      vertexColors: true,
      map: whiteTex,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const galaxy = new THREE.Points(geo, mat);
    galaxy.rotation.x = THREE.MathUtils.degToRad(14); // mild perspective tilt
    scene.add(galaxy);

    // ----------------------------------------------------------------
    // Core Glow Sprite (central bulge luminosity)
    // ----------------------------------------------------------------
    const cgCanvas = document.createElement('canvas');
    cgCanvas.width  = 512;
    cgCanvas.height = 512;
    const cgCtx = cgCanvas.getContext('2d')!;
    const cgG   = cgCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
    cgG.addColorStop(0,    'rgba(255,255,240,1.0)');
    cgG.addColorStop(0.05, 'rgba(255,245,210,0.9)');
    cgG.addColorStop(0.15, 'rgba(255,220,160,0.55)');
    cgG.addColorStop(0.32, 'rgba(180,140,255,0.22)');
    cgG.addColorStop(0.6,  'rgba(80,50,180,0.07)');
    cgG.addColorStop(1,    'rgba(0,0,0,0)');
    cgCtx.fillStyle = cgG;
    cgCtx.fillRect(0, 0, 512, 512);
    const cgTex  = new THREE.CanvasTexture(cgCanvas);
    const cgMat  = new THREE.SpriteMaterial({
      map: cgTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.88,
    });
    const cgSprite = new THREE.Sprite(cgMat);
    cgSprite.scale.set(30, 30, 1);
    // Add to galaxy group so it rotates with galaxy
    galaxy.add(cgSprite);

    // ----------------------------------------------------------------
    // Background distant stars (separate from galaxy, no rotation)
    // ----------------------------------------------------------------
    const BG_COUNT = 5000;
    const bgGeo   = new THREE.BufferGeometry();
    const bgPos   = new Float32Array(BG_COUNT * 3);
    const bgCols  = new Float32Array(BG_COUNT * 3);
    for (let i = 0; i < BG_COUNT; i++) {
      const r     = 800 + Math.random() * 3000;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(Math.random() * 2 - 1);
      bgPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      bgPos[i * 3 + 2] = r * Math.cos(phi);
      const b = 0.55 + Math.random() * 0.45;
      // Slightly warm/cool variety
      bgCols[i * 3]     = b * (0.85 + Math.random() * 0.15);
      bgCols[i * 3 + 1] = b * (0.88 + Math.random() * 0.12);
      bgCols[i * 3 + 2] = b * (0.92 + Math.random() * 0.08);
    }
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeo.setAttribute('color',    new THREE.BufferAttribute(bgCols, 3));
    const bgMat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      map: whiteTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bgStars = new THREE.Points(bgGeo, bgMat);
    scene.add(bgStars);

    // ----------------------------------------------------------------
    // Mouse Parallax
    // ----------------------------------------------------------------
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth)  * 2 - 1;
      targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ----------------------------------------------------------------
    // Animation Loop
    // ----------------------------------------------------------------
    let rafId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth inertial cursor
      mouseX += (targetX - mouseX) * 0.038;
      mouseY += (targetY - mouseY) * 0.038;

      // Galaxy rotation — slow, majestic
      galaxy.rotation.z = t * 0.0055;

      // Camera subtle parallax
      camera.position.x = mouseX * 10;
      camera.position.y = 48 + mouseY * 6;
      camera.lookAt(mouseX * 2.5, mouseY * 1.5, 0);

      // Background stars very slow drift
      bgStars.rotation.y = t * 0.0015;
      bgStars.rotation.x = t * 0.0006;

      // Core glow breathe
      cgMat.opacity = 0.80 + Math.sin(t * 1.3) * 0.14;

      renderer.render(scene, camera);
    };
    animate();

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geo.dispose();
      mat.dispose();
      bgGeo.dispose();
      bgMat.dispose();
      cgTex.dispose();
      cgMat.dispose();
      whiteTex.dispose();
      goldTex.dispose();
      blueTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#000000',
        pointerEvents: 'none',
      }}
    />
  );
}
