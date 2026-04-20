import { mat4Identity, mat4Perspective, mat4Translate, mat4Scale, mat4RotateY } from "./math";
import {
  phongVertSrc, phongFragSrc,
  unlitVertSrc, unlitFragSrc,
  ringVertSrc,  ringFragSrc,
  atmVertSrc,   atmFragSrc,
  quadVertSrc,  brightExtractFragSrc, blurFragSrc, compositeFragSrc,
} from "./shaders";
import { planets, SUN_RADIUS, SUN_COLOR } from "./planetData";
import { generateSphere } from "./sphere";
import { createStarfield } from "./starfield";
import { createOrbitRingGeometry } from "./orbitRing";
import { createRingGeometry } from "./ringGeometry";
import { createAsteroidBelt } from "./asteroidBelt";
import {
  getCameraEye, getViewMatrix, getRadius,
  updateCamera, attachMouseControls,
  setFocusTarget, getCameraAxes, setTargetRadius,
} from "./camera";

// ─── Canvas + WebGL2 ─────────────────────────────────────────────────────────

const canvas = document.getElementById("glCanvas") as HTMLCanvasElement;
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

const glContext = canvas.getContext("webgl2");
if (!glContext) throw new Error("WebGL2 not supported in this browser.");
const gl = glContext;

attachMouseControls(canvas);

// ─── Projection ───────────────────────────────────────────────────────────────

let projMatrix = mat4Perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 300.0);

window.addEventListener("resize", () => {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  projMatrix = mat4Perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 300.0);
  sceneFBO  = createSceneFBO(canvas.width, canvas.height);
  brightFBO = createColorFBO(canvas.width, canvas.height);
  blurFBO   = createColorFBO(canvas.width, canvas.height);
});

// ─── Speed / pause ────────────────────────────────────────────────────────────

let speedMult = 1.0;
let paused    = false;
const speedDisplay    = document.getElementById("speedDisplay")!;
const pauseIndicator  = document.getElementById("pauseIndicator")!;

function setSpeed(mult: number): void {
  speedMult = Math.max(0.1, Math.min(5.0, +mult.toFixed(1)));
  speedDisplay.textContent = `${speedMult.toFixed(1)}×`;
}

// ─── Sidebar / planet state ───────────────────────────────────────────────────

const planetListEl  = document.getElementById("planet-list")!;
const detailEl      = document.getElementById("planet-detail")!;
const detailName    = document.getElementById("detail-name")!;
const detailType    = document.getElementById("detail-type")!;
const dRadius       = document.getElementById("d-radius")!;
const dDist         = document.getElementById("d-dist")!;
const dPeriod       = document.getElementById("d-period")!;
const dMoons        = document.getElementById("d-moons")!;
const dType         = document.getElementById("d-type")!;

let activePlanetIdx  = -1;
let followPlanetIdx  = -1;  // index into planets (0-7) or 8 for moon, -1 for none

function focusPlanet(i: number): void {
  activePlanetIdx = i;
  followPlanetIdx = i;
  document.querySelectorAll(".planet-item").forEach((el, idx) => {
    el.classList.toggle("active", idx === i);
  });
  const p   = planets[i];
  const pos = planetPositions[i];
  setFocusTarget(pos.x, pos.z);
  // Zoom relative to orbit size — close enough to clearly see the planet
  setTargetRadius(Math.max(p.radius * 6, p.orbitRadius * 0.28 + p.radius * 3));
  detailEl.classList.remove("hidden");
  detailName.textContent = p.name;
  detailType.textContent = p.stats.type;
  dRadius.textContent    = p.stats.radiusKm;
  dDist.textContent      = p.stats.distanceAU;
  dPeriod.textContent    = p.stats.periodDays;
  dMoons.textContent     = p.stats.moons;
  dType.textContent      = p.stats.type;
}

function clearFocus(): void {
  activePlanetIdx = -1;
  followPlanetIdx = -1;
  document.querySelectorAll(".planet-item").forEach(el => el.classList.remove("active"));
  detailEl.classList.add("hidden");
}

// Build planet list items from data
planets.forEach((p, i) => {
  const item = document.createElement("div");
  item.className = "planet-item";
  item.innerHTML = `
    <div class="planet-dot" style="background:${p.dotColor};box-shadow:0 0 6px ${p.dotColor}88"></div>
    <div class="planet-name">${p.name}</div>
    <div class="planet-dist">${p.stats.distanceAU}</div>`;
  item.addEventListener("click", () => focusPlanet(i));
  planetListEl.appendChild(item);
});

