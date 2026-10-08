// Chunked terrain geometry from the heightmap. Pure: (map, profile,
// look, chunk) -> typed arrays, tested in tests/three-geometry.test.ts.
//
// World units: x = minor x, z = minor y (south), y = level * heightScale. A terrain block
// (tx, ty) covers minor 2tx-1..2tx, clipped to the map, so its footprint is 2 x 2 world units.
// Each block gets a top quad at its height and a vertical quad on every side whose neighbor is
// lower. Water blocks' earth sits at the riverbed (surface minus `water.bed`), so the banks'
// own side faces form the basin walls. Beach blocks are flat sand at the beach level. Off the map
// edge the island drops to one level below the beach (a skirt). A cut or rounded corner
// (corners.ts) splits its odd block's top into the main region and a corner region at the level
// of the blocks around it, with a wall along the curve and the sides split where the region ends
// (terrainShapes); blocks no shaped corner touches build exactly as before.
//
// Grass tops go in a mesh of their own, the lawn: its shader draws
// the leaf stamps, so it carries `edge` (distance in from the nearest cushion outline, and the
// direction in), and tops near an edge are cut into 0.5 quads for it. Cliff faces are cut into four
// rows a level and fine columns at outline corners, then dented (world-space noise, zero at every
// level boundary, so no face parts from the ground).
//
// Attributes: level (the block's integer height, the high side's for a face), face (0 grass top,
// 1 side, 2 sand top, 3 riverbed), shore (sand: distance to the map edge in tiles, for the wet
// band; side: height above the face's foot), edge (lawn: inward, direction x, z; side: 1 where
// the high side is grass, so a cushion hangs over it).

import type { GridSpec } from "../space";
import { cornerGrid, pathAt, pathGrid, terrainGrid, type MapDoc, type TerrainCell } from "../model";
import {
  CORNER_DIRS,
  CORNER_NAMES,
  cornerCurve,
  inCornerRegion,
  resolveTerrainCorner,
  trimmedSquare,
  vertexPoint,
  type TerrainCorner,
} from "../corners";
import { isLandTerrain, type Profile } from "../profile";
import type { Look } from "../style";
import { QuadBuilder, type MeshArrays, type V3 } from "@glade/render";
import {
  cornerRadius,
  cushionProfile,
  groundLift,
  hashI,
  landTone,
  noise3,
  pushLine,
  pushLeaf,
  type LandLook,
  type LeafList,
} from "./land";

/** The geometry-relevant part of a Look; a change here means rebuilding every chunk. */
export interface GeomLook {
  heightScale: number;
  inset: number;
  bed: number;
  foamHeight: number;
  foamSpread: number;
  /** Radius of the rounded edge where water tips over into a fall (world units). */
  fallLip: number;
  contactWidth: number;
  /** World units a path stops short of a different path type beside it. */
  pathGap: number;
  /** Radius (world units) of a path's rounded outer corners. */
  pathCorner: number;
  /** Grass at beach level on the buildable tiles' half of the beach blocks (style sand). */
  grassBorder: boolean;
  /** Cushions, leaves, tone and faces. */
  land: LandLook;
}

export function geomLook(look: Look): GeomLook {
  return {
    heightScale: look.units.heightScale,
    inset: look.water.inset,
    bed: look.water.bed ?? 0.6,
    foamHeight: look.water.fall.foam.height,
    foamSpread: look.water.fall.foam.spread,
    fallLip: look.water.fall.lip ?? 0,
    contactWidth: look.terrain.contact?.width ?? 0,
    pathGap: 2 * (look.paths?.gap ?? 0),
    pathCorner: look.paths?.corner ?? 0,
    grassBorder: look.terrain.sand.grassBorder ?? false,
    land: look.terrain.land,
  };
}

export const FACE = { grass: 0, side: 1, sand: 2, bed: 3 } as const;

// ---- chunks: one per area ----

export interface ChunkId {
  cx: number;
  cy: number;
}

export function chunkCounts(spec: GridSpec): { cols: number; rows: number } {
  return {
    cols: Math.ceil(spec.majorW / spec.areaSize),
    rows: Math.ceil(spec.majorH / spec.areaSize),
  };
}

export const chunkKey = (cx: number, cy: number) => `${cx},${cy}`;

/** The chunk a terrain block belongs to (the last row/column of blocks joins the last chunk). */
export function chunkOfBlock(spec: GridSpec, tx: number, ty: number): ChunkId {
  const { cols, rows } = chunkCounts(spec);
  return {
    cx: Math.min(cols - 1, Math.floor(tx / spec.areaSize)),
    cy: Math.min(rows - 1, Math.floor(ty / spec.areaSize)),
  };
}

/** Inclusive terrain block range of a chunk. */
export function chunkBlocks(spec: GridSpec, c: ChunkId) {
  const { cols, rows } = chunkCounts(spec);
  const s = spec.areaSize;
  return {
    tx0: c.cx * s,
    tx1: c.cx === cols - 1 ? spec.majorW : c.cx * s + s - 1,
    ty0: c.cy * s,
    ty1: c.cy === rows - 1 ? spec.majorH : c.cy * s + s - 1,
  };
}

/** Inclusive major-cell range of a chunk (paths, plants). */
export function chunkMajors(spec: GridSpec, c: ChunkId) {
  const s = spec.areaSize;
  return {
    X0: c.cx * s,
    X1: Math.min(spec.majorW - 1, c.cx * s + s - 1),
    Y0: c.cy * s,
    Y1: Math.min(spec.majorH - 1, c.cy * s + s - 1),
  };
}

export function allChunks(spec: GridSpec): ChunkId[] {
  const { cols, rows } = chunkCounts(spec);
  const out: ChunkId[] = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) out.push({ cx, cy });
  return out;
}

/**
 * Chunks whose terrain, water, fringe or paths differ between two maps. A block's change reaches
 * its neighbors' side faces and the shore ramp two blocks away, so each changed block marks the
 * chunks within `margin` blocks. With no previous map, every chunk is dirty.
 */
