/**
 * 3D Physics and Anime.js v4 Animation Engine for Sovereign-Core.
 */

import { animate, stagger } from 'animejs';

/**
 * Applies a 3D perspective tilt to a card or container based on cursor position.
 */
export function apply3DTilt(
  element: HTMLElement | null,
  event: React.MouseEvent<HTMLElement>,
  maxTiltDegrees: number = 10,
  translateZ: number = 12,
) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const mouseX = event.clientX - centerX;
  const mouseY = event.clientY - centerY;

  const tiltX = -((mouseY / (rect.height / 2)) * maxTiltDegrees);
  const tiltY = (mouseX / (rect.width / 2)) * maxTiltDegrees;

  animate(element, {
    rotateX: tiltX,
    rotateY: tiltY,
    translateZ: translateZ,
    duration: 250,
    ease: 'outQuad',
  });
}

/**
 * Resets 3D tilt back to flat with an elastic settling spring.
 */
export function reset3DTilt(element: HTMLElement | null) {
  if (!element) return;
  animate(element, {
    rotateX: 0,
    rotateY: 0,
    translateZ: 0,
    duration: 600,
    ease: 'outElastic(1, 0.6)',
  });
}

/**
 * Initializes continuous 3D orbital spinning and pulsing energy cores.
 */
export function initOrbitalStage(container: HTMLElement | null) {
  if (!container) return;

  const orbitRing = container.querySelectorAll('.orbit-ring');
  if (orbitRing.length > 0) {
    animate(orbitRing, {
      rotateZ: [0, 360],
      duration: 32000,
      loop: true,
      ease: 'linear',
    });
  }

  const orbitReverse = container.querySelectorAll('.orbit-ring-reverse');
  if (orbitReverse.length > 0) {
    animate(orbitReverse, {
      rotateZ: [360, 0],
      duration: 44000,
      loop: true,
      ease: 'linear',
    });
  }

  const orbitalNodes = container.querySelectorAll('.orbital-node');
  if (orbitalNodes.length > 0) {
    animate(orbitalNodes, {
      scale: [0.85, 1.25, 0.85],
      opacity: [0.7, 1, 0.7],
      duration: 3200,
      alternate: true,
      loop: true,
      delay: stagger(400),
      ease: 'inOutSine',
    });
  }
}

/**
 * Stagger reveal for lists, steps, and telemetry cards.
 */
export function staggerReveal(elements: HTMLElement[] | NodeListOf<Element> | string) {
  animate(elements, {
    opacity: [0, 1],
    translateY: [20, 0],
    scale: [0.97, 1],
    delay: stagger(75),
    duration: 450,
    ease: 'outCubic',
  });
}

/**
 * 3D Holographic pulse for error modals, security alerts, and offline warnings.
 */
export function pulseErrorHologram(element: HTMLElement | null) {
  if (!element) return;
  animate(element, {
    scale: [0.94, 1.02, 1],
    opacity: [0.3, 1],
    rotateX: [10, 0],
    duration: 550,
    ease: 'outBack',
  });
}

/**
 * Magnetic button spring effect for high-priority CTA actions.
 */
export function magneticButton(
  element: HTMLElement | null,
  event: React.MouseEvent<HTMLElement>,
  pullStrength: number = 0.35,
) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const relX = event.clientX - (rect.left + rect.width / 2);
  const relY = event.clientY - (rect.top + rect.height / 2);

  animate(element, {
    translateX: relX * pullStrength,
    translateY: relY * pullStrength,
    duration: 180,
    ease: 'outQuad',
  });
}

export function releaseMagneticButton(element: HTMLElement | null) {
  if (!element) return;
  animate(element, {
    translateX: 0,
    translateY: 0,
    duration: 550,
    ease: 'outElastic(1, 0.5)',
  });
}
