// Petit Planet's samples: made-up catalogs and saved maps for the tests, the test kit and the docs.
// The profile ships no items, so these exist only to exercise the game; nothing in src/ may import
// from here (tests/boundaries.test.ts).

import demoMap from "./maps/demo.json" with { type: "json" };
import home10 from "./maps/interior_home_1_10.json" with { type: "json" };
import home8 from "./maps/interior_home_1_8.json" with { type: "json" };

export { demoCatalog } from "./catalogs/demo";
export { homeCatalog } from "./catalogs/home";
export { modelsCatalog } from "./catalogs/models";
export { testCatalog } from "./catalogs/test";
export { showroomMap } from "./showroom";

/** Saved maps, as parsed map files (load them with loadMap). */
export const maps: Record<string, Record<string, unknown>> = {
  demo: demoMap,
  interior_home_1_10: home10,
  interior_home_1_8: home8,
};