export function dirtyChunks(
  spec: GridSpec,
  prev: MapDoc | null,
  next: MapDoc,
  margin = 3,
): Set<string> {
  const out = new Set<string>();
  const [pt, nt] = [prev && terrainGrid(prev), terrainGrid(next)];
  if (!prev || !pt || pt.length !== nt.length) {
    for (const c of allChunks(spec)) out.add(chunkKey(c.cx, c.cy));
    return out;
  }
  const mark = (tx: number, ty: number) => {
    for (let dy = -margin; dy <= margin; dy += margin) {
      for (let dx = -margin; dx <= margin; dx += margin) {
        const x = Math.max(0, Math.min(spec.majorW, tx + dx));
        const y = Math.max(0, Math.min(spec.majorH, ty + dy));
        const c = chunkOfBlock(spec, x, y);
        out.add(chunkKey(c.cx, c.cy));
      }
    }
  };
  for (let ty = 0; ty < nt.length; ty++) {
    const a = pt[ty];
    const b = nt[ty];
    for (let tx = 0; tx < b.length; tx++) {
      if (a[tx].h !== b[tx].h || a[tx].water !== b[tx].water) mark(tx, ty);
    }
  }
  const [pp, np] = [pathGrid(prev), pathGrid(next)];
  for (let Y = 0; Y < np.length; Y++) {
    for (let X = 0; X < np[Y].length; X++) {
      if (pp[Y]?.[X] === np[Y][X]) continue;
      // A path cell's gap and corners reach its neighbors.
      for (const [dx, dy] of [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const c = chunkOfBlock(spec, Math.max(0, X + dx), Math.max(0, Y + dy));
        out.add(chunkKey(c.cx, c.cy));
      }
    }
  }
  // A shaped vertex changes the blocks and cells around it, and their neighbors' faces.
  for (const layer of ["terrainCorners", "pathCorners"] as const) {
    const [a, b] = [cornerGrid(prev, layer), cornerGrid(next, layer)];
    b?.forEach((row, y) =>
      row.forEach((v, x) => {
        if ((a?.[y]?.[x] ?? null) !== v) mark(x, y);
      }),
    );
  }
  return out;
}

// ---- sampling ----

export interface TerrainSampler {
  spec: GridSpec;
  /** World y of a block's earth (riverbed for water, beach level off land); null off the map. */
  solid(tx: number, ty: number): number | null;
  /** World y of a water block's surface. */
  surface(tx: number, ty: number): number;
  isWater(tx: number, ty: number): boolean;
  isLand(tx: number, ty: number): boolean;
  /** World y of the ground an object stands on at a block (surface for water). */
  ground(tx: number, ty: number): number;
  /** The level the island drops to past the map edge. */
  skirt: number;
  footprint(tx: number, ty: number): [number, number, number, number];
}

export function sampler(
  map: MapDoc,
  profile: Profile,
  g: GeomLook,
  spec: GridSpec,
): TerrainSampler {
  const hs = g.heightScale;
  const W = spec.majorW * 2;
  const H = spec.majorH * 2;
  const beach = profile.beach.level * hs;
  const grid = terrainGrid(map);
  const cell = (tx: number, ty: number) => grid[ty]?.[tx];
  const s: TerrainSampler = {
    spec,
    skirt: (profile.beach.level - 1) * hs,
    isLand: (tx, ty) => isLandTerrain(profile, tx, ty),
    isWater: (tx, ty) => !!cell(tx, ty)?.water && isLandTerrain(profile, tx, ty),
    surface: (tx, ty) => (cell(tx, ty)!.h - g.inset) * hs,
    solid(tx, ty) {
      const c = cell(tx, ty);
      if (!c) return null;
      if (!isLandTerrain(profile, tx, ty)) return beach;
      return (c.water ? c.h - g.inset - g.bed : c.h) * hs;
    },
    ground(tx, ty) {
      const c = cell(tx, ty);
      if (!c) return beach;
      if (!isLandTerrain(profile, tx, ty)) return beach;
      return (c.water ? c.h - g.inset : c.h) * hs;
    },
    footprint: (tx, ty) => [
      Math.max(0, 2 * tx - 1),
      Math.min(W, 2 * tx + 1),
      Math.max(0, 2 * ty - 1),
      Math.min(H, 2 * ty + 1),
    ],
  };
  return s;
}

/** The four sides of a block: neighbor offset, outward normal, and the edge's end points. */
export const SIDES: {
  dx: number;
  dy: number;
  n: V3;
  edge: (f: [number, number, number, number]) => [[number, number], [number, number]];
}[] = [
  {
    dx: 0,
    dy: -1,
    n: [0, 0, -1],
    edge: ([x0, x1, z0]) => [
      [x0, z0],
      [x1, z0],
    ],
  },
  {
    dx: 1,
    dy: 0,
    n: [1, 0, 0],
    edge: ([, x1, z0, z1]) => [
      [x1, z0],
      [x1, z1],
    ],
  },
  {
    dx: 0,
    dy: 1,
    n: [0, 0, 1],
    edge: ([x0, x1, , z1]) => [
      [x1, z1],
      [x0, z1],
    ],
  },
  {
    dx: -1,
    dy: 0,
    n: [-1, 0, 0],
    edge: ([x0, , z0, z1]) => [
      [x0, z1],
      [x0, z0],
    ],
  },
];

// ---- shaped corners and walls ----

type XZ = [number, number];

/** The corners at each side's two ends (as SIDES orders them), by direction from the center. */
const SIDE_ENDS: [XZ, XZ][] = [
  [
    [-1, -1],
    [1, -1],
  ],
  [
    [1, -1],
    [1, 1],
  ],
  [
    [1, 1],
    [-1, 1],
  ],
  [
    [-1, 1],
    [-1, -1],
  ],
];

/**
 * A vertical face from a higher top down to a lower one: along a block's side (split where a
 * shaped corner's region meets it) or along a shaped corner's curve. a -> b runs with the high side
 * on the right seen from above (x east, z south), so the outward normal is (bz - az, ax - bx).
 */
export interface Wall {
  a: XZ;
  b: XZ;
  n: V3;
  top: number;
  low: number;
  /** The high side's level, from which cliff strata count down. */
  level: number;
  /** The high side is dry land (grass), where the fringe goes. */
  grass: boolean;
  /** The low side is on the map, and whether it is water (with its surface). */
  lowOnMap: boolean;
  lowWater: boolean;
  /** The low side is dry land on the island (grass at the face's foot). */
  lowGrass: boolean;
  lowSurface: number;
  /** Along-edge coordinate at a, for the fringe's tufts. */
  u: number;
  /** The high side's region ("tx,ty" or "tx,ty:corner"), so fringes join around it first. */
  region: string;
}

/**
 * Terrain with its shaped corners (corners.ts) resolved: each block's top is its main region plus
 * the corner regions it gives up or gains, and walls run wherever one side is lower.
 */
export function terrainShapes(map: MapDoc, profile: Profile, g: GeomLook, spec: GridSpec) {
  const s = sampler(map, profile, g, spec);
  const hs = g.heightScale;
  const grid = terrainGrid(map);
  const memo = new Map<number, TerrainCorner | null>();
  const shapes = cornerGrid(map, "terrainCorners");
  /** Whether any of a block's four corners has a shape stored (most blocks: no). */
  const touched = (tx: number, ty: number) =>
    !!shapes &&
    !!(
      shapes[ty - 1]?.[tx - 1] ||
      shapes[ty - 1]?.[tx] ||
      shapes[ty]?.[tx - 1] ||
      shapes[ty]?.[tx]
    );
  /** Whether any vertex in a range (inclusive, terrain corner coordinates) has a shape stored. */
  const anyShapes = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= y1 && shapes; y++) {
      const row = shapes[y];
      if (!row) break;
      for (let x = Math.max(0, x0); x <= x1 && x < row.length; x++) if (row[x]) return true;
    }
    return false;
  };
  const vertexCorner = (X: number, Y: number): TerrainCorner | null => {
    if (!shapes?.[Y]?.[X]) return null;
    const key = Y * 4096 + X;
    let c = memo.get(key);
    if (c === undefined) {
      const r = resolveTerrainCorner(map, profile, X, Y);
      c = r.status === "shaped" ? r.corner : null;
      memo.set(key, c);
    }
    return c;
  };
  const atCorner = (tx: number, ty: number, [sx, sy]: XZ) =>
    vertexCorner(tx + (sx > 0 ? 0 : -1), ty + (sy > 0 ? 0 : -1));
  const isOdd = (c: TerrainCorner | null, tx: number, ty: number): c is TerrainCorner =>
    !!c && c.cell.x === tx && c.cell.y === ty;
  /** A block's value near one of its corners: the corner region's if it is the odd block there. */
  const valueNear = (tx: number, ty: number, dir: XZ): TerrainCell | undefined => {
    const own = grid[ty]?.[tx];
    const c = own && atCorner(tx, ty, dir);
    return isOdd(c ?? null, tx, ty) ? c!.surround : own;
  };
  const solidOf = (tx: number, ty: number, v: TerrainCell | undefined): number | null => {
    if (!v) return null;
    if (!s.isLand(tx, ty)) return s.solid(tx, ty);
    return (v.water ? v.h - g.inset - g.bed : v.h) * hs;
  };
  /** Shaped corners whose odd block is this one. */
  const cornersOf = (tx: number, ty: number): TerrainCorner[] => {
    if (!touched(tx, ty) || !s.isLand(tx, ty)) return [];
    const out: TerrainCorner[] = [];
    for (const name of CORNER_NAMES) {
      const c = atCorner(tx, ty, CORNER_DIRS[name]);
      if (isOdd(c, tx, ty)) out.push(c);
    }
    return out;
  };
  /** World y of the earth at a world point, corner regions included; null off the map. */
  const solidAt = (x: number, z: number): number | null => {
    const [tx, ty] = [Math.floor((x + 1) / 2), Math.floor((z + 1) / 2)];
    let v = grid[ty]?.[tx];
    for (const c of cornersOf(tx, ty)) {
      const V = vertexPoint(c.layer, c.vx, c.vy);
      if (inCornerRegion([x / 2, z / 2], V, c.dir, c.leg, c.shape)) v = c.surround;
    }
    return solidOf(tx, ty, v);
  };
  /** A shaped corner's vertex and curve, in world units. */
  const curveOf = (c: TerrainCorner): { V: XZ; pts: XZ[] } => {
    const [vx, vz] = vertexPoint(c.layer, c.vx, c.vy);
    const V: XZ = [2 * vx, 2 * vz];
    return { V, pts: cornerCurve(V, c.dir, 2 * c.leg, c.shape) };
  };

  function walls(tx: number, ty: number): Wall[] {
    const out: Wall[] = [];
    const own = grid[ty][tx];
    const land = s.isLand(tx, ty);
    const f = s.footprint(tx, ty);
    const wall = (
      a: XZ,
      b: XZ,
      mine: TerrainCell,
      top: number,
      nx: number,
      ny: number,
      theirs: TerrainCell | undefined,
      u: number,
      region: string,
    ) => {
      const low = solidOf(nx, ny, theirs) ?? s.skirt;
      if (low >= top - 1e-6) return;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const onLand = !!theirs && s.isLand(nx, ny);
      out.push({
        a,
        b,
        n: [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
        top,
        low,
        level: land ? mine.h : profile.beach.level,
        grass: land && !mine.water,
        lowOnMap: !!theirs,
        lowWater: onLand && theirs!.water,
        lowGrass: onLand && !theirs!.water,
        lowSurface: onLand ? (theirs!.h - g.inset) * hs : 0,
        u,
        region,
      });
    };
    const top = s.solid(tx, ty)!;
    const tag = `${tx},${ty}`;
    // A side's end vertices are this block's corners: untouched blocks keep whole sides.
    const plain = !touched(tx, ty);
    SIDES.forEach((side, k) => {
      const [nx, ny] = [tx + side.dx, ty + side.dy];
      const theirs = grid[ny]?.[nx];
      if (plain) {
        if ((s.solid(nx, ny) ?? s.skirt) >= top - 1e-6) return;
        const [a, b] = side.edge(f);
        wall(a, b, own, top, nx, ny, theirs, 0, tag);
        return;
      }
      const [a, b] = side.edge(f);
      const [dA, dB] = SIDE_ENDS[k];
      // The same vertex seen from the neighbor: flip the component across the side.
      const mirror = ([sx, sy]: XZ): XZ => (side.dx !== 0 ? [-sx, sy] : [sx, -sy]);
      const nearA = [valueNear(tx, ty, dA), theirs && valueNear(nx, ny, mirror(dA))] as const;
      const nearB = [valueNear(tx, ty, dB), theirs && valueNear(nx, ny, mirror(dB))] as const;
      const shapedA = nearA[0] !== own || nearA[1] !== theirs;
      const shapedB = nearB[0] !== own || nearB[1] !== theirs;
      if (!shapedA && !shapedB) {
        wall(a, b, own, top, nx, ny, theirs, 0, tag);
        return;
      }
      // Split where the corner regions end: leg in from each shaped end.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const leg = 2 * profile.corners.terrain;
      const at = (d: number): XZ => [a[0] + t[0] * d, a[1] + t[1] * d];
      const cuts: [
        number,
        number,
        readonly [TerrainCell | undefined, TerrainCell | undefined],
        XZ | null,
      ][] = [];
      let from = 0;
      if (shapedA) {
        cuts.push([0, leg, nearA, dA]);
        from = leg;
      }
      const to = shapedB ? len - leg : len;
      if (to > from + 1e-9) cuts.push([from, to, [own, theirs], null]);
      if (shapedB) cuts.push([len - leg, len, nearB, dB]);
      for (const [d0, d1, [mine, other], dir] of cuts) {
        const m = mine ?? own;
        const region = dir && m !== own ? `${tag}:${dir.join(",")}` : tag;
        wall(at(d0), at(d1), m, solidOf(tx, ty, m)!, nx, ny, other, d0, region);
      }
    });
    // Along each shaped corner's curve, between the block's main region and its corner region.
    for (const c of cornersOf(tx, ty)) {
      const [m, r] = [solidOf(tx, ty, own)!, solidOf(tx, ty, c.surround)!];
      if (Math.abs(m - r) < 1e-6) continue;
      const { V, pts } = curveOf(c);
      const cornerLow = r < m;
      const [high, lowV] = cornerLow ? [own, c.surround] : [c.surround, own];
      // Orient so the low side is on the left: toward the vertex when the corner region is low.
      const [p, q] = [pts[0], pts[1]];
      const n0: XZ = [q[1] - p[1], p[0] - q[0]];
      const towardV = n0[0] * (V[0] - p[0]) + n0[1] * (V[1] - p[1]) > 0;
      if (towardV !== cornerLow) pts.reverse();
      const region = cornerLow ? `${tx},${ty}` : `${tx},${ty}:${c.dir.join(",")}`;
      let u = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        out.push({
          a,
          b,
          n: [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
          top: Math.max(m, r),
          low: Math.min(m, r),
          level: high.h,
          grass: !high.water,
          lowOnMap: true,
          lowWater: lowV.water,
          lowGrass: !lowV.water,
          lowSurface: (lowV.h - g.inset) * hs,
          u,
          region,
        });
        u += len;
      }
    }
    return out;
  }

  /**
   * A block's top as regions: [points (world x, z), value] for the main region and each corner
   * region, or null when no shaped corner touches it (its top is the plain footprint).
   */
  function regions(
    tx: number,
    ty: number,
  ): { pts: XZ[]; value: TerrainCell; corner?: TerrainCorner }[] | null {
    const corners = cornersOf(tx, ty);
    if (!corners.length) return null;
    const [x0, x1, z0, z1] = s.footprint(tx, ty);
    const main = trimmedSquare(
      x0,
      x1,
      z0,
      z1,
      corners.map((c) => ({ dir: c.dir, leg: 2 * c.leg, shape: c.shape })),
    );
    return [
      { pts: main, value: grid[ty][tx] },
      ...corners.map((c) => {
        const { V, pts } = curveOf(c);
        return { pts: [V, ...pts], value: c.surround, corner: c };
      }),
    ];
  }

  /** Where water falling off a block's side lands (world y), or null when it does not fall. */
  const fallLanding = (tx: number, ty: number, side: (typeof SIDES)[number]): number | null => {
    if (!s.isWater(tx, ty)) return null;
    const n = grid[ty + side.dy]?.[tx + side.dx];
    if (!n || n.h >= grid[ty][tx].h) return null;
    const [nx, ny] = [tx + side.dx, ty + side.dy];
    const landing = s.isWater(nx, ny) ? s.surface(nx, ny) : s.solid(nx, ny)!;
    return landing < s.surface(tx, ty) - 1e-6 ? landing : null;
  };
  /** Whether a fall's sheet ends at a block corner (world x, z). */
  const fallAt = ([x, z]: XZ): boolean => {
    for (const ty of [Math.round((z - 1) / 2), Math.round((z + 1) / 2)]) {
      for (const tx of [Math.round((x - 1) / 2), Math.round((x + 1) / 2)]) {
        if (!grid[ty]?.[tx] || !s.isWater(tx, ty)) continue;
        const f = s.footprint(tx, ty);
        for (const side of SIDES) {
          if (!side.edge(f).some((q) => at0(q, [x, z]))) continue;
          if (fallLanding(tx, ty, side) !== null) return true;
        }
      }
    }
    return false;
  };

  return { s, walls, regions, solidOf, solidAt, cornersOf, anyShapes, fallLanding, fallAt };
}

