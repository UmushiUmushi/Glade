// Step 1 of making the island: the land. Rolling hills from a few soft bumps, cut into whole
// levels, kept within the step limit (T3), and flat around the town center and the island's edge.
// Then ponds, dug only where the ground around them is level, so no water spills over a cliff.

import {
  isEditableTerrain,
  isTerrainLocked,
  landmarkTerrainRect,
  setTerrain,
  terrainAt,
  type MapDoc,
  type Profile,
} from "../../src";
import type { Rng } from "./rng";

/** Blocks kept at level 1 around the town center, so roads can circle it. */
const TOWN_MARGIN = 6;
/** Blocks kept at level 1 inside the island's locked edge. */
const EDGE_MARGIN = 3;
const HILLS = 7;
const TOP_LEVEL = 5;

interface Bump {
  x: number;
  y: number;
  height: number;
  spread: number;
}

/** Distance in blocks from a block to a rect (0 inside it). */
function distanceTo(r: { x: number; y: number; w: number; h: number }, tx: number, ty: number) {
  const dx = Math.max(r.x - tx, 0, tx - (r.x + r.w - 1));
  const dy = Math.max(r.y - ty, 0, ty - (r.y + r.h - 1));
  return Math.max(dx, dy);
}

/** Blocks that stay at the default level: locked ones, and a margin round the town and the edge. */
export function keptFlat(profile: Profile, tx: number, ty: number): boolean {
  if (isTerrainLocked(profile, tx, ty)) return true;
  const { x, y } = profile.terrainEditable;
  if (tx - x[0] < EDGE_MARGIN || x[1] - tx < EDGE_MARGIN) return true;
  if (ty - y[0] < EDGE_MARGIN || y[1] - ty < EDGE_MARGIN) return true;
  return profile.landmarks.some(
    (lm) => lm.lockTerrain && distanceTo(landmarkTerrainRect(lm), tx, ty) < TOWN_MARGIN,
  );
}

/** Bumps away from the town center: hills where the town isn't. */
function placeBumps(profile: Profile, rng: Rng): Bump[] {
  const town = landmarkTerrainRect(profile.landmarks[0]);
  const bumps: Bump[] = [];
  while (bumps.length < HILLS) {
    const x = rng.int(profile.terrainEditable.x[0] + 8, profile.terrainEditable.x[1] - 8);
    const y = rng.int(profile.terrainEditable.y[0] + 8, profile.terrainEditable.y[1] - 8);
    if (distanceTo(town, x, y) < 18) continue;
    bumps.push({ x, y, height: rng.range(1.8, 4.6), spread: rng.range(6, 12) });
  }
  return bumps;
}

function heightAt(bumps: Bump[], tx: number, ty: number): number {
  let f = 0;
  for (const b of bumps) {
    const d2 = (tx - b.x) ** 2 + (ty - b.y) ** 2;
    f += b.height * Math.exp(-d2 / (2 * b.spread ** 2));
  }
  return f;
}

/** Lower any block more than the step limit above a neighbor, until none is. */
function keepStepLimit(map: MapDoc, profile: Profile): void {
  const limit = profile.maxStepBetweenNeighbors;
  let changed = true;
  while (changed) {
    changed = false;
    forEachEditable(profile, (tx, ty) => {
      const here = terrainAt(map, tx, ty);
      if (!here) return;
      let lowest = here.h;
      for (const [dx, dy] of NEIGHBORS)
        lowest = Math.min(lowest, terrainAt(map, tx + dx, ty + dy)?.h ?? here.h);
      if (here.h - lowest > limit) {
        setTerrain(map, tx, ty, { ...here, h: lowest + limit });
        changed = true;
      }
    });
  }
}

const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function forEachEditable(profile: Profile, run: (tx: number, ty: number) => void): void {
  const { x, y } = profile.terrainEditable;
  for (let ty = y[0]; ty <= y[1]; ty++) for (let tx = x[0]; tx <= x[1]; tx++) run(tx, ty);
}

/** Rolling hills: whole levels from 1 to 5, within the step limit. */
export function shapeHills(map: MapDoc, profile: Profile, rng: Rng): void {
  const bumps = placeBumps(profile, rng);
  forEachEditable(profile, (tx, ty) => {
    if (keptFlat(profile, tx, ty)) return;
    const h = Math.min(TOP_LEVEL, 1 + Math.floor(heightAt(bumps, tx, ty)));
    setTerrain(map, tx, ty, { h, water: false });
  });
  keepStepLimit(map, profile);
}

/** Whether every block in an ellipse, and a ring of 2 around it, is dry at one level. */
function levelAround(
  map: MapDoc,
  profile: Profile,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  const level = terrainAt(map, cx, cy)?.h;
  for (let ty = cy - ry - 2; ty <= cy + ry + 2; ty++) {
    for (let tx = cx - rx - 2; tx <= cx + rx + 2; tx++) {
      const cell = terrainAt(map, tx, ty);
      if (!cell || cell.water || cell.h !== level) return false;
      if (!isEditableTerrain(profile, tx, ty) || keptFlat(profile, tx, ty)) return false;
    }
  }
  return true;
}

/** A pond: its middle block and its half widths, in blocks. */
export interface Pond {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Ponds: water in blocks whose whole neighborhood is level, so it never touches lower ground. */
export function digPonds(map: MapDoc, profile: Profile, rng: Rng, count: number): Pond[] {
  const dug: Pond[] = [];
  for (let attempt = 0; attempt < 400 && dug.length < count; attempt++) {
    const rx = rng.int(4, 8);
    const ry = rng.int(3, 6);
    const cx = rng.int(profile.terrainEditable.x[0] + 10, profile.terrainEditable.x[1] - 10);
    const cy = rng.int(profile.terrainEditable.y[0] + 10, profile.terrainEditable.y[1] - 10);
    if (!levelAround(map, profile, cx, cy, rx, ry)) continue;
    for (let ty = cy - ry; ty <= cy + ry; ty++) {
      for (let tx = cx - rx; tx <= cx + rx; tx++) {
        if (((tx - cx) / rx) ** 2 + ((ty - cy) / ry) ** 2 > 1) continue;
        const cell = terrainAt(map, tx, ty);
        if (cell) setTerrain(map, tx, ty, { ...cell, water: true });
      }
    }
    dug.push({ x: cx, y: cy, rx, ry });
  }
  return dug;
}
