// Coordinate spaces. A game defines named grids over one world plane, measured in one world unit
// ("tile", "m"). Origin top-left, x right, y down. Grid cell (i, j) covers the world box [ox +
// i·cw, ox + (i+1)·cw) x [oy + j·ch, oy + (j+1)·ch). Every conversion goes through world boxes: a
// rect in one grid becomes the world box it covers (clipped to the map's bounds), and a box becomes
// the smallest rect of cells in another grid that covers it.

export interface GridDef {
  /** Cell size in world units [w, h]. */
  cell: [number, number];
  /** World position of cell (0, 0)'s top-left corner. */
  origin: [number, number];
  /** Number of cells [cols, rows]. */
  size: [number, number];
  /** One letter for compact cell lists, e.g. "M(3,4)". Defaults to the grid name. */
  abbr?: string;
}

export interface Space {
  /** World unit, e.g. "tile" or "m". */
  unit: string;
  /** The map: world box that every clipped conversion stays inside. */
  bounds: Box;
  grids: Record<string, GridDef>;
  /** Storeys, for games that stack. */
  floors?: { height: number; max: number };
}

/** A world-unit box, x..x+w, y..y+h (half-open), optionally on a floor. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  floor?: number;
}

/** A rect of cells in one grid, inclusive of x..x+w-1, y..y+h-1. */
export interface Rect<G extends string = string> {
  grid: G;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Cell<G extends string = string> {
  grid: G;
  x: number;
  y: number;
}

const EPS = 1e-9;

export class UnknownGridError extends Error {}

export function gridDef(space: Space, grid: string): GridDef {
  const g = space.grids[grid];
  if (!g) {
    throw new UnknownGridError(
      `unknown rect grid "${grid}"; use ${Object.keys(space.grids).join(", ")}`,
    );
  }
  return g;
}

export function gridSize(space: Space, grid: string): { w: number; h: number } {
  const [w, h] = gridDef(space, grid).size;
  return { w, h };
}

export function inGrid(space: Space, grid: string, x: number, y: number): boolean {
  const { w, h } = gridSize(space, grid);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h;
}

/** World box a rect covers, not clipped (edge cells may reach past the bounds). */
export function rectToWorld(space: Space, r: Rect): Box {
  const g = gridDef(space, r.grid);
  return {
    x: g.origin[0] + r.x * g.cell[0],
    y: g.origin[1] + r.y * g.cell[1],
    w: r.w * g.cell[0],
    h: r.h * g.cell[1],
  };
}

/** A box clipped to the map bounds (w and h 0 when fully outside). */
export function clipBox(space: Space, b: Box): Box {
  const B = space.bounds;
  const x0 = Math.max(B.x, b.x);
  const y0 = Math.max(B.y, b.y);
  const x1 = Math.min(B.x + B.w, b.x + b.w);
  const y1 = Math.min(B.y + B.h, b.y + b.h);
  const out: Box = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  return b.floor === undefined ? out : { ...out, floor: b.floor };
}

/** World box a rect covers, clipped to the map. */
export function rectToBox(space: Space, r: Rect): Box {
  return clipBox(space, rectToWorld(space, r));
}

/** The cell of `grid` that contains a world point (not clipped). */
export function worldToCell(space: Space, grid: string, x: number, y: number): Cell {
  const g = gridDef(space, grid);
  return {
    grid,
    x: Math.floor((x - g.origin[0]) / g.cell[0] + EPS),
    y: Math.floor((y - g.origin[1]) / g.cell[1] + EPS),
  };
}

/**
 * Smallest rect of `grid` cells covering a box (cells that overlap it with positive area), with
 * each axis clipped to the map on its own: a box beside the map gives w 0 but keeps its rows.
 */
export function boxToRect(space: Space, box: Box, grid: string): Rect {
  const g = gridDef(space, grid);
  const B = space.bounds;
  const axis = (
    lo: number,
    len: number,
    min: number,
    max: number,
    o: number,
    c: number,
    n: number,
  ) => {
    const a = Math.max(min, lo);
    const b = Math.min(max, lo + len);
    const i0 = Math.max(0, Math.floor((a - o) / c + EPS));
    const i1 = Math.min(n - 1, Math.ceil((b - o) / c - EPS) - 1);
    return [i0, Math.max(0, i1 - i0 + 1)];
  };
  const [x, w] = axis(box.x, box.w, B.x, B.x + B.w, g.origin[0], g.cell[0], g.size[0]);
  const [y, h] = axis(box.y, box.h, B.y, B.y + B.h, g.origin[1], g.cell[1], g.size[1]);
  return { grid, x, y, w, h };
}

/** A rect in another grid covering the same (clipped) world box. */
export function convertRect(space: Space, r: Rect, grid: string): Rect {
  return boxToRect(space, rectToWorld(space, r), grid);
}

/** Grow a rect by `margin` cells on every side, clipped to its grid. */
export function expandRect(space: Space, r: Rect, margin: number): Rect {
  const { w, h } = gridSize(space, r.grid);
  const x0 = Math.max(0, r.x - margin);
  const y0 = Math.max(0, r.y - margin);
  const x1 = Math.min(w - 1, r.x + r.w - 1 + margin);
  const y1 = Math.min(h - 1, r.y + r.h - 1 + margin);
  return { grid: r.grid, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function fullRect(space: Space, grid: string): Rect {
  const { w, h } = gridSize(space, grid);
  return { grid, x: 0, y: 0, w, h };
}

export function* cellsInRect<G extends string>(r: Rect<G>): Generator<Cell<G>> {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) yield { grid: r.grid, x, y };
  }
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** Whether two rects in the same grid share a cell. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Whether two boxes overlap with positive area (floors ignored). */
export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Smallest box around several boxes, or null for none. */
export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Bounding rect of cells in one grid, or null if there are none. */
export function boundingRect<G extends string>(cells: Cell<G>[]): Rect<G> | null {
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

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } | null {
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

// ---- text ----

/** "x 32..47, y 32..47" */
export function rangeText(r: Rect): string {
  const xs = r.w === 1 ? `${r.x}` : `${r.x}..${r.x + r.w - 1}`;
  const ys = r.h === 1 ? `${r.y}` : `${r.y}..${r.y + r.h - 1}`;
  return `x ${xs}, y ${ys}`;
}

/** "<grid> x 32..47, y 32..47" */
export function rectText(r: Rect): string {
  return `${r.grid} ${rangeText(r)}`;
}

/** Compact cell list: "M(3,4) t(5,6) +12 more", using each grid's abbr. */
export function cellsText(space: Space | null, cells: Cell[], max = 12): string {
  const shown = cells
    .slice(0, max)
    .map((c) => `${space?.grids[c.grid]?.abbr ?? c.grid}(${c.x},${c.y})`)
    .join(" ");
  return cells.length > max ? `${shown} +${cells.length - max} more` : shown;
}
