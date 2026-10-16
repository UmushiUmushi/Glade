// The island fixture's catalog: about 80 made-up items with original models, in the 9 categories
// the planner's drawer shows, and 3 paths. The profile ships no items; these exist only for tests,
// the test kit and development (a real-size island to work on). Each item has its catalog entry
// (read by the profile) and its meta (name, category, tags: what the drawer and search read).

import type { CatalogEntry, Catalog, PathEntry } from "../../src/catalog";
import { C, ball, box, cone, cyl, legs, mirrored, model, wedge } from "./parts";

/** The planner drawer's categories, in tab order (Petit Planet's own, one level). */
export const ISLAND_CATEGORIES = [
  "Basic Furniture",
  "Functional",
  "Interior Fixtures",
  "Decorations",
  "Greenery",
  "Outdoor",
  "Facilities",
  "Plants",
  "Other",
] as const;

export type IslandCategory = (typeof ISLAND_CATEGORIES)[number];

export interface IslandMeta {
  name: string;
  category: IslandCategory;
  /** Materials and traits, for search: "wood", "sittable", "surface", "light"… */
  tags: string[];
}

export interface IslandItem {
  entry: CatalogEntry;
  meta: IslandMeta;
}

const P = "island-";

/** One catalog item: its entry and its meta. Footprints are in half tiles. */
function item(
  id: string,
  kind: string,
  footprint: [number, number],
  glyph: string,
  meta: [string, IslandCategory, string[]],
  entryModel: CatalogEntry["model"],
  extra: Partial<CatalogEntry> = {},
): IslandItem {
  const [name, category, tags] = meta;
  return {
    entry: {
      type: P + id,
      kind,
      footprint: { w: footprint[0], h: footprint[1] },
      shape: id,
      glyph,
      description: name.toLowerCase(),
      model: entryModel,
      ...extra,
    },
    meta: { name, category, tags },
  };
}

const glow = { finish: "glow" };
const glass = { finish: "glass" };

// ---- Basic Furniture ----