type Shapes = ReturnType<typeof terrainShapes>;

/** Every block's walls, computed once per builder. */
function wallMemo(sh: Shapes, spec: GridSpec) {
  const memo = new Map<number, Wall[]>();
  return (tx: number, ty: number): Wall[] => {
    if (tx < 0 || ty < 0 || tx > spec.majorW || ty > spec.majorH) return [];
    if (!sh.s.isLand(tx, ty)) return [];
    const k = ty * 4096 + tx;
    let w = memo.get(k);
    if (!w) memo.set(k, (w = sh.walls(tx, ty)));
    return w;
  };
}

/** How far the cushion's edge-distance field reaches: past it, a top is "far from any edge". */
export const EDGE_FAR = 4;

/**
 * Distance in from the nearest cushion outline at a point on a top (the nearest grass edge over
 * a drop at that top, plus the overhang) and the direction in; EDGE_FAR and no direction past it.
 */
function edgeField(walls: (tx: number, ty: number) => Wall[], overhang: number) {
  // The grass edges at a top within reach of a block, gathered once per block and top.
  const near = new Map<string, Wall[]>();
  const nearOf = (bx: number, by: number, top: number): Wall[] => {
    const k = `${bx},${by},${Math.round(top * 1e4)}`;
    let list = near.get(k);
    if (!list) {
      list = [];
      for (let ty = by - 2; ty <= by + 2; ty++) {
        for (let tx = bx - 2; tx <= bx + 2; tx++) {
          for (const w of walls(tx, ty)) {
            if (w.grass && Math.abs(w.top - top) <= 1e-6) list.push(w);
          }
        }
      }
      near.set(k, list);
    }
    return list;
  };
  const field = (x: number, z: number, top: number): [number, number, number] => {
    const [bx, by] = [Math.floor((x + 1) / 2), Math.floor((z + 1) / 2)];
    let best = Infinity;
    let dir: [number, number] = [0, 0];
    {
      {
        for (const w of nearOf(bx, by, top)) {
          const [ax, az] = w.a;
          const [ex, ez] = [w.b[0] - ax, w.b[1] - az];
          const len2 = ex * ex + ez * ez;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2));
          const [px, pz] = [ax + ex * t, az + ez * t];
          const d = Math.hypot(x - px, z - pz);
          if (d < best) {
            best = d;
            dir = d > 1e-6 ? [(x - px) / d, (z - pz) / d] : [-w.n[0], -w.n[2]];
          }
        }
      }
    }
    const inward = best + overhang;
    return inward >= EDGE_FAR ? [EDGE_FAR, 0, 0] : [inward, dir[0], dir[1]];
  };
  /** Whether a block has any grass edge at this top within reach. */
  field.any = (bx: number, by: number, top: number) => nearOf(bx, by, top).length > 0;
  /** The grass edges at this top within reach of a block. */
  field.near = nearOf;
  return field;
}

