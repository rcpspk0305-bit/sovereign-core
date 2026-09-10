'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RocketLaunchState = 'idle' | 'igniting' | 'launching' | 'completed';

interface InteractiveCosmicChatCanvasProps {
  launchState?: RocketLaunchState;
  onLaunchComplete?: () => void;
}

// -------------------------------------------------------------
// Main Photorealistic Cosmic Canvas Component: Real Earth
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
    scene.fog = new THREE.FogExp2(0x04020e, 0.001);

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
    const ambientLight = new THREE.AmbientLight(0x3a4c78, 2.6);
    scene.add(ambientLight);

    // Primary Sun Directional Light (crisp golden-white sunlight)
    const sunLight = new THREE.DirectionalLight(0xfff8e7, 4.2);
    sunLight.position.set(-110, 55, 90);
    scene.add(sunLight);

    // Front-Right Fill Light (ensures all continents & oceans stay beautifully visible)
    const fillLight = new THREE.DirectionalLight(0x486cae, 2.0);
    fillLight.position.set(90, -20, 70);
    scene.add(fillLight);

    // Subtle atmospheric back-bounce light from deep space
    const rimFillLight = new THREE.DirectionalLight(0x283868, 1.2);
    rimFillLight.position.set(0, -60, -60);
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
      new THREE.Color(0xd4d0ff), // Class O/B: Cool lavender-white
      new THREE.Color(0xffffff), // Class A: Pure diamond white
      new THREE.Color(0xfff5e6), // Class F: Warm champagne white
      new THREE.Color(0xf0c842), // Class G: Gold (premium)
      new THREE.Color(0xc9a0ff), // Class K: Soft violet
      new THREE.Color(0xff9e7a), // Class M: Radiant coral giant
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
        grad.addColorStop(0.18, 'rgba(240,235,255,0.9)');
        grad.addColorStop(0.45, 'rgba(180,140,255,0.35)');
        grad.addColorStop(0.85, 'rgba(100,60,255,0.06)');
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

      const hue = Math.random();
      if (hue < 0.4) {
        nebulaCols[i3] = 0.25 + Math.random() * 0.2;
        nebulaCols[i3 + 1] = 0.08 + Math.random() * 0.12;
        nebulaCols[i3 + 2] = 0.65 + Math.random() * 0.35;
      } else if (hue < 0.7) {
        nebulaCols[i3] = 0.35 + Math.random() * 0.25;
        nebulaCols[i3 + 1] = 0.15 + Math.random() * 0.2;
        nebulaCols[i3 + 2] = 0.75 + Math.random() * 0.25;
      } else {
        nebulaCols[i3] = 0.7 + Math.random() * 0.3;
        nebulaCols[i3 + 1] = 0.5 + Math.random() * 0.3;
        nebulaCols[i3 + 2] = 0.1 + Math.random() * 0.2;
      }
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
    // 4. REAL PLANET EARTH (TEXTURE-MAPPED, NO RINGS, BACKDROP)
    // =============================================================
    const textureLoader = new THREE.TextureLoader();

    const surfaceTexture = textureLoader.load('/textures/earth/earth_surface.jpg');
    surfaceTexture.colorSpace = THREE.SRGBColorSpace;

    const lightsTexture = textureLoader.load('/textures/earth/earth_lights.jpg');
    lightsTexture.colorSpace = THREE.SRGBColorSpace;

    const planetGroup = new THREE.Group();
    // Positioned centered behind the search console & hero text
    planetGroup.position.set(0, -6, -26);
    planetGroup.rotation.z = THREE.MathUtils.degToRad(23.44); // Real Earth axial tilt
    planetGroup.rotation.x = THREE.MathUtils.degToRad(6.5);

    const planetRadius = 46;

    // --- A. Base Planetary Surface Mesh (Pristine NASA Satellite Earth) ---
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({
      map: surfaceTexture,
      roughness: 0.48,
      metalness: 0.08,
      emissiveMap: lightsTexture,
      emissive: new THREE.Color(0xffd59e),
      emissiveIntensity: 1.45,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetGroup.add(planetMesh);

    // --- B. Photorealistic Rayleigh Atmospheric Scattering Rim Shell ---
    const atmoGeo = new THREE.SphereGeometry(planetRadius * 1.032, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: new THREE.Vector3(-130, 65, 110).normalize() },
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
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.6);
          float sunDot = max(0.0, dot(vNormal, sunDir));
          float intensity = fresnel * (0.35 + 0.65 * sunDot) * 2.2;

          // Authentic Earth atmospheric blue to sunlight cyan-white
          vec3 atmoSapphire = vec3(0.08, 0.48, 1.0);
          vec3 atmoHorizon = vec3(0.65, 0.90, 1.0);
          vec3 finalColor = mix(atmoSapphire, atmoHorizon, pow(sunDot, 3.5));

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

    // Note: No rings! Earth does not have planetary rings.
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
      const elapsed = clock.getElapsedTime();

      // Smooth inertia cursor damping
      mouseX += (targetMouseX - mouseX) * 0.045;
      mouseY += (targetMouseY - mouseY) * 0.045;

      // Subtle observation deck camera parallax
      camera.position.x = mouseX * 4.5;
      camera.position.y = mouseY * 3.0;
      camera.lookAt(0, -2, 0);

      // Deep space starfield slow drift
      starField.rotation.y = elapsed * 0.006 + mouseX * 0.02;
      starField.rotation.x = elapsed * 0.002 + mouseY * 0.02;
      nebulaClouds.rotation.y = elapsed * 0.004;

      // Realistic planetary Earth rotation (West to East)
      planetMesh.rotation.y = 2.4 + elapsed * 0.016;

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
      atmoGeo.dispose();
      atmoMat.dispose();
      surfaceTexture.dispose();
      lightsTexture.dispose();
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