const furniture: IslandItem[] = [
  item(
    "wood-chair",
    "item",
    [2, 2],
    "c",
    ["Wooden Chair", "Basic Furniture", ["wood", "sittable"]],
    model(
      legs(0.5, 0.5, 0.7, 0.7, 0.4, C.wood),
      box([0.5, 0.4, 0.5], [0.7, 0.08, 0.7], C.lightWood),
      box([0.5, 0.48, 0.18], [0.7, 0.55, 0.07], C.wood),
    ),
  ),
  item(
    "armchair",
    "item",
    [2, 2],
    "a",
    ["Armchair", "Basic Furniture", ["fabric", "sittable"]],
    model(
      box([0.5, 0, 0.5], [0.85, 0.35, 0.8], C.teal, { round: 0.08 }),
      box([0.5, 0.35, 0.16], [0.85, 0.5, 0.15], C.teal, { round: 0.06 }),
      mirrored(
        [0.5, 0.35, 0.5],
        ["x"],
        [box([0.36, 0, 0.05], [0.13, 0.22, 0.7], C.teal, { round: 0.05 })],
      ),
    ),
  ),
  item(
    "stool",
    "item",
    [1, 1],
    "s",
    ["Stool", "Basic Furniture", ["wood", "sittable"]],
    model(
      cyl([0.25, 0, 0.25], 0.05, 0.35, C.darkWood),
      cyl([0.25, 0.35, 0.25], 0.2, 0.06, C.lightWood),
    ),
  ),
  item(
    "park-bench",
    "item",
    [4, 2],
    "b",
    ["Park Bench", "Basic Furniture", ["wood", "metal", "sittable"]],
    model(
      box([1, 0.35, 0.55], [1.8, 0.08, 0.45], C.wood),
      box([1, 0.45, 0.25], [1.8, 0.35, 0.06], C.wood),
      mirrored([1, 0, 0.5], ["x"], [box([0.78, 0, 0], [0.08, 0.42, 0.55], C.iron)]),
    ),
  ),
  item(
    "log-bench",
    "item",
    [4, 2],
    "l",
    ["Log Bench", "Basic Furniture", ["wood", "sittable"]],
    model(
      box([1, 0, 0.5], [1.8, 0.3, 0.42], C.bark, { round: 0.12 }),
      box([1, 0.3, 0.5], [1.7, 0.04, 0.36], C.lightWood),
    ),
  ),
  item(
    "square-table",
    "item",
    [4, 4],
    "t",
    ["Square Table", "Basic Furniture", ["wood", "surface"]],
    model(legs(1, 1, 1.6, 1.6, 0.65, C.darkWood), box([1, 0.65, 1], [1.7, 0.08, 1.7], C.wood)),
    { surface: { w: 12, h: 12 } },
  ),
  item(
    "cafe-table",
    "item",
    [2, 2],
    "o",
    ["Café Table", "Basic Furniture", ["metal", "surface"]],
    model(
      cyl([0.5, 0, 0.5], 0.2, 0.04, C.iron),
      cyl([0.5, 0.04, 0.5], 0.04, 0.6, C.iron),
      cyl([0.5, 0.64, 0.5], 0.42, 0.05, C.white),
    ),
    { surface: { w: 6, h: 6 } },
  ),
  item(
    "long-table",
    "item",
    [4, 2],
    "g",
    ["Long Table", "Basic Furniture", ["wood", "surface"]],
    model(
      legs(1, 0.5, 1.8, 0.8, 0.65, C.darkWood),
      box([1, 0.65, 0.5], [1.9, 0.08, 0.9], C.lightWood),
    ),
    { surface: { w: 10, h: 4 } },
  ),
  item(
    "sofa",
    "item",
    [4, 2],
    "f",
    ["Sofa", "Basic Furniture", ["fabric", "sittable"]],
    model(
      box([1, 0, 0.55], [1.9, 0.35, 0.8], C.pink, { round: 0.1 }),
      box([1, 0.35, 0.2], [1.9, 0.45, 0.2], C.pink, { round: 0.08 }),
      mirrored(
        [1, 0.35, 0.55],
        ["x"],
        [box([0.87, 0, 0], [0.15, 0.2, 0.75], C.pink, { round: 0.06 })],
      ),
    ),
  ),
  item(
    "picnic-table",
    "item",
    [4, 4],
    "p",
    ["Picnic Table", "Basic Furniture", ["wood", "sittable", "surface"]],
    model(
      box([1, 0.6, 1], [1.8, 0.07, 0.8], C.wood),
      mirrored(
        [1, 0, 1],
        ["z"],
        [
          box([0, 0.35, 0.7], [1.8, 0.06, 0.3], C.wood),
          box([0, 0, 0.3], [1.4, 0.6, 0.08], C.darkWood),
        ],
      ),
    ),
    { surface: { w: 10, h: 4 } },
  ),
];

// ---- Interior Fixtures ----

const fixtures: IslandItem[] = [
  item(
    "bookshelf",
    "item",
    [2, 2],
    "k",
    ["Bookshelf", "Interior Fixtures", ["wood", "storage"]],
    model(
      box([0.5, 0, 0.5], [0.9, 1.5, 0.4], C.darkWood),
      box([0.5, 0.25, 0.62], [0.8, 0.28, 0.1], C.red),
      box([0.5, 0.75, 0.62], [0.8, 0.28, 0.1], C.blue),
      box([0.5, 1.15, 0.62], [0.8, 0.25, 0.1], C.sun),
    ),
  ),
  item(
    "cupboard",
    "item",
    [2, 2],
    "u",
    ["Cupboard", "Interior Fixtures", ["wood", "storage"]],
    model(
      box([0.5, 0, 0.5], [0.9, 1.3, 0.7], C.lightWood, { round: 0.03 }),
      box([0.5, 0.6, 0.86], [0.04, 0.5, 0.03], C.darkWood),
    ),
  ),
  item(
    "floor-lamp",
    "item",
    [1, 1],
    "j",
    ["Floor Lamp", "Interior Fixtures", ["metal", "fabric", "light"]],
    model(
      cyl([0.25, 0, 0.25], 0.15, 0.04, C.iron),
      cyl([0.25, 0.04, 0.25], 0.025, 1.3, C.iron),
      cone([0.25, 1.25, 0.25], 0.22, 0.35, C.cream, glow),
    ),
  ),
  item(
    "round-rug",
    "item",
    [4, 4],
    "r",
    ["Round Rug", "Interior Fixtures", ["fabric"]],
    model(cyl([1, 0, 1], 0.95, 0.02, C.lilac), cyl([1, 0.02, 1], 0.6, 0.01, C.cream)),
  ),
  item(
    "fireplace",
    "item",
    [4, 2],
    "e",
    ["Fireplace", "Interior Fixtures", ["stone", "light"]],
    model(
      box([1, 0, 0.45], [1.8, 1.2, 0.8], C.stone),
      box([1, 0, 0.86], [0.9, 0.6, 0.02], C.darkStone),
      ball([1, 0.2, 0.75], 0.15, C.glow, glow),
    ),
  ),
  item(
    "tall-clock",
    "item",
    [2, 2],
    "q",
    ["Tall Clock", "Interior Fixtures", ["wood"]],
    model(
      box([0.5, 0, 0.5], [0.5, 1.8, 0.4], C.darkWood),
      cyl([0.5, 1.45, 0.71], 0.16, 0.02, C.white, { rotate: [90, 0, 0] }),
    ),
  ),
  item(
    "coat-stand",
    "item",
    [1, 1],
    "y",
    ["Coat Stand", "Interior Fixtures", ["wood"]],
    model(
      cyl([0.25, 0, 0.25], 0.15, 0.04, C.darkWood),
      cyl([0.25, 0.04, 0.25], 0.03, 1.5, C.darkWood),
      ball([0.25, 1.55, 0.25], 0.05, C.darkWood),
    ),
  ),
];

