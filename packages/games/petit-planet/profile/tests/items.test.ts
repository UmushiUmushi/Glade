// The item formula (src/items/): how one catalog entry looks on its own, in 2D and 3D, and how the
// planet draws an app's own model for a placed thing (a state the game knows nothing about).

import { bind } from "@glade/core";
import {
  customizeLook,
  resolveLook,
  type InstancesSpec,
  type Model,
  type SolidPart,
} from "@glade/render";
import { describe, expect, it } from "vitest";
import { itemModel, planet } from "../src";
import { testCatalog } from "../samples";
import { addItems, blankMap, item } from "./planet/helpers";

const box = (color: string): Model => ({
  parts: [{ shape: "box", at: [0.5, 0, 0.5], size: [0.8, 1, 0.8], color }],
});

describe("the item formula", () => {
  it("gives a building a door on its front, and nothing else one", () => {
    const house = itemModel(testCatalog, "house");
    expect(house.parts.length).toBe(itemModel(testCatalog, "rock").parts.length + 1);
    expect((house.parts.at(-1) as SolidPart).color).toBe("#3b2a1c");
  });

  it("draws an incline without a model as four steps climbing `rise` blocks", () => {
    const steps = itemModel(testCatalog, "incline-1x2", { rise: 2 });
    expect(steps.parts).toHaveLength(4);
    const top = steps.parts[3] as { size: [number, number, number] };
    expect(top.size[1]).toBe(2);
  });

  it("uses an app's model in place of the entry's, and still adds the game's door", () => {
    const open = itemModel(testCatalog, "house", { model: box("#00ff00") });
    expect(open.parts).toHaveLength(2);
    expect((open.parts[0] as SolidPart).color).toBe("#00ff00");
  });
});

describe("an app's models for placed things", () => {
  const map = addItems(blankMap(), { ...item("rock", 80, 80), id: "r1", state: "painted" });
  /** Colors of the item instances the map's own 3D renderer builds. */
  const colors = (m: typeof planet) => {
    const game = bind(m, testCatalog);
    const look = resolveLook(game.style.defaults);
    return game.views
      .scene!.buildChunk(map, game, look, "objects")
      .filter(
        (s): s is InstancesSpec =>
          s.kind === "instances" && s.layer === "items" && s.material.startsWith("objects"),
      )
      .flatMap((s) => s.colors);
  };

  it("are drawn in 3D for the things the app chooses, by their own fields", () => {
    const painted = customizeLook(planet, {
      itemModel: (thing) => (thing.state === "painted" ? box("#ff00ff") : undefined),
    });
    expect(colors(planet)).not.toContain("#ff00ff");
    expect(colors(painted)).toEqual(["#ff00ff"]);
  });

  it("are drawn in 2D too", () => {
    const fills: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k) => (k in t ? t[k as string] : () => {}),
      set: (t, k, v) => {
        if (k === "fillStyle") fills.push(String(v));
        t[k as string] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const painted = bind(
      customizeLook(planet, { itemModel: (t) => (t.state ? box("#ff00ff") : undefined) }),
      testCatalog,
    );
    // The terrain is painted on an offscreen canvas: just enough of one for this test.
    const g = globalThis as Record<string, unknown>;
    g.document = { createElement: () => ({ getContext: () => ctx }) };
    g.ImageData = class {
      data: Uint8ClampedArray;
      constructor(w: number, h: number) {
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
    try {
      const visible = { x: 0, y: 0, w: 160, h: 144 };
      painted.views.plan!.draw(ctx, map, painted, { items: true }, visible, 4);
    } finally {
      delete g.document;
      delete g.ImageData;
    }
    expect(fills).toContain("#ff00ff");
  });
});
