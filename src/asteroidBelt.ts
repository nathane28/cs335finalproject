export interface AsteroidBelt {
  vao: WebGLVertexArrayObject;
  count: number;
}

export function createAsteroidBelt(gl: WebGL2RenderingContext, aPositionLoc: number): AsteroidBelt {
  const COUNT = 3200;
  const pos = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Main belt: Mars r=12, Jupiter r=17 → belt sits at 13.8–16.2
    const r = 13.8 + Math.random() * 2.4;
    const h = (Math.random() - 0.5) * 0.7;
    pos[i * 3]     = Math.cos(angle) * r;
    pos[i * 3 + 1] = h;
    pos[i * 3 + 2] = Math.sin(angle) * r;
  }

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  return { vao, count: COUNT };
}
