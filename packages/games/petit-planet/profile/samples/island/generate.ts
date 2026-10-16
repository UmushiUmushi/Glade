// The island fixture: a real-size, natural-looking island made by a seeded generator, so tests,
// speed measurements and development all work on a full map, the same one every time. Made-up
// items only (samples/island/catalog.ts). samples/maps/island.json is its output; a test checks
// the file still matches, and UPDATE_GOLDENS=1 rewrites it.

import { bind, validate, type Violation } from "@glade/core";
import { itemsOf, planet, profileOf, type MapDoc, type Planet } from "../../src";
import { islandCatalog } from "./catalog";
import { dressHouses, dressTown, fenceGardens, lightRoads, picnicSpots } from "./dress";
import { addRamps, launchBoats, setTables } from "./extras";
import { buildHouses } from "./houses";
import { createPlacer } from "./placer";
import { growTrees, plantFlowers, scatterBushes } from "./plants";
import { createRng } from "./rng";
import { layRoads } from "./roads";
import { digPonds, shapeHills } from "./terrain";

export const ISLAND_SEED = 20261016;
/** Fixed, so the saved file never changes by itself. */
export const ISLAND_DATE = new Date("2026-10-16T00:00:00.000Z");

/** How much of each thing the generator aims for. */
const AIM = {
  ponds: 5,
  houses: 18,
  gardens: 7,
  lampEvery: 11,
  picnics: 4,
  ramps: 10,
  trees: 300,
  groves: 16,
  flowerPatches: 26,
  bushes: 80,
} as const;

/** The island catalog bound to the planet: what the island is checked against. */
export function islandGame(): Planet {
  return bind(planet, islandCatalog) as unknown as Planet;
}

export class IslandProblems extends Error {
  constructor(readonly violations: Violation[]) {
    super(`the generated island has ${violations.length} problem(s): ${violations[0]?.message}`);
  }
}

export function generateIsland(seed = ISLAND_SEED): MapDoc {
  const rng = createRng(seed);
  const game = islandGame();
  const profile = profileOf(game);
  const doc = planet.newDoc("island", {}, ISLAND_DATE);

  // 1. The land: hills, then ponds.
  shapeHills(doc, profile, rng);
  const ponds = digPonds(doc, profile, rng, AIM.ponds);
  // 2. Roads.
  const roads = layRoads(doc, profile, rng);
  // 3. Houses along the roads.
  const placer = createPlacer(doc, game, profile, rng);
  const houses = buildHouses(placer, roads, AIM.houses);
  // 4. Yards, gardens, the town square, lamps, picnic spots.
  dressHouses(placer, houses);
  fenceGardens(placer, houses, AIM.gardens);
  dressTown(placer);
  lightRoads(placer, roads, AIM.lampEvery);
  picnicSpots(placer, AIM.picnics);
  // 5. Plants.
  growTrees(placer, AIM.trees, AIM.groves);
  plantFlowers(placer, AIM.flowerPatches);
  scatterBushes(placer, AIM.bushes);
  // 6. Ramps, boats, and things on tables.
  addRamps(placer, AIM.ramps);
  launchBoats(placer, ponds);
  setTables(placer, itemsOf(doc));

  // The whole island, every rule: it must be clean.
  const problems = validate(doc, game);
  if (problems.length) throw new IslandProblems(problems);
  return doc;
}