export interface TerrainChunk extends MeshArrays {
  stats: { tops: number; sides: number };
  /** The grass tops. */
  lawn: MeshArrays;
}

/** Rows a level is cut into on a cliff face, and the fine columns' width near its corners. */
const FACE_ROWS = 4;
const FINE = 0.1;
const FINE_SPAN = 0.4;
/** How far from a fall's sheet the faces' dents fade back in. */
const FALL_FADE = 0.4;

export function buildTerrainChunk(
  map: MapDoc,
  profile: Profile,
  g: GeomLook,
  spec: GridSpec,
  chunk: ChunkId,
): TerrainChunk {
  const sh = terrainShapes(map, profile, g, spec);
  const s = sh.s;
  const walls = wallMemo(sh, spec);
  /** The walls of the four blocks around a block corner (world x, z). */
  const wallsAround = ([x, z]: XZ): Wall[] => {
    const out: Wall[] = [];
    for (const ty of [Math.round((z - 1) / 2), Math.round((z + 1) / 2)]) {
      for (const tx of [Math.round((x - 1) / 2), Math.round((x + 1) / 2)])
        out.push(...walls(tx, ty));
    }
    return out;
  };
  const edge = edgeField(walls, g.land.cushion.overhang);
  const b = new QuadBuilder({ level: 1, face: 1, shore: 1, edge: 3 });
  const lawn = new QuadBuilder({ level: 1, face: 1, shore: 1, edge: 3 });
  const { tx0, tx1, ty0, ty1 } = chunkBlocks(spec, chunk);
  const W = spec.majorW * 2;
  const H = spec.majorH * 2;
  const hs = g.heightScale;
  const edgeDist = (x: number, z: number) => Math.min(x, z, W - x, H - z) / 2;
  // The buildable tiles (world units): beach blocks are grass where they reach in (grassBorder).
  const bw = 2 * profile.beach.width;
  const [bx0, bx1, bz0, bz1] = g.grassBorder ? [bw, W - bw, bw, H - bw] : [0, 0, 0, 0];
  /** A beach block's footprint cut at the buildable edge: [x0, x1, z0, z1, grass]. */
  const beachParts = (x0: number, x1: number, z0: number, z1: number) => {
    const cuts = (lo: number, hi: number, a: number, b2: number) =>
      [lo, ...[a, b2].filter((v) => v > lo && v < hi), hi].sort((p, q) => p - q);
    const xs = cuts(x0, x1, bx0, bx1);
    const zs = cuts(z0, z1, bz0, bz1);
    const out: [number, number, number, number, boolean][] = [];
    for (let j = 0; j + 1 < zs.length; j++) {
      for (let i = 0; i + 1 < xs.length; i++) {
        const [cx, cz] = [(xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2];
        out.push([
          xs[i],
          xs[i + 1],
          zs[j],
          zs[j + 1],
          cx > bx0 && cx < bx1 && cz > bz0 && cz < bz1,
        ]);
      }
    }
    return out;
  };
  const F = g.land.face;
  // Dents: a world-space field, so faces meeting at a corner move together; zero at every level
  // boundary, so tops and feet stay put.
  const dentK = 1 / Math.max(F.dentSize, 1e-3);
  const C = g.land.cushion;
  // Falls near the chunk: no dents at their sheets, which hang just off the face (else the face
  // pokes through), fading in over FALL_FADE, in world space so neighboring walls still meet.
  const falls: { a: XZ; b: XZ; y0: number; y1: number }[] = [];
  for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(spec.majorH, ty1 + 1); ty++) {
    for (let tx = Math.max(0, tx0 - 1); tx <= Math.min(spec.majorW, tx1 + 1); tx++) {
      if (!s.isLand(tx, ty) || !s.isWater(tx, ty)) continue;
      for (const side of SIDES) {
        const landing = sh.fallLanding(tx, ty, side);
        if (landing === null) continue;
        const [a, c] = side.edge(s.footprint(tx, ty));
        falls.push({ a, b: c, y0: landing, y1: s.surface(tx, ty) });
      }
    }
  }
  const fallFree = (x: number, y: number, z: number): number => {
    let k = 1;
    for (const f of falls) {
      if (y < f.y0 - 0.1 || y > f.y1 + 0.1) continue;
      const [ex, ez] = [f.b[0] - f.a[0], f.b[1] - f.a[1]];
      const u = Math.max(
        0,
        Math.min(1, ((x - f.a[0]) * ex + (z - f.a[1]) * ez) / (ex * ex + ez * ez)),
      );
      const d = Math.hypot(x - f.a[0] - ex * u, z - f.a[1] - ez * u);
      k = Math.min(k, Math.max(0, Math.min(1, (d - 0.05) / FALL_FADE)));
    }
    return k;
  };
  const dented = (x: number, y: number, z: number, under = Infinity): V3 => {
    if (F.dent <= 0) return [x, y, z];
    const f = y / hs - Math.floor(y / hs);
    // None under a cushion (from `under` up), so the face never pokes through it.
    const free =
      Math.min(1, Math.max(0, (under - y) / 0.15)) * (falls.length ? fallFree(x, y, z) : 1);
    const env = Math.sin(Math.PI * f) * F.dent * 2 * free;
    if (env === 0) return [x, y, z];
    const [kx, ky, kz] = [x * dentK, y * dentK, z * dentK];
    const dx = 0.6 * noise3(kx, ky, kz, 3) + 0.4 * noise3(kx * 2.1, ky * 2.1, kz * 2.1, 4) - 0.5;
    const dz =
      0.6 * noise3(kx + 31, ky, kz - 31, 7) +
      0.4 * noise3(kx * 2.1 + 31, ky * 2.1, kz * 2.1, 8) -
      0.5;
    return [x + dx * env, y, z + dz * env];
  };
  let tops = 0;
  let sides = 0;
  /**
   * A grass top: one quad far from edges, else a grid carrying the edge field, finer near them
   * (4 x 4 within the rim, 2 x 2 out to EDGE_FAR).
   */
  const grassTop = (x0: number, x1: number, z0: number, z1: number, y: number, level: number) => {
    const d = nearestEdge(x0, x1, z0, z1, y);
    // A path cell's half of the block is cut out of the lawn's stamps (quads of at most one unit
    // there, so they meet the path cells' edges).
    const cell = (x: number, z: number) => pathAt(map, Math.floor(x / 2), Math.floor(z / 2));
    const paved = [x0 + 0.5, x1 - 0.5].some((x) => [z0 + 0.5, z1 - 0.5].some((z) => cell(x, z)));
    const n = d < 2.4 ? 4 : d < EDGE_FAR - 1e-6 || paved ? 2 : 1;
    // The edge field once per grid vertex.
    const at = (i: number, j: number): V3 => [
      x0 + ((x1 - x0) * i) / n,
      y,
      z0 + ((z1 - z0) * j) / n,
    ];
    const field: [number, number, number][] = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const [x, , z] = at(i, j);
        field.push(n === 1 ? [EDGE_FAR, 0, 0] : edge(x, z, y));
      }
    }
    const f = (i: number, j: number) => field[j * (n + 1) + i];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const [cx, , cz] = at(i + 0.5, j + 0.5);
        lawn.quad([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], [0, 1, 0], {
          level,
          face: FACE.grass,
          // 0 under a path: plain grass, no stamps.
          shore: paved && cell(cx, cz) ? 0 : 1,
          edge: [f(i, j), f(i + 1, j), f(i + 1, j + 1), f(i, j + 1)],
        });
      }
    }
  };
  /** The nearest grass edge's distance at this top over a footprint (its corners and middle). */
  const nearestEdge = (x0: number, x1: number, z0: number, z1: number, y: number) => {
    if (!edge.any(Math.floor((x0 + x1 + 2) / 4), Math.floor((z0 + z1 + 2) / 4), y)) return EDGE_FAR;
    return Math.min(
      ...[
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
        [(x0 + x1) / 2, (z0 + z1) / 2],
      ].map(([x, z]) => edge(x, z, y)[0]),
    );
  };

  /** Whether the block along a plain wall continues the same face (no outline corner there). */
  const continues = (w: Wall, tx: number, ty: number, end: 0 | 1): boolean => {
    const [dx, dz] = [w.b[0] - w.a[0], w.b[1] - w.a[1]];
    const [sx, sy] = [Math.sign(dx), Math.sign(dz)];
    const [nx, ny] = end ? [tx + sx, ty + sy] : [tx - sx, ty - sy];
    const p = end ? w.b : w.a;
    return walls(nx, ny).some(
      (o) =>
        Math.abs(o.n[0] - w.n[0]) < 1e-6 &&
        Math.abs(o.n[2] - w.n[2]) < 1e-6 &&
        (end ? at0(o.a, p) : at0(o.b, p)),
    );
  };

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const top = s.solid(tx, ty)!;
      const land = s.isLand(tx, ty);
      const level = land ? terrainGrid(map)[ty][tx].h : profile.beach.level;
      const face = !land ? FACE.sand : s.isWater(tx, ty) ? FACE.bed : FACE.grass;
      const f = s.footprint(tx, ty);
      const [x0, x1, z0, z1] = f;
      const shaped = land ? sh.regions(tx, ty) : null;
      if (shaped) {
        for (const { pts, value } of shaped) {
          const y = sh.solidOf(tx, ty, value)!;
          const grass = !value.water;
          (grass ? lawn : b).polygon(
            pts.map(([x, z]): V3 => [x, y, z]),
            [0, 1, 0],
            {
              level: value.h,
              face: grass ? FACE.grass : FACE.bed,
              shore: 1,
              edge: pts.map(([x, z]) => (grass ? edge(x, z, y) : [EDGE_FAR, 0, 0])),
            },
          );
          tops++;
        }
      } else if (face === FACE.grass) {
        grassTop(x0, x1, z0, z1, top, level);
        tops++;
      } else {
        for (const [px0, px1, pz0, pz1, grass] of face === FACE.sand
          ? beachParts(x0, x1, z0, z1)
          : [[x0, x1, z0, z1, false] as const]) {
          if (grass) {
            grassTop(px0, px1, pz0, pz1, top, level);
            continue;
          }
          const corners: [V3, V3, V3, V3] = [
            [px0, top, pz0],
            [px1, top, pz0],
            [px1, top, pz1],
            [px0, top, pz1],
          ];
          const shore =
            face === FACE.sand ? corners.map(([x, , z]) => edgeDist(x, z)) : [1, 1, 1, 1];
          b.quad(corners, [0, 1, 0], { level, face, shore, edge: [EDGE_FAR, 0, 0] });
        }
        tops++;
      }
      const plain = !sh.cornersOf(tx, ty).length;
      const mine = walls(tx, ty);
      for (const w of mine) {
        const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
        const convex = plain ? filletsOf(w, mine, g, sh.fallAt) : ([null, null] as const);
        const concave = plain
          ? concaveFilletsOf(w, wallsAround, g, sh.fallAt)
          : ([null, null] as const);
        const fillets: [Fillet | null, Fillet | null] = [
          convex[0] ?? concave[0],
          convex[1] ?? concave[1],
        ];
        // Columns: fine within FINE_SPAN (or the fillet) of an outline corner (where dents show
        // on the silhouette and the corner rounds), else the whole run.
        const span = Math.max(FINE_SPAN, fillets[0]?.r ?? 0, fillets[1]?.r ?? 0);
        const colStep = span / Math.round(span / FINE);
        const cols = [0];
        // (A filleted end is a corner from its fillet's height up, even where the face runs on
        // straight below it.)
        const fineA = plain && len > 2 * span && (!!fillets[0] || !continues(w, tx, ty, 0));
        const fineB = plain && len > 2 * span && (!!fillets[1] || !continues(w, tx, ty, 1));
        if (fineA) for (let u = colStep; u < span + 1e-6; u += colStep) cols.push(u);
        if (fineB) for (let u = len - span; u < len - 1e-6; u += colStep) cols.push(u);
        cols.push(len);
        // Rows on the world's grid (four a level), so neighbors share every vertex.
        const rows = [w.low];
        const step = hs / FACE_ROWS;
        for (let k = Math.floor(w.low / step) + 1; k * step < w.top - 1e-6; k++) {
          if (k * step > w.low + 1e-6) rows.push(k * step);
        }
        // A grass face stops just under the lawn: the cushion covers that height, and its rounding
        // dips a little below the lawn at the face line, where the face's top edge would show.
        rows.push(w.grass ? w.top - 0.05 : w.top);
        // A round over water starts at the surface, and one at an inside corner ends at the lower
        // wall's top, off the grid: rows there.
        for (const fe of fillets) {
          for (const y of fe ? [fe.low, fe.high] : []) {
            if (y <= w.low + 1e-6 || y >= rows[rows.length - 1] - 1e-6) continue;
            if (!rows.some((r) => Math.abs(r - y) < 1e-6)) rows.push(y);
          }
        }
        rows.sort((p, q) => p - q);
        // A grass face is under its cushion from the core's foot up.
        const under = w.grass ? w.top + C.coreInset - C.depth - C.coreDrop : Infinity;
        // Under a fillet's lowest row, its half of the square corner the round gave up is open
        // (no top there): a floor closes it, lawn level with the ground below, or bed at the water's
        // surface.
        // An inside round's top is open instead (the lower wall's top, under the cushion): lawn.
        fillets.forEach((fe, end) => {
          if (!fe) return;
          const y = fe.concave ? fe.high : rows.find((r) => r >= fe.low - 1e-6);
          if (y === undefined || y >= w.top - 1e-6) return;
          const pts: V3[] = [];
          for (let k = 0; k <= ARC_STEPS; k++) {
            const e = (fe.r * k) / ARC_STEPS;
            const [[x, z]] = filletPoint(
              w,
              [end ? null : fe, end ? fe : null],
              end ? len - e : e,
              0,
            );
            pts.push([x, y, z]);
          }
          const p = end ? w.b : w.a;
          pts.push([p[0], y, p[1]]);
          const wet = fe.wet && !fe.concave;
          (wet ? b : lawn).polygon(pts, [0, 1, 0], {
            level: Math.round(y / hs),
            face: wet ? FACE.bed : FACE.grass,
            shore: 1,
            edge: pts.map(([x, , z]) => (wet ? [EDGE_FAR, 0, 0] : edge(x, z, y))),
          });
        });
        const t: XZ = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len];
        const straight = (u: number, y: number) =>
          dented(w.a[0] + t[0] * u, y, w.a[1] + t[1] * u, under);
        for (let j = 0; j + 1 < rows.length; j++) {
          const [y0, y1] = [rows[j], rows[j + 1]];
          // Rounded only where both of the corner's walls stand.
          const on = (fe: Fillet | null) =>
            fe && y0 >= fe.low - 1e-6 && y1 <= fe.high + 1e-6 ? fe : null;
          const f: [Fillet | null, Fillet | null] = [on(fillets[0]), on(fillets[1])];
          const [rA, rB] = [f[0]?.r ?? 0, len - (f[1]?.r ?? 0)];
          const attrs = {
            level: w.level,
            face: FACE.side,
            shore: [y1 - w.low, y1 - w.low, y0 - w.low, y0 - w.low],
            edge: [w.grass ? 1 : 0, 0, 0],
          };
          for (let i = 0; i + 1 < cols.length; i++) {
            const [u0, u1] = [cols[i], cols[i + 1]];
            if (u0 >= rA - 1e-9 && u1 <= rB + 1e-9) {
              b.quad(
                [straight(u0, y1), straight(u1, y1), straight(u1, y0), straight(u0, y0)],
                w.n,
                attrs,
              );
              continue;
            }
            const ps: V3[] = [];
            const ns: V3[] = [];
            for (const [u, y] of [
              [u0, y1],
              [u1, y1],
              [u1, y0],
              [u0, y0],
            ]) {
              const [[x, z], [nx, nz]] = filletPoint(w, f, u, 0);
              ps.push(dented(x, y, z, under));
              ns.push([nx, 0, nz]);
            }
            b.quad(ps as [V3, V3, V3, V3], w.n, attrs, ns as [V3, V3, V3, V3]);
          }
        }
        sides++;
      }
    }
  }
  return { ...b.finish(), stats: { tops, sides }, lawn: lawn.finish() };
}

