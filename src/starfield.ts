export interface StarfieldBuffers {
  vao: WebGLVertexArrayObject;
  count: number;
}

export function createStarfield(gl: WebGL2RenderingContext, aPosition: number): StarfieldBuffers {
  const STAR_COUNT = 4200;
  const RADIUS = 90;
  const positions = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform random points on a sphere surface (Marsaglia method)
    let x: number, y: number, z: number, d: number;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      d = x * x + y * y + z * z;
    } while (d > 1 || d === 0);
    const scale = RADIUS / Math.sqrt(d);
    positions[i * 3 + 0] = x * scale;
    positions[i * 3 + 1] = y * scale;
    positions[i * 3 + 2] = z * scale;
  }

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  return { vao, count: STAR_COUNT };
}
