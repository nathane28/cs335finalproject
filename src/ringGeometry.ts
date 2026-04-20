export interface RingBuffers { vao: WebGLVertexArrayObject; count: number; }

// Flat annulus in the XZ plane (Y=0).
// Each vertex: vec3 position + float uRadial (0=inner edge, 1=outer edge).
export function createRingGeometry(
  gl: WebGL2RenderingContext,
  aPosition: number,
  aRadial: number,
  innerRadius = 2.2,
  outerRadius = 4.0,
  segments    = 128,
): RingBuffers {
  const vertCount = (segments + 1) * 2;
  const positions = new Float32Array(vertCount * 3);
  const radials   = new Float32Array(vertCount);

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const base = i * 2;

    // inner vertex
    positions[base * 3 + 0] = cos * innerRadius;
    positions[base * 3 + 1] = 0;
    positions[base * 3 + 2] = sin * innerRadius;
    radials[base] = 0.0;

    // outer vertex
    positions[(base + 1) * 3 + 0] = cos * outerRadius;
    positions[(base + 1) * 3 + 1] = 0;
    positions[(base + 1) * 3 + 2] = sin * outerRadius;
    radials[base + 1] = 1.0;
  }

  // Triangle strip indices
  const indices = new Uint16Array(segments * 6);
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    indices[i * 6 + 0] = b;
    indices[i * 6 + 1] = b + 1;
    indices[i * 6 + 2] = b + 2;
    indices[i * 6 + 3] = b + 1;
    indices[i * 6 + 4] = b + 3;
    indices[i * 6 + 5] = b + 2;
  }

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const posBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

  const radBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, radBuf);
  gl.bufferData(gl.ARRAY_BUFFER, radials, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aRadial);
  gl.vertexAttribPointer(aRadial, 1, gl.FLOAT, false, 0, 0);

  const idxBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  return { vao, count: indices.length };
}
