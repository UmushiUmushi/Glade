// The planet's plan, lit like the 3D view: the sea under everything, no lines between heights,
// raised ground casting a shadow away from the look's sun, and the town center's name on its tag
// once it is big enough on screen.

import { resolveLook } from "@glade/render";
import { describe, expect, it } from "vitest";
import { plan } from "../../src/maps/planet/render2d";
import { LEVEL_MINOR } from "../../src/items/model";
import { PLAN, shadeFor } from "../../src/plan-style";
import { recordCanvas } from "../canvas";
import { resolveTerrainCorner, vertexOf } from "../../src/maps/planet/corners";
import { setCornerAt, terrainGrid } from "../../src/maps/planet/model";
import { blankMap, game, profile, stamp } from "./helpers";

const ALL = { heights: true, water: true, paths: true, plants: true, items: true, landmarks: true };
const shade = shadeFor(resolveLook(game.style!.defaults).light.sun);

function drawPlan(
  map = blankMap(),
  visible = { x: 40, y: 40, w: 20, h: 20 },
  pxPerUnit = 20,
): string[] {
  const { ctx, log, offscreen } = recordCanvas();
  offscreen(() => plan.draw(ctx, map, game, ALL, visible, pxPerUnit));
  return log;
}

/** The points of the ground's shadow path (the one filled in the shadow color), as [x, y]. */
const points = (log: string[]) => {
  const fill = log.indexOf(`fillStyle=${shade.color}`);
  if (fill < 0) return [];
  return log
    .slice(log.lastIndexOf("beginPath()", fill), fill)
    .filter((l) => l.startsWith("moveTo(") || l.startsWith("lineTo("))
    .map((l) => l.slice(7, -1).split(",").map(Number));
};

describe("the plan", () => {
  it("paints the sea first, over the whole visible box", () => {
    const log = drawPlan();
    expect(log[0]).toBe(`fillStyle=${PLAN.sea}`);
    expect(log[1]).toBe("fillRect(40,40,20,20)");
  });

  it("draws flat ground with no shadows and no lines", () => {
    const log = drawPlan();
    expect(log).not.toContain(`fillStyle=${shade.color}`);
    expect(log).not.toContain("stroke()");
  });

  it("shades the lower ground on the side away from the sun, as far as the drop reaches", () => {
    // The look's midday sun is in the south: raised block 51 shades block 50, north of it.
    expect(shade.dy).toBeLessThan(0);
    const log = drawPlan(stamp(blankMap(), 50, 50, ["1", "3"]));
    expect(log).toContain(`fillStyle=${shade.color}`);
    expect(log).not.toContain("stroke()");
    // Block 51 spans minor y 101..102; its north edge is y 101, and two levels' shadow reaches
    // that far north of it.
    const reach = 2 * LEVEL_MINOR * shade.perHeight * -shade.dy;
    const lowest = Math.min(...points(log).map(([, y]) => y));
    expect(lowest).toBeCloseTo(101 - reach);
  });

  it("casts nothing toward the sun", () => {
    // Raised block 50 with lower ground south of it: its shadow goes north and east, never south.
    const log = drawPlan(stamp(blankMap(), 50, 50, ["3", "1"]));
    expect(Math.max(...points(log).map(([, y]) => y))).toBeLessThanOrEqual(101);
  });

  it("casts from a cut corner's diagonal, not from the square corner it replaces", () => {
    const map = blankMap();
    terrainGrid(map)[60][60] = { h: 3, water: false };
    const v = vertexOf("terrainCorners", 60, 60, [-1, -1]);
    setCornerAt(map, "terrainCorners", v.x, v.y, "cut");
    expect(resolveTerrainCorner(map, profile, v.x, v.y).status).toBe("shaped");
    const square = drawPlan(stamp(blankMap(), 60, 60, ["3"]), { x: 55, y: 55, w: 10, h: 10 });
    const cut = drawPlan(map, { x: 55, y: 55, w: 10, h: 10 });
    // Block 60 spans minor 119..121 both ways; its north-west corner is (119, 119).
    const at = (log: string[], x: number, y: number) =>
      points(log).some(([px, py]) => Math.abs(px - x) < 1e-9 && Math.abs(py - y) < 1e-9);
    expect(at(square, 119, 119)).toBe(true);
    expect(at(cut, 119, 119)).toBe(false);
    expect(points(cut).length).toBeGreaterThan(points(square).length);
  });

  it("lets a pond's banks shade it, with no lines round its blocks", () => {
    const log = drawPlan(stamp(blankMap(), 50, 50, ["1~1~", "1~1~"]));
    expect(log).toContain(`fillStyle=${shade.color}`);
    expect(log).not.toContain("stroke()");
  });

  it("names the town center on its tag when zoomed in, and leaves the tag off when far out", () => {
    const whole = { x: 0, y: 0, w: 176, h: 144 };
    const named = (ppu: number) =>
      drawPlan(blankMap(), whole, ppu).some((l) => l.startsWith("fillText(Town center,"));
    expect(named(8)).toBe(true);
    expect(named(1)).toBe(false);
  });
});
