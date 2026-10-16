// Step 6: the extras that exercise more of the game. Ramps up the hills' straight edges (rule
// I6), rowboats on the ponds (items that sit on water), and small things standing on tables and
// stalls (surfaces, rules S1 to S3).

import { catalogEntry, terrainAt, type Item, type Rotation } from "../../src";
import type { Placer } from "./placer";
import type { Pond } from "./terrain";

const RAMPS = ["island-wood-ramp", "island-stone-ramp"];
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Whether the ground two tiles away, on some side, is one level higher. */
function stepsUp(placer: Placer, X: number, Y: number): boolean {
  const here = terrainAt(placer.doc, X, Y)?.h ?? 0;
  return [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ].some(([dx, dy]) => terrainAt(placer.doc, X + dx, Y + dy)?.h === here + 1);
}

/** A ramp near tile (X, Y), any way round, a half tile either way: true when one fits. */
function rampAt(placer: Placer, type: string, X: number, Y: number): boolean {
  const nudges = [
    [0, 0],
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 0],
  ];
  for (const rot of ROTATIONS) {
    for (const [dx, dy] of nudges) {
      if (placer.item(type, 2 * X + dx, 2 * Y + dy, rot)) return true;
    }
  }
  return false;
}

/** Ramps where the ground steps up by one level: tried at many spots, kept where they fit. */
export function addRamps(placer: Placer, count: number): number {
  let added = 0;
  for (let tries = 0; added < count && tries < 3000; tries++) {
    const X = placer.rng.int(20, 139);
    const Y = placer.rng.int(20, 123);
    if (stepsUp(placer, X, Y) && rampAt(placer, placer.rng.pick(RAMPS), X, Y)) added++;
  }
  return added;
}

/** A rowboat on each pond that has room for one. */
export function launchBoats(placer: Placer, ponds: Pond[]): number {
  let launched = 0;
  for (const p of ponds) {
    const rot: Rotation = p.rx >= p.ry ? 90 : 0;
    if (placer.item("island-rowboat", 2 * p.x - 2, 2 * p.y - 2, rot)) launched++;
  }
  return launched;
}

const SMALL = ["island-tea-cup", "island-flower-pot", "island-vase", "island-lantern"];

/** Small things on tables, stalls and benches with a top: one to three each. */
export function setTables(placer: Placer, hosts: Item[]): number {
  let set = 0;
  for (const host of hosts) {
    const surface = catalogEntry(placer.game.catalog, host.type)?.surface;
    if (!surface) continue;
    const wanted = placer.rng.int(1, 3);
    for (let tries = 0, n = 0; n < wanted && tries < 15; tries++) {
      const x = 2 * placer.rng.int(0, surface.w / 2 - 1);
      const y = 2 * placer.rng.int(0, surface.h / 2 - 1);
      if (placer.onSurface(placer.rng.pick(SMALL), host, x, y)) {
        n++;
        set++;
      }
    }
  }
  return set;
}
