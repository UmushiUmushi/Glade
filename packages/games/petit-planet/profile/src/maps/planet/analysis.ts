// Waterfalls, read from the map: which sides water falls off, and the straight cliff face a fall
// sits in (rule W2 and the 2D view use both). Pure functions of the map.

import { terrainAt, type MapDoc } from "./model";

const SIDES: [string, number, number][] = [
  ["north", 0, -1],
  ["east", 1, 0],
  ["south", 0, 1],
  ["west", -1, 0],
];

/** Sides a water cell falls off (4-neighbors lower than it). Empty for earth. */
export function fallSides(map: MapDoc, tx: number, ty: number): [string, number, number][] {
  const c = terrainAt(map, tx, ty);
  if (!c?.water) return [];
  return SIDES.filter(([, dx, dy]) => {
    const n = terrainAt(map, tx + dx, ty + dy);
    return !!n && n.h < c.h;
  });
}

/**
 * The straight cliff face through (tx, ty) for a fall in direction (dx, dy): cells at the fall's
 * height whose neighbor across that side is exactly where the fall lands. Anything in front of
 * the face higher or lower than the landing (a step, a terrace, a deeper hole) ends the face there.
 * Returns how far it extends each way.
 */
export function edgeRun(
  map: MapDoc,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
): { back: number; fwd: number; ex: number; ey: number } {
  const h = terrainAt(map, tx, ty)!.h;
  const landing = terrainAt(map, tx + dx, ty + dy)?.h ?? h - 1;
  const [ex, ey] = [dy === 0 ? 0 : 1, dx === 0 ? 0 : 1];
  const isEdge = (x: number, y: number) => {
    const cell = terrainAt(map, x, y);
    const below = terrainAt(map, x + dx, y + dy);
    return !!cell && !!below && cell.h === h && below.h === landing;
  };
  let back = 0;
  while (isEdge(tx - ex * (back + 1), ty - ey * (back + 1))) back++;
  let fwd = 0;
  while (isEdge(tx + ex * (fwd + 1), ty + ey * (fwd + 1))) fwd++;
  return { back, fwd, ex, ey };
}