// ─── Key controls ─────────────────────────────────────────────────────────────

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    paused = !paused;
    pauseIndicator.classList.toggle("visible", paused);
  }
  if (e.key === "ArrowRight") setSpeed(speedMult + 0.1);
  if (e.key === "ArrowLeft")  setSpeed(speedMult - 0.1);
  if (e.key === "r" || e.key === "R") {
    clearFocus();
    setFocusTarget(0, 0);
    setTargetRadius(68.0);
  }
});

// ─── Planet / moon world positions (updated each frame) ──────────────────────

const planetPositions: { x: number; z: number }[] = planets.map(() => ({ x: 0, z: 0 }));
const moonPosition = { x: 0, z: 0 };

// ─── Screen-space projection helper ──────────────────────────────────────────

function projectToScreen(
  wx: number, wy: number, wz: number,
  view: Float32Array, proj: Float32Array,
): { x: number; y: number; visible: boolean } {
  // Column-major: result[i] = sum_j M[j*4+i] * v[j]
  const vx = view[0]*wx + view[4]*wy + view[8]*wz  + view[12];
  const vy = view[1]*wx + view[5]*wy + view[9]*wz  + view[13];
  const vz = view[2]*wx + view[6]*wy + view[10]*wz + view[14];
  const vw = view[3]*wx + view[7]*wy + view[11]*wz + view[15];
  const cx = proj[0]*vx + proj[4]*vy + proj[8]*vz  + proj[12]*vw;
  const cy = proj[1]*vx + proj[5]*vy + proj[9]*vz  + proj[13]*vw;
  const cw = proj[3]*vx + proj[7]*vy + proj[11]*vz + proj[15]*vw;
  if (cw <= 0) return { x: 0, y: 0, visible: false };
  const ndcX = cx / cw;
  const ndcY = cy / cw;
  return {
    x: (ndcX * 0.5 + 0.5) * canvas.width,
    y: (1 - (ndcY * 0.5 + 0.5)) * canvas.height,
    visible: Math.abs(ndcX) < 1.0 && Math.abs(ndcY) < 1.0,
  };
}

// ─── Floating planet labels ───────────────────────────────────────────────────

const labelEls: HTMLDivElement[] = planets.map(p => {
  const div = document.createElement("div");
  div.className = "planet-label";
  div.textContent = p.name;
  document.body.appendChild(div);
  return div;
});

const moonLabelEl = document.createElement("div");
moonLabelEl.className = "planet-label";
moonLabelEl.textContent = "Moon";
document.body.appendChild(moonLabelEl);

const SIDEBAR_W = 220; // px — keep labels out of sidebar

function updateLabels(view: Float32Array, camRadius: number): void {
  // Labels appear when zoomed in enough to see the system
  const globalAlpha = Math.min(1.0, Math.max(0, (camRadius - 5) / 10));

  for (let i = 0; i < planets.length; i++) {
    const p   = planets[i];
    const pos = planetPositions[i];
    const el  = labelEls[i];
    const s   = projectToScreen(pos.x, p.radius * 1.4 + 0.25, pos.z, view, projMatrix);
    if (s.visible && s.x > SIDEBAR_W + 10) {
      el.style.left    = `${s.x}px`;
      el.style.top     = `${s.y}px`;
      el.style.opacity = String(globalAlpha * (i === activePlanetIdx ? 1.0 : 0.50));
    } else {
      el.style.opacity = "0";
    }
  }

  // Moon label
  const ms = projectToScreen(moonPosition.x, 0.18 * 1.4 + 0.1, moonPosition.z, view, projMatrix);
  if (ms.visible && ms.x > SIDEBAR_W + 10) {
    moonLabelEl.style.left    = `${ms.x}px`;
    moonLabelEl.style.top     = `${ms.y}px`;
    moonLabelEl.style.opacity = String(globalAlpha * 0.40);
  } else {
    moonLabelEl.style.opacity = "0";
  }
}

// ─── Click-to-focus (ray cast against planets + moon) ────────────────────────

