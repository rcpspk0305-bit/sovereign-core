'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RocketLaunchState = 'idle' | 'igniting' | 'launching' | 'completed';

interface InteractiveCosmicChatCanvasProps {
  launchState?: RocketLaunchState;
  onLaunchComplete?: () => void;
}

// -------------------------------------------------------------
// Fast Procedural 2D Simplex/Perlin Noise & fBm for Textures
// -------------------------------------------------------------
function createNoise2D() {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    const t = p[i];
    p[i] = p[r];
    p[r] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function grad(hash: number, x: number, y: number) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return function noise(x: number, y: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = perm[X] + Y;
    const aa = perm[a];
    const ab = perm[a + 1];
    const b = perm[X + 1] + Y;
    const ba = perm[b];
    const bb = perm[b + 1];
    const g1 = grad(perm[aa], xf, yf);
    const g2 = grad(perm[ba], xf - 1, yf);
    const g3 = grad(perm[ab], xf, yf - 1);
    const g4 = grad(perm[bb], xf - 1, yf - 1);
    const x1 = g1 + u * (g2 - g1);
    const x2 = g3 + u * (g4 - g3);
    return (x1 + v * (x2 - x1)) * 0.707;
  };
}

// -------------------------------------------------------------
// Texture Generator: Photorealistic Terran Surface & Night Lights
// -------------------------------------------------------------
function generatePlanetTextures(width = 1024, height = 512) {
  const noise = createNoise2D();

  function fbm(x: number, y: number, octaves = 5) {
    let val = 0;
    let amp = 0.5;
    let freq = 1.0;
    for (let i = 0; i < octaves; i++) {
      val += amp * noise(x * freq, y * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  // 1. Surface Texture Canvas
  const surfaceCanvas = document.createElement('canvas');
  surfaceCanvas.width = width;
  surfaceCanvas.height = height;
  const surfaceCtx = surfaceCanvas.getContext('2d')!;
  const surfaceImg = surfaceCtx.createImageData(width, height);
  const sData = surfaceImg.data;

  // 2. Specular / Roughness Canvas
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(width, height);
  const rData = roughImg.data;

  // 3. City Lights Canvas (Night side)
  const lightsCanvas = document.createElement('canvas');
  lightsCanvas.width = width;
  lightsCanvas.height = height;
  const lightsCtx = lightsCanvas.getContext('2d')!;
  const lightsImg = lightsCtx.createImageData(width, height);
  const lData = lightsImg.data;

  // 4. Atmospheric Clouds Canvas
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = width;
  cloudCanvas.height = height;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  const cloudImg = cloudCtx.createImageData(width, height);
  const cData = cloudImg.data;

  for (let y = 0; y < height; y++) {
    const lat = (y / height - 0.5) * Math.PI; // -pi/2 to pi/2
    const absLat = Math.abs(lat) / (Math.PI * 0.5); // 0 (equator) to 1 (poles)

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2; // 0 to 2pi
      const idx = (y * width + x) * 4;

      // Spherical coordinate sampling to avoid polar pinch
      const nx = Math.cos(lat) * Math.sin(lon);
      const ny = Math.sin(lat);
      const nz = Math.cos(lat) * Math.cos(lon);

      // Elevation noise with 5 octaves
      const elev = fbm(nx * 2.2 + 10, ny * 2.2 + 10, 5) * 0.5 + 0.5;
      const detail = fbm(nx * 8.0 + 30, nz * 8.0 + 30, 3) * 0.5 + 0.5;

      const seaLevel = 0.48;

      let r = 0, g = 0, b = 0;
      let roughness = 220; // 0-255

      // Ice caps at extreme poles
      const isPolarIce = absLat > 0.82 + (noise(nx * 4, nz * 4) * 0.08);

      if (isPolarIce) {
        // Gleaming arctic glacier ice
        r = 230 + Math.floor(detail * 25);
        g = 242 + Math.floor(detail * 13);
        b = 255;
        roughness = 70; // icy sheen
      } else if (elev < seaLevel) {
        // Oceans
        const depth = elev / seaLevel;
        if (depth < 0.6) {
          // Deep abyssal navy
          r = Math.floor(6 + depth * 14);
          g = Math.floor(22 + depth * 35);
          b = Math.floor(68 + depth * 55);
        } else if (depth < 0.92) {
          // Continental shelf sapphire
          r = Math.floor(12 + depth * 22);
          g = Math.floor(45 + depth * 65);
          b = Math.floor(105 + depth * 80);
        } else {
          // Coastal shallow turquoise
          r = Math.floor(24 + (depth - 0.92) * 200);
          g = Math.floor(95 + (depth - 0.92) * 350);
          b = Math.floor(155 + (depth - 0.92) * 400);
        }
        roughness = 25; // extremely low roughness = sharp glossy specular sunlight reflection!
      } else {
        // Continents / Landmasses
        const altitude = (elev - seaLevel) / (1 - seaLevel);
        roughness = 210;

        if (altitude < 0.04) {
          // Sandy coastline & beaches
          r = 194; g = 178; b = 138;
        } else if (absLat > 0.55) {
          // Subpolar taiga & tundra
          r = Math.floor(55 + altitude * 50);
          g = Math.floor(75 + altitude * 50);
          b = Math.floor(60 + altitude * 40);
        } else if (absLat < 0.35 && altitude < 0.45 && (nx > 0.1 || detail > 0.65)) {
          // Arid desert & savannah belts
          r = Math.floor(175 + detail * 55);
          g = Math.floor(138 + detail * 45);
          b = Math.floor(88 + detail * 35);
        } else if (altitude < 0.6) {
          // Lush temperate forest & river basins
          r = Math.floor(34 + detail * 30);
          g = Math.floor(88 + detail * 45);
          b = Math.floor(40 + detail * 25);
        } else if (altitude < 0.82) {
          // High mountain rock ridges
          r = Math.floor(105 + detail * 40);
          g = Math.floor(98 + detail * 35);
          b = Math.floor(90 + detail * 30);
        } else {
          // Snow-capped alpine mountain peaks
          r = 240; g = 244; b = 250;
          roughness = 90;
        }
      }

      sData[idx] = Math.min(255, r);
      sData[idx + 1] = Math.min(255, g);
      sData[idx + 2] = Math.min(255, b);
      sData[idx + 3] = 255;

      rData[idx] = roughness;
      rData[idx + 1] = roughness;
      rData[idx + 2] = roughness;
      rData[idx + 3] = 255;

      // -------------------------------------------------------------
      // Nocturnal City Lights (Glowing clusters on landmasses)
      // -------------------------------------------------------------
      if (elev >= seaLevel && !isPolarIce) {
        const cityDensity = fbm(nx * 14.0 + 80, nz * 14.0 + 80, 4);
        const roadWebs = noise(nx * 32.0, ny * 32.0);

        if (cityDensity > 0.62 && roadWebs > -0.1) {
          const intensity = Math.pow((cityDensity - 0.62) / 0.38, 2.2);
          lData[idx] = Math.floor(255 * intensity);
          lData[idx + 1] = Math.floor(210 * intensity);
          lData[idx + 2] = Math.floor(130 * intensity);
          lData[idx + 3] = 255;
        } else {
          lData[idx + 3] = 0;
        }
      } else {
        lData[idx + 3] = 0;
      }

      // -------------------------------------------------------------
      // Atmospheric Cloud System (Wispy swirls & cyclones)
      // -------------------------------------------------------------
      const warpX = nx + noise(nx * 3.5, ny * 3.5) * 0.45;
      const warpZ = nz + noise(nz * 3.5, ny * 3.5) * 0.45;
      const cloudVal = fbm(warpX * 3.2 + 50, warpZ * 3.2 + 50, 5) * 0.5 + 0.5;

      const stormBelt = Math.sin(lat * 3.0) * 0.12;
      const cloudThreshold = 0.52 - stormBelt;

      if (cloudVal > cloudThreshold) {
        const density = Math.min(1.0, (cloudVal - cloudThreshold) / 0.32);
        cData[idx] = 255;
        cData[idx + 1] = 255;
        cData[idx + 2] = 255;
        cData[idx + 3] = Math.floor(density * 220);
      } else {
        cData[idx + 3] = 0;
      }
    }
  }

  surfaceCtx.putImageData(surfaceImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  lightsCtx.putImageData(lightsImg, 0, 0);
  cloudCtx.putImageData(cloudImg, 0, 0);

  const surfaceTexture = new THREE.CanvasTexture(surfaceCanvas);
  surfaceTexture.wrapS = THREE.RepeatWrapping;
  surfaceTexture.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessTexture = new THREE.CanvasTexture(roughCanvas);
  roughnessTexture.wrapS = THREE.RepeatWrapping;
  roughnessTexture.wrapT = THREE.ClampToEdgeWrapping;

  const lightsTexture = new THREE.CanvasTexture(lightsCanvas);
  lightsTexture.wrapS = THREE.RepeatWrapping;
  lightsTexture.wrapT = THREE.ClampToEdgeWrapping;

  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  cloudTexture.wrapS = THREE.RepeatWrapping;
  cloudTexture.wrapT = THREE.ClampToEdgeWrapping;

  return { surfaceTexture, roughnessTexture, lightsTexture, cloudTexture };
}

// -------------------------------------------------------------
// Main Photorealistic Cosmic Canvas Component
// -------------------------------------------------------------
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

    // --- Three.js Scene, Camera, High-Precision WebGL Renderer ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020510, 0.001);

    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      3000,
    );
    camera.position.set(0, 0, 85);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // =============================================================
    // 1. CINEMATIC SOLAR & CELESTIAL LIGHTING
    // =============================================================
    const ambientLight = new THREE.AmbientLight(0x061226, 1.1);
    scene.add(ambientLight);

    // Distant Sun Directional Light (crisp realistic terminator)
    const sunLight = new THREE.DirectionalLight(0xfff8ea, 3.4);
    sunLight.position.set(-140, 75, 120);
    scene.add(sunLight);

    // Subtle atmospheric back-bounce light from deep space
    const rimFillLight = new THREE.DirectionalLight(0x1a3d6e, 0.8);
    rimFillLight.position.set(120, -50, -80);
    scene.add(rimFillLight);

    // =============================================================
    // 2. HIGH-FIDELITY TWINKLING MULTI-SPECTRAL STARFIELD
    // =============================================================
    const starCount = 3800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCols = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const spectralColors = [
      new THREE.Color(0xc9e4ff), // Class O/B: Blue-white
      new THREE.Color(0xffffff), // Class A: Pure diamond white
      new THREE.Color(0xfbf8e6), // Class F: Warm white
      new THREE.Color(0xffe89e), // Class G: Solar yellow
      new THREE.Color(0xffc585), // Class K: Soft amber
      new THREE.Color(0xff9e7a), // Class M: Radiant red giant
    ];

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const r = 240 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPos[i3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i3 + 2] = r * Math.cos(phi);

      const colorPick = spectralColors[Math.floor(Math.random() * spectralColors.length)];
      starCols[i3] = colorPick.r;
      starCols[i3 + 1] = colorPick.g;
      starCols[i3 + 2] = colorPick.b;

      const brightness = Math.pow(Math.random(), 3.5);
      starSizes[i] = 1.0 + brightness * 3.5;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const makeStarTexture = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.18, 'rgba(235,245,255,0.9)');
        grad.addColorStop(0.45, 'rgba(140,205,255,0.35)');
        grad.addColorStop(0.85, 'rgba(40,120,255,0.06)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(c);
    };

    const starTexture = makeStarTexture();

    const starMat = new THREE.PointsMaterial({
      size: 2.4,
      vertexColors: true,
      map: starTexture,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // =============================================================
    // 3. COSMIC DUST & NEBULAR FILAMENTS
    // =============================================================
    const nebulaCount = 450;
    const nebulaGeo = new THREE.BufferGeometry();
    const nebulaPos = new Float32Array(nebulaCount * 3);
    const nebulaCols = new Float32Array(nebulaCount * 3);

    for (let i = 0; i < nebulaCount; i++) {
      const i3 = i * 3;
      nebulaPos[i3] = (Math.random() - 0.5) * 1200;
      nebulaPos[i3 + 1] = (Math.random() - 0.5) * 800;
      nebulaPos[i3 + 2] = -400 - Math.random() * 800;

      nebulaCols[i3] = 0.08 + Math.random() * 0.15;
      nebulaCols[i3 + 1] = 0.25 + Math.random() * 0.35;
      nebulaCols[i3 + 2] = 0.65 + Math.random() * 0.35;
    }

    nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
    nebulaGeo.setAttribute('color', new THREE.BufferAttribute(nebulaCols, 3));

    const nebulaMat = new THREE.PointsMaterial({
      size: 65,
      vertexColors: true,
      map: starTexture,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nebulaClouds = new THREE.Points(nebulaGeo, nebulaMat);
    scene.add(nebulaClouds);

    // =============================================================
    // 4. PHOTOREALISTIC 3D PLANET (NOT PLASTIC)
    // =============================================================
    const { surfaceTexture, roughnessTexture, lightsTexture, cloudTexture } =
      generatePlanetTextures(1024, 512);

    const planetGroup = new THREE.Group();
    // Positioned majestically on the right/lower quadrant:
    // Frames the interface beautifully without EVER overlapping text or inputs!
    planetGroup.position.set(46, -18, -25);
    planetGroup.rotation.z = THREE.MathUtils.degToRad(23.4);

    const planetRadius = 35;

    // --- A. Base Planetary Surface Mesh ---
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({
      map: surfaceTexture,
      roughnessMap: roughnessTexture,
      roughness: 0.65,
      metalness: 0.15,
      emissiveMap: lightsTexture,
      emissive: new THREE.Color(0xfff0d0),
      emissiveIntensity: 1.25,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetGroup.add(planetMesh);

    // --- B. Atmospheric Cloud Layer ---
    const cloudGeo = new THREE.SphereGeometry(planetRadius * 1.012, 64, 64);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.88,
      blending: THREE.NormalBlending,
      roughness: 0.95,
      metalness: 0.05,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    planetGroup.add(cloudMesh);

    // --- C. Photorealistic Rayleigh Atmospheric Scattering Rim Shell ---
    const atmoGeo = new THREE.SphereGeometry(planetRadius * 1.032, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: new THREE.Vector3(-140, 75, 120).normalize() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.2);

          float sunDot = max(0.0, dot(vNormal, sunDir));
          float intensity = fresnel * (0.35 + 0.65 * sunDot) * 1.7;

          vec3 atmoCyan = vec3(0.18, 0.68, 1.0);
          vec3 atmoWhite = vec3(0.85, 0.95, 1.0);
          vec3 finalColor = mix(atmoCyan, atmoWhite, pow(sunDot, 4.0));

          gl_FragColor = vec4(finalColor, intensity);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    planetGroup.add(atmoMesh);

    // --- D. Luminous Orbital Communication Ring ---
    const ringGeo = new THREE.TorusGeometry(planetRadius * 1.38, 0.22, 16, 120);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x64d2ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI * 0.42;
    ringMesh.rotation.y = Math.PI * 0.12;
    planetGroup.add(ringMesh);

    scene.add(planetGroup);

    // =============================================================
    // 5. MOUSE PARALLAX TRACKING WITH INERTIA DAMPING
    // =============================================================
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // =============================================================
    // 6. ANIMATION TICKER LOOP
    // =============================================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animateLoop = () => {
      animationFrameId = requestAnimationFrame(animateLoop);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth inertia cursor damping
      mouseX += (targetMouseX - mouseX) * 0.045;
      mouseY += (targetMouseY - mouseY) * 0.045;

      // Observation deck camera parallax
      camera.position.x = mouseX * 9;
      camera.position.y = mouseY * 6;
      camera.lookAt(mouseX * 2.5, mouseY * 1.8, 0);

      // Deep space starfield slow drift & parallax
      starField.rotation.y = elapsed * 0.008 + mouseX * 0.03;
      starField.rotation.x = elapsed * 0.003 + mouseY * 0.03;
      nebulaClouds.rotation.y = elapsed * 0.005;

      // Realistic planetary rotation
      planetMesh.rotation.y = elapsed * 0.022;
      cloudMesh.rotation.y = elapsed * 0.028;
      ringMesh.rotation.z = elapsed * 0.015;

      // Dynamic star twinkling
      starMat.opacity = 0.88 + Math.sin(elapsed * 2.2) * 0.08;

      renderer.render(scene, camera);
    };

    animateLoop();

    // =============================================================
    // 7. CLEANUP
    // =============================================================
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      starGeo.dispose();
      starMat.dispose();
      nebulaGeo.dispose();
      nebulaMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      surfaceTexture.dispose();
      roughnessTexture.dispose();
      lightsTexture.dispose();
      cloudTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="interactive-chat-canvas"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}