// ---- Decorations (the small ones also stand on tables) ----

const decorations: IslandItem[] = [
  item(
    "flower-pot",
    "item",
    [1, 1],
    "w",
    ["Flower Pot", "Decorations", ["ceramic", "placeable"]],
    model(
      cone([0.25, 0, 0.25], 0.16, 0.2, C.clay, { top: 0.2 }),
      ball([0.25, 0.28, 0.25], 0.13, C.pink),
    ),
    { placeable: { w: 2, h: 2 } },
  ),
  item(
    "tea-cup",
    "item",
    [1, 1],
    "z",
    ["Tea Cup", "Decorations", ["ceramic", "placeable"]],
    model(cyl([0.25, 0, 0.25], 0.1, 0.1, C.white)),
    { placeable: { w: 2, h: 2 } },
  ),
  item(
    "vase",
    "item",
    [1, 1],
    "v",
    ["Vase", "Decorations", ["ceramic", "placeable"]],
    model(
      cyl([0.25, 0, 0.25], 0.12, 0.3, C.blue, { top: 0.07 }),
      ball([0.25, 0.4, 0.25], 0.1, C.sun),
    ),
    { placeable: { w: 2, h: 2 } },
  ),
  item(
    "lantern",
    "item",
    [1, 1],
    "n",
    ["Lantern", "Decorations", ["metal", "light", "placeable"]],
    model(
      box([0.25, 0, 0.25], [0.24, 0.3, 0.24], C.glow, glow),
      cone([0.25, 0.3, 0.25], 0.16, 0.12, C.iron, { sides: 4 }),
    ),
    { placeable: { w: 2, h: 2 } },
  ),
  item(
    "stone-statue",
    "item",
    [2, 2],
    "x",
    ["Stone Statue", "Decorations", ["stone"]],
    model(
      box([0.5, 0, 0.5], [0.7, 0.35, 0.7], C.darkStone),
      cyl([0.5, 0.35, 0.5], 0.18, 0.6, C.stone, { top: 0.12 }),
      ball([0.5, 1.1, 0.5], 0.17, C.stone),
    ),
  ),
  item(
    "bird-bath",
    "item",
    [2, 2],
    "i",
    ["Bird Bath", "Decorations", ["stone"]],
    model(
      cyl([0.5, 0, 0.5], 0.08, 0.6, C.stone),
      cyl([0.5, 0.6, 0.5], 0.38, 0.1, C.stone),
      cyl([0.5, 0.66, 0.5], 0.3, 0.05, C.glass, glass),
    ),
  ),
  item(
    "sundial",
    "item",
    [2, 2],
    "d",
    ["Sundial", "Decorations", ["stone", "metal"]],
    model(
      cyl([0.5, 0, 0.5], 0.3, 0.5, C.stone, { sides: 8 }),
      wedge([0.5, 0.5, 0.5], [0.04, 0.2, 0.3], C.iron),
    ),
  ),
  item(
    "pinwheel",
    "item",
    [1, 1],
    "h",
    ["Pinwheel", "Decorations", ["fabric"]],
    model(
      cyl([0.25, 0, 0.25], 0.02, 0.8, C.lightWood),
      cyl([0.25, 0.8, 0.25], 0.18, 0.02, C.pink, { rotate: [90, 0, 0], sides: 4 }),
    ),
  ),
  item(
    "crate-stack",
    "item",
    [2, 2],
    "m",
    ["Crate Stack", "Decorations", ["wood", "storage"]],
    model(
      box([0.5, 0, 0.5], [0.8, 0.45, 0.8], C.lightWood),
      box([0.45, 0.45, 0.5], [0.6, 0.4, 0.6], C.wood, { rotate: [0, 15, 0] }),
    ),
  ),
  item(
    "clay-figure",
    "item",
    [1, 1],
    "g",
    ["Clay Figure", "Decorations", ["ceramic"]],
    model(
      cyl([0.25, 0, 0.25], 0.13, 0.25, C.blue, { top: 0.1 }),
      ball([0.25, 0.32, 0.25], 0.09, C.cream),
      cone([0.25, 0.38, 0.25], 0.1, 0.22, C.red),
    ),
  ),
];

