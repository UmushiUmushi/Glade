// Things from above: a model's own top view in its parts' colors, with no outlines or shadows;
// plant symbols without a model; and the arrow that shows a building's front.

import type { SolidPart } from "@glade/render";
import { describe, expect, it } from "vitest";
import { catalogEntry } from "../src/catalog";
import { drawItem2D, frontArrow } from "../src/items";
import { frontSide } from "../src/items/model";
import { testCatalog as catalog } from "../samples";
import { recordCanvas } from "./canvas";

const box = { x: 10, y: 10, w: 4, h: 2 };
/** One screen pixel, in minor units, when a minor cell is 20 pixels. */
const NEAR = 0.05;

function draw(type: string, r = box, rot = 0) {
  const { ctx, log } = recordCanvas();
  drawItem2D(ctx, catalog, type, r, rot, NEAR);
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

  it("casts no shadow: everything it draws stays inside its own rect", () => {
    for (const [x, y] of points(draw("bench"))) {
      expect(x).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(x).toBeLessThanOrEqual(box.x + box.w + 1e-9);
      expect(y).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(y).toBeLessThanOrEqual(box.y + box.h + 1e-9);
    }
  });

  it("draws the same way every time (models are prepared once and kept)", () => {
    expect(draw("bench")).toEqual(draw("bench"));
    expect(draw("bench", box, 90)).not.toEqual(draw("bench"));
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

describe("a building's front arrow", () => {
  const house = { x: 0, y: 0, w: 10, h: 8 };

  it("points out of the front edge (the side rule B1 checks), from just outside it", () => {
    for (const rot of [0, 90, 180, 270]) {
      const pts = frontArrow(house, rot, 2);
      const [tx, ty] = pts[0];
      const outside = {
        south: pts.every(([, y]) => y > house.h) && ty === house.h + 0.4 + 2,
        north: pts.every(([, y]) => y < 0) && ty === -0.4 - 2,
        east: pts.every(([x]) => x > house.w) && tx === house.w + 0.4 + 2,
        west: pts.every(([x]) => x < 0) && tx === -0.4 - 2,
      }[frontSide(rot)];
      expect(outside, `rot ${rot}`).toBe(true);
    }
  });

  it("sits on the middle of the edge, the same on both sides", () => {
    const pts = frontArrow(house, 0, 2);
    expect(pts[0][0]).toBe(5);
    for (let i = 1; i < pts.length; i++) {
      const mirror = pts[pts.length - i];
      expect(pts[i][0] - 5).toBeCloseTo(5 - mirror[0]);
      expect(pts[i][1]).toBeCloseTo(mirror[1]);
    }
  });
});
