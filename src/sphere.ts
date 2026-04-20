export interface SphereMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
}

export function generateSphere(stacks: number, slices: number, radius: number): SphereMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let stack = 0; stack <= stacks; stack++) {
    const phi = (Math.PI * stack) / stacks; // 0 (north pole) → π (south pole)
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let slice = 0; slice <= slices; slice++) {
      const theta = (2 * Math.PI * slice) / slices;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const nx = cosTheta * sinPhi;
      const ny = cosPhi;
      const nz = sinTheta * sinPhi;

      positions.push(radius * nx, radius * ny, radius * nz);
      normals.push(nx, ny, nz);
    }
  }

  for (let stack = 0; stack < stacks; stack++) {
    for (let slice = 0; slice < slices; slice++) {
      const a = stack * (slices + 1) + slice;
      const b = a + slices + 1;

      // two triangles per quad
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}