function raySphereHit(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number,
  r: number
): number {
  const ex = ox - cx, ey = oy - cy, ez = oz - cz;
  const b = ex*dx + ey*dy + ez*dz;
  const c = ex*ex + ey*ey + ez*ez - r*r;
  const disc = b*b - c;
  if (disc < 0) return -1;
  return -b - Math.sqrt(disc);
}

canvas.addEventListener("click", (e) => {
  if ((canvas as any)._dragMoved?.()) return;

  const ndcX =  (e.clientX / canvas.clientWidth)  * 2 - 1;
  const ndcY = -(e.clientY / canvas.clientHeight) * 2 + 1;
  const tanHalf = Math.tan(Math.PI / 6);
  const aspect  = canvas.width / canvas.height;

  const { forward, right, up } = getCameraAxes();
  const [ex, ey, ez] = getCameraEye();

  const rdx = forward[0] + right[0]*ndcX*aspect*tanHalf + up[0]*ndcY*tanHalf;
  const rdy = forward[1] + right[1]*ndcX*aspect*tanHalf + up[1]*ndcY*tanHalf;
  const rdz = forward[2] + right[2]*ndcX*aspect*tanHalf + up[2]*ndcY*tanHalf;
  const rlen = Math.hypot(rdx, rdy, rdz);

  let hitIdx = -1, hitDist = Infinity;

  for (let i = 0; i < planets.length; i++) {
    const { x, z } = planetPositions[i];
    const t = raySphereHit(ex, ey, ez, rdx/rlen, rdy/rlen, rdz/rlen,
                           x, 0, z, planets[i].radius * 1.5);
    if (t > 0 && t < hitDist) { hitDist = t; hitIdx = i; }
  }

  // Check moon
  const mt = raySphereHit(ex, ey, ez, rdx/rlen, rdy/rlen, rdz/rlen,
                          moonPosition.x, 0, moonPosition.z, 0.18 * 1.5);
  if (mt > 0 && mt < hitDist) { hitDist = mt; hitIdx = planets.length; }

  if (hitIdx >= 0 && hitIdx < planets.length) {
    focusPlanet(hitIdx);
  } else if (hitIdx === planets.length) {
    // Moon clicked
    followPlanetIdx = planets.length;
    setFocusTarget(moonPosition.x, moonPosition.z);
    setTargetRadius(3.5);
  } else {
    clearFocus();
    setFocusTarget(0, 0);
    setTargetRadius(68.0);
  }
});

// ─── Shader helpers ──────────────────────────────────────────────────────────

function compileShader(type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(`Shader error:\n${gl.getShaderInfoLog(s)}`);
  return s;
}

function createProgram(vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER,   vert));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(`Program error:\n${gl.getProgramInfoLog(p)}`);
  return p;
}

// ─── Programs ────────────────────────────────────────────────────────────────

const phongProg = createProgram(phongVertSrc, phongFragSrc);
const unlitProg = createProgram(unlitVertSrc, unlitFragSrc);
const ringProg  = createProgram(ringVertSrc,  ringFragSrc);
const atmProg   = createProgram(atmVertSrc,   atmFragSrc);

const ph = {
  aPosition:           gl.getAttribLocation(phongProg,  "aPosition"),
  aNormal:             gl.getAttribLocation(phongProg,  "aNormal"),
  uModel:              gl.getUniformLocation(phongProg, "uModel")!,
  uView:               gl.getUniformLocation(phongProg, "uView")!,
  uProjection:         gl.getUniformLocation(phongProg, "uProjection")!,
  uColor:              gl.getUniformLocation(phongProg, "uColor")!,
  uSecondaryColor:     gl.getUniformLocation(phongProg, "uSecondaryColor")!,
  uLightPos:           gl.getUniformLocation(phongProg, "uLightPos")!,
  uCameraPos:          gl.getUniformLocation(phongProg, "uCameraPos")!,
  uShininess:          gl.getUniformLocation(phongProg, "uShininess")!,
  uTime:               gl.getUniformLocation(phongProg, "uTime")!,
  uPatternType:        gl.getUniformLocation(phongProg, "uPatternType")!,
  uBumpIntensity:      gl.getUniformLocation(phongProg, "uBumpIntensity")!,
  uOccluderPositions:  gl.getUniformLocation(phongProg, "uOccluderPositions")!,
  uOccluderRadii:      gl.getUniformLocation(phongProg, "uOccluderRadii")!,
  uThisPlanet:         gl.getUniformLocation(phongProg, "uThisPlanet")!,
};