const at0 = (p: XZ, q: XZ) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

const dirOf = (w: Wall): XZ => {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  return [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len];
};

/**
 * A rounded outside corner at one end of a grass wall: the
 * radius, the outward normal of the block's other wall there, and the height down to which both
 * walls stand (below it the corner is not a corner of this block, so the face stays square).
 */
export interface Fillet {
  r: number;
  other: XZ;
  low: number;
  /** The height up to which both walls stand (the lower one's face top). */
  high: number;
  /** The round starts at a water surface (the walls drop into water), not dry ground. */
  wet: boolean;
  /** An inside corner: the round bulges out into the open, between two blocks' walls. */
  concave: boolean;
}

/**
 * The fillets at a grass wall's two ends (a, b): where the same block's next wall turns outward.
 * Over water the round starts at the surface (the face stays square under it, as the water's
 * edge is); none where a fall's sheet ends at the corner (the sheet is square, and a round beside
 * it opens a gap onto the channel's bed). Radius `face.round`, at most corner - overhang, so the
 * face's corner is concentric with the cushion's rounded corner above it (and stays inside it),
 * and at most half the wall.
 */
export function filletsOf(
  w: Wall,
  mine: Wall[],
  g: GeomLook,
  fallAt: (p: XZ) => boolean,
): [Fillet | null, Fillet | null] {
  const C = g.land.cushion;
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const r = Math.min(g.land.face.round, C.corner - C.overhang, len / 2);
  if (!w.grass || r <= 1e-6) return [null, null];
  const t = dirOf(w);
  const find = (end: 0 | 1): Fillet | null => {
    const p = end ? w.b : w.a;
    // Outward: the next wall faces the way this one runs (at b), the previous one against it.
    const want: XZ = end ? t : [-t[0], -t[1]];
    const o = mine.find(
      (o) =>
        o !== w &&
        o.grass &&
        Math.abs(o.top - w.top) < 1e-6 &&
        (end ? at0(o.a, p) : at0(o.b, p)) &&
        Math.abs(o.n[0] - want[0]) < 1e-6 &&
        Math.abs(o.n[2] - want[1]) < 1e-6,
    );
    if (!o || fallAt(p)) return null;
    const dry = Math.max(w.low, o.low);
    const surface = Math.max(
      w.lowWater ? w.lowSurface : -Infinity,
      o.lowWater ? o.lowSurface : -Infinity,
    );
    const low = Math.max(dry, surface);
    if (low >= w.top - 1e-6) return null;
    return {
      r,
      other: [o.n[0], o.n[2]],
      low,
      high: w.top - 0.05,
      wet: surface > dry,
      concave: false,
    };
  };
  return [find(0), find(1)];
}

