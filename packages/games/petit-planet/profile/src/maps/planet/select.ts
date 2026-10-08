// Selections in Petit Planet's grids, and the flood fill a click selects with (a water body, a
// level of terrain). Pure; floodRegion only reads.

import { gridSize, inGrid, type Cell, type GridName, type GridSpec, type Rect } from "./space";

/** A selection in the viewer, in Petit Planet's grids. */
export interface Selection {
  /** Rects in any grid; a drag in the viewer posts major rects. */
  rects: Rect[];
  /** Exact cells for a flood selection; rects then hold its bbox. */
  cells?: Cell[];
  /** What was flood-selected, e.g. "water body" or "level-3 terrain". */
  label?: string;
  updated: string;
}

export type Point = [number, number];

/** Connected cells (4-neighborhood) from a seed that satisfy a predicate. */
export function floodRegion(
  spec: GridSpec,
  grid: GridName,
  seed: Point,
  predicate: (x: number, y: number) => boolean,
): Cell[] {
  const { w } = gridSize(spec, grid);
  const [sx, sy] = seed;
  if (!inGrid(spec, grid, sx, sy) || !predicate(sx, sy)) return [];
  const seen = new Set<number>([sy * w + sx]);
  const stack: Point[] = [seed];
  const out: Cell[] = [];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    out.push({ grid, x, y });
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      const k = ny * w + nx;
      if (!inGrid(spec, grid, nx, ny) || seen.has(k) || !predicate(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Bounding rect of a set of cells (all in one grid), or null if empty. */
export function boundingRect(cells: Cell[]): Rect | null {
  if (!cells.length) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of cells) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  return { grid: cells[0].grid, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
