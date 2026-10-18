// The island fixture: the saved file is what the generator makes (UPDATE_GOLDENS=1 rewrites it),
// it has no problems under every rule, it is real size, and its made-up catalog is sound: every
// entry passes the profile, every item has a name and one of the drawer's categories.

import { catalogProblems, loadMap, serializeMap, validate } from "@glade/core";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  baseOf,
  itemsOf,
  onSurfaces,
  pathCells,
  petitPlanet,
  planet,
  plantsOf,
  terrainGrid,
  type MapDoc,
} from "../src";
import {
  ISLAND_CATEGORIES,
  islandCatalog,
  islandItems,
  islandMeta,
} from "../samples/island/catalog";
import { generateIsland, islandGame } from "../samples/island/generate";

const FILE = join(__dirname, "../samples/maps/island.json");

describe("the island file", () => {
  it("is what the generator makes", () => {
    const made = serializeMap(generateIsland(), planet);
    if (process.env.UPDATE_GOLDENS === "1") writeFileSync(FILE, made);
    expect(readFileSync(FILE, "utf8"), "run UPDATE_GOLDENS=1 pnpm test island").toBe(made);
    // About 25 s alone (the generator checks every rule as it places); far longer while the whole
    // suite runs at once on a busy machine.
  }, 120_000);

  /** The saved island, read when a test first needs it (after the first test may rewrite it). */
  let saved: MapDoc | undefined;
  const island = () =>
    (saved ??= loadMap(
      JSON.parse(readFileSync(FILE, "utf8")) as Record<string, unknown>,
      petitPlanet,
    ));

  it("has no problems under every rule", () => {
    expect(validate(island(), islandGame())).toEqual([]);
  });

  it("is real size: hundreds of items and plants, roads, hills and ponds", () => {
    expect(itemsOf(island()).length).toBeGreaterThanOrEqual(350);
    expect(plantsOf(island()).length).toBeGreaterThanOrEqual(500);
    expect(pathCells(island()).length).toBeGreaterThanOrEqual(300);
    expect(onSurfaces(island()).length).toBeGreaterThanOrEqual(20);
    const cells = terrainGrid(island()).flat();
    expect(Math.max(...cells.map((c) => c.h))).toBeGreaterThanOrEqual(4);
    expect(cells.filter((c) => c.water).length).toBeGreaterThanOrEqual(60);
  });

  it("uses every kind of thing the island takes: items, buildings, plants, ramps, boats", () => {
    const kinds = new Set(itemsOf(island()).map((i) => baseOf(islandCatalog, i.type)));
    expect([...kinds].sort()).toEqual(["incline", "item"]);
    const types = new Set(itemsOf(island()).map((i) => i.type));
    expect(types.has("island-rowboat")).toBe(true);
    expect([...types].some((t) => islandMeta[t]?.category === "Facilities")).toBe(true);
  });
});

describe("the island catalog", () => {
  it("passes the profile's checks", () => {
    expect(catalogProblems(planet, islandCatalog)).toEqual([]);
  });

  it("gives every item a unique name and one of the drawer's categories", () => {
    const names = islandItems.map((i) => i.meta.name);
    expect(new Set(names).size).toBe(names.length);
    for (const { meta } of islandItems) expect(ISLAND_CATEGORIES).toContain(meta.category);
    const used = new Set(islandItems.map((i) => i.meta.category));
    expect([...used].sort()).toEqual([...ISLAND_CATEGORIES].sort());
  });

  it("prefixes every type, so it never clashes with a real catalog", () => {
    for (const e of islandCatalog.entries) expect(e.type).toMatch(/^island-[a-z-]+$/);
  });

  it("has tables to put things on, and things to put on them", () => {
    const entries = islandItems.map((i) => i.entry);
    expect(entries.some((e) => e.surface)).toBe(true);
    expect(entries.some((e) => e.placeable)).toBe(true);
    expect(entries.some((e) => e.connects)).toBe(true);
    expect(entries.some((e) => e.onWater)).toBe(true);
  });
});
