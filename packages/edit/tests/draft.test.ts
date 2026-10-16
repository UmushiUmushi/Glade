// The recording draft: reads see writes, only what an op touches is copied, writes put back are
// no change, and the profile-style ways of reading a map (loops, Object.values, JSON) all work.

import { entityLayer, gridLayer } from "@glade/core";
import { describe, expect, it } from "vitest";
import { createDraft } from "../src/draft";
import { freezeDoc } from "../src/freeze";
import { newYard, thing, type Thing } from "./toy";

const start = () => freezeDoc(newYard());

describe("grid layers", () => {
  it("reads see writes, and the map it started from stays as it was", () => {
    const base = start();
    const draft = createDraft(base);
    const cells = gridLayer<string>(draft.doc, "ground").cells;
    cells[1][2] = "w";
    expect(cells[1][2]).toBe("w");
    expect(gridLayer<string>(base, "ground").cells[1][2]).toBe("g");
  });

  it("records each changed cell once, with its first value and its last", () => {
    const draft = createDraft(start());
    const cells = gridLayer<string>(draft.doc, "ground").cells;
    cells[1][2] = "w";
    cells[1][2] = "x";
    cells[3][0] = "w";
    expect(draft.finish().patch.changes).toEqual([
      { kind: "cell", layer: "ground", x: 2, y: 1, before: "g", after: "x" },
      { kind: "cell", layer: "ground", x: 0, y: 3, before: "g", after: "w" },
    ]);
  });

  it("leaves out a cell written back to its first value", () => {
    const draft = createDraft(start());
    const cells = gridLayer<string>(draft.doc, "ground").cells;
    cells[0][0] = "w";
    cells[0][0] = "g";
    expect(draft.finish().patch.changes).toEqual([]);
  });

  it("the new map shares every row it didn't change", () => {
    const base = start();
    const draft = createDraft(base);
    gridLayer<string>(draft.doc, "ground").cells[2][4] = "w";
    const next = draft.finish().doc;
    const [a, b] = [
      gridLayer<string>(base, "ground").cells,
      gridLayer<string>(next, "ground").cells,
    ];
    expect(b[0]).toBe(a[0]);
    expect(b[2]).not.toBe(a[2]);
    expect(next.layers.things).toBe(base.layers.things);
  });

  it("works with loops, spreads, JSON and length like a plain grid", () => {
    const draft = createDraft(start());
    const cells = gridLayer<string>(draft.doc, "ground").cells;
    cells[0][1] = "w";
    expect(cells.length).toBe(4);
    expect(Array.isArray(cells[0])).toBe(true);
    expect([...cells[0]]).toEqual(["g", "w", "g", "g", "g", "g"]);
    expect(cells.map((row) => row.join("")).join("/")).toBe("gwgggg/gggggg/gggggg/gggggg");
    expect(JSON.parse(JSON.stringify(cells))[0][1]).toBe("w");
    expect(Object.keys(cells[0])).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(1 in cells[0] && !(6 in cells[0])).toBe(true);
    expect(cells[9]).toBeUndefined();
  });

  it("refuses to replace or remove rows, or write past a row's end", () => {
    const cells = gridLayer<string>(createDraft(start()).doc, "ground").cells;
    expect(() => {
      cells[0] = [];
    }).toThrow(/not rows/);
    expect(() => {
      cells[0][6] = "w";
    }).toThrow(/not rows/);
    expect(() => {
      cells[0].length = 0;
    }).toThrow(/not rows/);
    expect(() => delete cells[0]).toThrow(/not rows/);
  });
});

describe("entity layers", () => {
  it("adds, replaces and removes entities, recording each one's first and last state", () => {
    const base = freezeDoc(newYard());
    const seeded = createDraft(base);
    entityLayer<Thing>(seeded.doc, "things").items.a = thing("a", 0, 0);
    entityLayer<Thing>(seeded.doc, "things").items.b = thing("b", 1, 0);
    const start2 = seeded.finish().doc;

    const draft = createDraft(start2);
    const items = entityLayer<Thing>(draft.doc, "things").items;
    items.a = thing("a", 5, 3);
    delete items.b;
    items.c = thing("c", 2, 2);
    expect(Object.keys(items).sort()).toEqual(["a", "c"]);
    expect("b" in items).toBe(false);
    expect(Object.values(items).map((t) => t.x)).toEqual([5, 2]);
    expect(draft.finish().patch.changes).toEqual([
      {
        kind: "entity",
        layer: "things",
        id: "a",
        before: thing("a", 0, 0),
        after: thing("a", 5, 3),
      },
      { kind: "entity", layer: "things", id: "b", before: thing("b", 1, 0) },
      { kind: "entity", layer: "things", id: "c", after: thing("c", 2, 2) },
    ]);
  });

  it("an entity added then removed is no change", () => {
    const draft = createDraft(start());
    const items = entityLayer<Thing>(draft.doc, "things").items;
    items.a = thing("a", 0, 0);
    delete items.a;
    expect(draft.finish().patch.changes).toEqual([]);
  });

  it("a committed entity can't be edited in place; it must be replaced", () => {
    const seeded = createDraft(start());
    entityLayer<Thing>(seeded.doc, "things").items.a = thing("a", 0, 0);
    const base = seeded.finish().doc;
    const items = entityLayer<Thing>(createDraft(base).doc, "things").items;
    expect(() => {
      items.a.x = 4;
    }).toThrow(TypeError);
  });

  it("ignores symbol keys", () => {
    const items = entityLayer<Thing>(createDraft(start()).doc, "things").items as unknown as Record<
      symbol,
      unknown
    >;
    const key = Symbol("k");
    expect(items[key]).toBeUndefined();
    expect(Reflect.set(items, key, 1)).toBe(false);
    expect(Reflect.deleteProperty(items, key)).toBe(false);
    expect(Object.getOwnPropertyDescriptor(items, key)).toBeUndefined();
  });
});

describe("the draft map", () => {
  it("can't be renamed or have its layers swapped", () => {
    const doc = createDraft(start()).doc as { name: string; layers: Record<string, unknown> };
    expect(() => {
      doc.name = "other";
    }).toThrow(TypeError);
    expect(() => {
      doc.layers.ground = {};
    }).toThrow(TypeError);
  });
});
