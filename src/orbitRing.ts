export interface OrbitRingBuffers {
  vao: WebGLVertexArrayObject;
  count: number;
}

export function createOrbitRingGeometry(gl: WebGL2RenderingContext, aPosition: number): OrbitRingBuffers {
  const SEGMENTS = 128;
  const positions = new Float32Array(SEGMENTS * 3);

  for (let i = 0; i < SEGMENTS; i++) {
    const theta = (2 * Math.PI * i) / SEGMENTS;
    positions[i * 3 + 0] = Math.cos(theta); // x (radius 1 — scaled per orbit in model matrix)
    positions[i * 3 + 1] = 0;               // y (flat in orbital plane)
    positions[i * 3 + 2] = Math.sin(theta); // z
  }

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  return { vao, count: SEGMENTS };
}