/**
 * The fillets at a grass wall's inside corners: where the outline's next wall (another block's)
 * turns inward. The round bulges out into the open by up to r (sqrt 2 - 1) on the diagonal,
 * within the cushion's overhang above it; it stands where both walls do, from the higher foot (or
 * the water's surface) to the lower top. None where a fall's sheet ends at the corner. `near`
 * gives the walls of the blocks around a corner point.
 */
export function concaveFilletsOf(
  w: Wall,
  near: (p: XZ) => Wall[],
  g: GeomLook,
  fallAt: (p: XZ) => boolean,
): [Fillet | null, Fillet | null] {
  const C = g.land.cushion;
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const r = Math.min(g.land.face.round, C.corner - C.overhang, len / 2);
  if (!w.grass || r <= 1e-6) return [null, null];
  const t = dirOf(w);
  const find = (end: 0 | 1): Fillet | null => {
    const p = end ? w.b : w.a;
    // Inward: the next wall faces back against this one's run (at b), the previous one along it.
    const want: XZ = end ? [-t[0], -t[1]] : t;
    const o = near(p).find(
      (o) =>
        o !== w &&
        o.grass &&
        (end ? at0(o.a, p) : at0(o.b, p)) &&
        Math.abs(o.n[0] - want[0]) < 1e-6 &&
        Math.abs(o.n[2] - want[1]) < 1e-6,
    );
    if (!o || fallAt(p)) return null;
    const dry = Math.max(w.low, o.low);
    const surface = Math.max(
      w.lowWater ? w.lowSurface : -Infinity,
      o.lowWater ? o.lowSurface : -Infinity,
    );
    const low = Math.max(dry, surface);
    const high = Math.min(w.top, o.top) - 0.05;
    if (high <= low + 1e-6) return null;
    return { r, other: [o.n[0], o.n[2]], low, high, wet: surface > dry, concave: true };
  };
  return [find(0), find(1)];
}

/**
 * A point on a wall, u along it from a and s out from it, bent round its fillets (an eighth of
 * the quarter round each, meeting the other wall's on the diagonal), and the face's normal there.
 */
export function filletPoint(
  w: Wall,
  f: readonly [Fillet | null, Fillet | null],
  u: number,
  s: number,
): [XZ, XZ] {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const t = dirOf(w);
  const n: XZ = [w.n[0], w.n[2]];
  for (const end of [0, 1] as const) {
    const fe = f[end];
    const e = end ? len - u : u;
    if (!fe || e >= fe.r) continue;
    const p = end ? w.b : w.a;
    const o = fe.other;
    const phi = (Math.PI / 4) * (1 - e / fe.r);
    // The round's center: r inside both faces (outside corner) or r out from both (inside).
    const k = fe.concave ? fe.r : -fe.r;
    const [cx, cz] = [p[0] + k * (n[0] + o[0]), p[1] + k * (n[1] + o[1])];
    const dir: XZ = [
      n[0] * Math.cos(phi) + o[0] * Math.sin(phi),
      n[1] * Math.cos(phi) + o[1] * Math.sin(phi),
    ];
    const d = fe.concave ? s - fe.r : fe.r + s;
    return [[cx + d * dir[0], cz + d * dir[1]], dir];
  }
  return [[w.a[0] + t[0] * u + n[0] * s, w.a[1] + t[1] * u + n[1] * s], n];
}

/** Signed turn from direction d1 to d2 (positive: convex, the cushion's outside corner). */
function turn(d1: XZ, d2: XZ): number {
  const t = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]);
  return Math.max(-2.5, Math.min(2.5, t));
}

/** Where a wall's cushion stands: its crest (the lawn plus coreInset) and its foot. */
export function cushionSpan(w: Wall, g: GeomLook): { crest: number; bottom: number } {
  const C = g.land.cushion;
  const crest = w.top + C.coreInset;
  let bottom = crest - C.depth;
  // Over water it reaches down to just above the surface (a strip of wall between them reads
  // as a gap).
  if (w.lowWater) bottom = Math.max(bottom, w.lowSurface + 0.04);
  bottom = Math.max(bottom, w.low + 0.01);
  return { crest, bottom };
}

/** Arc segments in a rounded corner of the swept core. */
const ARC_STEPS = 4;

/**
 * The cushions: along every grass edge over a
 * drop, the sandbox's profile swept along the outline (`overhang` past the face), convex corners
 * rounded, concave ones mitered; a wall owns its straight run and the rounded corner at its end b.
 * The mesh is the leaves' backing (attributes `lip`: h 0..1 up the cushion, inward, 0; `lipN`: the
 * smooth normal). Leaves: rows along the profile on the world lattice, the lawn grid's stamps
 * within `edgeBand` of the outline, and rows along the foot of faces with grass below; every
 * tone baked here, as the lawn shader computes it.
 */
