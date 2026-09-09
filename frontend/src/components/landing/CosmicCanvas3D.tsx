'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CosmicCanvas3DProps {
  scrollProgress?: number;
}

function makeStarSprite(innerColor: string, hazeColor: string, size = 64): THREE.CanvasTexture {
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

function gaussian(): number {
  const u = Math.random() + 1e-10;
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default function CosmicCanvas3D({ scrollProgress = 0 }: CosmicCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<number>(scrollProgress);

  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      6000,
    );
    camera.position.set(0, 35, 120);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- Star Sprites ---
    const whiteTex = makeStarSprite('rgba(255,255,255,1)', 'rgba(210,230,255,0.5)', 64);

    // --- Photorealistic Barred Spiral Galaxy ---
    const GALAXY_RADIUS = 72;
    const ARM_TURNS = 2.4;
    const B_LOG = 0.32;
    const A_START = 3.5;
    const ARMS = 2;

    const CORE_COUNT = 3400;
    const BAR_COUNT = 1200;
    const ARM_COUNT = 5200;
    const DUST_COUNT = 2000;
    const TOTAL = CORE_COUNT + BAR_COUNT + ARMS * ARM_COUNT + DUST_COUNT;

    const positions = new Float32Array(TOTAL * 3);
    const colors = new Float32Array(TOTAL * 3);
    const sizes = new Float32Array(TOTAL);

    const C_CORE_BRIGHT = new THREE.Color(0xfffae8);
    const C_CORE_GOLD = new THREE.Color(0xffcc66);
    const C_WHITE = new THREE.Color(0xffffff);
    const C_BLUE_WHITE = new THREE.Color(0xd8e8ff);
    const C_BLUE = new THREE.Color(0xb0ccff);
    const C_GOLD_WARM = new THREE.Color(0xffe0a0);
    const C_ORANGE = new THREE.Color(0xffb870);

    let ptr = 0;
    const put = (x: number, y: number, z: number, col: THREE.Color, sz: number) => {
      if (ptr >= TOTAL) return;
      positions[ptr * 3] = x;
      positions[ptr * 3 + 1] = y;
      positions[ptr * 3 + 2] = z;
      colors[ptr * 3] = col.r;
      colors[ptr * 3 + 1] = col.g;
      colors[ptr * 3 + 2] = col.b;
      sizes[ptr] = sz;
      ptr++;
    };

    // Core
    for (let i = 0; i < CORE_COUNT; i++) {
      const sigma = 3.8 + Math.random() * 2.5;
      const x = gaussian() * sigma * 0.55;
      const y = gaussian() * sigma * 0.55;
      const z = gaussian() * sigma * 0.22;
      const d = Math.sqrt(x * x + y * y);
      const t = Math.max(0, 1 - d / 9);
      const col = C_CORE_GOLD.clone().lerp(C_CORE_BRIGHT, t);
      const sz = 1.6 + t * 2.8 + Math.random() * 1.4;
      put(x, y, z, col, sz);
    }

    // Central Bar
    const BAR_LENGTH = 26;
    const BAR_WIDTH = 2.8;
    for (let i = 0; i < BAR_COUNT; i++) {
      const t = (Math.random() - 0.5) * 2;
      const bx = t * BAR_LENGTH + gaussian() * BAR_WIDTH;
      const by = gaussian() * BAR_WIDTH * 0.55;
      const bz = gaussian() * 1.2;
      const col = C_CORE_GOLD.clone().lerp(C_WHITE, Math.abs(t));
      put(bx, by, bz, col, 1.1 + Math.random() * 1.2);
    }

    // Spiral Arms
    for (let arm = 0; arm < ARMS; arm++) {
      const armOffset = (arm / ARMS) * Math.PI * 2;
      const barShift = arm === 0 ? BAR_LENGTH * 0.3 : -BAR_LENGTH * 0.3;

      for (let i = 0; i < ARM_COUNT; i++) {
        const frac = Math.random();
        const theta = frac * ARM_TURNS * Math.PI * 2;
        const r = A_START * Math.exp(B_LOG * theta);
        const spread = 1.4 + frac * 13;
        const angle = theta + armOffset;

        const sx = gaussian() * spread * 0.7;
        const sy = gaussian() * spread * 0.7;

        const x = r * Math.cos(angle) + sx + barShift;
        const y = r * Math.sin(angle) + sy;
        const z = gaussian() * (1.2 + frac * 3.5);

        if (Math.sqrt(x * x + y * y) > GALAXY_RADIUS * 1.12) continue;

        let col: THREE.Color;
        if (frac < 0.12) {
          col = C_WHITE.clone().lerp(C_GOLD_WARM, 0.4);
        } else if (frac < 0.42) {
          col = C_WHITE.clone().lerp(C_BLUE_WHITE, (frac - 0.12) / 0.3);
        } else if (frac < 0.72) {
          col = C_BLUE_WHITE.clone().lerp(C_BLUE, (frac - 0.42) / 0.3);
        } else {
          const rng = Math.random();
          if (rng < 0.06) {
            col = C_ORANGE.clone();
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

    // Inter-arm halo
    for (let i = 0; i < DUST_COUNT; i++) {
      const r = GALAXY_RADIUS * (0.15 + Math.random() * 0.88);
      const angle = Math.random() * Math.PI * 2;
      const x = r * Math.cos(angle) + gaussian() * 12;
      const y = r * Math.sin(angle) + gaussian() * 12;
      const z = gaussian() * 5;
      const t = r / GALAXY_RADIUS;
      const col = C_BLUE_WHITE.clone().lerp(C_BLUE, t).multiplyScalar(0.65);
      put(x, y, z, col, 0.5 + Math.random() * 0.85);
    }

    const count = ptr;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, count * 3), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes.slice(0, count), 1));

    const mat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      map: whiteTex,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const galaxy = new THREE.Points(geo, mat);
    galaxy.rotation.x = THREE.MathUtils.degToRad(18);
    scene.add(galaxy);

    // Galactic Nucleus Glow Sprite
    const cgCanvas = document.createElement('canvas');
    cgCanvas.width = 512;
    cgCanvas.height = 512;
    const cgCtx = cgCanvas.getContext('2d')!;
    const cgG = cgCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
    cgG.addColorStop(0, 'rgba(255,255,240,1.0)');
    cgG.addColorStop(0.06, 'rgba(255,245,210,0.9)');
    cgG.addColorStop(0.18, 'rgba(255,220,160,0.55)');
    cgG.addColorStop(0.35, 'rgba(180,140,255,0.22)');
    cgG.addColorStop(0.65, 'rgba(80,50,180,0.06)');
    cgG.addColorStop(1, 'rgba(0,0,0,0)');
    cgCtx.fillStyle = cgG;
    cgCtx.fillRect(0, 0, 512, 512);
    const cgTex = new THREE.CanvasTexture(cgCanvas);
    const cgMat = new THREE.SpriteMaterial({
      map: cgTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
    });
    const cgSprite = new THREE.Sprite(cgMat);
    cgSprite.scale.set(34, 34, 1);
    galaxy.add(cgSprite);

    // Distant Stars
    const BG_COUNT = 4500;
    const bgGeo = new THREE.BufferGeometry();
    const bgPos = new Float32Array(BG_COUNT * 3);
    const bgCols = new Float32Array(BG_COUNT * 3);
    for (let i = 0; i < BG_COUNT; i++) {
      const r = 800 + Math.random() * 3000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      bgPos[i * 3 + 2] = r * Math.cos(phi);
      const b = 0.5 + Math.random() * 0.5;
      bgCols[i * 3] = b * 0.9;
      bgCols[i * 3 + 1] = b * 0.92;
      bgCols[i * 3 + 2] = b * 0.98;
    }
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCols, 3));
    const bgMat = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      map: whiteTex,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bgStars = new THREE.Points(bgGeo, bgMat);
    scene.add(bgStars);

    // Parallax tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let rafId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      // Galaxy rotation & scroll-driven camera glide
      galaxy.rotation.z = t * 0.006;

      const scrollOffset = scrollRef.current || (typeof window !== 'undefined' ? window.scrollY / 1200 : 0);
      camera.position.x = mouseX * 12;
      camera.position.y = 35 + mouseY * 8 - scrollOffset * 20;
      camera.position.z = 120 + scrollOffset * 40;
      camera.lookAt(mouseX * 2, mouseY * 1.5, 0);

      bgStars.rotation.y = t * 0.001;

      cgMat.opacity = 0.82 + Math.sin(t * 1.4) * 0.12;

      renderer.render(scene, camera);
    };
    animate();

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
