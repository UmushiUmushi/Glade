// Coordinate conventions. Origin top-left, x right, y down, 0-based.
// Three lattices, all expressible on the minor grid (2 minor cells per major cell):
//   major   W x H          (X, Y)    covers minor [2X, 2X+1]
//   minor   2W x 2H        (mx, my)  itself
//   terrain (W+1) x (H+1)  (tx, ty)  centered on major corner (tx, ty), covers minor [2tx-1, 2tx]
// Terrain cells on the outer ring are half off-map: their minor range is clipped.
//
// These are wrappers over the generic Space (@glade/core): one world tile per major cell, minor
// cells half a tile, terrain blocks a tile wide centered on major corners, areas 16 x 16 tiles.
// tests/grid.test.ts proves them equal to the original grid math.

import {
  boxToRect,
  cellKey,
  cellsInRect,
  convertRect as convertSpaceRect,
  expandRect as expandSpaceRect,
  fullRect as fullSpaceRect,
  gridSize as spaceGridSize,
  inGrid as spaceInGrid,
  parseCellKey,
  rectContains,
  rectToWorld,
  rectsIntersect,
  worldToCell,
  type Space,
} from "@glade/core";

export { cellKey, cellsInRect, parseCellKey, rectContains, rectsIntersect };

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

const spaces = new Map<string, Space>();

/** The Space for a map of these dimensions (major, minor, terrain and area grids). */
export function spaceOf(spec: GridSpec): Space {
  const key = `${spec.majorW}x${spec.majorH}/${spec.areaSize}`;
  let s = spaces.get(key);
  if (!s) {
    const { majorW: W, majorH: H, areaSize: A } = spec;
    s = {
      unit: "tile",
      bounds: { x: 0, y: 0, w: W, h: H },
      grids: {
        major: { cell: [1, 1], origin: [0, 0], size: [W, H], abbr: "M" },
        minor: { cell: [0.5, 0.5], origin: [0, 0], size: [2 * W, 2 * H], abbr: "m" },
        terrain: { cell: [1, 1], origin: [-0.5, -0.5], size: [W + 1, H + 1], abbr: "t" },
        area: { cell: [A, A], origin: [0, 0], size: [Math.ceil(W / A), Math.ceil(H / A)] },
      },
    };
    spaces.set(key, s);
  }
  return s;
}

export function gridSize(spec: GridSpec, grid: GridName): { w: number; h: number } {
  return spaceGridSize(spaceOf(spec), grid);
}

export function inGrid(spec: GridSpec, grid: GridName, x: number, y: number): boolean {
  return spaceInGrid(spaceOf(spec), grid, x, y);
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

/** The cell of `grid` under a world point (tiles), unclipped. */
export function cellAtWorld(spec: GridSpec, grid: GridName, x: number, y: number): Cell {
  return worldToCell(spaceOf(spec), grid, x, y) as Cell;
}

// ---- rect conversions ----

function checkGrid(rect: Rect): void {
  if (!["major", "minor", "terrain"].includes(rect.grid)) {
    throw new Error(
      `unknown rect grid "${(rect as { grid: string }).grid}"; use major, minor or terrain ` +
        `(for areas in scripts: rects.area(spec, column, row))`,
    );
  }
}

/** Minor-grid rect covering `rect`, clipped to the map. Returns w/h 0 if fully off-map. */
export function toMinorRect(spec: GridSpec, rect: Rect): Rect {
  checkGrid(rect);
  return convertSpaceRect(spaceOf(spec), rect, "minor") as Rect;
}

/**
 * Smallest rect in `grid` covering every minor cell of `rect`. Major -> terrain gives all
 * overlapping terrain cells, so a w-wide major rect becomes w+1 terrain cells.
 */
export function convertRect(spec: GridSpec, rect: Rect, grid: GridName): Rect {
  checkGrid(rect);
  const space = spaceOf(spec);
  const m = toMinorRect(spec, rect);
  if (grid === "minor" || m.w === 0 || m.h === 0) return { ...m, grid };
  return boxToRect(space, rectToWorld(space, m), grid) as Rect;
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

/** Grow a rect by `margin` on every side, clipped to its grid. */
export function expandRect(spec: GridSpec, rect: Rect, margin: number): Rect {
  return expandSpaceRect(spaceOf(spec), rect, margin) as Rect;
}

export function fullRect(spec: GridSpec, grid: GridName): Rect {
  return fullSpaceRect(spaceOf(spec), grid) as Rect;
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

/** Rect input with the "area" shorthand (x, y: 1-based area column and row; w, h in areas). */
export function normRect(
  profile: { areaSize: number },
  r: { grid: string; x: number; y: number; w?: number; h?: number },
): Rect {
  const w = r.w ?? 1;
  const h = r.h ?? 1;
  if (r.grid === "area") {
    const s = profile.areaSize;
    return { grid: "major", x: (r.x - 1) * s, y: (r.y - 1) * s, w: w * s, h: h * s };
  }
  return { grid: r.grid as Rect["grid"], x: r.x, y: r.y, w, h };
}
