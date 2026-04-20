// All matrices are column-major Float32Array[16] (matches WebGL convention)

export type Mat4 = Float32Array;

export function mat4Identity(): Mat4 {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function mat4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1.0 / Math.tan(fovY / 2);
  const rangeInv = 1.0 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0,                         0,  0,
    0,          f,                         0,  0,
    0,          0, (near + far) * rangeInv, -1,
    0,          0, near * far * rangeInv * 2, 0,
  ]);
}

export function mat4LookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Mat4 {
  const f = normalize([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]]);
  const s = normalize(cross(f, up));
  const u = cross(s, f);

  // prettier-ignore
  return new Float32Array([
     s[0],  u[0], -f[0], 0,
     s[1],  u[1], -f[1], 0,
     s[2],  u[2], -f[2], 0,
    -dot(s, eye), -dot(u, eye), dot(f, eye), 1,
  ]);
}

export function mat4Translate(m: Mat4, tx: number, ty: number, tz: number): Mat4 {
  const t = mat4Identity();
  t[12] = tx; t[13] = ty; t[14] = tz;
  return mat4Multiply(m, t);
}

export function mat4Scale(m: Mat4, sx: number, sy: number, sz: number): Mat4 {
  const s = mat4Identity();
  s[0] = sx; s[5] = sy; s[10] = sz;
  return mat4Multiply(m, s);
}

export function mat4RotateY(m: Mat4, angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r = mat4Identity();
  r[0] = c;  r[8] = s;
  r[2] = -s; r[10] = c;
  return mat4Multiply(m, r);
}

// --- vector helpers ---

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
