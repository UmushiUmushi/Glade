// The original grid math, kept verbatim as the oracle for tests/grid.test.ts equivalence checks
//. Do not use outside tests.

// Coordinate conventions. Origin top-left, x right, y down, 0-based.
// Three lattices, all expressible on the minor grid (2 minor cells per major cell):
//   major   W x H          (X, Y)    covers minor [2X, 2X+1]
//   minor   2W x 2H        (mx, my)  itself
//   terrain (W+1) x (H+1)  (tx, ty)  centered on major corner (tx, ty), covers minor [2tx-1, 2tx]
// Terrain cells on the outer ring are half off-map: their minor range is clipped.

export type GridName = "major" | "minor" | "terrain";

export interface Cell {
  grid: GridName;
  x: number;
  y: number;
}

/** Inclusive of x..x+w-1, y..y+h-1. */
export interface Rect {
  grid: GridName;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Map dimensions in major cells. Minor is always 2x, terrain is always +1. */
export interface GridSpec {
  majorW: number;
  majorH: number;
  areaSize: number;
}

export const MINOR_PER_MAJOR = 2;

export function gridSize(spec: GridSpec, grid: GridName): { w: number; h: number } {
  switch (grid) {
    case "major":
      return { w: spec.majorW, h: spec.majorH };
    case "minor":
      return { w: spec.majorW * 2, h: spec.majorH * 2 };
    case "terrain":
      return { w: spec.majorW + 1, h: spec.majorH + 1 };
  }
}

export function inGrid(spec: GridSpec, grid: GridName, x: number, y: number): boolean {
  const { w, h } = gridSize(spec, grid);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h;
}

// ---- 1D conversions (apply per axis) ----

export function majorOfMinor(m: number): number {
  return Math.floor(m / 2);
}

export function terrainOfMinor(m: number): number {
  return Math.floor((m + 1) / 2);
}

/** Minor range [lo, hi] covered by a major index. */
export function minorRangeOfMajor(M: number): [number, number] {
  return [2 * M, 2 * M + 1];
}

/** Minor range [lo, hi] covered by a terrain index, unclipped (may be -1 or 2W). */
export function minorRangeOfTerrain(t: number): [number, number] {
  return [2 * t - 1, 2 * t];
}

/** Major indices [lo, hi] a terrain index overlaps, unclipped. */
export function majorRangeOfTerrain(t: number): [number, number] {
  return [t - 1, t];
}

/** Terrain indices [lo, hi] a major index overlaps. */
export function terrainRangeOfMajor(M: number): [number, number] {
  return [M, M + 1];
}

// ---- cell conversions ----

/** The four terrain cells a major cell overlaps (its four corners), in row order. */
export function terrainCellsOfMajor(X: number, Y: number): Cell[] {
  return [
    { grid: "terrain", x: X, y: Y },
    { grid: "terrain", x: X + 1, y: Y },
    { grid: "terrain", x: X, y: Y + 1 },
    { grid: "terrain", x: X + 1, y: Y + 1 },
  ];
}

/** The on-map major cells a terrain cell overlaps (up to four). */
export function majorCellsOfTerrain(spec: GridSpec, tx: number, ty: number): Cell[] {
  const out: Cell[] = [];
  for (let Y = ty - 1; Y <= ty; Y++) {
    for (let X = tx - 1; X <= tx; X++) {
      if (inGrid(spec, "major", X, Y)) out.push({ grid: "major", x: X, y: Y });
    }
  }
  return out;
}

/** Convert a cell to the minor cells it covers (clipped to the map). */
export function minorRectOfCell(spec: GridSpec, cell: Cell): Rect {
  return toMinorRect(spec, { grid: cell.grid, x: cell.x, y: cell.y, w: 1, h: 1 });
}

/** The cell in `grid` that contains a minor cell. */
export function cellOfMinor(grid: GridName, mx: number, my: number): Cell {
  switch (grid) {
    case "minor":
      return { grid, x: mx, y: my };
    case "major":
      return { grid, x: majorOfMinor(mx), y: majorOfMinor(my) };
    case "terrain":
      return { grid, x: terrainOfMinor(mx), y: terrainOfMinor(my) };
  }
}

// ---- rect conversions ----

/** Minor-grid rect covering `rect`, clipped to the map. Returns w/h 0 if fully off-map. */
export function toMinorRect(spec: GridSpec, rect: Rect): Rect {
  let x0: number, x1: number, y0: number, y1: number;
  switch (rect.grid) {
    case "minor":
      [x0, x1, y0, y1] = [rect.x, rect.x + rect.w - 1, rect.y, rect.y + rect.h - 1];
      break;
    case "major":
      [x0, x1] = [2 * rect.x, 2 * (rect.x + rect.w) - 1];
      [y0, y1] = [2 * rect.y, 2 * (rect.y + rect.h) - 1];
      break;
    case "terrain":
      [x0, x1] = [2 * rect.x - 1, 2 * (rect.x + rect.w - 1)];
      [y0, y1] = [2 * rect.y - 1, 2 * (rect.y + rect.h - 1)];
      break;
    default:
      throw new Error(
        `unknown rect grid "${(rect as { grid: string }).grid}"; use major, minor or terrain ` +
          `(for areas in scripts: rects.area(spec, column, row))`,
      );
  }
  const { w, h } = gridSize(spec, "minor");
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(w - 1, x1);
  y1 = Math.min(h - 1, y1);
  return { grid: "minor", x: x0, y: y0, w: Math.max(0, x1 - x0 + 1), h: Math.max(0, y1 - y0 + 1) };
}

/**
 * Smallest rect in `grid` covering every minor cell of `rect`. Major -> terrain gives all
 * overlapping terrain cells, so a w-wide major rect becomes w+1 terrain cells.
 */
export function convertRect(spec: GridSpec, rect: Rect, grid: GridName): Rect {
  const m = toMinorRect(spec, rect);
  if (grid === "minor" || m.w === 0 || m.h === 0) return { ...m, grid };
  const lo = cellOfMinor(grid, m.x, m.y);
  const hi = cellOfMinor(grid, m.x + m.w - 1, m.y + m.h - 1);
  return { grid, x: lo.x, y: lo.y, w: hi.x - lo.x + 1, h: hi.y - lo.y + 1 };
}

/** The rect echoed in all three grids, for tool outputs. */
export function rectInAllGrids(
  spec: GridSpec,
  rect: Rect,
): { major: Rect; minor: Rect; terrain: Rect } {
  return {
    major: convertRect(spec, rect, "major"),
    minor: convertRect(spec, rect, "minor"),
    terrain: convertRect(spec, rect, "terrain"),
  };
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Grow a rect by `margin` on every side, clipped to its grid. */
export function expandRect(spec: GridSpec, rect: Rect, margin: number): Rect {
  const { w, h } = gridSize(spec, rect.grid);
  const x0 = Math.max(0, rect.x - margin);
  const y0 = Math.max(0, rect.y - margin);
  const x1 = Math.min(w - 1, rect.x + rect.w - 1 + margin);
  const y1 = Math.min(h - 1, rect.y + rect.h - 1 + margin);
  return { grid: rect.grid, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function fullRect(spec: GridSpec, grid: GridName): Rect {
  const { w, h } = gridSize(spec, grid);
  return { grid, x: 0, y: 0, w, h };
}

export function* cellsInRect(rect: Rect): Generator<Cell> {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) yield { grid: rect.grid, x, y };
  }
}

// ---- areas ----
// 16 x 16 major cells each. (aX, aY) is 0-based internally; user-facing names are 1-based
// ("area column 6 row 6" = aX 5, aY 5).

export function areaOfMajor(spec: GridSpec, X: number, Y: number): { aX: number; aY: number } {
  return { aX: Math.floor(X / spec.areaSize), aY: Math.floor(Y / spec.areaSize) };
}

export function areaRect(spec: GridSpec, aX: number, aY: number): Rect {
  const s = spec.areaSize;
  return { grid: "major", x: aX * s, y: aY * s, w: s, h: s };
}

/** 1-based user-facing column/row to the 0-based area rect. */
export function areaRectFromLabel(spec: GridSpec, column: number, row: number): Rect {
  return areaRect(spec, column - 1, row - 1);
}

export function areaLabel(aX: number, aY: number): string {
  return `area column ${aX + 1} row ${aY + 1}`;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } | null {
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/**
 * Parse a rect written on a command line: "major:32,32,16,16", "minor:...", "terrain:...",
 * "area:3,3" (1-based column,row), or "all" (the whole map).
 */
export function parseRectSpec(spec: GridSpec, text: string): Rect {
  if (text === "all") return fullRect(spec, "major");
  const [grid, nums] = text.split(":");
  const n = (nums ?? "").split(",").map(Number);
  if (grid === "area" && n.length === 2 && n.every(Number.isInteger)) {
    return areaRectFromLabel(spec, n[0], n[1]);
  }
  if (["major", "minor", "terrain"].includes(grid) && n.length === 4 && n.every(Number.isInteger)) {
    return { grid: grid as GridName, x: n[0], y: n[1], w: n[2], h: n[3] };
  }
  throw new Error(
    `bad rect "${text}": use major:x,y,w,h | minor:x,y,w,h | terrain:x,y,w,h | area:col,row | all`,
  );
}
