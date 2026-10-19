// Things from above: a model's own top view in its parts' colors, with no outlines, and on request
// a soft shadow south-east of it (none when too small to see); plant symbols without a model;
// and the small rounded triangles that show a building's front and which way stairs climb.

import type { SolidPart } from "@glade/render";
import { describe, expect, it } from "vitest";
import { catalogEntry } from "../src/catalog";
import { drawItem2D, frontArrow } from "../src/items";
import { frontSide } from "../src/items/model";
import { PLAN, SHADE } from "../src/plan-style";
import { testCatalog as catalog } from "../samples";
import { recordCanvas } from "./canvas";

const box = { x: 10, y: 10, w: 4, h: 2 };
/** One screen pixel, in minor units, when a minor cell is 20 pixels: the bench is 80 across. */
const NEAR = 0.05;
/** When a minor cell is one pixel: the bench is 2 pixels across. */
const FAR = 1;

function draw(type: string, r = box, opts: { rot?: number; shadow?: boolean; px?: number } = {}) {
  const { ctx, log } = recordCanvas();
  drawItem2D(ctx, catalog, type, r, opts.rot ?? 0, opts.px ?? NEAR, { shadow: opts.shadow });
  return log;
}

/** Every point a drawing traced. */
const points = (log: string[]) =>
  log
    .filter((l) => l.startsWith("moveTo(") || l.startsWith("lineTo("))
    .map((l) => l.slice(7, -1).split(",").map(Number));

const wood = () => {
  const bench = catalogEntry(catalog, "bench");
  if (!bench?.model) throw new Error("the test catalog has a bench with a model");
  return (bench.model.parts[0] as SolidPart).color;
};

describe("a model from above", () => {
  it("is its parts' colors with no outline", () => {
    const log = draw("bench");
    expect(log).toContain(`fillStyle=${wood()}`);
    expect(log.some((l) => l.startsWith("strokeStyle=#3d3632"))).toBe(false);
  });

  it("casts no shadow unless asked: everything it draws stays inside its own rect", () => {
    for (const [x, y] of points(draw("bench"))) {
      expect(x).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(x).toBeLessThanOrEqual(box.x + box.w + 1e-9);
      expect(y).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(y).toBeLessThanOrEqual(box.y + box.h + 1e-9);
    }
  });

  it("asked, casts a soft shadow first, south-east of it", () => {
    const log = draw("bench", box, { shadow: true });
    const shadow = log.indexOf(`fillStyle=${SHADE.color}`);
    expect(shadow).toBeGreaterThan(-1);
    expect(shadow).toBeLessThan(log.indexOf(`fillStyle=${wood()}`));
    // Compared with the bench alone, the shadow reaches further east and south, never west or north.
    const lit = points(log);
    const plain = points(draw("bench"));
    const most = (pts: number[][], i: number, pick: (...v: number[]) => number) =>
      pick(...pts.map((p) => p[i]));
    expect(most(lit, 0, Math.max)).toBeGreaterThan(most(plain, 0, Math.max));
    expect(most(lit, 1, Math.max)).toBeGreaterThan(most(plain, 1, Math.max));
    expect(most(lit, 0, Math.min)).toBeCloseTo(most(plain, 0, Math.min));
    expect(most(lit, 1, Math.min)).toBeCloseTo(most(plain, 1, Math.min));
  });

  it("casts a longer shadow for a taller thing", () => {
    const spot = { x: 0, y: 0, w: 2, h: 2 };
    const reach = (type: string) =>
      Math.max(...points(draw(type, spot, { shadow: true })).map(([, y]) => y)) - spot.h;
    expect(reach("tree")).toBeGreaterThan(reach("bench"));
  });

  it("casts no shadow when it is a few pixels across", () => {
    expect(draw("bench", box, { shadow: true, px: FAR })).not.toContain(`fillStyle=${SHADE.color}`);
  });

  it("draws the same way every time (models and shadows are prepared once and kept)", () => {
    expect(draw("bench", box, { shadow: true })).toEqual(draw("bench", box, { shadow: true }));
    expect(draw("bench", box, { rot: 90 })).not.toEqual(draw("bench"));
  });
});

describe("plants", () => {
  it("with a model are drawn from it", () => {
    const tree = catalogEntry(catalog, "tree");
    if (!tree?.model) throw new Error("the test catalog has a tree with a model");
    const crown = tree.model.parts.at(-1) as SolidPart;
    expect(draw("tree", { x: 0, y: 0, w: 2, h: 2 })).toContain(`fillStyle=${crown.color}`);
  });

  it("without a model are their shape's symbol", () => {
    expect(draw("bush", { x: 0, y: 0, w: 2, h: 2 })).toContain("fillStyle=#7f9f3a");
  });
});

describe("a building's front marker", () => {
  const house = { x: 0, y: 0, w: 10, h: 8 };

  it("is a triangle just outside the front edge, pointing out", () => {
    for (const rot of [0, 90, 180, 270]) {
      const pts = frontArrow(house, rot, 2);
      expect(pts).toHaveLength(3);
      const [tx, ty] = pts[0];
      const outside = {
        south: pts.every(([, y]) => y > house.h) && ty === house.h + 0.5 + 2,
        north: pts.every(([, y]) => y < 0) && ty === -0.5 - 2,
        east: pts.every(([x]) => x > house.w) && tx === house.w + 0.5 + 2,
        west: pts.every(([x]) => x < 0) && tx === -0.5 - 2,
      }[frontSide(rot)];
      expect(outside, `rot ${rot}`).toBe(true);
    }
  });

  it("sits on the middle of the edge, as wide as it is long", () => {
    const [tip, left, right] = frontArrow(house, 0, 2);
    expect(tip[0]).toBe(5);
    expect(left[0] - 5).toBeCloseTo(5 - right[0]);
    expect(Math.abs(left[0] - right[0])).toBeCloseTo(2);
  });
});

describe("stairs", () => {
  it("show a small ink triangle pointing up the incline, with soft corners", () => {
    const steps = { x: 0, y: 0, w: 2, h: 4 };
    const log = draw("incline-1x2", steps);
    expect(log).toContain(`fillStyle=${PLAN.ink}`);
    expect(log.filter((l) => l.startsWith("arcTo(")).length).toBe(3);
    // Rotation 0 climbs north: the first corner rounded is the tip, above the middle.
    const tip = log
      .find((l) => l.startsWith("arcTo("))
      ?.slice(6, -1)
      .split(",")
      .map(Number);
    expect(tip?.[1]).toBeLessThan(steps.h / 2);
  });
});