export function buildCushionChunk(
  map: MapDoc,
  profile: Profile,
  g: GeomLook,
  spec: GridSpec,
  chunk: ChunkId,
): MeshArrays & { stats: { edges: number; leaves: number }; leaves: LeafList } {
  const sh = terrainShapes(map, profile, g, spec);
  const walls = wallMemo(sh, spec);
  const land = g.land;
  const C = land.cushion;
  const L = land.leaves;
  const T = land.tone;
  const o = C.overhang;
  const b = new QuadBuilder({ lip: 3, lipN: 3 });
  const leaves: LeafList = { matrices: [], colors: [] };
  const { tx0, tx1, ty0, ty1 } = chunkBlocks(spec, chunk);
  let edges = 0;

  // Joins: a wall's neighbors along the outline, found by their shared end at the same top.
  const key = (p: XZ, top: number) =>
    `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(top * 1e4)}`;
  const starts = new Map<string, Wall>();
  const ends = new Map<string, Wall>();
  for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) {
    for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
      for (const w of walls(tx, ty)) {
        if (!w.grass) continue;
        starts.set(key(w.a, w.top), w);
        ends.set(key(w.b, w.top), w);
      }
    }
  }
  const lenOf = (w: Wall) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const mine = walls(tx, ty);
      const plain = !sh.cornersOf(tx, ty).length;
      for (const w of mine) {
        if (!w.grass) continue;
        edges++;
        const d = dirOf(w);
        const n: XZ = [w.n[0], w.n[2]];
        const len = lenOf(w);
        const pred = ends.get(key(w.a, w.top));
        const succ = starts.get(key(w.b, w.top));
        const ta = pred ? turn(dirOf(pred), d) : 0;
        const tb = succ ? turn(d, dirOf(succ)) : 0;
        const tanA = Math.tan(ta / 2);
        const tanB = Math.tan(tb / 2);
        // The straight run and the end corner at offset s from the face.
        const run = (s: number) => {
          const ra = pred && ta > 0 ? cornerRadius(C, s, ta, lenOf(pred), len) : 0;
          const rb = succ && tb > 0 ? cornerRadius(C, s, tb, len, lenOf(succ)) : 0;
          const u0 = pred ? -(s - ra) * tanA : 0;
          const u1 = Math.max(u0, len + (succ ? (s - rb) * tanB : 0));
          return { u0, u1, rb };
        };
        const flat = (u: number, s: number): XZ => [
          w.a[0] + d[0] * u + n[0] * s,
          w.a[1] + d[1] * u + n[1] * s,
        ];
        /** The corner's arc at b: point and outward direction at angle phi (0..tb). */
        const arc = (s: number, rb: number, phi: number): [XZ, XZ] => {
          const u = len + (s - rb) * tanB;
          const c = flat(u, s - rb);
          const dir: XZ = [
            n[0] * Math.cos(phi) + d[0] * Math.sin(phi),
            n[1] * Math.cos(phi) + d[1] * Math.sin(phi),
          ];
          return [[c[0] + dir[0] * rb, c[1] + dir[1] * rb], dir];
        };
        const { crest, bottom } = cushionSpan(w, g);
        const span = crest - bottom;
        const groundTone = groundLift(land, w.top, g.heightScale, profile.land.defaultLevel);
        const prof = cushionProfile(C, bottom, crest, L.rowStep);
        const convexB = !!succ && tb > 0;

        // The core: the profile inset by coreInset, swept along the run and round the corner.
        // The core reaches coreDrop below the cushion's foot, behind its lowest (hanging) leaves,
        // so the gaps between them are grass, not the face.
        const deep = cushionProfile(
          C,
          Math.max(bottom - C.coreDrop, w.low + 0.01),
          crest,
          L.rowStep,
        );
        const core = deep.all.map(([pd, py, nd, ny]) => ({
          d: pd - nd * C.coreInset,
          y: py - ny * C.coreInset,
          nd,
          ny,
          h: Math.max(0, (py - bottom) / span),
          inward: -pd,
        }));
        // lip: h up the cushion, inward, the ground's tone lift.
        for (let i = 0; i + 1 < core.length; i++) {
          const [p, q] = [core[i], core[i + 1]];
          const [rp, rq] = [run(o + p.d), run(o + q.d)];
          const N = (c: typeof p, dir: XZ): V3 => [dir[0] * c.nd, c.ny, dir[1] * c.nd];
          const attrs = (pts: [typeof p, XZ][]) => ({
            lip: pts.map(([c]) => [c.h, c.inward, groundTone]),
            lipN: pts.map(([c, dir]) => N(c, dir)),
          });
          const mid: V3 = [
            n[0] * (p.nd + q.nd) * 0.5,
            (p.ny + q.ny) * 0.5,
            n[1] * (p.nd + q.nd) * 0.5,
          ];
          const v = (xz: XZ, y: number): V3 => [xz[0], y, xz[1]];
          b.quad(
            [
              v(flat(rp.u0, o + p.d), p.y),
              v(flat(rp.u1, o + p.d), p.y),
              v(flat(rq.u1, o + q.d), q.y),
              v(flat(rq.u0, o + q.d), q.y),
            ],
            mid,
            attrs([
              [p, n],
              [p, n],
              [q, n],
              [q, n],
            ]),
          );
          if (!convexB) continue;
          for (let k = 0; k < ARC_STEPS; k++) {
            const [f0, f1] = [(k / ARC_STEPS) * tb, ((k + 1) / ARC_STEPS) * tb];
            const [pa, da] = arc(o + p.d, rp.rb, f0);
            const [pb, db] = arc(o + p.d, rp.rb, f1);
            const [qb, eb] = arc(o + q.d, rq.rb, f1);
            const [qa, ea] = arc(o + q.d, rq.rb, f0);
            const dm: XZ = [(da[0] + db[0]) / 2, (da[1] + db[1]) / 2];
            b.quad(
              [v(pa, p.y), v(pb, p.y), v(qb, q.y), v(qa, q.y)],
              [dm[0] * (p.nd + q.nd) * 0.5, (p.ny + q.ny) * 0.5, dm[1] * (p.nd + q.nd) * 0.5],
              attrs([
                [p, da],
                [p, db],
                [q, eb],
                [q, ea],
              ]),
            );
          }
        }

        // The plug: a strip of the backing just off the face, from the core's foot to just under
        // the lawn, so where the block's corner pokes through the rounded cushion it shows grass,
        // not the face (the sandbox's plug). It follows the face's fillets.
        {
          const plugBottom = core[0].y + 0.02;
          const plugTop = w.top - 0.06;
          if (plugTop > plugBottom) {
            const e = 0.015;
            const fillets = plain ? filletsOf(w, mine, g, sh.fallAt) : ([null, null] as const);
            const us = [0];
            for (const [end, fe] of fillets.entries()) {
              if (!fe) continue;
              for (let k = 1; k <= ARC_STEPS; k++)
                us.push(end ? len - (fe.r * k) / ARC_STEPS : (fe.r * k) / ARC_STEPS);
            }
            us.push(len);
            us.sort((x, y) => x - y);
            const hOf = (y: number) => Math.max(0, (y - bottom) / span);
            const at = (u: number, y: number): [V3, V3] => {
              const [[x, z], [nx, nz]] = filletPoint(w, fillets, u, e);
              return [
                [x, y, z],
                [nx, 0, nz],
              ];
            };
            for (let i = 0; i + 1 < us.length; i++) {
              if (us[i + 1] - us[i] < 1e-6) continue;
              const c = [
                at(us[i], plugTop),
                at(us[i + 1], plugTop),
                at(us[i + 1], plugBottom),
                at(us[i], plugBottom),
              ];
              b.quad(
                c.map(([p]) => p) as [V3, V3, V3, V3],
                [n[0], 0, n[1]],
                {
                  lip: [
                    [hOf(plugTop), 0, groundTone],
                    [hOf(plugTop), 0, groundTone],
                    [hOf(plugBottom), 0, groundTone],
                    [hOf(plugBottom), 0, groundTone],
                  ],
                  lipN: c.map(([, m]) => m),
                },
                c.map(([, m]) => m) as [V3, V3, V3, V3],
              );
            }
          }
        }

        // Leaf rows along the profile: on the world lattice along the line (straight runs) and
        // by the corner's vertex (arcs), so chunks agree stamp for stamp.
        const line = Math.round(Math.atan2(d[1], d[0]) * 100);
        prof.rows.forEach(([pd, py, nd, ny], r) => {
          const s = o + pd;
          const { u0, u1, rb } = run(s);
          const lineKey = Math.round((w.a[0] * n[0] + w.a[1] * n[1] + s) * 64) * 211 + line;
          const phase = hashI(lineKey, r, 11);
          const [p1, p2] = [hashI(lineKey, r, 12) * 6.283, hashI(lineKey, r, 13) * 6.283];
          const hh = (py - bottom) / span;
          const lift = Math.min(1, Math.max(0, hh / 0.4));
          const place = (xz: XZ, dir: XZ, uw: number, hs: number[]) => {
            const [, h2, h3, h4, h5, h6] = hs;
            // Lower rows stand further out (layer), and a little random depth keeps a row's
            // stamps from z-fighting.
            const out = L.push + L.layer * (1 - hh) + h6 * 0.02;
            const wave =
              lift * L.rowWave * (Math.sin(uw * 2.1 + p1) + 0.6 * Math.sin(uw * 4.7 + p2));
            const nW: V3 = [dir[0] * nd, ny, dir[1] * nd];
            const x = xz[0] + nW[0] * out;
            const z = xz[1] + nW[2] * out;
            const y = py + (h2 - 0.5) * L.jitter * L.rowStep + wave + nW[1] * out;
            const tone =
              landTone(T, nW, [x, y, z], hh, -(pd + out * nd), 1, groundTone) + L.rand * (h5 - 0.5);
            pushLeaf(leaves, x, y, z, (L.size / 2) * (1 + (h3 - 0.5) * L.jitter), tone, h4);
          };
          const uStart = w.a[0] * d[0] + w.a[1] * d[1];
          for (
            let k = Math.ceil((uStart + u0) / L.spacing - phase);
            (k + phase) * L.spacing < uStart + u1;
            k++
          ) {
            const hs = [1, 2, 3, 4, 5, 6];
            for (let q = 0; q < 6; q++) hs[q] = hashI(k, lineKey, r * 8 + q + 1);
            const uw = (k + phase + (hs[0] - 0.5) * L.jitter) * L.spacing;
            const u = uw - uStart;
            place(flat(u, s), n, uw, hs);
          }
          if (convexB && rb > 1e-6) {
            const count = Math.round((rb * tb) / L.spacing);
            const vk = Math.round(w.b[0] * 64) * 4099 + Math.round(w.b[1] * 64);
            for (let k = 0; k < count; k++) {
              const hs = [1, 2, 3, 4, 5, 6];
              for (let q = 0; q < 6; q++) hs[q] = hashI(vk, r * 64 + k, q + 1);
              const phi = (tb * (k + 0.5 + (hs[0] - 0.5) * L.jitter)) / count;
              const [xz, dir] = arc(s, rb, Math.max(0, Math.min(tb, phi)));
              place(xz, dir, uStart + len + rb * phi, hs);
            }
          }
        });
      }
    }
  }

  // The lawn grid's stamps near the outline, as real leaves (the lawn shader draws the same ones
  // further in, and these again under them): cells between the top rounding and edgeBand.
  const edge = edgeField(walls, o);
  const gs = L.topSpacing;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!sh.s.isLand(tx, ty) || (sh.s.isWater(tx, ty) && !sh.cornersOf(tx, ty).length)) continue;
      const own = sh.s.solid(tx, ty)!;
      const shaped = sh.cornersOf(tx, ty).length > 0;
      const [x0, x1, z0, z1] = sh.s.footprint(tx, ty);
      // A plain block needs only the edges that come within edgeBand of it (by their bounds).
      const reach = L.edgeBand - o;
      const close = shaped
        ? []
        : edge.near(tx, ty, own).filter((w) => {
            const [wx0, wx1] = [Math.min(w.a[0], w.b[0]), Math.max(w.a[0], w.b[0])];
            const [wz0, wz1] = [Math.min(w.a[1], w.b[1]), Math.max(w.a[1], w.b[1])];
            const dx = Math.max(0, wx0 - x1, x0 - wx1);
            const dz = Math.max(0, wz0 - z1, z0 - wz1);
            return Math.hypot(dx, dz) <= reach;
          });
      if (!shaped && !close.length) continue;
      /** Distance in from the outline at a point of a plain block's top. */
      const inwardAt = (x: number, z: number) => {
        let best = Infinity;
        for (const w of close) {
          const ex = w.b[0] - w.a[0];
          const ez = w.b[1] - w.a[1];
          const t = Math.max(
            0,
            Math.min(1, ((x - w.a[0]) * ex + (z - w.a[1]) * ez) / (ex * ex + ez * ez)),
          );
          best = Math.min(best, Math.hypot(x - w.a[0] - ex * t, z - w.a[1] - ez * t));
        }
        return best + o;
      };
      for (let j = Math.floor(z0 / gs) - 1; j <= Math.ceil(z1 / gs) + 1; j++) {
        for (let i = Math.floor(x0 / gs) - 1; i <= Math.ceil(x1 / gs) + 1; i++) {
          const x = (i + (hashI(i, j, 1) - 0.5) * L.jitter) * gs;
          const z = (j + (hashI(i, j, 2) - 0.5) * L.jitter) * gs;
          if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
          const top = shaped ? sh.solidAt(x, z) : own;
          if (top === null) continue;
          const inward = shaped ? edge(x, z, top)[0] : inwardAt(x, z);
          if (inward < C.radius || inward > L.edgeBand) continue;
          const y = top + C.coreInset + L.push + hashI(i, j, 6) * 0.02;
          const lift = groundLift(land, top, g.heightScale, profile.land.defaultLevel);
          const tone =
            landTone(T, [0, 1, 0], [x, y, z], 1, inward, 1, lift) + L.rand * (hashI(i, j, 5) - 0.5);
          pushLeaf(
            leaves,
            x,
            y,
            z,
            (L.size / 2) * (1 + (hashI(i, j, 3) - 0.5) * L.jitter),
            tone,
            hashI(i, j, 4),
          );
        }
      }
    }
  }

  // Rows along the foot of every face whose low side is grass: the ground's own stamps.
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      for (const w of walls(tx, ty)) {
        if (!w.lowGrass) continue;
        const lift = groundLift(land, w.low, g.heightScale, profile.land.defaultLevel);
        L.foot.forEach(([out, dy], i) => {
          const off = (p: XZ): [number, number] => [p[0] + w.n[0] * out, p[1] + w.n[2] * out];
          pushLine(leaves, land, off(w.a), off(w.b), w.low + dy, 40 + i, lift);
        });
      }
    }
  }
  return { ...b.finish(), stats: { edges, leaves: leaves.colors.length }, leaves };
}

