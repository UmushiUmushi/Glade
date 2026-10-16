// The planet's plan in the cosy style: the sea under everything, a face below each raised edge,
// and the town center's name on its tag once it is big enough on screen.

import { describe, expect, it } from "vitest";
import { plan } from "../../src/maps/planet/render2d";
import { EDGE_LINE, faceDepth, PLAN } from "../../src/plan-style";
import { recordCanvas } from "../canvas";
import { blankMap, game, stamp } from "./helpers";

const ALL = { heights: true, water: true, paths: true, plants: true, items: true, landmarks: true };

function drawPlan(
  map = blankMap(),
  visible = { x: 40, y: 40, w: 20, h: 20 },
  pxPerUnit = 20,
): string[] {
  const { ctx, log, offscreen } = recordCanvas();
  offscreen(() => plan.draw(ctx, map, game, ALL, visible, pxPerUnit));
  return log;
}

describe("the plan", () => {
  it("paints the sea first, over the whole visible box", () => {
    const log = drawPlan();
    expect(log[0]).toBe(`fillStyle=${PLAN.sea}`);
    expect(log[1]).toBe("fillRect(40,40,20,20)");
  });

  it("shows a raised edge's face along its south side, deeper for a bigger drop", () => {
    const map = stamp(blankMap(), 50, 50, ["3", "1"]);
    const log = drawPlan(map);
    const face = log.indexOf(`fillStyle=${PLAN.face}`);
    expect(face).toBeGreaterThan(-1);
    // Terrain block 50 covers minor cells 99..100; its face is the bottom of the block.
    const depth = faceDepth(2);
    expect(log[face + 1]).toBe(`fillRect(99,${101 - depth},2,${depth})`);
  });

  it("draws no face where the ground below is higher, only a thin edge", () => {
    const map = stamp(blankMap(), 50, 50, ["1", "3"]);
    const log = drawPlan(map);
    const faces = log.flatMap((l, i) => (l === `fillStyle=${PLAN.face}` ? [log[i + 1]] : []));
    // Block 50's south edge (minor y 101) has higher ground below: no face there. Block 51 drops
    // to the base level south of it, so it has one.
    expect(faces.some((f) => f.startsWith("fillRect(99,10") && f.includes(",2,"))).toBe(true);
    expect(faces.filter((f) => Number(f.split(",")[1]) < 101)).toEqual([]);
    expect(log).toContain(`fillStyle=${EDGE_LINE}`);
  });

  it("names the town center on its tag when zoomed in, and leaves the tag off when far out", () => {
    const whole = { x: 0, y: 0, w: 176, h: 144 };
    expect(drawPlan(blankMap(), whole, 8).some((l) => l.startsWith("fillText(Town center,"))).toBe(
      true,
    );
    expect(drawPlan(blankMap(), whole, 1).some((l) => l.startsWith("fillText("))).toBe(false);
  });
});
