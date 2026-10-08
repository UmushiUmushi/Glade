// Corner shapes: paths, water and cliffs can have cut (straight) or rounded corners, as in the
// game's scissors tool. A shape is stored on a vertex, the point where four cells meet, and applies
// where exactly one of the four differs from the other three:
//
// outer  the odd cell stands out (a path cell, a water block, a raised block): its corner is
// trimmed, and the trimmed part takes the other three's value (ground, bank, the level below).
// inner  the odd cell is a notch (a bank block beside three water blocks, a low block beside three
// high ones): its corner is filled with the other three's value. Water and cliffs only: a path's
// inner corner (the inside of an L) stays square.
//
// Either way the odd cell's corner region takes the other three's value. The region reaches
// `profile.corners` tiles along each edge from the vertex: a whole cell for paths, half a block for
// water and cliffs, so a five-block plus of water with every corner cut is a diamond.
//
// Where a vertex has no single odd cell (flat ground, a straight edge) a shape does nothing. A
// cliff corner whose three other blocks are not at one level sits over a gap and cannot be shaped
// (rule T5); nor can a corner between two path types, an inner path corner, or a corner of a lone
// path cell (P3). Pure.

import {
  cornerAt,
  cornerGrid,
  pathAt,
  terrainAt,
  type CornerLayer,
  type CornerShape,
  type MapDoc,
  type TerrainCell,
} from "./model";
import { isTerrainLocked, type Profile } from "./profile";

export type { CornerShape };
export type CornerName = "nw" | "ne" | "se" | "sw";
export type CornerKind = "path" | "water" | "cliff";
export type Pt = [number, number];

