// Things from above: a model's own top view in its parts' colors, with no outlines, and given a
// sun a shadow cast away from it (none when too small to see); plant symbols without a model.

import type { SolidPart } from "@glade/render";
import { describe, expect, it } from "vitest";
import { catalogEntry } from "../src/catalog";
import { drawItem2D } from "../src/items";
import { shadeFor } from "../src/plan-style";
import { testCatalog as catalog } from "../samples";
import { recordCanvas } from "./canvas";

const box = { x: 10, y: 10, w: 4, h: 2 };
/** One screen pixel, in minor units, when a minor cell is 20 pixels: the bench is 80 across. */
const NEAR = 0.05;
/** When a minor cell is one pixel: the bench is 2 pixels across. */
const FAR = 1;
/** A sun due south: shadows fall north (toward smaller y). */
const shade = shadeFor({ azimuth: 180, elevation: 45 });

function draw(type: string, px: number, r = box, opts: { rot?: number; lit?: boolean } = {}) {
  const { ctx, log } = recordCanvas();
  drawItem2D(ctx, catalog, type, r, opts.rot ?? 0, px, { shade: opts.lit ? shade : undefined });
  return log;
}

/** The y of every point a drawing traced. */
const ys = (log: string[]) =>
  log
    .filter((l) => l.startsWith("moveTo(") || l.startsWith("lineTo("))
    .map((l) => Number(l.slice(7, -1).split(",")[1]));

const wood = () => {
  const bench = catalogEntry(catalog, "bench");
  if (!bench?.model) throw new Error("the test catalog has a bench with a model");
  return (bench.model.parts[0] as SolidPart).color;
};

describe("a model from above", () => {
  it("is its parts' colors with no outline", () => {
    const log = draw("bench", NEAR);
    expect(log).toContain(`fillStyle=${wood()}`);
    expect(log.some((l) => l.startsWith("strokeStyle=#3d3632"))).toBe(false);
  });

  it("given a sun, casts its shadow first, away from the sun", () => {
    const log = draw("bench", NEAR, box, { lit: true });
    expect(log.indexOf(`fillStyle=${shade.color}`)).toBeGreaterThan(-1);
    expect(log.indexOf(`fillStyle=${shade.color}`)).toBeLessThan(
      log.indexOf(`fillStyle=${wood()}`),
    );
    // The bench stands on y 10..12; a sun due south throws its shadow north, above it.
    expect(Math.min(...ys(log))).toBeLessThan(box.y);
    expect(Math.min(...ys(draw("bench", NEAR)))).toBeGreaterThanOrEqual(box.y);
  });

  it("casts a longer shadow for a taller thing", () => {
    const spot = { x: 0, y: 10, w: 2, h: 2 };
    const reach = (type: string) => spot.y - Math.min(...ys(draw(type, NEAR, spot, { lit: true })));
    expect(reach("tree")).toBeGreaterThan(reach("bench") + 1);
  });

  it("casts no shadow when it is a few pixels across", () => {
    expect(draw("bench", FAR, box, { lit: true })).not.toContain(`fillStyle=${shade.color}`);
  });

  it("draws the same way every time (models and shadows are prepared once and kept)", () => {
    expect(draw("bench", NEAR, box, { lit: true })).toEqual(
      draw("bench", NEAR, box, { lit: true }),
    );
    expect(draw("bench", NEAR, box, { rot: 90 })).not.toEqual(draw("bench", NEAR));
  });
});

describe("plants", () => {
  it("with a model are drawn from it", () => {
    const tree = catalogEntry(catalog, "tree");
    if (!tree?.model) throw new Error("the test catalog has a tree with a model");
    const crown = tree.model.parts.at(-1) as SolidPart;
    expect(draw("tree", NEAR, { x: 0, y: 0, w: 2, h: 2 })).toContain(`fillStyle=${crown.color}`);
  });

  it("without a model are their shape's symbol, with a shadow given a sun", () => {
    const log = draw("bush", NEAR, { x: 0, y: 0, w: 2, h: 2 }, { lit: true });
    expect(log).toContain("fillStyle=#7f9f3a");
    expect(log).toContain(`fillStyle=${shade.color}`);
  });
});
