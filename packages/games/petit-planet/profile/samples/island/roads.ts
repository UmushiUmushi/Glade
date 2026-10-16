// Step 2: the roads. A cobbled ring round the town center, a cobbled road south to the entrance,
// and roads out to a few spots around the island, found by a path search that prefers going
// straight. Roads stay on the low ground (level 1), on whole flat dry tiles (rule P2).

import {
  landmarkAtMajor,
  notFlatEarth,
  placementBlocked,
  setPathAt,
  terrainAt,
  terrainOfMajor,
  type MapDoc,
  type Profile,
} from "../../src";
import type { Rng } from "./rng";

export interface RoadTile {
  X: number;
  Y: number;
  type: string;
}

const W = 160;
const H = 144;
const COBBLE = "island-cobble";
const DIRT = "island-dirt";
const ROAD_LEVEL = 1;
/** Extra cost for turning, so roads run straight and bend rarely. */
const TURN_COST = 4;

/** A tile a road may use: on the map, not the beach or a landmark, flat dry ground at level 1. */
export function roadable(doc: MapDoc, profile: Profile, X: number, Y: number): boolean {
  if (X < 0 || Y < 0 || X >= W || Y >= H || placementBlocked(profile, X, Y)) return false;
  if (notFlatEarth(doc, terrainOfMajor(X, Y))) return false;
  return terrainAt(doc, X, Y)?.h === ROAD_LEVEL;
}

const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

/** The cheapest way from any start tile to the goal, by tiles, turning as little as it can. */
function findWay(
  doc: MapDoc,
  profile: Profile,
  starts: { X: number; Y: number }[],
  goal: { X: number; Y: number },
): { X: number; Y: number }[] | null {
  const key = (X: number, Y: number, d: number) => (Y * W + X) * 4 + d;
  const cost = new Float64Array(W * H * 4).fill(Infinity);
  const from = new Int32Array(W * H * 4).fill(-1);
  const open: [number, number][] = [];
  const push = (k: number, c: number) => {
    open.push([c, k]);
    let i = open.length - 1;
    while (i > 0 && open[(i - 1) >> 1][0] > open[i][0]) {
      [open[i], open[(i - 1) >> 1]] = [open[(i - 1) >> 1], open[i]];
      i = (i - 1) >> 1;
    }
  };
  const pop = (): [number, number] | undefined => {
    const top = open[0];
    const last = open.pop();
    if (!open.length || !last) return top;
    open[0] = last;
    let i = 0;
    for (;;) {
      const [l, r] = [2 * i + 1, 2 * i + 2];
      let m = i;
      if (l < open.length && open[l][0] < open[m][0]) m = l;
      if (r < open.length && open[r][0] < open[m][0]) m = r;
      if (m === i) break;
      [open[i], open[m]] = [open[m], open[i]];
      i = m;
    }
    return top;
  };
  for (const s of starts) {
    for (let d = 0; d < 4; d++) {
      cost[key(s.X, s.Y, d)] = 0;
      push(key(s.X, s.Y, d), 0);
    }
  }
  for (let next = pop(); next; next = pop()) {
    const [c, k] = next;
    if (c > cost[k]) continue;
    const d = k % 4;
    const tile = (k - d) / 4;
    const [X, Y] = [tile % W, Math.floor(tile / W)];
    if (X === goal.X && Y === goal.Y) return trace(from, k);
    for (let nd = 0; nd < 4; nd++) {
      const [nX, nY] = [X + DIRS[nd][0], Y + DIRS[nd][1]];
      if (!roadable(doc, profile, nX, nY)) continue;
      const nk = key(nX, nY, nd);
      const nc = c + 1 + (nd === d ? 0 : TURN_COST);
      if (nc < cost[nk]) {
        cost[nk] = nc;
        from[nk] = k;
        push(nk, nc);
      }
    }
  }
  return null;
}

function trace(from: Int32Array, end: number): { X: number; Y: number }[] {
  const out: { X: number; Y: number }[] = [];
  for (let k = end; k !== -1; k = from[k]) {
    const tile = (k - (k % 4)) / 4;
    out.push({ X: tile % W, Y: Math.floor(tile / W) });
  }
  return out.reverse();
}

/** The ring of tiles two wide around the town center. */
function townRing(profile: Profile): { X: number; Y: number }[] {
  const lm = profile.landmarks[0];
  const out: { X: number; Y: number }[] = [];
  for (let Y = lm.y - 2; Y < lm.y + lm.h + 2; Y++) {
    for (let X = lm.x - 2; X < lm.x + lm.w + 2; X++) {
      if (!landmarkAtMajor(profile, X, Y)) out.push({ X, Y });
    }
  }
  return out;
}

/** A spot for a road to reach in each part of the island: flat ground far from the town. */
function destinations(doc: MapDoc, profile: Profile, rng: Rng, count: number) {
  const lm = profile.landmarks[0];
  const [cx, cy] = [lm.x + lm.w / 2, lm.y + lm.h / 2];
  const out: { X: number; Y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count + rng.range(-0.3, 0.3);
    for (let tries = 0; tries < 40; tries++) {
      const r = rng.range(28, 56);
      const X = Math.round(cx + r * Math.cos(angle) * 1.2);
      const Y = Math.round(cy + r * Math.sin(angle));
      if (roadable(doc, profile, X, Y)) {
        out.push({ X, Y });
        break;
      }
    }
  }
  return out;
}

/** Lay a road along a way, one tile wide, or two when `wide` (the second beside it, if it fits). */
function lay(
  doc: MapDoc,
  profile: Profile,
  way: { X: number; Y: number }[],
  type: string,
  wide: boolean,
  laid: Map<string, RoadTile>,
) {
  way.forEach((t, i) => {
    const tiles = [t];
    if (wide) {
      const n = way[Math.min(i + 1, way.length - 1)];
      const p = way[Math.max(i - 1, 0)];
      const horizontal = n.Y === p.Y;
      tiles.push(horizontal ? { X: t.X, Y: t.Y + 1 } : { X: t.X + 1, Y: t.Y });
    }
    for (const { X, Y } of tiles) {
      const k = `${X},${Y}`;
      if (laid.has(k) || !roadable(doc, profile, X, Y)) continue;
      setPathAt(doc, X, Y, type);
      laid.set(k, { X, Y, type });
    }
  });
}

/** Every road: the town ring, the road to the entrance, and roads out across the island. */
export function layRoads(doc: MapDoc, profile: Profile, rng: Rng): RoadTile[] {
  const laid = new Map<string, RoadTile>();
  const ring = townRing(profile).filter((t) => roadable(doc, profile, t.X, t.Y));
  lay(doc, profile, ring, COBBLE, false, laid);
  const entrance = profile.landmarks[1];
  const gate = { X: entrance.x + 1, Y: profile.major.h - profile.beach.width - 1 };
  const toGate = findWay(doc, profile, ring, gate);
  if (toGate) lay(doc, profile, toGate, COBBLE, true, laid);
  destinations(doc, profile, rng, 8).forEach((spot, i) => {
    const starts = [...laid.values()];
    const way = findWay(doc, profile, starts, spot);
    if (way) lay(doc, profile, way, i % 2 === 0 ? COBBLE : DIRT, i % 2 === 0, laid);
  });
  return [...laid.values()];
}
