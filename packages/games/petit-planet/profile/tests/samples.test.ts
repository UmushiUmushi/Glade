import { bind, loadMap, serializeMap, validate, type Doc } from "@glade/core";
import { describe, expect, it } from "vitest";
import { entryProblems, petitPlanet, planet } from "../src";
import { demoCatalog, maps, modelsCatalog, showroomMap, testCatalog } from "../samples";

const entityItems = (map: Doc, layer: string) =>
  (map.layers[layer] as { items: Record<string, unknown> }).items;

describe("the demo island", () => {
  const game = bind(planet, demoCatalog);

  it("is valid with the demo catalog", () => {
    expect(validate(loadMap(maps.demo, petitPlanet), game)).toEqual([]);
  });

  it("is saved in the current file format", () => {
    const doc = loadMap(maps.demo, petitPlanet);
    expect(JSON.parse(serializeMap(doc, game))).toEqual(maps.demo);
  });
});

describe("the sample catalogs", () => {
  it("are valid entries", () => {
    for (const e of [...demoCatalog.entries, ...testCatalog.entries])
      expect(entryProblems(planet, e), e.type).toEqual([]);
  });
});

describe("the sample models", () => {
  it("are valid entries", () => {
    for (const e of modelsCatalog.entries) expect(entryProblems(planet, e), e.type).toEqual([]);
  });
});

describe("the showroom", () => {
  it("lays out every plant and item, and is valid", () => {
    const entries = [...modelsCatalog.entries, ...testCatalog.entries];
    const game = bind(planet, { entries });
    const map = showroomMap(game.catalog);
    expect(validate(map, game)).toEqual([]);
    // Everything but bridges, inclines and paths, and three of each linking piece.
    const shown = entries.filter((e) => !["bridge", "incline", "path"].includes(e.kind));
    const linking = shown.filter((e) => "connects" in e && e.connects).length;
    const placed = Object.keys({ ...entityItems(map, "plants"), ...entityItems(map, "items") });
    expect(placed).toHaveLength(shown.length + 2 * linking);
    const one = showroomMap(game.catalog, ["sample-chair"]);
    expect(Object.keys(entityItems(one, "items"))).toHaveLength(1);
  });
});
