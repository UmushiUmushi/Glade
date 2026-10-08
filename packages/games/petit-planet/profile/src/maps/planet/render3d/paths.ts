// Path decals per chunk: a quad per path cell at its ground level + 0.02, or a polygon where a
// corner is cut or rounded (corners.ts) or the cell stops short of a different path type beside it
// (the game never merges two types; `pathGap`). `pcolor` (linear RGB) and `pattern` (1 cobble, 0
// plain) come from the path's catalog entry; a path not in the catalog is a plain grey stub. The
// light and grade make day and night, so switching them needs no rebuild. `open` flags a square cell's sides (north, east, south, west) that border grass at the
// same height: there the shader lets the grass's lobes overlap the path, as in the game; a row of
// leaf stamps stands on those sides, overlapping the path as the game's grass does. `corner` flags
// a cell's corners (north-west, north-east, south-east, south-west) with no path on either side:
// the shader rounds those a little (style paths.corner). Pure.

import type { GridSpec } from "../space";
import { pathAt, type MapDoc } from "../model";
import { type Profile } from "../profile";
import { pathEntry, type Catalog } from "../../../catalog";
import { pathCellRegions, type Pt } from "../corners";
import { QuadBuilder, type MeshArrays, type V3 } from "@glade/render";
import { chunkMajors, sampler, type ChunkId, type GeomLook } from "./terrain";
import { groundLift, pushLine, type LeafList } from "./land";

export const PATH_LIFT = 0.02;
/** How a path not in the catalog is drawn. */
const STUB_COLOR = "#999999";

/** "#rrggbb" (sRGB) as linear RGB, as the renderer's colors are. */
function linearRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

/** Segments in the arc of grass round a rounded path corner. */
const CORNER_STEPS = 3;

