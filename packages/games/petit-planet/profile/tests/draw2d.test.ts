// Things from above, in the cosy style: models as stickers (shadow, one ink outline, parts), flat
// when too small to show that, plant symbols when there is no model, and a building's door.

import type { SolidPart } from "@glade/render";
import { describe, expect, it } from "vitest";
import { catalogEntry } from "../src/catalog";
import { drawItem2D, frontDoor } from "../src/items";
import { frontSide } from "../src/items/model";
import { PLAN, SHADOW } from "../src/plan-style";
import { testCatalog as catalog } from "../samples";
import { recordCanvas } from "./canvas";

const box = { x: 10, y: 10, w: 4, h: 2 };
/** One screen pixel, in minor units, when a minor cell is 20 pixels: the bench is 80 across. */
const NEAR = 0.05;
/** When a minor cell is one pixel: the bench is 2 pixels across. */
const FAR = 1;

function draw(type: string, px: number, r = box, rot = 0): string[] {
  const { ctx, log } = recordCanvas();
  drawItem2D(ctx, catalog, type, r, rot, px);
  return log;
}

describe("a model, drawn as a sticker", () => {
  it("has a drop shadow and an ink outline when it is big enough to see them", () => {
    const log = draw("bench", NEAR);
    expect(log).toContain(`fillStyle=${SHADOW.color}`);
    expect(log).toContain(`strokeStyle=${PLAN.ink}`);
    // The shadow comes first, then the ink, then the parts on top.
    expect(log.indexOf(`fillStyle=${SHADOW.color}`)).toBeLessThan(
      log.indexOf(`strokeStyle=${PLAN.ink}`),
    );
  });

  it("is just its parts when it is a few pixels across", () => {
    const log = draw("bench", FAR);
    expect(log).not.toContain(`fillStyle=${SHADOW.color}`);
    expect(log).not.toContain(`strokeStyle=${PLAN.ink}`);
    expect(log.filter((l) => l === "fill()").length).toBeGreaterThan(0);
  });

  it("draws the same way every time (models are prepared once and kept)", () => {
    expect(draw("bench", NEAR)).toEqual(draw("bench", NEAR));
    expect(draw("bench", NEAR, box, 90)).not.toEqual(draw("bench", NEAR));
  });
});

describe("plants", () => {
  const tree = catalogEntry(catalog, "tree");

  it("with a model are drawn from it, with a light spot on the crown", () => {
    if (!tree?.model) throw new Error("the test catalog has a tree with a model");
    const crown = tree.model.parts.at(-1) as SolidPart;
    const log = draw(tree.type, NEAR, { x: 0, y: 0, w: 2, h: 2 });
    expect(log).toContain(`fillStyle=${crown.color}`);
    expect(log.filter((l) => l.startsWith("arc(")).length).toBe(1);
  });

  it("without a model are their shape's symbol, as a sticker", () => {
    const log = draw("bush", NEAR, { x: 0, y: 0, w: 2, h: 2 });
    expect(log).toContain("fillStyle=#7f9f3a");
    expect(log).toContain(`strokeStyle=${PLAN.ink}`);
  });
});

describe("a building's door", () => {
  const house = { x: 0, y: 0, w: 10, h: 8 };

  it("sits on the middle of the front edge, the side rule B1 checks", () => {
    for (const rot of [0, 90, 180, 270]) {
      const d = frontDoor(house, rot);
      expect(d.side).toBe(frontSide(rot));
      const onEdge = {
        north: d.y === house.y && d.x === 5,
        south: d.y === house.y + house.h && d.x === 5,
        west: d.x === house.x && d.y === 4,
        east: d.x === house.x + house.w && d.y === 4,
      }[d.side];
      expect(onEdge, `rot ${rot}: ${d.side}`).toBe(true);
    }
  });

  it("turns so it stands inside the building", () => {
    const into = (rot: number) => {
      const d = frontDoor(house, rot);
      // The door rises along -y before turning: where that ends up after the turn.
      return [Math.round(d.x + Math.sin(d.angle) * d.h), Math.round(d.y - Math.cos(d.angle) * d.h)];
    };
    for (const rot of [0, 90, 180, 270]) {
      const [x, y] = into(rot);
      expect(x >= house.x && x <= house.w && y >= house.y && y <= house.h, `rot ${rot}`).toBe(true);
    }
  });

  it("is a fifth of the short side, kept readable", () => {
    expect(frontDoor(house, 0).w).toBe(1.2);
    expect(frontDoor({ x: 0, y: 0, w: 2, h: 2 }, 0).w).toBe(0.5);
    expect(frontDoor({ x: 0, y: 0, w: 4, h: 4 }, 0).w).toBeCloseTo(0.8);
  });

  it("is drawn in ink on a building", () => {
    const log = draw("house", NEAR, house);
    const door = frontDoor(house, 0);
    expect(log).toContain(`translate(${door.x},${door.y})`);
    expect(log.lastIndexOf(`fillStyle=${PLAN.ink}`)).toBeGreaterThan(log.indexOf("translate(5,8)"));
  });
});
