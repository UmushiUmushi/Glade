// The generic core: spaces, docs and their codecs, catalogs and kinds.
// Nothing here knows about any game; the fixtures are made-up grids and layers.

import { describe, expect, it } from "vitest";
import {
  blankDoc,
  decodeDoc,
  deepEqual,
  encodeDoc,
  serializeDoc,
  type LayerSchema,
} from "../src/doc";
import { bind, catalogProblems, entryOf, kindChain, kindIs, typeIs } from "../src/catalog";
import type { MapDefinition } from "../src/game";
import {
  boxToRect,
  cellsText,
  clipBox,
  convertRect,
  rectToWorld,
  worldToCell,
  type Space,
} from "../src/space";

const space: Space = {
  unit: "m",
  bounds: { x: 0, y: 0, w: 12, h: 8 },
  grids: {
    tile: { cell: [4, 4], origin: [0, 0], size: [3, 2], abbr: "T" },
    fine: { cell: [1, 1], origin: [0, 0], size: [12, 8] },
    corner: { cell: [4, 4], origin: [-2, -2], size: [4, 3] },
  },
};

describe("space", () => {
  it("converts rects between grids through world boxes", () => {
    expect(rectToWorld(space, { grid: "tile", x: 1, y: 0, w: 2, h: 1 })).toEqual({
      x: 4,
      y: 0,
      w: 8,
      h: 4,
    });
    expect(convertRect(space, { grid: "tile", x: 1, y: 1, w: 1, h: 1 }, "fine")).toEqual({
      grid: "fine",
      x: 4,
      y: 4,
      w: 4,
      h: 4,
    });
    // A tile overlaps four corner cells; the corner grid's outer ring is clipped by the bounds.
    expect(convertRect(space, { grid: "tile", x: 0, y: 0, w: 1, h: 1 }, "corner")).toEqual({
      grid: "corner",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
    expect(convertRect(space, { grid: "corner", x: 0, y: 0, w: 1, h: 1 }, "fine")).toEqual({
      grid: "fine",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  it("clips per axis and finds the cell under a point", () => {
    expect(clipBox(space, { x: -3, y: 6, w: 5, h: 5 })).toEqual({ x: 0, y: 6, w: 2, h: 2 });
    expect(boxToRect(space, { x: 20, y: 1, w: 2, h: 2 }, "fine")).toMatchObject({ w: 0, h: 2 });
    expect(worldToCell(space, "corner", 2, 1.99)).toEqual({ grid: "corner", x: 1, y: 0 });
    expect(
      cellsText(space, [
        { grid: "tile", x: 1, y: 2 },
        { grid: "fine", x: 0, y: 0 },
      ]),
    ).toBe("T(1,2) fine(0,0)");
  });
});

const schema: LayerSchema = {
  ground: {
    kind: "grid",
    grid: "tile",
    description: "a letter per tile",
    initial: () => "g",
    codec: { kind: "rle", token: (c: string) => c, parse: (t: string) => t },
  },
  marks: {
    kind: "grid",
    grid: "fine",
    description: "sparse numbers",
    initial: () => null,
    codec: { kind: "sparse" },
  },
  things: { kind: "entities", description: "things", label: "thing kinds", quiet: true },
};

function doc() {
  return blankDoc(
    { game: "toy", map: "yard" },
    space,
    schema,
    "t",
    new Date("2026-01-01T00:00:00Z"),
  );
}

describe("docs", () => {
  it("round-trips through the encoded form and the file text", () => {
    const d = doc();
    (d.layers.ground as { cells: string[][] }).cells[1][2] = "w";
    (d.layers.marks as { cells: (number | null)[][] }).cells[3][5] = 7;
    (d.layers.things as { items: object }).items = {
      a10: { id: "a10", type: "x" },
      a2: { id: "a2", type: "y" },
    };
    const enc = encodeDoc(schema, d);
    expect(enc.layers.ground).toMatchObject({ encoding: "rle", rows: ["g*3", "g*2 w"] });
    expect(enc.layers.marks).toMatchObject({ encoding: "sparse", cells: { "5,3": 7 } });
    expect((enc.layers.things as { items: { id: string }[] }).items.map((e) => e.id)).toEqual([
      "a2",
      "a10",
    ]);
    const back = decodeDoc(schema, space, JSON.parse(serializeDoc(schema, d)));
    expect(deepEqual(back, d)).toBe(true);
    expect(Object.keys((back.layers.things as { items: object }).items)).toEqual(["a2", "a10"]);
  });

  it("rejects grids of the wrong size", () => {
    const enc = encodeDoc(schema, doc());
    (enc.layers.ground as { rows: string[] }).rows = ["g*3"];
    expect(() => decodeDoc(schema, space, enc)).toThrow(/ground is 3x1; the game expects 3x2/);
  });
});

describe("catalogs and kinds", () => {
  // Only what catalogs read of a game: its kinds, and its own entry check.
  const game = {
    kinds: [
      { kind: "seat", description: "something to sit on" },
      { kind: "chair", parent: "seat", description: "a seat with a back" },
      { kind: "lamp", description: "a light" },
    ],
    entryProblems: (e: unknown) => ((e as { legs?: number }).legs === 0 ? ["legs: none"] : []),
  } as unknown as MapDefinition;
  const catalog = {
    kinds: [{ kind: "armchair", parent: "chair", description: "a soft chair" }],
    entries: [
      { type: "club", kind: "armchair" },
      { type: "stool", kind: "seat" },
    ],
  };
  const bound = bind(game, catalog);

  it("binds without changing the game", () => {
    expect(bound.catalog).toBe(catalog);
    expect(game).not.toHaveProperty("catalog");
  });

  it("follows a kind's parents, the catalog's own kinds included", () => {
    expect(kindChain(bound, "armchair")).toEqual(["armchair", "chair", "seat"]);
    expect(kindChain(bound, "sofa")).toEqual([]);
    expect(kindIs(bound, "armchair", "seat")).toBe(true);
    expect(kindIs(bound, "seat", "chair")).toBe(false);
    expect(typeIs(bound, "club", "chair")).toBe(true);
    expect(typeIs(bound, "stool", "chair")).toBe(false);
    expect(entryOf(bound, "stool")).toEqual({ type: "stool", kind: "seat" });
  });

  it("sees a catalog given new entries", () => {
    const live = { entries: [{ type: "stool", kind: "seat" }] };
    const g = bind(game, live);
    expect(entryOf(g, "bench")).toBeUndefined();
    live.entries = [...live.entries, { type: "bench", kind: "seat" }];
    expect(entryOf(g, "bench")).toEqual({ type: "bench", kind: "seat" });
  });

  it("treats a loop of parents as unknown", () => {
    const loop = bind(game, {
      entries: [],
      kinds: [
        { kind: "a", parent: "b", description: "" },
        { kind: "b", parent: "a", description: "" },
      ],
    });
    expect(kindChain(loop, "a")).toEqual([]);
  });

  it("lists what is wrong with a catalog", () => {
    expect(catalogProblems(game, catalog)).toEqual([]);
    expect(
      catalogProblems(game, {
        kinds: [
          { kind: "lamp", description: "" },
          { kind: "orphan", description: "" },
          { kind: "stray", parent: "nowhere", description: "" },
        ],
        entries: [
          { type: "", kind: "seat" },
          { type: "x", kind: "seat" },
          { type: "x", kind: "seat" },
          { type: "y", kind: "sofa" },
          { type: "z", kind: "chair", legs: 0 } as { type: string; kind: string },
        ],
      }),
    ).toEqual([
      "kind lamp: the game already has this kind",
      "kind orphan: needs a parent kind the game knows",
      "kind stray: its parents do not lead to a kind the game knows",
      "entry 0: needs a type",
      "x: type used twice",
      "y: unknown kind sofa",
      "z: legs: none",
    ]);
  });
});