// ---- Greenery (plants in pots and boxes: items, on half tiles) ----

const greenery: IslandItem[] = [
  item(
    "planter-box",
    "item",
    [4, 2],
    "b",
    ["Planter Box", "Greenery", ["wood", "leaves"]],
    model(
      box([1, 0, 0.5], [1.8, 0.35, 0.6], C.wood),
      box([1, 0.35, 0.5], [1.7, 0.15, 0.5], C.leaf, { round: 0.07 }),
      ball([0.55, 0.55, 0.5], 0.12, C.pink),
      ball([1.45, 0.55, 0.5], 0.12, C.sun),
    ),
  ),
  item(
    "potted-fern",
    "item",
    [2, 2],
    "f",
    ["Potted Fern", "Greenery", ["ceramic", "leaves"]],
    model(
      cone([0.5, 0, 0.5], 0.22, 0.3, C.clay, { top: 0.28 }),
      ball([0.5, 0.5, 0.5], 0.32, C.leafDark, { squash: 0.7 }),
    ),
  ),
  item(
    "topiary",
    "item",
    [2, 2],
    "t",
    ["Topiary Ball", "Greenery", ["ceramic", "leaves"]],
    model(
      box([0.5, 0, 0.5], [0.4, 0.3, 0.4], C.white),
      cyl([0.5, 0.3, 0.5], 0.03, 0.3, C.bark),
      ball([0.5, 0.85, 0.5], 0.3, C.leaf),
    ),
  ),
  item(
    "flower-barrel",
    "item",
    [2, 2],
    "r",
    ["Flower Barrel", "Greenery", ["wood", "leaves"]],
    model(
      cyl([0.5, 0, 0.5], 0.32, 0.4, C.wood),
      ball([0.5, 0.45, 0.5], 0.28, C.leafLight, { squash: 0.6 }),
      ball([0.4, 0.55, 0.45], 0.08, C.red),
      ball([0.6, 0.55, 0.58], 0.08, C.sun),
    ),
  ),
  item(
    "basket-post",
    "item",
    [1, 1],
    "p",
    ["Hanging Basket", "Greenery", ["wood", "leaves"]],
    model(cyl([0.25, 0, 0.25], 0.03, 1.4, C.darkWood), ball([0.25, 1.15, 0.25], 0.16, C.leafLight)),
  ),
  item(
    "hedge",
    "item",
    [2, 2],
    "h",
    ["Hedge", "Greenery", ["leaves", "links up"]],
    model(
      box([0.5, 0, 0.5], [1, 0.75, 0.4], C.leafDark, { round: 0.12 }),
      box([0.5, 0, 0.5], [0.45, 0.8, 0.45], C.leafDark, { round: 0.15 }),
    ),
    { connects: true },
  ),
];

// ---- Outdoor ----

