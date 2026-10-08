// The fixture's samples: two made-up things and a demo map for each map, for the test kit. Nothing in src/ may
// import from here (tests/boundaries.test.ts).

import type { Catalog } from "@glade/core";
import demoMap from "./maps/demo.json" with { type: "json" };
import sheetMap from "./maps/sheet.json" with { type: "json" };

/** A lamp and a bench, both things. */
export const things: Catalog = {
  entries: [
    { type: "lamp", kind: "thing" },
    { type: "bench", kind: "thing" },
  ],
};

/** Saved maps, as parsed map files (load them with loadMap). */
export const maps: Record<string, Record<string, unknown>> = { demo: demoMap, sheet: sheetMap };
