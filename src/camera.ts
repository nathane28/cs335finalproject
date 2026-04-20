import { mat4LookAt } from "./math";
import type { Mat4 } from "./math";

// ─── Spherical orbit camera ───────────────────────────────────────────────────

let theta  = 0.3;
let phi    = 0.50;
let radius = 68.0;
let targetRadius = 68.0;

const PHI_MIN    = 0.05;
const PHI_MAX    = 1.48;
const RADIUS_MIN = 2.0;
const RADIUS_MAX = 120.0;

// ─── Focus target (click-to-focus) ───────────────────────────────────────────

let focusX = 0, focusZ = 0;         // current interpolated target
let focusTargetX = 0, focusTargetZ = 0; // destination target

export function setFocusTarget(x: number, z: number): void {
  focusTargetX = x;
  focusTargetZ = z;
}

// ─── Computed eye position ────────────────────────────────────────────────────

export function getCameraEye(): [number, number, number] {
  return [
    focusX + radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.sin(phi),
    focusZ + radius * Math.cos(phi) * Math.cos(theta),
  ];
}

export function getViewMatrix(): Mat4 {
  const eye = getCameraEye();
  return mat4LookAt(eye, [focusX, 0, focusZ], [0, 1, 0]);
}

export function getRadius(): number { return radius; }

export function setTargetRadius(r: number): void {
  targetRadius = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, r));
}

// Camera basis vectors — used for analytical ray casting (no mat4Inverse needed)
export function getCameraAxes(): {
  forward: [number,number,number];
  right:   [number,number,number];
  up:      [number,number,number];
} {
  const sinT = Math.sin(theta), cosT = Math.cos(theta);
  const sinP = Math.sin(phi),   cosP = Math.cos(phi);

  // forward = direction from eye toward focus target
  const forward: [number,number,number] = [
    -cosP * sinT,
    -sinP,
    -cosP * cosT,
  ];

  // right = forward × worldUp, with fallback when looking straight up/down
  const wx = 0, wy = 1, wz = 0;
  let rx = forward[1]*wz - forward[2]*wy;
  let ry = forward[2]*wx - forward[0]*wz;
  let rz = forward[0]*wy - forward[1]*wx;
  const rlen = Math.hypot(rx, ry, rz) || 1;
  rx /= rlen; ry /= rlen; rz /= rlen;
  const right: [number,number,number] = [rx, ry, rz];

  // up = right × forward
  const up: [number,number,number] = [
    right[1]*forward[2] - right[2]*forward[1],
    right[2]*forward[0] - right[0]*forward[2],
    right[0]*forward[1] - right[1]*forward[0],
  ];

  return { forward, right, up };
}

// ─── Per-frame update ─────────────────────────────────────────────────────────

export function updateCamera(): void {
  radius += (targetRadius - radius) * 0.12;
  focusX += (focusTargetX - focusX) * 0.06;
  focusZ += (focusTargetZ - focusZ) * 0.06;
}

// ─── Mouse + scroll controls ─────────────────────────────────────────────────

export function attachMouseControls(canvas: HTMLCanvasElement): void {
  let dragging = false;
  let lastX = 0, lastY = 0;
  let dragMoved = false;

  canvas.addEventListener("mousedown", (e) => {
    dragging  = true;
    dragMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    theta += dx * 0.005;
    phi   -= dy * 0.005;
    phi    = Math.max(PHI_MIN, Math.min(PHI_MAX, phi));
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    targetRadius *= 1 + e.deltaY * 0.001;
    targetRadius  = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, targetRadius));
  }, { passive: false });

  canvas.style.cursor = "grab";

  // Expose dragMoved so click handler in main.ts can ignore drag-clicks
  (canvas as any)._dragMoved = () => dragMoved;
}