const outdoor: IslandItem[] = [
  item(
    "street-lamp",
    "item",
    [1, 1],
    "s",
    ["Street Lamp", "Outdoor", ["metal", "light"]],
    model(cyl([0.25, 0, 0.25], 0.05, 2, C.iron), ball([0.25, 2.1, 0.25], 0.15, C.glow, glow)),
  ),
  item(
    "picket-fence",
    "item",
    [2, 2],
    "k",
    ["Picket Fence", "Outdoor", ["wood", "links up"]],
    model(
      box([0.5, 0.25, 0.5], [1, 0.08, 0.05], C.white),
      box([0.5, 0.55, 0.5], [1, 0.08, 0.05], C.white),
      box([0.5, 0, 0.5], [0.1, 0.8, 0.1], C.white),
    ),
    { connects: true },
  ),
  item(
    "rail-fence",
    "item",
    [2, 2],
    "e",
    ["Rail Fence", "Outdoor", ["wood", "links up"]],
    model(
      box([0.5, 0.3, 0.5], [1, 0.1, 0.07], C.wood),
      box([0.5, 0.6, 0.5], [1, 0.1, 0.07], C.wood),
      box([0.5, 0, 0.5], [0.12, 0.85, 0.12], C.darkWood),
    ),
    { connects: true },
  ),
  item(
    "stone-wall",
    "item",
    [2, 2],
    "w",
    ["Stone Wall", "Outdoor", ["stone", "links up"]],
    model(
      box([0.5, 0, 0.5], [1, 0.55, 0.3], C.stone, { round: 0.05 }),
      box([0.5, 0, 0.5], [0.4, 0.62, 0.36], C.darkStone, { round: 0.05 }),
    ),
    { connects: true },
  ),
  item(
    "parasol",
    "item",
    [2, 2],
    "u",
    ["Parasol", "Outdoor", ["fabric"]],
    model(
      cyl([0.5, 0, 0.5], 0.03, 1.5, C.white),
      cone([0.5, 1.3, 0.5], 0.48, 0.35, C.red, { sides: 8 }),
    ),
  ),
  item(
    "picnic-blanket",
    "item",
    [4, 4],
    "q",
    ["Picnic Blanket", "Outdoor", ["fabric"]],
    model(
      box([1, 0, 1], [1.8, 0.02, 1.8], C.red),
      box([1, 0.02, 1], [1.8, 0.01, 0.4], C.white),
      box([1, 0.02, 1], [0.4, 0.01, 1.8], C.white),
    ),
  ),
  item(
    "campfire",
    "item",
    [2, 2],
    "c",
    ["Campfire", "Outdoor", ["stone", "wood", "light"]],
    model(
      cyl([0.5, 0, 0.5], 0.4, 0.1, C.darkStone, { sides: 10 }),
      cone([0.5, 0.1, 0.5], 0.2, 0.4, C.glow, glow),
    ),
  ),
  item(
    "swing",
    "item",
    [4, 2],
    "i",
    ["Swing", "Outdoor", ["wood", "sittable"]],
    model(
      mirrored([1, 0, 0.5], ["x"], [box([0.85, 0, 0], [0.08, 1.6, 0.08], C.darkWood)]),
      box([1, 1.6, 0.5], [1.85, 0.08, 0.08], C.darkWood),
      box([1, 0.45, 0.5], [0.6, 0.05, 0.3], C.lightWood),
      mirrored([1, 0.5, 0.5], ["x"], [cyl([0.27, 0, 0], 0.01, 1.1, C.iron)]),
    ),
  ),
  item(
    "rowboat",
    "item",
    [2, 4],
    "o",
    ["Rowboat", "Outdoor", ["wood", "water decor"]],
    model(
      box([0.5, 0, 1], [0.75, 0.3, 1.7], C.wood, { round: 0.12 }),
      box([0.5, 0.25, 1], [0.6, 0.05, 0.2], C.lightWood),
    ),
    { onWater: true },
  ),
  item(
    "rose-arch",
    "item",
    [4, 2],
    "a",
    ["Rose Arch", "Outdoor", ["metal", "leaves"]],
    model(
      mirrored([1, 0, 0.5], ["x"], [box([0.8, 0, 0], [0.08, 1.7, 0.08], C.white)]),
      box([1, 1.7, 0.5], [1.7, 0.08, 0.15], C.white),
      ball([1, 1.75, 0.5], 0.25, C.leaf, { squash: 0.6 }),
      ball([0.4, 1.7, 0.5], 0.15, C.pink),
      ball([1.6, 1.7, 0.5], 0.15, C.pink),
    ),
  ),
  item(
    "log-pile",
    "item",
    [2, 2],
    "l",
    ["Log Pile", "Outdoor", ["wood"]],
    model(
      box([0.5, 0, 0.5], [0.85, 0.3, 0.6], C.bark, { round: 0.1 }),
      box([0.5, 0.3, 0.5], [0.6, 0.25, 0.55], C.bark, { round: 0.1 }),
    ),
  ),
];

