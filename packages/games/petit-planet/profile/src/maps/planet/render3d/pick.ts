// Picking for Petit Planet's 3D view, pure. 3D x = minor x, 3D z = minor y, so a hit maps
// straight to a minor-space point.

import type { V3 } from "@glade/render";
import type { GridSpec } from "../space";

/**
 * The minor-space point for a ray hit on the terrain. A hit on a cliff face lies on the block
 * boundary; nudging it against the face normal lands in the block the face belongs to (the
 * higher one), which is what the pointer is on.
 */
export function hitToMinor(point: V3, normal: V3, spec: GridSpec): { x: number; y: number } {
  const side = Math.abs(normal[1]) < 0.5;
  const e = side ? 0.02 : 0;
  const x = point[0] - normal[0] * e;
  const y = point[2] - normal[2] * e;
  const W = spec.majorW * 2;
  const H = spec.majorH * 2;
  return { x: Math.min(W - 1e-6, Math.max(0, x)), y: Math.min(H - 1e-6, Math.max(0, y)) };
}
