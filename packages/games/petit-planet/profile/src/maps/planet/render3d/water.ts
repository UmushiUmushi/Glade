// Water geometry per chunk: a surface quad per water block at h - inset (a polygon per water region
// where a corner is cut or rounded, corners.ts), a vertical sheet on every side that falls to a
// lower neighbor, and a foam mound at the sheet's foot. Where water falls, the surface stops short
// and a rounded lip (style fall.lip) curves down into the sheet. Pure; tested in
// tests/three-geometry.test.ts.
//
// Attributes: kind (0 surface, 1 fall sheet, 2 foam), shore (surface only: 0 at the water's edge, 1
// two blocks inward), uv (sheets and foam: x along the edge, y down the fall / out from the wall),
// run (sheets and foam: the whole fall's width along the edge and its drop). A fall wider than one
// block is one run: uv x counts from the run's start, so the sheet's streaks continue across blocks
// and only the run's own ends get the light edge.

import type { GridSpec } from "../space";
import { terrainGrid, type MapDoc } from "../model";
import type { Profile } from "../profile";
import { QuadBuilder, type MeshArrays, type V3 } from "@glade/render";
import { chunkBlocks, SIDES, terrainShapes, type ChunkId, type GeomLook } from "./terrain";

export const WATER_KIND = { surface: 0, fall: 1, foam: 2 } as const;

/** Segments in a fall's rounded lip. */
const LIP_STEPS = 4;
/** How far a fall's sheet stands off the face behind it (whose dents fade out there, terrain.ts). */
const FALL_OUT = 0.02;

/** Keep the part of a polygon (with a value per point) on one side of an axis line. */
function clip(
  pts: [number, number][],
  vals: number[],
  axis: 0 | 1,
  bound: number,
  keepAbove: boolean,
): { pts: [number, number][]; vals: number[] } {
  const inside = (p: [number, number]) => (keepAbove ? p[axis] >= bound : p[axis] <= bound);
  const out: [number, number][] = [];
  const outVals: number[] = [];
  pts.forEach((p, i) => {
    const j = (i + 1) % pts.length;
    const q = pts[j];
    if (inside(p)) {
      out.push(p);
      outVals.push(vals[i]);
    }
    if (inside(p) !== inside(q)) {
      const t = (bound - p[axis]) / (q[axis] - p[axis]);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      outVals.push(vals[i] + (vals[j] - vals[i]) * t);
    }
  });
  return { pts: out, vals: outVals };
}

export interface WaterChunk extends MeshArrays {
  stats: { surfaces: number; falls: number; foams: number };
}

