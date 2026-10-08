// Surfaces (src/surfaces/): things standing on tables, checked by rules S1 to S3, placed in the
// table's own grid (which turns with it), located, drawn on top of the table, and named in hover
// text. Shown on the planet; every map of the game shares them.

import { bind, entityLayer, validate, type Doc } from "@glade/core";
import { resolveLook, type InstancesSpec } from "@glade/render";
import { describe, expect, it } from "vitest";
import { entryProblems, planet } from "../src";
import { onSurfaceBox, type OnSurface } from "../src/surfaces";
import { surfaceHosts } from "../src/maps/planet/model";
import { testCatalog } from "../samples";
import { addItems, blankMap, item } from "./planet/helpers";

const game = bind(planet, testCatalog);

/** A 2x2 table t1 at minor 80,80 (turned `rot`), and things on it. */
function onTable(
  things: Pick<OnSurface, "id" | "type" | "x" | "y" | "rot">[],
  rot: 0 | 90 | 180 | 270 = 0,
): Doc {
  const map = addItems(blankMap(), { ...item("table-2x2", 80, 80, rot), id: "t1" });
  const layer = entityLayer<OnSurface>(map, "onSurfaces");
  for (const t of things) layer.items[t.id] = { ...t, on: "t1" };
  return map;
}
const thing = (id: string, type: string, x: number, y: number, rot: 0 | 90 = 0) => ({
  id,
  type,
  x,
  y,
  rot,
});
const broken = (doc: Doc) => validate(doc, game).map((v) => v.ruleId);

describe("catalog entries", () => {
  it("have a surface or are placeable, never both", () => {
    const both = {
      type: "x",
      kind: "item",
      footprint: { w: 2, h: 2 },
      shape: "s",
      glyph: "x",
      surface: { w: 6, h: 6 },
      placeable: { w: 2, h: 2 },
    };
    expect(entryProblems(planet, both)).toEqual([
      "surface and placeable: nothing stacks, so an entry has one or the other",
    ]);
  });
});

describe("the surface rules", () => {
  it("accept placeable things wholly on a table's surface, apart", () => {
    const doc = onTable([
      thing("a", "tray", 0, 0),
      thing("b", "cup", 8, 8),
      thing("c", "cup", 10, 0),
    ]);
    expect(broken(doc)).toEqual([]);
  });

  it("S1: only placeable things, only on items with a surface, and nothing stacks", () => {
    expect(broken(onTable([thing("a", "rock", 0, 0)]))).toEqual(["S1"]);
    expect(broken(onTable([thing("a", "table-1x1", 0, 0)]))).toEqual(["S1"]);
    const onRock = addItems(blankMap(), { ...item("rock", 80, 80), id: "r1" });
    entityLayer<OnSurface>(onRock, "onSurfaces").items.a = { ...thing("a", "cup", 0, 0), on: "r1" };
    expect(broken(onRock)).toEqual(["S1"]);
    const nowhere = blankMap();
    entityLayer<OnSurface>(nowhere, "onSurfaces").items.a = {
      ...thing("a", "cup", 0, 0),
      on: "gone",
    };
    expect(broken(nowhere)).toEqual(["S1"]);
  });

  it("S2: off the surface, or between its half cells", () => {
    expect(broken(onTable([thing("a", "tray", 10, 0)]))).toEqual(["S2"]);
    expect(broken(onTable([thing("a", "cup", 0.5, 0)]))).toEqual(["S2"]);
  });

  it("S3: things on one surface do not overlap", () => {
    expect(broken(onTable([thing("a", "tray", 0, 0), thing("b", "cup", 2, 2)]))).toEqual(["S3"]);
  });

  it("ids stay unique across plants, items and things on surfaces (O2)", () => {
    expect(broken(onTable([thing("t1", "cup", 0, 0)]))).toContain("O2");
  });
});

describe("where a thing on a surface sits", () => {
  const box = (doc: Doc, id: string) => {
    const t = entityLayer<OnSurface>(doc, "onSurfaces").items[id];
    return onSurfaceBox(testCatalog, surfaceHosts(doc, testCatalog).get("t1")!, t);
  };

  it("in the table's grid: a cell of a 2x2 table's 6 x 6 top is a third of a tile", () => {
    const b = box(onTable([thing("a", "cup", 0, 0)]), "a")!;
    expect(b.x).toBe(80);
    expect(b.y).toBe(80);
    expect(b.w).toBeCloseTo(4 / 6, 9);
    expect(b.rot).toBe(0);
  });

  it("turning with the table: at 90, the top-left corner of its grid is the top-right", () => {
    const b = box(onTable([thing("a", "cup", 0, 0, 90)], 90), "a")!;
    expect(b.x).toBeCloseTo(84 - 4 / 6, 9);
    expect(b.y).toBe(80);
    expect(b.rot).toBe(180);
  });

  it("is located on the half tiles under it", () => {
    // A tray at 8,8 of the 12 x 12 grid covers minor 82.67 to 84 each way.
    const doc = onTable([thing("a", "tray", 8, 8)]);
    const t = entityLayer<OnSurface>(doc, "onSurfaces").items.a;
    expect(game.locate(game, doc, "onSurfaces", t)).toEqual([
      { grid: "minor", x: 82, y: 82, w: 2, h: 2 },
    ]);
  });
});

describe("drawing things on surfaces", () => {
  it("in 3D, on the top of the table", () => {
    const doc = onTable([thing("a", "cup", 4, 4)]);
    const look = resolveLook(game.style.defaults);
    const cups = game.views
      .scene!.buildChunk(doc, game, look, "objects")
      .filter((s): s is InstancesSpec => s.kind === "instances" && s.primitive === "cylinder");
    expect(cups).toHaveLength(1);
    const ground = game.views.scene!.ground(doc, game, look)(41, 41);
    // A cylinder instance's matrix: translation y is its foot.
    expect(cups[0].matrices[13]).toBeGreaterThan(ground + 0.5 * look.units.heightScale);
  });

  it("and in hover text", () => {
    const doc = onTable([thing("a", "cup", 4, 4)]);
    // The cup covers minor 81.33 to 82, world 40.67 to 41.
    expect(game.ui.hover(doc, game, { x: 40.8, y: 40.8 })).toContain("cup a on t1");
    expect(game.ui.hover(doc, game, { x: 40.2, y: 40.2 })).not.toContain("cup a");
  });
});