const ul = {
  aPosition:   gl.getAttribLocation(unlitProg,  "aPosition"),
  uModel:      gl.getUniformLocation(unlitProg, "uModel")!,
  uView:       gl.getUniformLocation(unlitProg, "uView")!,
  uProjection: gl.getUniformLocation(unlitProg, "uProjection")!,
  uColor:      gl.getUniformLocation(unlitProg, "uColor")!,
  uAlpha:      gl.getUniformLocation(unlitProg, "uAlpha")!,
  uTime:       gl.getUniformLocation(unlitProg, "uTime")!,
  uIsSun:      gl.getUniformLocation(unlitProg, "uIsSun")!,
};

const rg = {
  aPosition:   gl.getAttribLocation(ringProg,  "aPosition"),
  aRadial:     gl.getAttribLocation(ringProg,  "aRadial"),
  uModel:      gl.getUniformLocation(ringProg, "uModel")!,
  uView:       gl.getUniformLocation(ringProg, "uView")!,
  uProjection: gl.getUniformLocation(ringProg, "uProjection")!,
  uRingColor:  gl.getUniformLocation(ringProg, "uRingColor")!,
  uAlpha:      gl.getUniformLocation(ringProg, "uAlpha")!,
};

const at = {
  aPosition:    gl.getAttribLocation(atmProg,  "aPosition"),
  aNormal:      gl.getAttribLocation(atmProg,  "aNormal"),
  uModel:       gl.getUniformLocation(atmProg, "uModel")!,
  uView:        gl.getUniformLocation(atmProg, "uView")!,
  uProjection:  gl.getUniformLocation(atmProg, "uProjection")!,
  uAtmColor:    gl.getUniformLocation(atmProg, "uAtmColor")!,
  uCameraPos:   gl.getUniformLocation(atmProg, "uCameraPos")!,
  uAtmStrength: gl.getUniformLocation(atmProg, "uAtmStrength")!,
};

// Bloom programs
const brightProg    = createProgram(quadVertSrc, brightExtractFragSrc);
const blurProg      = createProgram(quadVertSrc, blurFragSrc);
const compositeProg = createProgram(quadVertSrc, compositeFragSrc);

const bp  = { aPosition: gl.getAttribLocation(brightProg,    "aPosition"), uScene: gl.getUniformLocation(brightProg,    "uScene")! };
const blp = { aPosition: gl.getAttribLocation(blurProg,      "aPosition"), uTex:   gl.getUniformLocation(blurProg,      "uTex")!,  uDir: gl.getUniformLocation(blurProg, "uDir")! };
const cp  = { aPosition: gl.getAttribLocation(compositeProg, "aPosition"), uScene: gl.getUniformLocation(compositeProg, "uScene")!, uBloom: gl.getUniformLocation(compositeProg, "uBloom")!, uStrength: gl.getUniformLocation(compositeProg, "uStrength")! };

// ─── Bloom FBOs ──────────────────────────────────────────────────────────────

interface FBO { fbo: WebGLFramebuffer; tex: WebGLTexture; }

function createColorFBO(w: number, h: number): FBO {
  const fbo = gl.createFramebuffer()!;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

function createSceneFBO(w: number, h: number): FBO & { depth: WebGLRenderbuffer } {
  const { fbo, tex } = createColorFBO(w, h);
  const depth = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, depth };
}

let sceneFBO  = createSceneFBO(canvas.width, canvas.height);
let brightFBO = createColorFBO(canvas.width, canvas.height);
let blurFBO   = createColorFBO(canvas.width, canvas.height);

// ─── Fullscreen quad ──────────────────────────────────────────────────────────

const quadVAO = gl.createVertexArray()!;
gl.bindVertexArray(quadVAO);
const quadBuf = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER,
  new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(bp.aPosition);
gl.vertexAttribPointer(bp.aPosition, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

// ─── Geometry ────────────────────────────────────────────────────────────────

const sphere = generateSphere(48, 48, 1.0);

// Planet VAO (phong)
const sphereVAO = gl.createVertexArray()!;
gl.bindVertexArray(sphereVAO);
const posVBO = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
gl.enableVertexAttribArray(ph.aPosition);
gl.vertexAttribPointer(ph.aPosition, 3, gl.FLOAT, false, 0, 0);
const normVBO = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);
gl.enableVertexAttribArray(ph.aNormal);
gl.vertexAttribPointer(ph.aNormal, 3, gl.FLOAT, false, 0, 0);
const ebo = gl.createBuffer()!;
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
gl.bindVertexArray(null);