/**
 * Contact shading: a strip on the lower ground along the foot of every cliff face, `contactWidth`
 * wide, that the shader fades from dark at the wall (`fade` 0) to nothing (`fade` 1). None where
 * the lower side is water or off the map. A cheap substitute for ambient occlusion.
 */
export function buildContactChunk(
  map: MapDoc,
  profile: Profile,
  g: GeomLook,
  spec: GridSpec,
  chunk: ChunkId,
): MeshArrays & { stats: { strips: number } } {
  const sh = terrainShapes(map, profile, g, spec);
  const b = new QuadBuilder({ fade: 1 });
  const { tx0, tx1, ty0, ty1 } = chunkBlocks(spec, chunk);
  const w = Math.min(g.contactWidth, 1.9);
  let strips = 0;
  if (w <= 0) return { ...b.finish(), stats: { strips } };
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!sh.s.isLand(tx, ty)) continue;
      for (const wall of sh.walls(tx, ty)) {
        if (!wall.lowOnMap || wall.lowWater) continue;
        const [[ax, az], [bx, bz]] = [wall.a, wall.b];
        const [ox, , oz] = wall.n;
        const y = wall.low + 0.03;
        b.quad(
          [
            [ax, y, az],
            [bx, y, bz],
            [bx + ox * w, y, bz + oz * w],
            [ax + ox * w, y, az + oz * w],
          ],
          [0, 1, 0],
          { fade: [0, 0, 1, 1] },
        );
        strips++;
      }
    }
  }
  return { ...b.finish(), stats: { strips } };
}
