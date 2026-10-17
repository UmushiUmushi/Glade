// The planet's plan: the sea under everything, raised ground's face along its south side as the
// design draws cliffs (and no other lines), the town center's name on its tag once it is big
// enough on screen, and on hover an arrow out of a building's front.

import { describe, expect, it } from "vitest";
import { resolveTerrainCorner, vertexOf } from "../../src/maps/planet/corners";
import { setCornerAt, terrainGrid, type MapDoc } from "../../src/maps/planet/model";
import { plan } from "../../src/maps/planet/render2d";
import { faceColor, faceDepth, PLAN, POND_DROP } from "../../src/plan-style";
import { recordCanvas } from "../canvas";
import { addItems, blankMap, game, item, profile, stamp } from "./helpers";

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

/** The rect drawn right after each `fillStyle=color`. */
const rectsIn = (log: string[], color: string) =>
  log.flatMap((l, i) =>
    l === `fillStyle=${color}` && log[i + 1]?.startsWith("fillRect(") ? [log[i + 1]] : [],
  );

describe("the plan", () => {
  it("paints the sea first, over the whole visible box", () => {
    const log = drawPlan();
    expect(log[0]).toBe(`fillStyle=${PLAN.sea}`);
    expect(log[1]).toBe("fillRect(40,40,20,20)");
  });

  it("draws flat ground with no faces and no lines", () => {
    const log = drawPlan();
    expect(rectsIn(log, faceColor(1))).toEqual([]);
    expect(log).not.toContain("stroke()");
  });
});

describe("raised ground", () => {
  it("shows its face along its south side, in a darker shade, deeper for a bigger drop", () => {
    // Block 50 (level 3) above block 51 (level 1). Block 50 spans minor 99..101 both ways.
    const log = drawPlan(stamp(blankMap(), 50, 50, ["3", "1"]));
    const d = faceDepth(2);
    expect(rectsIn(log, faceColor(3))).toEqual([`fillRect(99,${101 - d},2,${d})`]);
    expect(log).not.toContain("stroke()");
  });

  it("shows no face on its north side", () => {
    // Block 51 (level 3) below block 50 (level 1): its face is on its own south side, at y 103.
    const faces = rectsIn(drawPlan(stamp(blankMap(), 50, 50, ["1", "3"])), faceColor(3));
    expect(faces).toEqual([`fillRect(99,${103 - faceDepth(2)},2,${faceDepth(2)})`]);
  });

  it("is darker than its top, close to the design's face below its meadow (#6f7a3f)", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const design = rgb("#6f7a3f");
    rgb(faceColor(2)).forEach((c, i) => expect(Math.abs(c - design[i])).toBeLessThanOrEqual(8));
  });

  it("shows a face along the south-looking curve of a cut corner, and none for a north one", () => {
    const cutAt = (dir: [number, number]) => {
      const map = blankMap();
      terrainGrid(map)[60][60] = { h: 3, water: false };
      const v = vertexOf("terrainCorners", 60, 60, dir);
      setCornerAt(map, "terrainCorners", v.x, v.y, "cut");
      expect(resolveTerrainCorner(map, profile, v.x, v.y).status).toBe("shaped");
      return drawPlan(map, { x: 55, y: 55, w: 10, h: 10 });
    };
    /** What the corner faces traced: from their color to their fill. */
    const cornerPath = (log: string[]) => {
      const at = log.lastIndexOf(`fillStyle=${faceColor(3)}`);
      return log.slice(at, log.indexOf("fill()", at));
    };
    const se = cutAt([1, 1]);
    expect(cornerPath(se).some((l) => l.startsWith("moveTo("))).toBe(true);
    // The straight south edge stops halfway, where the cut begins.
    const d = faceDepth(2);
    expect(rectsIn(se, faceColor(3))).toEqual([`fillRect(119,${121 - d},1,${d})`]);
    const nw = cutAt([-1, -1]);
    expect(cornerPath(nw).some((l) => l.startsWith("moveTo("))).toBe(false);
  });

  it("includes a pond's banks: the bank north of a pond shows a face, as a pond lies lower", () => {
    const log = drawPlan(stamp(blankMap(), 50, 50, ["1~"]));
    const d = faceDepth(POND_DROP);
    // Block 49, north of the pond, spans minor y 97..99.
    expect(rectsIn(log, faceColor(1))).toEqual([`fillRect(99,${99 - d},2,${d})`]);
    expect(log).not.toContain("stroke()");
  });
});

describe("landmarks", () => {
  it("name the town center on its tag when zoomed in, and leave the tag off when far out", () => {
    const whole = { x: 0, y: 0, w: 176, h: 144 };
    const named = (ppu: number) =>
      drawPlan(blankMap(), whole, ppu).some((l) => l.startsWith("fillText(Town center,"));
    expect(named(8)).toBe(true);
    expect(named(1)).toBe(false);
  });
});

describe("hovering", () => {
  /** A house (10 x 8 minor cells) at minor 80, 80: world 40..45 across, 40..44 down. */
  const withHouse = (rot: 0 | 90 | 180 | 270 = 0) =>
    addItems(blankMap(), { ...item("house", 80, 80, rot), id: "h1" });
  const hover = (map: MapDoc, p: { x: number; y: number }) => {
    const { ctx, log } = recordCanvas();
    plan.drawHover?.(ctx, map, game, p, 20);
    return log;
  };
  const tip = (log: string[]) =>
    log
      .find((l) => l.startsWith("moveTo("))
      ?.slice(7, -1)
      .split(",")
      .map(Number);

  it("over a building, draws an arrow out of its front", () => {
    const log = hover(withHouse(), { x: 42, y: 42 });
    expect(log).toContain(`fillStyle=${PLAN.ink}`);
    // Rotation 0 faces south: the tip is below the house's south edge (minor y 88).
    expect(tip(log)?.[1]).toBeGreaterThan(88);
  });

  it("follows the building's rotation", () => {
    // Rotation 180 faces north: the tip is above the house's north edge (minor y 80).
    expect(tip(hover(withHouse(180), { x: 42, y: 42 }))?.[1]).toBeLessThan(80);
  });

  it("draws nothing over open ground or a thing that isn't a building", () => {
    expect(hover(withHouse(), { x: 30, y: 30 })).toEqual([]);
    const bench = addItems(blankMap(), { ...item("bench", 80, 80), id: "b1" });
    expect(hover(bench, { x: 40.5, y: 40.5 })).toEqual([]);
  });
});