// Atmosphere VAO — same sphere data, different attribute locations
const atmVAO = gl.createVertexArray()!;
gl.bindVertexArray(atmVAO);
gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
gl.enableVertexAttribArray(at.aPosition);
gl.vertexAttribPointer(at.aPosition, 3, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
gl.enableVertexAttribArray(at.aNormal);
gl.vertexAttribPointer(at.aNormal, 3, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bindVertexArray(null);

// Sun VAO (unlit)
const sunVAO = gl.createVertexArray()!;
gl.bindVertexArray(sunVAO);
const sunPosVBO = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, sunPosVBO);
gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
gl.enableVertexAttribArray(ul.aPosition);
gl.vertexAttribPointer(ul.aPosition, 3, gl.FLOAT, false, 0, 0);
const sunEBO = gl.createBuffer()!;
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunEBO);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
gl.bindVertexArray(null);

const starfield    = createStarfield(gl, ul.aPosition);
const orbitRing    = createOrbitRingGeometry(gl, ul.aPosition);
const saturnRing   = createRingGeometry(gl, rg.aPosition, rg.aRadial);
const asteroidBelt = createAsteroidBelt(gl, ul.aPosition);

// ─── Planet + moon angles ─────────────────────────────────────────────────────

const planetAngles     = planets.map(p => p.startAngle);
const planetSelfAngles = planets.map(() => 0);
let moonAngle = 0;

const MOON_ORBIT_RADIUS = 1.42;
const MOON_ORBIT_SPEED  = 3.8;
const MOON_RADIUS       = 0.18;

// ─── Render helpers ──────────────────────────────────────────────────────────

function drawOrbitRing(orbitRadius: number, alpha: number): void {
  if (alpha <= 0.01) return;
  let model = mat4Identity();
  model = mat4Scale(model, orbitRadius, 1, orbitRadius);
  gl.uniformMatrix4fv(ul.uModel, false, model);
  gl.uniform3fv(ul.uColor, [0.42, 0.42, 0.50]);
  gl.uniform1f(ul.uAlpha, alpha);
  gl.uniform1i(ul.uIsSun, 0);
  gl.bindVertexArray(orbitRing.vao);
  gl.drawArrays(gl.LINE_LOOP, 0, orbitRing.count);
  gl.bindVertexArray(null);
}

function drawPlanet(
  x: number, y: number, z: number,
  scale: number, selfAngle: number,
  color: [number,number,number],
  secondaryColor: [number,number,number],
  shininess: number,
  patternType: number,
  time: number,
  bumpIntensity: number
): void {
  let model = mat4Identity();
  model = mat4Translate(model, x, y, z);
  model = mat4RotateY(model, selfAngle);
  model = mat4Scale(model, scale, scale, scale);
  gl.uniformMatrix4fv(ph.uModel, false, model);
  gl.uniform3fv(ph.uColor, color);
  gl.uniform3fv(ph.uSecondaryColor, secondaryColor);
  gl.uniform1f(ph.uShininess, shininess);
  gl.uniform1i(ph.uPatternType, patternType);
  gl.uniform1f(ph.uTime, time);
  gl.uniform1f(ph.uBumpIntensity, bumpIntensity);
  gl.bindVertexArray(sphereVAO);
  gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);
}

function drawAtmosphere(
  x: number, z: number,
  planetRadius: number,
  color: [number,number,number],
  strength: number,
  cameraEye: [number,number,number]
): void {
  if (strength < 0.01) return;
  let model = mat4Identity();
  model = mat4Translate(model, x, 0, z);
  model = mat4Scale(model, planetRadius * 1.30, planetRadius * 1.30, planetRadius * 1.30);
  gl.uniformMatrix4fv(at.uModel, false, model);
  gl.uniform3fv(at.uAtmColor, color);
  gl.uniform3fv(at.uCameraPos, cameraEye);
  gl.uniform1f(at.uAtmStrength, strength);
  gl.bindVertexArray(atmVAO);
  gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);
}