// ---- Functional ----

const functional: IslandItem[] = [
  item(
    "mailbox",
    "item",
    [1, 1],
    "x",
    ["Mailbox", "Functional", ["metal", "interactable"]],
    model(
      box([0.25, 0, 0.25], [0.06, 0.75, 0.06], C.darkWood),
      box([0.25, 0.75, 0.25], [0.3, 0.22, 0.4], C.red, { round: 0.05 }),
    ),
  ),
  item(
    "signpost",
    "item",
    [1, 1],
    "y",
    ["Signpost", "Functional", ["wood"]],
    model(
      box([0.25, 0, 0.25], [0.07, 1.3, 0.07], C.darkWood),
      box([0.25, 1.0, 0.25], [0.45, 0.15, 0.04], C.lightWood),
    ),
  ),
  item(
    "well",
    "item",
    [2, 2],
    "w",
    ["Well", "Functional", ["stone", "wood", "interactable"]],
    model(
      cyl([0.5, 0, 0.5], 0.42, 0.5, C.stone, { sides: 10 }),
      mirrored([0.5, 0.5, 0.5], ["x"], [box([0.38, 0, 0], [0.06, 0.8, 0.06], C.darkWood)]),
      wedge([0.5, 1.3, 0.5], [0.95, 0.35, 0.9], C.roof),
    ),
  ),
  item(
    "water-pump",
    "item",
    [1, 1],
    "p",
    ["Water Pump", "Functional", ["metal", "interactable"]],
    model(
      cyl([0.25, 0, 0.25], 0.08, 0.7, C.teal),
      box([0.25, 0.6, 0.35], [0.05, 0.05, 0.2], C.teal),
    ),
  ),
  item(
    "notice-board",
    "item",
    [2, 2],
    "n",
    ["Notice Board", "Functional", ["wood"]],
    model(
      mirrored([0.5, 0, 0.5], ["x"], [box([0.4, 0, 0], [0.06, 1.3, 0.06], C.darkWood)]),
      box([0.5, 0.7, 0.5], [0.9, 0.55, 0.05], C.lightWood),
      box([0.4, 0.85, 0.53], [0.25, 0.2, 0.01], C.white),
    ),
  ),
  item(
    "bin",
    "item",
    [1, 1],
    "b",
    ["Bin", "Functional", ["metal"]],
    model(cyl([0.25, 0, 0.25], 0.18, 0.5, C.leafDark), cyl([0.25, 0.5, 0.25], 0.2, 0.04, C.iron)),
  ),
  item(
    "workbench",
    "item",
    [4, 2],
    "o",
    ["Workbench", "Functional", ["wood", "surface"]],
    model(legs(1, 0.5, 1.8, 0.8, 0.7, C.darkWood), box([1, 0.7, 0.5], [1.9, 0.1, 0.9], C.wood)),
    { surface: { w: 10, h: 4 } },
  ),
  item(
    "market-stall",
    "item",
    [4, 2],
    "m",
    ["Market Stall", "Functional", ["wood", "fabric", "surface"]],
    model(
      box([1, 0, 0.5], [1.9, 0.75, 0.8], C.lightWood),
      mirrored([1, 0.75, 0.5], ["x"], [box([0.88, 0, 0], [0.06, 0.9, 0.06], C.darkWood)]),
      box([1, 1.65, 0.5], [1.95, 0.1, 0.95], C.red),
    ),
    { surface: { w: 10, h: 4 } },
  ),
];

