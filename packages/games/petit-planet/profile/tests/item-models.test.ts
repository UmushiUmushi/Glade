// Catalog entries with full models (@glade/render models): checking an entry as an item builder
// would, and drawing groups, turned parts, own-geometry solids and finishes in 3D.

import { bind, customizeMap } from "@glade/core";
import { resolveLook, type InstancesSpec } from "@glade/render";
import { describe, expect, it } from "vitest";
import styleJson from "../look/planet.json" with { type: "json" };
import { modelsCatalog } from "../samples";
import { BLOCK_TILES, entryProblems, planet } from "../src";
import { catalogEntry, type CatalogEntry } from "../src/catalog";
import { type LayerInstances } from "../src/items/instances";
import { buildInstances } from "../src/maps/planet/render3d/objects";
import { geomLook, sampler } from "../src/maps/planet/render3d/terrain";
import type { Look, Style } from "../src/maps/planet/style";
import { addItems, blankMap, item, profile } from "./planet/helpers";
import { gridSpec } from "../src/maps/planet/profile";

const game = bind(planet, modelsCatalog);
const look = resolveLook(styleJson as unknown as Style, "midday") as Look;
const g = geomLook(look);
const spec = gridSpec(profile);
const sample = (type: string) => catalogEntry(game.catalog, type)!;

const box = (extra: object = {}): CatalogEntry => ({
  type: "test:block",
  kind: "item",
  footprint: { w: 2, h: 2 },
  shape: "block",
  glyph: "k",
  model: { parts: [{ shape: "box", at: [0.5, 0, 0.5], size: [0.5, 0.5, 0.5], color: "#888888" }] },
  ...extra,
});

/** Instances of every group in a layer. */
const total = (l: LayerInstances) => Object.values(l).reduce((n, x) => n + x.colors.length, 0);

function instancesOf(...items: ReturnType<typeof item>[]) {
  const map = addItems(blankMap(), ...items);
  return buildInstances(map, game.catalog, sampler(map, profile, g, spec), g.heightScale);
}

describe("entryProblems", () => {
  it("accepts a good entry and names what is wrong with a bad one", () => {
    expect(entryProblems(game, box())).toEqual([]);
    expect(entryProblems(game, { ...box(), glyph: "kk" })).toEqual([
      "glyph: Too big: expected string to have exactly 1 characters",
    ]);
    const outside = box({
      model: {
        parts: [
          {
            shape: "group",
            name: "legs",
            mirror: ["x"],
            at: [0.5, 0, 0.5],
            parts: [{ shape: "box", at: [0.6, 0, 0], size: [0.1, 0.4, 0.1], color: "#888888" }],
          },
        ],
      },
    });
    expect(entryProblems(game, outside)).toEqual([
      "model: part 1 > 1 (box): reaches outside the 1x1 tile footprint",
    ]);
  });

  it("checks linking pieces are one tile and bridges match their size", () => {
    expect(entryProblems(game, box({ footprint: { w: 4, h: 2 }, connects: true }))).toEqual([
      "footprint: a linking piece (connects) is one tile, { w: 2, h: 2 }",
    ]);
    const bridge = {
      type: "test:bridge",
      kind: "bridge",
      footprint: { w: 2, h: 6 },
      majorSize: { w: 1, l: 4 },
      shape: "slab",
      glyph: "h",
    };
    expect(entryProblems(game, bridge)).toEqual(["footprint: a 1x4 bridge is { w: 2, h: 8 }"]);
  });

  it("reads the model limits from the game's params, which apps can change", () => {
    const lantern = sample("sample-lantern");
    expect(entryProblems(game, lantern)).toEqual([]);
    const strict = customizeMap(game, {
      params: { modelLimits: { ...game.params.modelLimits, maxHeight: 2 } },
    });
    expect(entryProblems(strict, lantern)).toEqual([
      'model: part 2 > 4 (cone "cap"): taller than 2 blocks',
    ]);
  });

  it("works out turned parts with a block as tall as the look draws it", () => {
    // A rod one tile long stood on end, its middle 0.7 blocks up: it reaches 0.5 tiles above that,
    // which is more than half a block, since a block is less than a tile.
    const rod = box({
      model: {
        parts: [
          {
            shape: "box",
            at: [0.5, 0.7, 0.5],
            rotate: [0, 0, 90],
            size: [1, 0.1, 0.1],
            color: "#888888",
          },
        ],
      },
    });
    expect(BLOCK_TILES).toBeCloseTo(styleJson.units.heightScale / 2);
    expect(BLOCK_TILES).toBeLessThan(1);
    expect(entryProblems(game, rod)).toEqual([]);
    const limits = { ...game.params.modelLimits, maxHeight: 1.2 };
    expect(entryProblems(customizeMap(game, { params: { modelLimits: limits } }), rod)).toEqual([
      "model: part 1 (box): taller than 1.2 blocks",
    ]);
    // Apps that draw blocks a tile tall see it 1.2 blocks tall: within the limit.
    const custom = customizeMap(game, { params: { modelLimits: limits } });
    expect(entryProblems(custom, rod, { blockSize: 1 })).toEqual([]);
  });
});

