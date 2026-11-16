import * as THREE from "three";

/**
 * Creates a faceted, puffy 5-pointed Origami Lucky Star geometry.
 * Non-indexed triangles ensure crisp paper-fold normals across all 20 facets.
 */
export function createOrigamiStarGeometry(
  outerRadius = 1.0,
  innerRadius = 0.55,
  puffDepth = 0.44
): THREE.BufferGeometry {
  const rimPoints: Array<[number, number, number]> = [];
  const totalTips = 10;

  for (let i = 0; i < totalTips; i++) {
    const angle = (i / totalTips) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    rimPoints.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
  }

  const positions: number[] = [];

  const pushTriangle = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number]
  ): void => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  const frontApex: [number, number, number] = [0, 0, puffDepth];
  const backApex: [number, number, number] = [0, 0, -puffDepth];

  for (let i = 0; i < totalTips; i++) {
    const current = rimPoints[i];
    const next = rimPoints[(i + 1) % totalTips];

    // Front puff facets (CCW winding facing +Z)
    pushTriangle(frontApex, current, next);
    // Back puff facets (CCW winding facing -Z)
    pushTriangle(backApex, next, current);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}