// ---- Facilities (buildings: the front faces south at rotation 0, and gets a door) ----

function house(
  id: string,
  size: [number, number],
  meta: [string, IslandCategory, string[]],
  walls: string,
  roof: string,
  wallHeight = 1.6,
): IslandItem {
  const [w, d] = [size[0] / 2, size[1] / 2];
  return item(
    id,
    "building",
    size,
    "h",
    meta,
    model(
      box([w / 2, 0, d / 2], [w - 0.4, wallHeight, d - 0.4], walls, { round: 0.05 }),
      mirrored(
        [w / 2, wallHeight, d / 2],
        ["z"],
        [
          wedge([0, 0, -(d - 0.1) / 4], [w - 0.1, Math.min(1.2, d * 0.6), (d - 0.1) / 2], roof, {
            rotate: [0, 180, 0],
          }),
        ],
      ),
      mirrored(
        [w / 2, 0.6, d - 0.19],
        ["x"],
        [box([w / 4, 0, 0], [0.4, 0.45, 0.04], C.glass, glass)],
      ),
    ),
  );
}

const facilities: IslandItem[] = [
  house("cottage", [6, 4], ["Cottage", "Facilities", ["plaster", "enterable"]], C.cream, C.roof),
  house(
    "blue-house",
    [8, 6],
    ["Blue House", "Facilities", ["plaster", "enterable"]],
    "#cfe0ee",
    "#4f6d8f",
  ),
  house(
    "big-house",
    [10, 8],
    ["Big House", "Facilities", ["plaster", "enterable"]],
    C.white,
    C.red,
    2.2,
  ),
  house("bakery", [6, 6], ["Bakery", "Facilities", ["plaster", "enterable"]], "#f3dcc0", "#9a6a3a"),
  house("barn", [10, 6], ["Barn", "Facilities", ["wood", "enterable"]], C.red, C.darkWood, 2),
  house(
    "log-cabin",
    [8, 6],
    ["Log Cabin", "Facilities", ["wood", "enterable"]],
    C.wood,
    C.darkWood,
  ),
  house(
    "greenhouse",
    [6, 4],
    ["Greenhouse", "Facilities", ["glass", "enterable"]],
    C.glass,
    C.white,
  ),
];

// ---- Plants (on whole tiles) ----

function tree(
  id: string,
  meta: [string, IslandCategory, string[]],
  crown: string,
  trunk: string = C.bark,
  tall = 1.2,
): IslandItem {
  return item(
    id,
    "tree",
    [2, 2],
    "T",
    meta,
    model(
      cyl([0.5, 0, 0.5], 0.09, tall, trunk, { top: 0.06 }),
      ball([0.5, tall + 0.3, 0.5], 0.42, crown, { squash: 0.9 }),
      mirrored([0.5, tall + 0.2, 0.5], ["x", "z"], [ball([0.17, 0, 0.17], 0.24, crown)]),
    ),
  );
}

function flower(id: string, meta: [string, IslandCategory, string[]], color: string): IslandItem {
  return item(
    id,
    "flower",
    [2, 2],
    "F",
    meta,
    model(
      ball([0.5, 0.11, 0.5], 0.3, C.leafLight, { squash: 0.35 }),
      mirrored([0.5, 0.18, 0.5], ["x", "z"], [ball([0.17, 0, 0.17], 0.08, color)]),
      ball([0.5, 0.22, 0.5], 0.08, color),
    ),
  );
}

