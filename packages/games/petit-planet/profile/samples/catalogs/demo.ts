// The made-up items and path the demo map (maps/demo.json) uses: a bench, a street lamp and a
// stone path. The profile ships no items; these exist only for samples and tests.

import type { Catalog } from "../../src/catalog";

const wood = "#9a7350";
const iron = "#4a4f57";

/** The demo's made-up items and path: a bench, a street lamp, and a stone path. */
export const demoCatalog: Catalog = {
  entries: [
    {
      type: "demo-stone",
      kind: "path",
      glyph: "=",
      allowsPlants: false,
      color: "#a8a39a",
      pattern: "cobble",
      description: "a cobbled stone path",
    },
    {
      type: "demo-bench",
      kind: "item",
      footprint: { w: 4, h: 2 },
      shape: "bench",
      glyph: "b",
      description: "a wooden bench",
      model: {
        parts: [
          { shape: "box", at: [1, 0.35, 0.5], size: [1.8, 0.1, 0.5], color: wood },
          { shape: "box", at: [0.2, 0, 0.5], size: [0.12, 0.35, 0.45], color: wood },
          { shape: "box", at: [1.8, 0, 0.5], size: [0.12, 0.35, 0.45], color: wood },
        ],
      },
    },
    {
      type: "demo-lamp",
      kind: "item",
      footprint: { w: 1, h: 1 },
      shape: "lamp",
      glyph: "l",
      description: "a street lamp",
      model: {
        parts: [
          { shape: "cylinder", at: [0.25, 0, 0.25], radius: 0.05, height: 2, color: iron },
          { shape: "sphere", at: [0.25, 2.1, 0.25], radius: 0.15, color: "#ffe6a0" },
        ],
      },
    },
  ],
};
