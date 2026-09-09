'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CosmicCanvas3DProps {
  scrollProgress?: number;
}

export default function CosmicCanvas3D({ scrollProgress: controlledProgress }: CosmicCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020511, 0.0018);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      2500,
    );
    camera.position.set(0, 0, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // --- Ambient & Directional Lights ---
    const ambientLight = new THREE.AmbientLight(0x0b1e38, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffa844, 4, 1200);
    sunLight.position.set(280, -180, -320);
    scene.add(sunLight);

    const blueLight = new THREE.DirectionalLight(0x4aa5ff, 1.5);
    blueLight.position.set(-100, 150, 100);
    scene.add(blueLight);

    // ==========================================
    // 1. DEEP STARFIELD & WARP PARTICLES
    // ==========================================
    const starCount = 3500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const colorPalette = [
      new THREE.Color(0xd7ecff),
      new THREE.Color(0x91c4ff),
      new THREE.Color(0xffffff),
      new THREE.Color(0xffdca8),
      new THREE.Color(0x73e1ff),
    ];

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 300 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i3 + 2] = radius * Math.cos(phi);

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      starColors[i3] = col.r;
      starColors[i3 + 1] = col.g;
      starColors[i3 + 2] = col.b;

      starSizes[i] = Math.random() * 2.8 + 0.8;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    // Circle texture for smooth round stars
    const makeCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(215,240,255,0.8)');
        gradient.addColorStop(0.7, 'rgba(100,180,255,0.3)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const circleTexture = makeCircleTexture();

    const starMaterial = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      map: circleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const starField = new THREE.Points(starGeo, starMaterial);
    scene.add(starField);

    // ==========================================
    // 2. HERO PLANET WITH ATMOSPHERE RIM
    // ==========================================
    const planetGroup = new THREE.Group();
    planetGroup.position.set(55, -28, -25);

    // Base Planet Sphere
    const planetGeo = new THREE.SphereGeometry(42, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x0a2245,
      roughness: 0.65,
      metalness: 0.25,
      emissive: 0x021028,
      emissiveIntensity: 0.8,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetGroup.add(planetMesh);

    // Glowing Atmospheric Shell
    const atmoGeo = new THREE.SphereGeometry(44.5, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.28, 0.68, 1.0, 1.0) * intensity * 1.6;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    planetGroup.add(atmoMesh);

    // Orbiting Satellite Rings
    const ringGeo = new THREE.TorusGeometry(58, 0.35, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x68ddff,
      transparent: true,
      opacity: 0.45,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI * 0.35;
    ringMesh.rotation.y = Math.PI * 0.15;
    planetGroup.add(ringMesh);

    scene.add(planetGroup);

    // ==========================================
    // 3. PROCEDURAL BLAZING SUN & CORONA
    // ==========================================
    const sunGroup = new THREE.Group();
    sunGroup.position.set(160, -80, -380);

    // Core Solar Sphere
    const sunCoreGeo = new THREE.SphereGeometry(48, 64, 64);
    const sunCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfff4d6,
    });
    const sunCoreMesh = new THREE.Mesh(sunCoreGeo, sunCoreMat);
    sunGroup.add(sunCoreMesh);

    // Outer Solar Plasma Shell
    const sunCoronaGeo = new THREE.SphereGeometry(53, 48, 48);
    const sunCoronaMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          float rim = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
          float pulse = sin(vUv.x * 24.0 + time * 3.0) * cos(vUv.y * 24.0 + time * 2.0) * 0.2 + 0.8;
          vec3 sunOrange = vec3(1.0, 0.48, 0.08);
          vec3 sunYellow = vec3(1.0, 0.86, 0.35);
          vec3 col = mix(sunYellow, sunOrange, rim * pulse);
          gl_FragColor = vec4(col, pow(rim, 1.6) * 0.95);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const sunCoronaMesh = new THREE.Mesh(sunCoronaGeo, sunCoronaMat);
    sunGroup.add(sunCoronaMesh);

    // Solar Prominence / Flare Particles
    const flareCount = 600;
    const flareGeo = new THREE.BufferGeometry();
    const flarePositions = new Float32Array(flareCount * 3);
    const flareVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < flareCount; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize();
      const dist = 52 + Math.random() * 25;
      flarePositions[i * 3] = v.x * dist;
      flarePositions[i * 3 + 1] = v.y * dist;
      flarePositions[i * 3 + 2] = v.z * dist;
      flareVelocities.push(v.clone().multiplyScalar(0.4 + Math.random() * 0.8));
    }

    flareGeo.setAttribute('position', new THREE.BufferAttribute(flarePositions, 3));
    const flareMat = new THREE.PointsMaterial({
      size: 4.5,
      color: 0xffaa33,
      map: circleTexture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flarePoints = new THREE.Points(flareGeo, flareMat);
    sunGroup.add(flarePoints);

    scene.add(sunGroup);

    // ==========================================
    // 4. METEOR SHOWER WITH GLOW TRAILS
    // ==========================================
    const meteorGroup = new THREE.Group();
    meteorGroup.position.set(-60, 40, -680);

    const meteorCount = 28;
    interface Meteor {
      head: THREE.Vector3;
      velocity: THREE.Vector3;
      length: number;
      size: number;
      color: THREE.Color;
      active: boolean;
      tailPoints: THREE.Vector3[];
    }

    const meteors: Meteor[] = [];
    const meteorHeadGeo = new THREE.BufferGeometry();
    const meteorHeadPositions = new Float32Array(meteorCount * 3);
    const meteorHeadColors = new Float32Array(meteorCount * 3);

    for (let i = 0; i < meteorCount; i++) {
      const mCol = Math.random() > 0.4 ? new THREE.Color(0xff8b3d) : new THREE.Color(0x6ee7b7);
      meteors.push({
        head: new THREE.Vector3(
          (Math.random() - 0.5) * 260,
          (Math.random() - 0.5) * 180,
          (Math.random() - 0.5) * 220,
        ),
        velocity: new THREE.Vector3(
          -2.2 - Math.random() * 2.8,
          -1.4 - Math.random() * 1.8,
          -1.0 - Math.random() * 2.0,
        ),
        length: 20 + Math.random() * 30,
        size: 3 + Math.random() * 4,
        color: mCol,
        active: true,
        tailPoints: [],
      });
    }

    const meteorTrailLines: THREE.Line[] = [];
    meteors.forEach((m) => {
      const lineGeo = new THREE.BufferGeometry();
      const linePos = new Float32Array(6); // 2 vertices: head and tail
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      meteorTrailLines.push(line);
      meteorGroup.add(line);
    });

    meteorHeadGeo.setAttribute('position', new THREE.BufferAttribute(meteorHeadPositions, 3));
    meteorHeadGeo.setAttribute('color', new THREE.BufferAttribute(meteorHeadColors, 3));

    const meteorHeadMat = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      map: circleTexture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const meteorHeads = new THREE.Points(meteorHeadGeo, meteorHeadMat);
    meteorGroup.add(meteorHeads);

    // Asteroid Debris Rocks
    const asteroidCount = 14;
    for (let i = 0; i < asteroidCount; i++) {
      const rockGeo = new THREE.DodecahedronGeometry(2.5 + Math.random() * 4.5, 1);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.9,
        metalness: 0.1,
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(
        (Math.random() - 0.5) * 220,
        (Math.random() - 0.5) * 160,
        (Math.random() - 0.5) * 200,
      );
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      meteorGroup.add(rock);
    }

    scene.add(meteorGroup);

    // ==========================================
    // 5. SPIRAL MILKY WAY GALAXY (16,000+ STARS)
    // ==========================================
    const galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(0, -60, -1150);
    galaxyGroup.rotation.x = Math.PI * 0.32;

    const galaxyParams = {
      count: 16000,
      size: 2.2,
      radius: 340,
      branches: 3,
      spin: 1.35,
      randomness: 0.38,
      power: 3.5,
      insideColor: '#ffd79e',
      outsideColor: '#3b82f6',
    };

    const galaxyGeo = new THREE.BufferGeometry();
    const galaxyPositions = new Float32Array(galaxyParams.count * 3);
    const galaxyColors = new Float32Array(galaxyParams.count * 3);

    const colInside = new THREE.Color(galaxyParams.insideColor);
    const colOutside = new THREE.Color(galaxyParams.outsideColor);

    for (let i = 0; i < galaxyParams.count; i++) {
      const i3 = i * 3;
      const r = Math.random() * galaxyParams.radius;
      const spinAngle = r * galaxyParams.spin * 0.015;
      const branchAngle = ((i % galaxyParams.branches) * ((2 * Math.PI) / galaxyParams.branches));

      const randomX = Math.pow(Math.random(), galaxyParams.power) * (Math.random() < 0.5 ? 1 : -1) * galaxyParams.randomness * r;
      const randomY = Math.pow(Math.random(), galaxyParams.power) * (Math.random() < 0.5 ? 1 : -1) * galaxyParams.randomness * (r * 0.45);
      const randomZ = Math.pow(Math.random(), galaxyParams.power) * (Math.random() < 0.5 ? 1 : -1) * galaxyParams.randomness * r;

      galaxyPositions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX;
      galaxyPositions[i3 + 1] = randomY;
      galaxyPositions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

      // Color interpolation: core is luminous amber/white, arms are cyan/blue
      const mixedCol = colInside.clone().lerp(colOutside, r / galaxyParams.radius);
      galaxyColors[i3] = mixedCol.r;
      galaxyColors[i3 + 1] = mixedCol.g;
      galaxyColors[i3 + 2] = mixedCol.b;
    }

    galaxyGeo.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
    galaxyGeo.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));

    const galaxyMat = new THREE.PointsMaterial({
      size: galaxyParams.size,
      vertexColors: true,
      map: circleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const galaxyPoints = new THREE.Points(galaxyGeo, galaxyMat);
    galaxyGroup.add(galaxyPoints);

    // Galactic Core Super-Glow
    const coreGlowGeo = new THREE.SphereGeometry(26, 32, 32);
    const coreGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffecc4,
      transparent: true,
      opacity: 0.65,
    });
    const coreGlowMesh = new THREE.Mesh(coreGlowGeo, coreGlowMat);
    galaxyGroup.add(coreGlowMesh);

    scene.add(galaxyGroup);

    // ==========================================
    // 6. CAMERA KEYFRAMES & SCROLL INTERPOLATION
    // ==========================================
    const cameraTargets = [
      { progress: 0.0,  pos: new THREE.Vector3(0, 0, 100),       lookAt: new THREE.Vector3(25, -10, 0) },
      { progress: 0.20, pos: new THREE.Vector3(10, -20, -120),   lookAt: new THREE.Vector3(30, -30, -240) },
      { progress: 0.42, pos: new THREE.Vector3(110, -50, -320),  lookAt: new THREE.Vector3(160, -80, -380) },
      { progress: 0.65, pos: new THREE.Vector3(-30, 20, -580),   lookAt: new THREE.Vector3(-60, 40, -680) },
      { progress: 0.88, pos: new THREE.Vector3(0, 140, -960),    lookAt: new THREE.Vector3(0, -60, -1150) },
      { progress: 1.0,  pos: new THREE.Vector3(0, 40, -1080),    lookAt: new THREE.Vector3(0, -20, -1250) },
    ];

    let currentScroll = 0;
    let targetScroll = 0;

    const handleScroll = () => {
      if (typeof controlledProgress === 'number') {
        targetScroll = THREE.MathUtils.clamp(controlledProgress, 0, 1);
      } else {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const rawProgress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
        targetScroll = THREE.MathUtils.clamp(rawProgress, 0, 1);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // ==========================================
    // 7. ANIMATION TICKER LOOP
    // ==========================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const currentCameraPos = camera.position.clone();
    const currentCameraLook = new THREE.Vector3(0, 0, 0);

    const animateLoop = () => {
      animationFrameId = requestAnimationFrame(animateLoop);
      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll interpolation (damping)
      currentScroll += (targetScroll - currentScroll) * 0.065;

      // Find camera keyframes interpolation
      let p1 = cameraTargets[0];
      let p2 = cameraTargets[cameraTargets.length - 1];

      for (let i = 0; i < cameraTargets.length - 1; i++) {
        if (currentScroll >= cameraTargets[i].progress && currentScroll <= cameraTargets[i + 1].progress) {
          p1 = cameraTargets[i];
          p2 = cameraTargets[i + 1];
          break;
        }
      }

      const segmentSpan = p2.progress - p1.progress || 0.001;
      const alpha = (currentScroll - p1.progress) / segmentSpan;
      const smoothAlpha = THREE.MathUtils.smoothstep(alpha, 0, 1);

      const targetPos = new THREE.Vector3().lerpVectors(p1.pos, p2.pos, smoothAlpha);
      const targetLook = new THREE.Vector3().lerpVectors(p1.lookAt, p2.lookAt, smoothAlpha);

      currentCameraPos.lerp(targetPos, 0.08);
      currentCameraLook.lerp(targetLook, 0.08);

      camera.position.copy(currentCameraPos);
      camera.lookAt(currentCameraLook);

      // --- 1. Rotate Starfield & Warp Stretch ---
      starField.rotation.y = elapsedTime * 0.015;
      starField.rotation.x = elapsedTime * 0.006;

      // --- 2. Planet Rotation ---
      planetMesh.rotation.y = elapsedTime * 0.04;
      ringMesh.rotation.z = elapsedTime * 0.02;

      // --- 3. Sun Plasma & Flares ---
      sunCoronaMat.uniforms.time.value = elapsedTime;
      sunGroup.rotation.y = elapsedTime * 0.05;

      // Pulsing solar flares
      const fPos = flareGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < flareCount; i++) {
        const i3 = i * 3;
        const vel = flareVelocities[i];
        fPos[i3] += vel.x * 0.35;
        fPos[i3 + 1] += vel.y * 0.35;
        fPos[i3 + 2] += vel.z * 0.35;

        // Reset if drifted too far
        const dist = Math.hypot(fPos[i3], fPos[i3 + 1], fPos[i3 + 2]);
        if (dist > 85) {
          const v = vel.clone().normalize();
          const baseD = 52;
          fPos[i3] = v.x * baseD;
          fPos[i3 + 1] = v.y * baseD;
          fPos[i3 + 2] = v.z * baseD;
        }
      }
      flareGeo.attributes.position.needsUpdate = true;

      // --- 4. Meteor Movement ---
      const mHeadPos = meteorHeadGeo.attributes.position.array as Float32Array;
      const mHeadCol = meteorHeadGeo.attributes.color.array as Float32Array;

      meteors.forEach((m, idx) => {
        m.head.add(m.velocity);

        // Respawn meteor when it leaves box
        if (m.head.x < -220 || m.head.y < -150 || m.head.z < -900) {
          m.head.set(
            180 + Math.random() * 80,
            120 + Math.random() * 60,
            -550 + (Math.random() - 0.5) * 150,
          );
        }

        const i3 = idx * 3;
        mHeadPos[i3] = m.head.x;
        mHeadPos[i3 + 1] = m.head.y;
        mHeadPos[i3 + 2] = m.head.z;

        mHeadCol[i3] = m.color.r;
        mHeadCol[i3 + 1] = m.color.g;
        mHeadCol[i3 + 2] = m.color.b;

        // Update trail lines
        const line = meteorTrailLines[idx];
        if (line) {
          const lPos = line.geometry.attributes.position.array as Float32Array;
          lPos[0] = m.head.x;
          lPos[1] = m.head.y;
          lPos[2] = m.head.z;

          const tail = m.head.clone().sub(m.velocity.clone().multiplyScalar(m.length * 0.25));
          lPos[3] = tail.x;
          lPos[4] = tail.y;
          lPos[5] = tail.z;

          line.geometry.attributes.position.needsUpdate = true;
        }
      });
      meteorHeadGeo.attributes.position.needsUpdate = true;
      meteorHeadGeo.attributes.color.needsUpdate = true;

      // --- 5. Milky Way Galaxy Rotation ---
      galaxyGroup.rotation.z = elapsedTime * 0.035;
      coreGlowMesh.scale.setScalar(1 + Math.sin(elapsedTime * 2.5) * 0.05);

      renderer.render(scene, camera);
    };

    animateLoop();

    // Clean up on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose geometries and materials
      starGeo.dispose();
      starMaterial.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      sunCoreGeo.dispose();
      sunCoreMat.dispose();
      sunCoronaGeo.dispose();
      sunCoronaMat.dispose();
      flareGeo.dispose();
      flareMat.dispose();
      meteorHeadGeo.dispose();
      meteorHeadMat.dispose();
      galaxyGeo.dispose();
      galaxyMat.dispose();
      coreGlowGeo.dispose();
      coreGlowMat.dispose();
      renderer.dispose();
    };
  }, [controlledProgress]);

  return (
    <div
      ref={mountRef}
      className="cosmic-canvas-container"
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
