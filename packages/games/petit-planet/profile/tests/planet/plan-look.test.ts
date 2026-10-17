// The planet's plan: the sea under everything, raised ground's drop just outside its south edge as
// the design draws cliffs (and no other lines), the town center's name on its tag once it is big
// enough on screen, and on hover an arrow out of a building's front.

import { describe, expect, it } from "vitest";
import { resolveTerrainCorner, vertexOf } from "../../src/maps/planet/corners";
import { setCornerAt, terrainGrid, type MapDoc } from "../../src/maps/planet/model";
import { plan } from "../../src/maps/planet/render2d";
import { DROP, dropDepth, PLAN, POND_DROP, SHADE } from "../../src/plan-style";
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

/** The straight drops drawn: the rects right after the drop color is set. */
const drops = (log: string[]) => {
  const out: string[] = [];
  let on = false;
  for (const l of log) {
    if (l.startsWith("fillStyle=")) on = l === `fillStyle=${DROP}`;
    else if (on && l.startsWith("fillRect(")) out.push(l);
  }
  return out;
};

describe("the plan", () => {
  it("paints the sea first, over the whole visible box", () => {
    const log = drawPlan();
    expect(log[0]).toBe(`fillStyle=${PLAN.sea}`);
    expect(log[1]).toBe("fillRect(40,40,20,20)");
  });

  it("draws flat ground with no drops and no lines", () => {
    const log = drawPlan();
    expect(drops(log)).toEqual([]);
    expect(log).not.toContain("stroke()");
  });
});

describe("raised ground", () => {
  it("drops a dark band just outside its south edge, deeper for a bigger drop", () => {
    // Block 50 (level 3) above block 51 (level 1). Block 50 spans minor 99..101 both ways, so its
    // drop starts at y 101, on block 51.
    const log = drawPlan(stamp(blankMap(), 50, 50, ["3", "1"]));
    expect(drops(log)).toEqual([`fillRect(99,101,2,${dropDepth(2)})`]);
    expect(log).not.toContain("stroke()");
  });

  it("drops nothing on its north side", () => {
    // Block 51 (level 3) below block 50 (level 1): its drop is south of it, from y 103.
    expect(drops(drawPlan(stamp(blankMap(), 50, 50, ["1", "3"])))).toEqual([
      `fillRect(99,103,2,${dropDepth(2)})`,
    ]);
  });

  it("drops outside the south-looking curve of a cut corner, and not a north one", () => {
    const cutAt = (dir: [number, number]) => {
      const map = blankMap();
      terrainGrid(map)[60][60] = { h: 3, water: false };
      const v = vertexOf("terrainCorners", 60, 60, dir);
      setCornerAt(map, "terrainCorners", v.x, v.y, "cut");
      expect(resolveTerrainCorner(map, profile, v.x, v.y).status).toBe("shaped");
      return drawPlan(map, { x: 55, y: 55, w: 10, h: 10 });
    };
    /** What the corner drops traced: from their color to their fill. */
    const cornerPath = (log: string[]) => {
      const at = log.lastIndexOf(`fillStyle=${DROP}`);
      return log.slice(at, log.indexOf("fill()", at));
    };
    const se = cutAt([1, 1]);
    const traced = cornerPath(se)
      .filter((l) => l.startsWith("moveTo(") || l.startsWith("lineTo("))
      .map((l) => l.slice(7, -1).split(",").map(Number));
    expect(traced.length).toBeGreaterThan(0);
    // Outside the corner: south-east of the cut's diagonal (x + y at least the diagonal's 241).
    expect(traced.every(([x, y]) => x + y >= 241 - 1e-9)).toBe(true);
    // The straight south edge stops halfway, where the cut begins.
    expect(drops(se)).toEqual([`fillRect(119,121,1,${dropDepth(2)})`]);
    const nw = cutAt([-1, -1]);
    expect(cornerPath(nw).some((l) => l.startsWith("moveTo("))).toBe(false);
  });

  it("includes a pond's banks: the bank north of a pond drops onto it, as a pond lies lower", () => {
    const log = drawPlan(stamp(blankMap(), 50, 50, ["1~"]));
    // Block 49, north of the pond, ends at minor y 99, where the pond begins.
    expect(drops(log)).toEqual([`fillRect(99,99,2,${dropDepth(POND_DROP)})`]);
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

describe("things on the map", () => {
  it("cast their soft shadows", () => {
    const map = addItems(blankMap(), { ...item("bench", 80, 80), id: "b1" });
    expect(drawPlan(map)).toContain(`fillStyle=${SHADE.color}`);
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