/** Keep the part of a polygon on one side of an axis line (Sutherland-Hodgman). */
function clip(pts: Pt[], axis: 0 | 1, bound: number, keepAbove: boolean): Pt[] {
  const inside = (p: Pt) => (keepAbove ? p[axis] >= bound : p[axis] <= bound);
  const out: Pt[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) {
      const t = (bound - p[axis]) / (q[axis] - p[axis]);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return out;
}

export function buildPathChunk(
  map: MapDoc,
  profile: Profile,
  catalog: Catalog,
  g: GeomLook,
  spec: GridSpec,
  chunk: ChunkId,
): MeshArrays & { stats: { cells: number }; leaves: LeafList } {
  const s = sampler(map, profile, g, spec);
  const leaves: LeafList = { matrices: [], colors: [] };
  const L = g.land;
  const b = new QuadBuilder({ pcolor: 3, pattern: 1, open: 4, corner: 4 });
  const { X0, X1, Y0, Y1 } = chunkMajors(spec, chunk);
  const looks = new Map<string, { pcolor: number[]; pattern: number }>();
  /** A path type's color and pattern attributes. */
  const lookOf = (type: string) => {
    let l = looks.get(type);
    if (!l) {
      const e = pathEntry(catalog, type);
      l = {
        pcolor: linearRgb(e?.color ?? STUB_COLOR),
        pattern: e && e.pattern !== "plain" ? 1 : 0,
      };
      looks.set(type, l);
    }
    return l;
  };
  let cells = 0;
  for (let Y = Y0; Y <= Y1; Y++) {
    for (let X = X0; X <= X1; X++) {
      const regions = pathCellRegions(map, profile, X, Y);
      if (!regions) continue;
      const type = pathAt(map, X, Y);
      const top = (x: number, y: number) =>
        Math.max(s.ground(x, y), s.ground(x + 1, y), s.ground(x, y + 1), s.ground(x + 1, y + 1));
      const ground = top(X, Y);
      const y = ground + PATH_LIFT;
      // Grass beside a side: no path there, dry land on the map, at the same height.
      const grassy = (dx: number, dy: number) => {
        const [nx, ny] = [X + dx, Y + dy];
        if (nx < 0 || ny < 0 || nx >= spec.majorW || ny >= spec.majorH) return 0;
        if (pathAt(map, nx, ny)) return 0;
        for (const [i, j] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          if (!s.isLand(nx + i, ny + j) || s.isWater(nx + i, ny + j)) return 0;
        }
        return Math.abs(top(nx, ny) - ground) < 1e-6 ? 1 : 0;
      };
      const [x0, x1, z0, z1] = [2 * X, 2 * X + 2, 2 * Y, 2 * Y + 2];
      // Corners with no path on either side are rounded (a square cell's own corners only).
      const bare = (dx: number, dy: number) => (pathAt(map, X + dx, Y + dy) ? 0 : 1);
      const [n, e, so, w] = [bare(0, -1), bare(1, 0), bare(0, 1), bare(-1, 0)];
      const corner = regions === "square" ? [n * w, n * e, so * e, so * w] : [0, 0, 0, 0];
      // Sides beside a different path type stop short of it.
      const other = (dx: number, dy: number) => {
        const t = pathAt(map, X + dx, Y + dy);
        return !!type && !!t && t !== type && g.pathGap > 0;
      };
      const gaps: [0 | 1, number, boolean][] = [];
      if (other(-1, 0)) gaps.push([0, x0 + g.pathGap, true]);
      if (other(1, 0)) gaps.push([0, x1 - g.pathGap, false]);
      if (other(0, -1)) gaps.push([1, z0 + g.pathGap, true]);
      if (other(0, 1)) gaps.push([1, z1 - g.pathGap, false]);
      if (regions === "square") {
        // Tufts on each side that borders grass: rows of the lawn's stamps (style
        // leaves.pathRows: [how far over the path, height]), so the grass overhangs the path.
        const ly = ground + L.cushion.coreInset + L.leaves.push;
        const lift = groundLift(L, ground, g.heightScale, profile.land.defaultLevel);
        // Sides north, east, south, west; side k runs from corner k to corner k + 1 (corners
        // north-west, north-east, south-east, south-west, each with its inward direction).
        const open = [grassy(0, -1), grassy(1, 0), grassy(0, 1), grassy(-1, 0)];
        const corners: [number, number, number, number][] = [
          [x0, z0, 1, 1],
          [x1, z0, -1, 1],
          [x1, z1, -1, -1],
          [x0, z1, 1, -1],
        ];
        // Rounded corners with grass on both sides: the rows bend round them.
        const R = g.pathCorner;
        const bends = corner.map((c, k) => !!c && R > 0 && !!open[k] && !!open[(k + 3) % 4]);
        L.leaves.pathRows.forEach(([inset, dy], r) => {
          for (let k = 0; k < 4; k++) {
            if (!open[k]) continue;
            const [ax, az, aix, aiz] = corners[k];
            const [bx, bz, bix, biz] = corners[(k + 1) % 4];
            // The row along this side, `inset` in from it, short of each bent corner by R.
            const [tx, tz] = [Math.sign(bx - ax), Math.sign(bz - az)];
            const [ix, iz] = [(aix + bix) / 2, (aiz + biz) / 2];
            const ta = bends[k] ? R : 0;
            const tb = bends[(k + 1) % 4] ? R : 0;
            pushLine(
              leaves,
              L,
              [ax + tx * ta + ix * inset, az + tz * ta + iz * inset],
              [bx - tx * tb + ix * inset, bz - tz * tb + iz * inset],
              ly + dy,
              50 + 4 * r + k,
              lift,
            );
          }
          // Each bent corner: a quarter arc round its center, R in from both sides.
          corners.forEach(([cx, cz, ix, iz], k) => {
            const rho = R - inset;
            if (!bends[k] || rho <= 0) return;
            const [ox, oz] = [cx + ix * R, cz + iz * R];
            const at = (t: number): [number, number] => [
              ox - ix * rho * Math.cos(t),
              oz - iz * rho * Math.sin(t),
            ];
            for (let i = 0; i < CORNER_STEPS; i++) {
              const [t0, t1] = [i, i + 1].map((j) => (j / CORNER_STEPS) * (Math.PI / 2));
              pushLine(leaves, L, at(t0), at(t1), ly + dy, 70 + 16 * r + 4 * k + i, lift);
            }
          });
        });
      }
      if (regions === "square" && !gaps.length) {
        b.quad(
          [
            [x0, y, z0],
            [x1, y, z0],
            [x1, y, z1],
            [x0, y, z1],
          ],
          [0, 1, 0],
          {
            ...lookOf(type!),
            open: [grassy(0, -1), grassy(1, 0), grassy(0, 1), grassy(-1, 0)],
            corner,
          },
        );
        cells++;
        continue;
      }
      const polys =
        regions === "square"
          ? [
              {
                pts: [
                  [X, Y],
                  [X + 1, Y],
                  [X + 1, Y + 1],
                  [X, Y + 1],
                ] as Pt[],
                type: type!,
              },
            ]
          : regions;
      for (const poly of polys) {
        let pts = poly.pts.map(([px, pz]): Pt => [2 * px, 2 * pz]);
        for (const [axis, bound, above] of gaps) pts = clip(pts, axis, bound, above);
        if (pts.length < 3) continue;
        b.polygon(
          pts.map(([px, pz]): V3 => [px, y, pz]),
          [0, 1, 0],
          { ...lookOf(poly.type), open: [0, 0, 0, 0], corner },
        );
      }
      cells++;
    }
  }
  return { ...b.finish(), stats: { cells }, leaves };
}