export function buildWaterChunk(
  map: MapDoc,
  profile: Profile,
  g: GeomLook,
  spec: GridSpec,
  chunk: ChunkId,
): WaterChunk {
  const sh = terrainShapes(map, profile, g, spec);
  const s = sh.s;
  const b = new QuadBuilder({ kind: 1, shore: 1, uv: 2, run: 2 });
  const { tx0, tx1, ty0, ty1 } = chunkBlocks(spec, chunk);
  const dist = shoreDistance(s.isWater);
  const grid = terrainGrid(map);
  const fallLanding = sh.fallLanding;
  /** Blocks of the same fall before and after this one along its edge. */
  const runOf = (tx: number, ty: number, side: (typeof SIDES)[number]) => {
    // The edge runs a -> b; in blocks that is (-dy, dx) for SIDES' winding.
    const [ex, ey] = [-side.dy, side.dx];
    const h = grid[ty][tx].h;
    const same = (x: number, y: number) =>
      grid[y]?.[x]?.h === h && fallLanding(x, y, side) !== null;
    let back = 0;
    while (same(tx - ex * (back + 1), ty - ey * (back + 1))) back++;
    let fwd = 0;
    while (same(tx + ex * (fwd + 1), ty + ey * (fwd + 1))) fwd++;
    return { back, fwd };
  };
  let surfaces = 0;
  let falls = 0;
  let foams = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const f = s.footprint(tx, ty);
      const [x0, x1, z0, z1] = f;
      // Corner (i, j) is shared by blocks tx+i-1..tx+i, ty+j-1..ty+j.
      const corner = (i: number, j: number) =>
        Math.min(
          1,
          Math.min(
            dist(tx + i - 1, ty + j - 1),
            dist(tx + i, ty + j - 1),
            dist(tx + i - 1, ty + j),
            dist(tx + i, ty + j),
          ) / 2,
        );
      // Sides this block falls over, and how far the surface stops short of each (its lip).
      const lips: { side: (typeof SIDES)[number]; landing: number; r: number }[] = [];
      if (s.isWater(tx, ty)) {
        for (const side of SIDES) {
          const landing = fallLanding(tx, ty, side);
          if (landing === null) continue;
          const r = Math.min(g.fallLip, (s.surface(tx, ty) - landing) / 2);
          lips.push({ side, landing, r });
        }
      }
      /** The surface's footprint, pulled back from each lip (axis, bound, keep above). */
      const cuts = lips
        .filter((l) => l.r > FALL_OUT)
        .map(({ side, r }): [0 | 1, number, boolean] => {
          const back = r - FALL_OUT;
          const [nx, , nz] = side.n;
          if (nx > 0) return [0, x1 - back, false];
          if (nx < 0) return [0, x0 + back, true];
          if (nz > 0) return [1, z1 - back, false];
          return [1, z0 + back, true];
        });
      // Shaped corners: the water in each region, at 0 shore along the curves.
      const regions = s.isLand(tx, ty) ? sh.regions(tx, ty) : null;
      if (regions) {
        for (const { pts, value } of regions) {
          if (!value.water) continue;
          const y = (value.h - g.inset) * g.heightScale;
          let cut = {
            pts: pts as [number, number][],
            vals: pts.map(([x, z]) => {
              const i = x === x0 ? 0 : x === x1 ? 1 : -1;
              const j = z === z0 ? 0 : z === z1 ? 1 : -1;
              return i >= 0 && j >= 0 ? corner(i, j) : 0;
            }),
          };
          for (const [axis, bound, above] of cuts) {
            cut = clip(cut.pts, cut.vals, axis, bound, above);
          }
          if (cut.pts.length < 3) continue;
          const shore = cut.vals;
          b.polygon(
            cut.pts.map(([x, z]): V3 => [x, y, z]),
            [0, 1, 0],
            { kind: WATER_KIND.surface, shore },
          );
          surfaces++;
        }
      }
      if (!s.isWater(tx, ty)) continue;
      const y = s.surface(tx, ty);
      // The surface's own edges, pulled back from the lips.
      let [sx0, sx1, sz0, sz1] = [x0, x1, z0, z1];
      for (const [axis, bound, above] of cuts) {
        if (axis === 0 && above) sx0 = bound;
        else if (axis === 0) sx1 = bound;
        else if (above) sz0 = bound;
        else sz1 = bound;
      }
      if (!regions)
        b.quad(
          [
            [sx0, y, sz0],
            [sx1, y, sz0],
            [sx1, y, sz1],
            [sx0, y, sz1],
          ],
          [0, 1, 0],
          {
            kind: WATER_KIND.surface,
            shore: [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)],
          },
        );
      if (!regions) surfaces++;

      for (const { side, landing, r: lipR } of lips) {
        const [[ax, az], [bx, bz]] = side.edge(f);
        const len = Math.hypot(bx - ax, bz - az);
        const { back, fwd } = runOf(tx, ty, side);
        const u0 = 2 * back;
        const [ox, , oz] = side.n;
        const off = (d: number, p: [number, number], yy: number): V3 => [
          p[0] + ox * d,
          yy,
          p[1] + oz * d,
        ];
        const drop = y - landing;
        const out = FALL_OUT;
        // The lip: a quarter circle from the pulled-back surface down to the sheet's top.
        const r = lipR > out ? lipR : 0;
        const lipLen = (r * Math.PI) / 2;
        const run: [number, number] = [2 * (back + fwd) + len, drop - r + lipLen];
        const fall = (pts: [V3, V3, V3, V3], n: V3, v0: number, v1: number) =>
          b.quad(pts, n, {
            kind: WATER_KIND.fall,
            shore: 1,
            uv: [
              [u0, v0],
              [u0 + len, v0],
              [u0 + len, v1],
              [u0, v1],
            ],
            run: [run, run, run, run],
          });
        for (let k = 0; r > 0 && k < LIP_STEPS; k++) {
          const [t0, t1] = [k / LIP_STEPS, (k + 1) / LIP_STEPS].map((t) => (t * Math.PI) / 2);
          const at = (t: number, p: [number, number]) =>
            off(out - r + r * Math.sin(t), p, y - r + r * Math.cos(t));
          const tm = (t0 + t1) / 2;
          fall(
            [at(t0, [ax, az]), at(t0, [bx, bz]), at(t1, [bx, bz]), at(t1, [ax, az])],
            [ox * Math.sin(tm), Math.cos(tm), oz * Math.sin(tm)],
            r * t0,
            r * t1,
          );
        }
        fall(
          [
            off(out, [ax, az], y - r),
            off(out, [bx, bz], y - r),
            off(out, [bx, bz], landing),
            off(out, [ax, az], landing),
          ],
          side.n,
          lipLen,
          lipLen + drop - r,
        );
        falls++;
        // Foam mound: slopes from the wall out to `spread` at the landing.
        const top = landing + Math.min(g.foamHeight, drop);
        const slope: V3 = [ox * (top - landing), g.foamSpread, oz * (top - landing)];
        const sl = Math.hypot(...slope);
        b.quad(
          [
            off(out + 0.02, [ax, az], top),
            off(out + 0.02, [bx, bz], top),
            off(g.foamSpread, [bx, bz], landing + 0.01),
            off(g.foamSpread, [ax, az], landing + 0.01),
          ],
          [slope[0] / sl, slope[1] / sl, slope[2] / sl],
          {
            kind: WATER_KIND.foam,
            shore: 1,
            uv: [
              [u0, 0],
              [u0 + len, 0],
              [u0 + len, 1],
              [u0, 1],
            ],
            run: [run, run, run, run],
          },
        );
        foams++;
      }
    }
  }
  return { ...b.finish(), stats: { surfaces, falls, foams } };
}

/**
 * Blocks from a water block to the nearest non-water block (Chebyshev), capped at 3; 0 for
 * non-water. Memoized per build.
 */
export function shoreDistance(isWater: (tx: number, ty: number) => boolean) {
  const memo = new Map<number, number>();
  return (tx: number, ty: number): number => {
    const key = ty * 4096 + tx;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let d = 0;
    if (isWater(tx, ty)) {
      d = 3;
      search: for (let r = 1; r <= 2; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !isWater(tx + dx, ty + dy)) {
              d = r;
              break search;
            }
          }
        }
      }
    }
    memo.set(key, d);
    return d;
  };
}
