'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RocketLaunchState = 'idle' | 'igniting' | 'launching' | 'completed';

interface InteractiveCosmicChatCanvasProps {
  launchState?: RocketLaunchState;
  onLaunchComplete?: () => void;
}

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

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020614, 0.0015);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    camera.position.set(0, 0, 75);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x0d2142, 1.4);
    scene.add(ambientLight);

    const blueLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    blueLight.position.set(-60, 80, 80);
    scene.add(blueLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 2.5, 400);
    cyanLight.position.set(40, -30, 60);
    scene.add(cyanLight);

    const engineLight = new THREE.PointLight(0xff6b00, 0, 250);
    scene.add(engineLight);

    // --- Starfield ---
    const starCount = 2800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCols = new Float32Array(starCount * 3);

    const starColors = [
      new THREE.Color(0xdbeafe),
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xffffff),
      new THREE.Color(0x67e8f9),
    ];

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const r = 200 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPos[i3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i3 + 2] = r * Math.cos(phi);

      const c = starColors[Math.floor(Math.random() * starColors.length)];
      starCols[i3] = c.r;
      starCols[i3 + 1] = c.g;
      starCols[i3 + 2] = c.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));

    // Circle texture
    const makeDotTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.3, 'rgba(180,230,255,0.8)');
        grad.addColorStop(0.7, 'rgba(80,180,255,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(canvas);
    };
    const dotTexture = makeDotTexture();

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      map: dotTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // --- Floating Glowing Planet in Background ---
    const planetGroup = new THREE.Group();
    planetGroup.position.set(-42, 22, -90);

    const planetGeo = new THREE.SphereGeometry(16, 48, 48);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x072b54,
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x021630,
      emissiveIntensity: 0.7,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetGroup.add(planetMesh);

    const ringGeo = new THREE.TorusGeometry(24, 0.25, 16, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI * 0.4;
    planetGroup.add(ringMesh);

    scene.add(planetGroup);

    // ==========================================
    // 3D ROCKET OBJECT
    // ==========================================
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(0, -6, 25);
    rocketGroup.scale.setScalar(0.75);

    // 1. Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(1.8, 2.2, 14, 32);
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.75,
      roughness: 0.25,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.position.y = 7;
    rocketGroup.add(fuselage);

    // 2. Aerodynamic Nose Cone
    const noseGeo = new THREE.ConeGeometry(1.8, 5, 32);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x0070f3,
      metalness: 0.6,
      roughness: 0.2,
      emissive: 0x002d6b,
      emissiveIntensity: 0.5,
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.y = 16.5;
    rocketGroup.add(nose);

    // 3. Command Capsule Window
    const windowGeo = new THREE.SphereGeometry(0.75, 16, 16);
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
    });
    const cabinWindow = new THREE.Mesh(windowGeo, windowMat);
    cabinWindow.position.set(0, 11, 1.6);
    cabinWindow.scale.set(1, 1.4, 0.4);
    rocketGroup.add(cabinWindow);

    // 4. Delta Fins (4 fins)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(2.6, -2.5);
    finShape.lineTo(2.6, -4.5);
    finShape.lineTo(0, -2);
    finShape.closePath();

    const finExtrudeSettings = { depth: 0.2, bevelEnabled: false };
    const finGeo = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x0055c4,
      metalness: 0.8,
      roughness: 0.2,
    });

    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeo, finMat);
      const angle = (i * Math.PI) / 2;
      fin.rotation.y = angle;
      fin.position.set(0, 3, 0);
      rocketGroup.add(fin);
    }

    // 5. Engine Nozzle Bell
    const nozzleGeo = new THREE.CylinderGeometry(1.6, 2.3, 2, 24, 1, true);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.y = -0.6;
    rocketGroup.add(nozzle);

    // 6. Thruster Flame Particles
    const flameCount = 240;
    const flameGeo = new THREE.BufferGeometry();
    const flamePositions = new Float32Array(flameCount * 3);
    const flameColors = new Float32Array(flameCount * 3);
    const flameSizes = new Float32Array(flameCount);
    const flameVelocities: THREE.Vector3[] = [];

    const flamePal = [
      new THREE.Color(0xff4500),
      new THREE.Color(0xff8c00),
      new THREE.Color(0xffd700),
      new THREE.Color(0x00d4ff),
    ];

    for (let i = 0; i < flameCount; i++) {
      flamePositions[i * 3] = (Math.random() - 0.5) * 1.5;
      flamePositions[i * 3 + 1] = -1.6 - Math.random() * 2;
      flamePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

      const col = flamePal[Math.floor(Math.random() * flamePal.length)];
      flameColors[i * 3] = col.r;
      flameColors[i * 3 + 1] = col.g;
      flameColors[i * 3 + 2] = col.b;

      flameSizes[i] = Math.random() * 5 + 3;
      flameVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          -4 - Math.random() * 8,
          (Math.random() - 0.5) * 0.8,
        ),
      );
    }

    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameColors, 3));
    flameGeo.setAttribute('size', new THREE.BufferAttribute(flameSizes, 1));

    const flameMat = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      map: dotTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameParticles = new THREE.Points(flameGeo, flameMat);
    rocketGroup.add(flameParticles);

    scene.add(rocketGroup);

    // ==========================================
    // MOUSE CURSOR PARALLAX TRACKING
    // ==========================================
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // ==========================================
    // ANIMATION & LAUNCH TICKER
    // ==========================================
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let launchVelocity = 0;
    let hasCompletedLaunch = false;

    const animateLoop = () => {
      animationFrameId = requestAnimationFrame(animateLoop);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth mouse cursor damping
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Camera parallax based on cursor
      camera.position.x = mouseX * 14;
      camera.position.y = mouseY * 10;
      camera.lookAt(mouseX * 4, mouseY * 3, 0);

      // Starfield slow rotation & parallax
      starField.rotation.y = elapsed * 0.02 + mouseX * 0.1;
      starField.rotation.x = elapsed * 0.01 + mouseY * 0.1;

      // Planet rotation
      planetMesh.rotation.y = elapsed * 0.05;
      ringMesh.rotation.z = elapsed * 0.03;

      // Rocket state management
      const currentLaunch = launchRef.current;

      if (currentLaunch === 'idle') {
        // Subtle floating hover
        rocketGroup.position.y = -6 + Math.sin(elapsed * 2.0) * 0.6;
        rocketGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.04 - mouseX * 0.15;
        rocketGroup.rotation.x = mouseY * 0.15;
        flameMat.opacity = 0.12; // faint glow
        engineLight.intensity = 0.5;
        engineLight.position.copy(rocketGroup.position).add(new THREE.Vector3(0, -2, 0));
      } else if (currentLaunch === 'igniting') {
        // Intense vibration & ignition
        rocketGroup.position.x = (Math.random() - 0.5) * 0.4;
        rocketGroup.position.y = -6 + (Math.random() - 0.5) * 0.4;
        flameMat.opacity = 0.95;
        engineLight.intensity = 4.0;
        engineLight.position.copy(rocketGroup.position).add(new THREE.Vector3(0, -2, 0));
      } else if (currentLaunch === 'launching') {
        // Liftoff acceleration!
        launchVelocity += delta * 75;
        rocketGroup.position.y += launchVelocity * delta;
        rocketGroup.position.x += mouseX * 0.2;
        rocketGroup.rotation.z = -mouseX * 0.2;

        flameMat.opacity = 1.0;
        engineLight.intensity = 6.0;
        engineLight.position.copy(rocketGroup.position).add(new THREE.Vector3(0, -2, 0));

        // Screen shake
        camera.position.x += (Math.random() - 0.5) * 0.8;
        camera.position.y += (Math.random() - 0.5) * 0.8;

        if (rocketGroup.position.y > 90 && !hasCompletedLaunch) {
          hasCompletedLaunch = true;
          if (onLaunchComplete) {
            onLaunchComplete();
          }
        }
      }

      // Update thruster flame particles
      const fPos = flameGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < flameCount; i++) {
        const i3 = i * 3;
        const v = flameVelocities[i];
        fPos[i3] += v.x * delta * (currentLaunch === 'launching' ? 1.8 : 0.8);
        fPos[i3 + 1] += v.y * delta * (currentLaunch === 'launching' ? 3.0 : 1.2);
        fPos[i3 + 2] += v.z * delta * (currentLaunch === 'launching' ? 1.8 : 0.8);

        // Reset particle if it moved too far down
        if (fPos[i3 + 1] < -18) {
          fPos[i3] = (Math.random() - 0.5) * 1.5;
          fPos[i3 + 1] = -1.6;
          fPos[i3 + 2] = (Math.random() - 0.5) * 1.5;
        }
      }
      flameGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animateLoop();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      starGeo.dispose();
      starMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      fuselageGeo.dispose();
      fuselageMat.dispose();
      noseGeo.dispose();
      noseMat.dispose();
      windowGeo.dispose();
      windowMat.dispose();
      finGeo.dispose();
      finMat.dispose();
      nozzleGeo.dispose();
      nozzleMat.dispose();
      flameGeo.dispose();
      flameMat.dispose();
      renderer.dispose();
    };
  }, [onLaunchComplete]);

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