function drawSaturnRing(saturnX: number, saturnZ: number, viewMatrix: Float32Array): void {
  gl.useProgram(ringProg);
  gl.uniformMatrix4fv(rg.uView,       false, viewMatrix);
  gl.uniformMatrix4fv(rg.uProjection, false, projMatrix);
  let model = mat4Identity();
  model = mat4Translate(model, saturnX, 0, saturnZ);
  gl.uniformMatrix4fv(rg.uModel,    false, model);
  gl.uniform3fv(rg.uRingColor, [0.88, 0.80, 0.58]);
  gl.uniform1f(rg.uAlpha, 0.82);
  gl.bindVertexArray(saturnRing.vao);
  gl.drawElements(gl.TRIANGLES, saturnRing.count, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);
}

// ─── Render loop ─────────────────────────────────────────────────────────────

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0.0, 0.0, 0.0, 1.0);

let lastTime  = performance.now();
let totalTime = 0;

function render(): void {
  const now   = performance.now();
  const rawDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime    = now;
  const dt    = paused ? 0 : rawDt * speedMult;
  totalTime  += rawDt;

  // Follow selected planet / moon
  if (followPlanetIdx >= 0 && followPlanetIdx < planets.length) {
    setFocusTarget(planetPositions[followPlanetIdx].x, planetPositions[followPlanetIdx].z);
  } else if (followPlanetIdx === planets.length) {
    setFocusTarget(moonPosition.x, moonPosition.z);
  }

  updateCamera();

  const viewMatrix = getViewMatrix();
  const cameraEye  = getCameraEye();
  const camRadius  = getRadius();
  const ringAlpha  = Math.max(0, Math.min(0.42, (camRadius - 10) / 18));

  // ── Render scene into off-screen FBO ──────────────────────────────────────
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO.fbo);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, canvas.width, canvas.height);

  // ── Pass 1: unlit (stars, orbit rings, sun, asteroid belt) ────────────────
  gl.useProgram(unlitProg);
  gl.uniformMatrix4fv(ul.uView,       false, viewMatrix);
  gl.uniformMatrix4fv(ul.uProjection, false, projMatrix);
  gl.uniform1f(ul.uTime, totalTime);

  // Stars
  gl.depthMask(false);
  gl.uniformMatrix4fv(ul.uModel, false, mat4Identity());
  gl.uniform3fv(ul.uColor, [1.0, 1.0, 1.0]);
  gl.uniform1f(ul.uAlpha, 1.0);
  gl.uniform1i(ul.uIsSun, 0);
  gl.bindVertexArray(starfield.vao);
  gl.drawArrays(gl.POINTS, 0, starfield.count);
  gl.bindVertexArray(null);
  gl.depthMask(true);

  // Orbit rings
  for (const planet of planets) {
    drawOrbitRing(planet.orbitRadius, ringAlpha);
  }

  // Asteroid belt — grey points in the same unlit star-mode
  gl.depthMask(false);
  gl.uniformMatrix4fv(ul.uModel, false, mat4Identity());
  gl.uniform3fv(ul.uColor, [0.48, 0.45, 0.42]);
  gl.uniform1f(ul.uAlpha, 1.0);
  gl.uniform1i(ul.uIsSun, 0);
  gl.bindVertexArray(asteroidBelt.vao);
  gl.drawArrays(gl.POINTS, 0, asteroidBelt.count);
  gl.bindVertexArray(null);
  gl.depthMask(true);

  // Sun
  {
    let model = mat4Identity();
    model = mat4Scale(model, SUN_RADIUS, SUN_RADIUS, SUN_RADIUS);
    gl.uniformMatrix4fv(ul.uModel, false, model);
    gl.uniform3fv(ul.uColor, SUN_COLOR);
    gl.uniform1f(ul.uAlpha, 1.0);
    gl.uniform1i(ul.uIsSun, 1);
    gl.bindVertexArray(sunVAO);
    gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  // ── Pass 2: phong planets ──────────────────────────────────────────────────
  gl.useProgram(phongProg);
  gl.uniformMatrix4fv(ph.uView,       false, viewMatrix);
  gl.uniformMatrix4fv(ph.uProjection, false, projMatrix);
  gl.uniform3fv(ph.uLightPos,  [0, 0, 0]);
  gl.uniform3fv(ph.uCameraPos, cameraEye);

  // Occluder data for planet-on-planet shadows
  const occPos   = new Float32Array(27);
  const occRadii = new Float32Array(9);
  for (let i = 0; i < planets.length; i++) {
    occPos[i*3]   = planetPositions[i].x;
    occPos[i*3+1] = 0;
    occPos[i*3+2] = planetPositions[i].z;
    occRadii[i]   = planets[i].radius;
  }
  // Moon at index 8 — casts solar eclipse shadow on Earth
  occPos[24] = moonPosition.x;
  occPos[25] = 0;
  occPos[26] = moonPosition.z;
  occRadii[8] = MOON_RADIUS;
  gl.uniform3fv(ph.uOccluderPositions, occPos);
  gl.uniform1fv(ph.uOccluderRadii, occRadii);

  let saturnX = 0, saturnZ = 0;

  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    planetAngles[i]     += p.orbitSpeed   * dt * 0.4;
    planetSelfAngles[i] += p.selfRotSpeed * dt;

    const x = Math.cos(planetAngles[i]) * p.orbitRadius;
    const z = Math.sin(planetAngles[i]) * p.orbitRadius;

    planetPositions[i].x = x;
    planetPositions[i].z = z;
    if (i === 5) { saturnX = x; saturnZ = z; }

    gl.uniform1i(ph.uThisPlanet, i);
    drawPlanet(x, 0, z, p.radius, planetSelfAngles[i],
      p.color, p.secondaryColor, p.shininess, p.patternType, totalTime, p.bumpIntensity);
  }

  // Moon orbiting Earth
  moonAngle += MOON_ORBIT_SPEED * dt;
  const earthPos = planetPositions[2]; // Earth = index 2
  const moonX    = earthPos.x + Math.cos(moonAngle) * MOON_ORBIT_RADIUS;
  const moonZ    = earthPos.z + Math.sin(moonAngle) * MOON_ORBIT_RADIUS;
  moonPosition.x = moonX;
  moonPosition.z = moonZ;

  gl.uniform1i(ph.uThisPlanet, -1); // no shadow self-exclusion for moon
  drawPlanet(moonX, 0, moonZ, MOON_RADIUS, 0,
    [0.72, 0.70, 0.68], [0.48, 0.46, 0.44],
    10, 0, totalTime, 1.0);

  // ── Pass 3: atmospheric glow (additive, no depth write) ───────────────────
  gl.useProgram(atmProg);
  gl.uniformMatrix4fv(at.uView,       false, viewMatrix);
  gl.uniformMatrix4fv(at.uProjection, false, projMatrix);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.depthMask(false);

  for (let i = 0; i < planets.length; i++) {
    const p   = planets[i];
    const pos = planetPositions[i];
    drawAtmosphere(pos.x, pos.z, p.radius, p.atmosphereColor, p.atmosphereStrength, cameraEye);
  }

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(true);

  // ── Pass 4: Saturn's rings (transparent, after opaque geometry) ───────────
  gl.depthMask(false);
  drawSaturnRing(saturnX, saturnZ, viewMatrix);
  gl.depthMask(true);

  // ── Bloom passes ──────────────────────────────────────────────────────────
  gl.disable(gl.DEPTH_TEST);
  gl.bindVertexArray(quadVAO);

  gl.bindFramebuffer(gl.FRAMEBUFFER, brightFBO.fbo);
  gl.useProgram(brightProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneFBO.tex);
  gl.uniform1i(bp.uScene, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindFramebuffer(gl.FRAMEBUFFER, blurFBO.fbo);
  gl.useProgram(blurProg);
  gl.bindTexture(gl.TEXTURE_2D, brightFBO.tex);
  gl.uniform1i(blp.uTex, 0);
  gl.uniform2f(blp.uDir, 1.0 / canvas.width, 0.0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindFramebuffer(gl.FRAMEBUFFER, brightFBO.fbo);
  gl.bindTexture(gl.TEXTURE_2D, blurFBO.tex);
  gl.uniform2f(blp.uDir, 0.0, 1.0 / canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(compositeProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneFBO.tex);
  gl.uniform1i(cp.uScene, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, brightFBO.tex);
  gl.uniform1i(cp.uBloom, 1);
  gl.uniform1f(cp.uStrength, 1.4);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST);

  // Update floating label positions
  updateLabels(viewMatrix, camRadius);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
