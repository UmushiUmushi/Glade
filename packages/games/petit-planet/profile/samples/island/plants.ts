// Step 5: plants. Woods on the hills (pines up high, leafy trees lower), a few trees in the
// meadows, flower beds in patches of one kind, bushes and tall grass. Trees keep a free tile
// round them (rule L6), which the placer's check enforces.

import { pathAt, terrainAt } from "../../src";
import type { Placer } from "./placer";

const HIGH_TREES = ["island-pine", "island-pine", "island-birch"];
const LOW_TREES = ["island-oak", "island-maple", "island-birch", "island-fruit-tree", "island-oak"];
const FLOWERS = [
  "island-tulips",
  "island-daisies",
  "island-lavender",
  "island-roses",
  "island-sunflowers",
];
const BUSHES = ["island-round-bush", "island-berry-bush", "island-fern", "island-tall-grass"];

function randomTile(placer: Placer): { X: number; Y: number } {
  return { X: placer.rng.int(18, 141), Y: placer.rng.int(18, 125) };
}

/** A clump of trees within `r` tiles of a tile: woods, where most tiles that can take one do. */
function grove(placer: Placer, X: number, Y: number, r: number, density: number): number {
  let grown = 0;
  for (let y = Y - r; y <= Y + r; y++) {
    for (let x = X - r; x <= X + r; x++) {
      if ((x - X) ** 2 + (y - Y) ** 2 > r * r || placer.rng.next() > density) continue;
      if (pathAt(placer.doc, x, y)) continue;
      const level = terrainAt(placer.doc, x, y)?.h ?? 0;
      if (placer.plant(placer.rng.pick(level >= 4 ? HIGH_TREES : LOW_TREES), x, y)) grown++;
    }
  }
  return grown;
}

/**
 * Trees: woods on the hills and groves in the meadows, then single trees here and there. Stops
 * at `count`.
 */
export function growTrees(placer: Placer, count: number, groves: number): number {
  let grown = 0;
  for (let g = 0, tries = 0; g < groves && tries < groves * 20 && grown < count; tries++) {
    const { X, Y } = randomTile(placer);
    const level = terrainAt(placer.doc, X, Y)?.h ?? 0;
    if (level <= 1 && placer.rng.next() < 0.6) continue;
    grown += grove(placer, X, Y, placer.rng.int(4, 9), placer.rng.range(0.45, 0.8));
    g++;
  }
  for (let tries = 0; grown < count && tries < count * 10; tries++) {
    const { X, Y } = randomTile(placer);
    if (!pathAt(placer.doc, X, Y) && placer.plant(placer.rng.pick(LOW_TREES), X, Y)) grown++;
  }
  return grown;
}

/** Flower beds: patches of one kind, a few tiles across. */
export function plantFlowers(placer: Placer, patches: number): number {
  let planted = 0;
  for (let p = 0; p < patches; p++) {
    const { X, Y } = randomTile(placer);
    const type = placer.rng.pick(FLOWERS);
    const r = placer.rng.int(1, 3);
    for (let y = Y - r; y <= Y + r; y++) {
      for (let x = X - r; x <= X + r; x++) {
        if ((x - X) ** 2 + (y - Y) ** 2 > r * r + 1 || placer.rng.next() < 0.3) continue;
        if (!pathAt(placer.doc, x, y) && placer.plant(type, x, y)) planted++;
      }
    }
  }
  return planted;
}

/** Bushes and grass, scattered. */
export function scatterBushes(placer: Placer, count: number): number {
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 10; tries++) {
    const { X, Y } = randomTile(placer);
    if (pathAt(placer.doc, X, Y)) continue;
    if (placer.plant(placer.rng.pick(BUSHES), X, Y)) placed++;
  }
  return placed;
}