const plants: IslandItem[] = [
  tree("oak", ["Oak", "Plants", ["leaves", "tree"]], C.leaf),
  tree("maple", ["Maple", "Plants", ["leaves", "tree"]], "#c8643c"),
  tree("birch", ["Birch", "Plants", ["leaves", "tree"]], C.leafLight, C.white, 1.4),
  tree("fruit-tree", ["Fruit Tree", "Plants", ["leaves", "tree"]], "#6a9e4a", C.bark, 1),
  item(
    "pine",
    "tree",
    [2, 2],
    "P",
    ["Pine", "Plants", ["leaves", "tree"]],
    model(
      cyl([0.5, 0, 0.5], 0.08, 0.5, C.bark),
      cone([0.5, 0.4, 0.5], 0.45, 0.8, C.leafDark),
      cone([0.5, 0.9, 0.5], 0.35, 0.7, C.leafDark),
      cone([0.5, 1.35, 0.5], 0.25, 0.6, C.leafDark),
    ),
  ),
  item(
    "round-bush",
    "shrub",
    [2, 2],
    "B",
    ["Round Bush", "Plants", ["leaves"]],
    model(ball([0.5, 0.3, 0.5], 0.36, C.leaf, { squash: 0.8 })),
  ),
  item(
    "berry-bush",
    "shrub",
    [2, 2],
    "Y",
    ["Berry Bush", "Plants", ["leaves"]],
    model(
      ball([0.5, 0.3, 0.5], 0.36, C.leafDark, { squash: 0.8 }),
      mirrored([0.5, 0.4, 0.5], ["x", "z"], [ball([0.2, 0, 0.2], 0.06, C.red)]),
    ),
  ),
  item(
    "fern",
    "shrub",
    [2, 2],
    "N",
    ["Fern", "Plants", ["leaves"]],
    model(cone([0.5, 0, 0.5], 0.4, 0.45, C.leafDark, { sides: 6 })),
  ),
  flower("tulips", ["Tulips", "Plants", ["flower"]], C.red),
  flower("daisies", ["Daisies", "Plants", ["flower"]], C.white),
  flower("lavender", ["Lavender", "Plants", ["flower"]], C.lilac),
  flower("roses", ["Roses", "Plants", ["flower"]], C.pink),
  item(
    "sunflowers",
    "flower",
    [2, 2],
    "S",
    ["Sunflowers", "Plants", ["flower"]],
    model(
      mirrored([0.5, 0, 0.5], ["x"], [cyl([0.15, 0, 0], 0.025, 0.8, C.leaf)]),
      mirrored([0.5, 0.8, 0.5], ["x"], [ball([0.15, 0, 0], 0.12, C.sun, { squash: 0.5 })]),
    ),
  ),
  item(
    "tall-grass",
    "plant",
    [2, 2],
    "G",
    ["Tall Grass", "Plants", ["leaves"]],
    model(cone([0.5, 0, 0.5], 0.3, 0.4, C.leafLight, { sides: 5 })),
  ),
];

// ---- Other: ramps and a bridge ----

const other: IslandItem[] = [
  item("wood-ramp", "incline", [2, 4], "/", ["Wooden Ramp", "Other", ["wood"]], undefined),
  item("stone-ramp", "incline", [4, 4], "/", ["Stone Ramp", "Other", ["stone"]], undefined),
  item(
    "plank-bridge",
    "bridge",
    [2, 8],
    "=",
    ["Plank Bridge", "Other", ["wood"]],
    model(
      box([0.5, 0, 2], [0.9, 0.1, 3.9], C.wood),
      mirrored([0.5, 0.1, 2], ["x"], [box([0.42, 0, 0], [0.05, 0.4, 3.9], C.darkWood)]),
    ),
    { majorSize: { w: 1, l: 4 } },
  ),
];

/** Every item, in category order. */
export const islandItems: IslandItem[] = [
  ...furniture,
  ...functional,
  ...fixtures,
  ...decorations,
  ...greenery,
  ...outdoor,
  ...facilities,
  ...plants,
  ...other,
];

/** The paths (the Paths mode palette, not the drawer). */
export const islandPaths: PathEntry[] = [
  {
    type: P + "cobble",
    kind: "path",
    glyph: "=",
    allowsPlants: false,
    color: "#a8a39a",
    pattern: "cobble",
    description: "a cobbled stone path",
  },
  {
    type: P + "dirt",
    kind: "path",
    glyph: "-",
    allowsPlants: false,
    color: "#b8956a",
    pattern: "plain",
    description: "a dirt track",
  },
  {
    type: P + "garden",
    kind: "path",
    glyph: ":",
    allowsPlants: true,
    color: "#c9c1ad",
    pattern: "plain",
    description: "garden gravel, plants allowed",
  },
];

export const islandCatalog: Catalog = {
  entries: [...islandItems.map((i) => i.entry), ...islandPaths],
};

/** An item's meta by its type. */
export const islandMeta: Record<string, IslandMeta> = Object.fromEntries(
  islandItems.map((i) => [i.entry.type, i.meta]),
);
