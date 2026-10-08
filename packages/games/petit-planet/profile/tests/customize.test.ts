// Customizing Petit Planet: apps turn rules off, change params, and bring their own items, with
// kinds of their own under the game's. Ops and renderers read the same customized params as the
// rules.

import { bind, catalogProblems, customizeMap, validate } from "@glade/core";
import { describe, expect, it } from "vitest";
import { entryProblems, kinds, petitPlanet, planet, upgradeCatalog, type Catalog } from "../src";
import { terrainGrid, type MapDoc } from "../src/maps/planet/model";
import { testCatalog } from "../samples";
import { addItems, addPlants, blankMap, item, plant } from "./planet/helpers";

/** Ids of the rules a map breaks, with an app's catalog. */
const broken = (g: typeof planet, map: MapDoc, catalog: Catalog = testCatalog) =>
  validate(map, bind(g, catalog)).map((v) => v.ruleId);

/** A single block `h` high at terrain 60,60, on level-1 land. */
function spike(h: number): MapDoc {
  const map = blankMap();
  terrainGrid(map)[60][60] = { h, water: false };
  return map;
}
/** A step of 4 from the land around it (T3 allows 3). */
const SPIKE = spike(5);

describe("Petit Planet's profile", () => {
  it("ships kinds, not items", () => {
    expect(planet).not.toHaveProperty("catalog");
    expect(kinds.map((k) => (k.parent ? `${k.parent}/${k.kind}` : k.kind))).toEqual([
      "plant",
      "plant/tree",
      "plant/shrub",
      "plant/flower",
      "item",
      "item/building",
      "bridge",
      "incline",
      "wallpaper",
      "flooring",
      "path",
    ]);
  });

  it("every rule a kind names exists, on one of the game's maps", () => {
    const ids = new Set(
      Object.values(petitPlanet.maps).flatMap((m) => m.rulebook().map((r) => r.id)),
    );
    for (const k of kinds)
      for (const id of k.rules ?? []) expect(ids.has(id), `${k.kind}: ${id}`).toBe(true);
  });

  it("an app's catalog entries validate against the kinds", () => {
    expect(catalogProblems(planet, testCatalog)).toEqual([]);
    expect(entryProblems(planet, { type: "x", kind: "bridge" })).not.toEqual([]);
    expect(entryProblems(planet, { type: "x", kind: "sofa" })).toEqual([
      'kind: unknown kind "sofa"',
    ]);
  });
});

describe("kinds of the app's own", () => {
  const OAK = {
    type: "my:oak",
    kind: "oak",
    footprint: { w: 2, h: 2 },
    shape: "trunk-cone",
    glyph: "O",
  };
  const mine: Catalog = {
    entries: [OAK],
    kinds: [{ kind: "oak", parent: "tree", description: "" }],
  };

  it("are checked like the kind they are a sort of", () => {
    expect(catalogProblems(planet, mine)).toEqual([]);
    expect(entryProblems(planet, { ...OAK, footprint: undefined }, { catalog: mine })).toEqual([
      "footprint: Invalid input: expected object, received undefined",
    ]);
  });

  it("follow their parents' rules: two oaks side by side break tree spacing", () => {
    const map = addPlants(blankMap(), plant("my:oak", 60, 60), plant("my:oak", 61, 60));
    expect(validate(map, bind(planet, mine)).map((v) => v.ruleId)).toEqual(["L6"]);
  });

  it("need a parent the game knows", () => {
    const lost: Catalog = { entries: [], kinds: [{ kind: "x", parent: "y", description: "" }] };
    expect(catalogProblems(planet, lost)).toEqual([
      "kind x: its parents do not lead to a kind the game knows",
    ]);
    expect(
      catalogProblems(planet, { entries: [], kinds: [{ kind: "tree", description: "" }] }),
    ).toEqual(["kind tree: the game already has this kind"]);
  });
});

describe("upgrading an older catalog", () => {
  it("turns the tree and building flags into kinds", () => {
    const old = {
      entries: [
        { type: "oak", kind: "plant", tree: true },
        { type: "rose", kind: "plant", tree: false },
        { type: "inn", kind: "item", building: true },
        { type: "bench", kind: "item" },
      ],
    };
    const { catalog, notes } = upgradeCatalog(old);
    expect(catalog.entries).toEqual([
      { type: "oak", kind: "tree" },
      { type: "rose", kind: "plant" },
      { type: "inn", kind: "building" },
      { type: "bench", kind: "item" },
    ]);
    expect(notes).toEqual(["oak: kind plant -> tree", "inn: kind item -> building"]);
  });
});

describe("customizing rules and params", () => {
  it("the step limit applies by default", () => {
    expect(broken(planet, SPIKE)).toContain("T3");
  });

  it("turning the step rule off lets the step through", () => {
    const g = customizeMap(planet, { rules: { off: ["T3"] } });
    expect(broken(g, SPIKE)).toEqual([]);
  });

  it("turning every rule off lets anything through", () => {
    const g = customizeMap(planet, { rules: { off: "all" } });
    expect(g.rules).toEqual([]);
    expect(broken(g, SPIKE)).toEqual([]);
  });

  it("a param changes what the rules allow", () => {
    const noStep = customizeMap(planet, { rules: { off: ["T3"] } });
    expect(broken(noStep, spike(12))).toEqual(["T1"]);
    const tall = customizeMap(noStep, { params: { maxHeight: 12 } });
    expect(broken(tall, spike(12))).toEqual([]);
  });

  it("nested params merge key by key", () => {
    const g = customizeMap(planet, { params: { bridge: { maxLength: 9 } } });
    expect(g.params.bridge).toEqual({ minLength: 4, maxLength: 9 });
    expect(planet.params.bridge).toEqual({ minLength: 4, maxLength: 7 });
  });
});

describe("binding a catalog", () => {
  const BENCH = () => addItems(blankMap(), item("bench", 95, 79, 90));

  it("an item the catalog lacks is reported", () => {
    expect(broken(planet, BENCH(), { entries: [] })).toEqual(["O1"]);
  });

  it("an app's own items are known", () => {
    expect(broken(planet, BENCH())).toEqual([]);
  });
});
