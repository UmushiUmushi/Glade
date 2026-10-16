// Petit Planet's samples: made-up catalogs and saved maps for the tests, the test kit and the docs.
// The profile ships no items, so these exist only to exercise the game; nothing in src/ may import
// from here (tests/boundaries.test.ts).

import demoMap from "./maps/demo.json" with { type: "json" };
import home10 from "./maps/interior_home_1_10.json" with { type: "json" };
import home8 from "./maps/interior_home_1_8.json" with { type: "json" };
import islandMap from "./maps/island.json" with { type: "json" };

export { demoCatalog } from "./catalogs/demo";
export { homeCatalog } from "./catalogs/home";
export { modelsCatalog } from "./catalogs/models";
export { testCatalog } from "./catalogs/test";
export { showroomMap } from "./showroom";
export {
  ISLAND_CATEGORIES,
  islandCatalog,
  islandItems,
  islandMeta,
  islandPaths,
  type IslandCategory,
  type IslandItem,
  type IslandMeta,
} from "./island/catalog";
export { generateIsland, islandGame, ISLAND_SEED } from "./island/generate";

/** Saved maps, as parsed map files (load them with loadMap). */
export const maps: Record<string, Record<string, unknown>> = {
  demo: demoMap,
  /** A real-size island (460 items, 600 plants), made by samples/island/generate.ts. */
  island: islandMap,
  interior_home_1_10: home10,
  interior_home_1_8: home8,
};