describe("item models in 3D", () => {
  it("draws a solid of its own once per shape, instanced for every copy", () => {
    const inst = instancesOf(item("sample-chair", 80, 80), item("sample-chair", 84, 80));
    const seats = Object.entries(inst.items).filter(([, x]) =>
      x.geometry?.key.includes('"round":0.03'),
    );
    // The seat (round 0.03) of both chairs share one geometry.
    expect(seats).toHaveLength(1);
    expect(seats[0][1].colors).toHaveLength(2);
    // Legs (tapered cylinders, mirrored into four): the two mirrored copies need a mirrored
    // geometry, the other two the plain one.
    const legs = Object.values(inst.items).filter((x) => x.geometry?.key.includes('"top":0.03'));
    expect(legs.map((x) => x.colors.length).sort()).toEqual([4, 4]);
    // 4 legs + seat + 4 slats + top rail, twice.
    expect(total(inst.items)).toBe(20);
  });

  it("turns parts in true proportions: a part stood on end is as tall as it was long", () => {
    const rodGame = bind(planet, {
      entries: [
        box({
          model: {
            parts: [
              {
                shape: "box",
                at: [0.5, 0.5, 0.5],
                rotate: [0, 0, 90],
                size: [0.8, 0.1, 0.1],
                color: "#888888",
              },
            ],
          },
        }),
      ],
    });
    const map = addItems(blankMap(), item("test:block", 80, 80));
    const inst = buildInstances(
      map,
      rodGame.catalog,
      sampler(map, profile, g, spec),
      g.heightScale,
    );
    const m = inst.items.box.matrices;
    // The box's x axis (its 0.8-tile length) now points up: 0.8 tiles = 1.6 world units.
    expect(m[0]).toBeCloseTo(0);
    expect(m[1]).toBeCloseTo(1.6);
  });

  it("groups instances by finish, for the glow and glass materials", () => {
    const inst = instancesOf(item("sample-lantern", 80, 80), item("sample-crystal", 84, 80));
    const finishes = new Set(
      Object.values(inst.items)
        .filter((x) => x.colors.length)
        .map((x) => x.finish),
    );
    expect(finishes).toEqual(new Set(["matte", "glow", "glass"]));
    expect(inst.items["glow sphere"].colors).toEqual(["#ffd27a"]);
    expect(inst.items["glass box"].colors).toHaveLength(1);
  });

  it("turns own-geometry solids with the item", () => {
    const at0 = instancesOf(item("sample-tent", 80, 80, 0)).items;
    const at90 = instancesOf(item("sample-tent", 80, 80, 90)).items;
    const wedge = (l: LayerInstances) =>
      Object.values(l)
        .filter((x) => x.geometry?.key.includes("wedge"))[0]
        .matrices.slice(0, 16);
    const [a, b] = [wedge(at0), wedge(at90)];
    // The wedge's x axis runs east-west at 0 and north-south at 90.
    expect(Math.abs(a[0])).toBeCloseTo(2);
    expect(Math.abs(b[2])).toBeCloseTo(2);
  });

  it("puts a door on a building with a model made of groups", () => {
    const inst = instancesOf(item("sample-cottage", 80, 80));
    expect(inst.items.box.colors).toContain("#3b2a1c");
  });

  it("links fences whose posts are groups, one post per end", () => {
    const inst = instancesOf(
      item("sample-picket", 80, 80),
      item("sample-picket", 82, 80),
      item("sample-picket", 84, 80),
    );
    // Three pieces in a row have four ends; each post is a box and a four-sided cone.
    const caps = Object.values(inst.items).filter((x) => x.geometry?.key.includes('"sides":4'));
    expect(caps.reduce((n, x) => n + x.colors.length, 0)).toBe(4);
    // Rails: two per arm, two arms per piece.
    expect(inst.items.box.colors.length).toBe(3 * 2 * 2 + 4);
  });

  it("rings the feet of turned and own-geometry parts with leaf stamps", () => {
    const map = addItems(blankMap(), item("sample-tent", 80, 80));
    const s = sampler(map, profile, g, spec);
    const feet = { land: g.land, heightScale: g.heightScale, baseLevel: profile.land.defaultLevel };
    const inst = buildInstances(map, game.catalog, s, g.heightScale, feet);
    expect(inst.itemLeaves.colors.length).toBeGreaterThan(20);
  });

  it("draws tubes, part of a ring, and copies that turn as they repeat", () => {
    const feet = { land: g.land, heightScale: g.heightScale, baseLevel: profile.land.defaultLevel };
    const map = addItems(
      blankMap(),
      item("sample-hose-reel", 80, 80),
      item("sample-pipework", 84, 80),
      item("sample-fire-pit", 90, 80),
      item("sample-spiral-stair", 96, 80),
    );
    const inst = buildInstances(
      map,
      game.catalog,
      sampler(map, profile, g, spec),
      g.heightScale,
      feet,
    );
    const own = (word: string) =>
      Object.values(inst.items).filter((x) => x.geometry?.key.includes(word));
    // The coil, the hose's end and the bent pipe are each a tube of their own.
    expect(own('"shape":"tube"')).toHaveLength(3);
    expect(own('"arc":90')).toHaveLength(1);
    // Ten stones from one: one rounded-box geometry, ten instances.
    expect(own('"round":0.05').map((x) => x.colors.length)).toEqual([10]);
    // The stair's steps climb a quarter block each (y of each step's matrix).
    const steps = inst.items.box.matrices.filter((_, i) => i % 16 === 13);
    const rise = steps.slice(1).map((y, i) => +(y - steps[i]).toFixed(4));
    expect(new Set(rise)).toEqual(new Set([+(0.25 * g.heightScale).toFixed(4)]));
  });

  it("gives the viewer specs with a material for every finish", () => {
    const doc = addItems(
      blankMap(),
      item("sample-lantern", 80, 80),
      item("sample-crystal", 84, 80),
      item("sample-gazebo", 90, 80),
    );
    const specs = game.views.scene!.buildChunk(doc, game, look, "objects") as InstancesSpec[];
    const mats = game.views.scene!.materials(look, { flat: false, layers: {} });
    for (const s of specs) expect(mats[s.material], s.material).toBeDefined();
    const glass = specs.filter((s) => s.material === "objects-glass");
    expect(glass.length).toBeGreaterThan(0);
    expect(glass.every((s) => !s.outline && s.castShadow === false)).toBe(true);
    const own = specs.filter((s) => s.geometry);
    expect(own.length).toBeGreaterThan(0);
    for (const s of own) {
      expect(s.primitive).toBeUndefined();
      const a = s.geometry!.arrays;
      expect(a.position.length).toBe(3 * a.vertexCount);
      expect(Math.max(...a.index)).toBeLessThan(a.vertexCount);
    }
  });

  it("glows faintly by day and fully at night", () => {
    const glow = (preset: string) => {
      const l = resolveLook(styleJson as unknown as Style, preset) as Look;
      return game.views.scene!.materials(l, { flat: false, layers: {} })["objects-glow"].uniforms!
        .uGlow;
    };
    expect(glow("night")).toBe("#ffffff");
    expect(glow("midday")).not.toBe("#ffffff");
  });
});