/** Direction from a cell's center to each of its corners. */
export const CORNER_DIRS: Record<CornerName, Pt> = {
  nw: [-1, -1],
  ne: [1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

export const CORNER_NAMES = Object.keys(CORNER_DIRS) as CornerName[];

export function cornerName([sx, sy]: Pt): CornerName {
  return sy < 0 ? (sx < 0 ? "nw" : "ne") : sx < 0 ? "sw" : "se";
}

interface CornerBase {
  layer: CornerLayer;
  /** The vertex, in its layer's grid (terrain corners: major; path corners: terrain). */
  vx: number;
  vy: number;
  shape: CornerShape;
  side: "outer" | "inner";
  /** The odd cell (terrain block or major cell) whose corner region changes. */
  cell: { x: number; y: number };
  /** Direction from the odd cell's center to the vertex. */
  dir: Pt;
  /** Reach along each edge from the vertex, in tiles. */
  leg: number;
}

export interface TerrainCorner extends CornerBase {
  kind: "water" | "cliff";
  own: TerrainCell;
  /** What the odd block's corner region becomes: the other three blocks' height and water. */
  surround: TerrainCell;
}

export interface PathCorner extends CornerBase {
  kind: "path";
  side: "outer";
  /** The path cell's type; its corner region becomes open ground. */
  own: string;
}

export type Resolution<C> =
  | { status: "shaped"; corner: C }
  | { status: "inert"; reason: string }
  | { status: "invalid"; reason: string; hint: string };

// ---- vertices ----

/**
 * The four cells around a vertex with each one's direction to it, in the order nw, ne, sw, se of
 * the vertex. Terrain vertex (X, Y) is where blocks X..X+1, Y..Y+1 meet; path vertex (tx, ty) is
 * where major cells tx-1..tx, ty-1..ty meet.
 */
export function vertexCells(layer: CornerLayer, vx: number, vy: number) {
  const base = layer === "terrainCorners" ? 0 : -1;
  return [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].map(([i, j]) => ({ x: vx + base + i, y: vy + base + j, dir: [1 - 2 * i, 1 - 2 * j] as Pt }));
}

/** The vertex at a cell's corner (terrain blocks for terrainCorners, major cells for paths). */
export function vertexOf(
  layer: CornerLayer,
  x: number,
  y: number,
  [sx, sy]: Pt,
): { x: number; y: number } {
  const [i, j] = [(1 - sx) / 2, (1 - sy) / 2];
  const base = layer === "terrainCorners" ? 0 : 1;
  return { x: x - i + base, y: y - j + base };
}

/** A vertex's position in tiles (world units / 2). */
export function vertexPoint(layer: CornerLayer, vx: number, vy: number): Pt {
  return layer === "terrainCorners" ? [vx + 0.5, vy + 0.5] : [vx, vy];
}

/**
 * Which of four values is the odd one (the other three equal each other and differ from it), or
 * why there is none: all equal ("flat"), two by two along a line ("edge"), or neither ("mixed").
 * Values are in the order nw, ne, sw, se.
 */
export function oddOne<V>(
  vals: V[],
  eq: (a: V, b: V) => boolean,
): number | "flat" | "edge" | "mixed" {
  if (vals.every((v) => eq(v, vals[0]))) return "flat";
  for (let k = 0; k < 4; k++) {
    const others = vals.filter((_, i) => i !== k);
    if (others.every((v) => eq(v, others[0])) && !eq(vals[k], others[0])) return k;
  }
  const [nw, ne, sw, se] = vals;
  if ((eq(nw, ne) && eq(sw, se)) || (eq(nw, sw) && eq(ne, se))) return "edge";
  return "mixed";
}

const sameTerrain = (a: TerrainCell, b: TerrainCell) => a.h === b.h && a.water === b.water;

// ---- resolution ----

/**
 * What a terrain vertex's shape does. `shape` defaults to the one stored on the map; with none
 * stored the vertex is inert.
 */
export function resolveTerrainCorner(
  map: MapDoc,
  profile: Profile,
  X: number,
  Y: number,
  shape: CornerShape | undefined = cornerAt(map, "terrainCorners", X, Y),
): Resolution<TerrainCorner> {
  if (!shape) return { status: "inert", reason: "square" };
  const cells = vertexCells("terrainCorners", X, Y);
  const vals = cells.map((c) => terrainAt(map, c.x, c.y));
  if (vals.some((v) => !v)) {
    return { status: "invalid", reason: "off the map", hint: "shape corners on the island" };
  }
  const t = vals as TerrainCell[];
  const odd = oddOne(t, sameTerrain);
  if (odd === "flat") return { status: "inert", reason: "flat ground, no corner here" };
  if (odd === "edge") return { status: "inert", reason: "a straight edge, no corner here" };
  if (odd === "mixed") {
    const hs = t.map((c) => c.h);
    const max = Math.max(...hs);
    const min = Math.min(...hs);
    // A block alone at the top (or the bottom) is a corner, but the others are not level.
    const lone = [max, min].find((e) => hs.filter((h) => h === e).length === 1);
    const level = (k: number) => new Set(hs.filter((_, i) => i !== k)).size === 1;
    if (lone !== undefined && max !== min && level(hs.indexOf(lone))) {
      return {
        status: "invalid",
        reason: "water and ground meet unevenly at this cliff corner",
        hint: "shape water corners where the blocks around are at one level, cliffs where they are dry",
      };
    }
    if (lone !== undefined && max !== min) {
      const k = hs.indexOf(lone);
      const others = hs.filter((_, i) => i !== k).join(", ");
      const what = lone === max ? "cliff corner over a gap" : "cliff notch between uneven levels";
      return {
        status: "invalid",
        reason:
          `${what}: block ${cells[k].x},${cells[k].y} (level ${lone}) has ` +
          `levels ${others} around it, not one level`,
        hint:
          "a cliff corner can be cut or rounded only when the three blocks around it are at one " +
          "level; fill the gap below the corner, or leave the corner square",
      };
    }
    return {
      status: "invalid",
      reason: "no single corner here (blocks meet diagonally or unevenly)",
      hint: "shape a vertex where exactly one of the four blocks differs from the other three",
    };
  }
  const own = t[odd];
  const surround = t[odd === 0 ? 1 : 0];
  const { x, y, dir } = cells[odd];
  if (isTerrainLocked(profile, x, y)) {
    return {
      status: "invalid",
      reason: `the corner's block ${x},${y} is locked terrain`,
      hint: "corners on the beach border or the town center cannot be shaped",
    };
  }
  const base = { layer: "terrainCorners" as const, vx: X, vy: Y, shape, cell: { x, y }, dir };
  const leg = profile.corners.terrain;
  if (own.h === surround.h) {
    const side = own.water ? "outer" : "inner";
    return { status: "shaped", corner: { ...base, kind: "water", side, leg, own, surround } };
  }
  const side = own.h > surround.h ? "outer" : "inner";
  if (own.water || (side === "inner" && surround.water)) {
    return {
      status: "invalid",
      reason: "water at the top of a cliff corner (it would fall off a corner)",
      hint: "shape the cliff corner where its top is dry ground",
    };
  }
  return { status: "shaped", corner: { ...base, kind: "cliff", side, leg, own, surround } };
}

/** What a path vertex's shape does (see resolveTerrainCorner). */
export function resolvePathCorner(
  map: MapDoc,
  profile: Profile,
  tx: number,
  ty: number,
  shape: CornerShape | undefined = cornerAt(map, "pathCorners", tx, ty),
): Resolution<PathCorner> {
  if (!shape) return { status: "inert", reason: "square" };
  const cells = vertexCells("pathCorners", tx, ty);
  const vals = cells.map((c) => pathAt(map, c.x, c.y) ?? null);
  const odd = oddOne(vals, (a, b) => a === b);
  if (odd === "flat") {
    return { status: "inert", reason: vals[0] ? "inside a path" : "no path here" };
  }
  if (odd === "edge") return { status: "inert", reason: "a straight path edge, no corner here" };
  if (odd === "mixed") {
    return {
      status: "invalid",
      reason: "no single path corner here (cells meet diagonally or with several types)",
      hint: "shape a vertex where exactly one of the four cells differs from the other three",
    };
  }
  const own = vals[odd];
  const surround = vals[odd === 0 ? 1 : 0];
  const { x, y, dir } = cells[odd];
  if (own !== null && surround !== null) {
    return {
      status: "invalid",
      reason: `corner between two path types (${own}, ${surround})`,
      hint: "different path types never merge; shape corners where a path meets open ground",
    };
  }
  if (own === null) {
    return {
      status: "invalid",
      reason: `inner path corner (the notch at major ${x},${y})`,
      hint: "paths have outer corners only; inner corners can be shaped on water and cliffs",
    };
  }
  const joined = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => pathAt(map, x + dx, y + dy) === own);
  if (!joined) {
    return {
      status: "invalid",
      reason: `major ${x},${y} is a lone path cell`,
      hint: "a one-cell path cannot be cut or rounded; extend the path first",
    };
  }
  return {
    status: "shaped",
    corner: {
      layer: "pathCorners",
      kind: "path",
      vx: tx,
      vy: ty,
      shape,
      side: "outer",
      cell: { x, y },
      dir,
      leg: profile.corners.path,
      own,
    },
  };
}

export function resolveCorner(
  map: MapDoc,
  profile: Profile,
  layer: CornerLayer,
  x: number,
  y: number,
  shape?: CornerShape,
): Resolution<TerrainCorner | PathCorner> {
  return layer === "terrainCorners"
    ? resolveTerrainCorner(map, profile, x, y, shape ?? cornerAt(map, layer, x, y))
    : resolvePathCorner(map, profile, x, y, shape ?? cornerAt(map, layer, x, y));
}

/** Shaped corners whose odd cell is terrain block (tx, ty), at most one per corner. */
export function blockCorners(
  map: MapDoc,
  profile: Profile,
  tx: number,
  ty: number,
): TerrainCorner[] {
  return cellCorners("terrainCorners", tx, ty, (x, y) =>
    resolveTerrainCorner(map, profile, x, y),
  ) as TerrainCorner[];
}

/** Shaped corners whose odd cell is major cell (X, Y). */
export function pathCellCorners(map: MapDoc, profile: Profile, X: number, Y: number): PathCorner[] {
  return cellCorners("pathCorners", X, Y, (x, y) =>
    resolvePathCorner(map, profile, x, y),
  ) as PathCorner[];
}

function cellCorners(
  layer: CornerLayer,
  x: number,
  y: number,
  resolve: (vx: number, vy: number) => Resolution<TerrainCorner | PathCorner>,
): (TerrainCorner | PathCorner)[] {
  const out: (TerrainCorner | PathCorner)[] = [];
  for (const name of CORNER_NAMES) {
    const v = vertexOf(layer, x, y, CORNER_DIRS[name]);
    const r = resolve(v.x, v.y);
    if (r.status === "shaped" && r.corner.cell.x === x && r.corner.cell.y === y) out.push(r.corner);
  }
  return out;
}

// ---- geometry (tiles; renderers scale) ----

/** Steps in a rounded corner's arc. */
export const ARC_STEPS = 6;

/**
 * The boundary between an odd cell's corner region and the rest of it, from the point `leg` along
 * the edge running in x from the vertex to the point `leg` along the edge running in y. A cut is a
 * straight line; a round is a quarter circle centered `leg` in from the vertex on both axes, so it
 * bulges toward the vertex.
 */
export function cornerCurve(V: Pt, dir: Pt, leg: number, shape: CornerShape): Pt[] {
  const [sx, sy] = dir;
  const a: Pt = [V[0] - sx * leg, V[1]];
  const b: Pt = [V[0], V[1] - sy * leg];
  if (shape === "cut") return [a, b];
  const O: Pt = [V[0] - sx * leg, V[1] - sy * leg];
  const out: Pt[] = [];
  for (let k = 0; k <= ARC_STEPS; k++) {
    const th = (k / ARC_STEPS) * (Math.PI / 2);
    out.push([O[0] + sx * leg * Math.sin(th), O[1] + sy * leg * Math.cos(th)]);
  }
  out[0] = a;
  out[ARC_STEPS] = b;
  return out;
}

/** The corner region itself: the vertex and the curve. */
export function cornerRegion(V: Pt, dir: Pt, leg: number, shape: CornerShape): Pt[] {
  return [V, ...cornerCurve(V, dir, leg, shape)];
}

/** Whether a point lies strictly inside a corner region. */
export function inCornerRegion(
  p: Pt,
  V: Pt,
  [sx, sy]: Pt,
  leg: number,
  shape: CornerShape,
): boolean {
  const u = (V[0] - p[0]) * sx;
  const w = (V[1] - p[1]) * sy;
  if (u <= 0 || w <= 0 || u >= leg || w >= leg) return false;
  if (shape === "cut") return u + w < leg;
  return (leg - u) ** 2 + (leg - w) ** 2 > leg * leg;
}

/**
 * A cell's square [x0, x1] x [y0, y1] with the given corners replaced by their curves, clockwise
 * from the north-west (y down). Corners are given by their direction from the cell's center.
 */
export function trimmedSquare(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  cuts: { dir: Pt; leg: number; shape: CornerShape }[],
): Pt[] {
  const out: Pt[] = [];
  const corners: [Pt, Pt][] = [
    [
      [x0, y0],
      [-1, -1],
    ],
    [
      [x1, y0],
      [1, -1],
    ],
    [
      [x1, y1],
      [1, 1],
    ],
    [
      [x0, y1],
      [-1, 1],
    ],
  ];
  for (const [V, d] of corners) {
    const cut = cuts.find((c) => c.dir[0] === d[0] && c.dir[1] === d[1]);
    if (!cut) {
      out.push(V);
      continue;
    }
    const curve = cornerCurve(V, d, cut.leg, cut.shape);
    // Walking clockwise, the north-east and south-west corners meet the x edge first.
    out.push(...(d[0] * d[1] < 0 ? curve : curve.reverse()));
  }
  // A corner reaching the whole cell ends on the next corner: drop repeated points.
  const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  return out.filter((p, i) => !same(p, out[(i + 1) % out.length]));
}

/**
 * A path cell's surface in tiles, with its path type: the cell trimmed by its outer corners.
 * "square" for a plain path cell, null for no path.
 */
export function pathCellRegions(
  map: MapDoc,
  profile: Profile,
  X: number,
  Y: number,
): { pts: Pt[]; type: string }[] | "square" | null {
  const type = pathAt(map, X, Y);
  if (!type) return null;
  // Most cells have no shape stored on any of their four vertices.
  const shapes = cornerGrid(map, "pathCorners");
  const stored =
    !!shapes &&
    !!(shapes[Y]?.[X] || shapes[Y]?.[X + 1] || shapes[Y + 1]?.[X] || shapes[Y + 1]?.[X + 1]);
  if (!stored) return "square";
  const corners = pathCellCorners(map, profile, X, Y);
  if (!corners.length) return "square";
  const cuts = corners.map((c) => ({ dir: c.dir, leg: c.leg, shape: c.shape }));
  return [{ pts: trimmedSquare(X, X + 1, Y, Y + 1, cuts), type }];
}

/** Terrain corner regions around a point (tiles), for sampling what the ground is there. */
export function terrainCornerAt(map: MapDoc, profile: Profile, p: Pt): TerrainCorner | undefined {
  // The vertex nearest the point is the middle of the major cell it is in.
  const [X, Y] = [Math.floor(p[0]), Math.floor(p[1])];
  const r = resolveTerrainCorner(map, profile, X, Y);
  if (r.status !== "shaped") return undefined;
  const c = r.corner;
  return inCornerRegion(p, vertexPoint(c.layer, c.vx, c.vy), c.dir, c.leg, c.shape) ? c : undefined;
}
