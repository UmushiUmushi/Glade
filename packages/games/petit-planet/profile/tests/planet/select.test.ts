import { describe, expect, it } from "vitest";
import type { Cell, GridSpec } from "../../src/maps/planet/space";
import { boundingRect, floodRegion } from "../../src/maps/planet/select";

const spec: GridSpec = { majorW: 160, majorH: 160, areaSize: 16 };
const xy = (cells: Cell[]) => cells.map((c) => `${c.x},${c.y}`);

describe("floodRegion", () => {
  it("selects a connected region only", () => {
    const wet = new Set(["3,3", "4,3", "4,4", "6,6"]);
    const cells = floodRegion(spec, "terrain", [3, 3], (x, y) => wet.has(`${x},${y}`));
    expect(xy(cells)).toEqual(["3,3", "4,3", "4,4"]);
  });

  it("returns nothing when the seed fails the predicate", () => {
    expect(floodRegion(spec, "terrain", [0, 0], () => false)).toEqual([]);
  });
});

describe("boundingRect", () => {
  it("is the smallest rect holding every cell, or null for none", () => {
    const cells: Cell[] = [
      { grid: "major", x: 4, y: 7 },
      { grid: "major", x: 2, y: 9 },
    ];
    expect(boundingRect(cells)).toEqual({ grid: "major", x: 2, y: 7, w: 3, h: 3 });
    expect(boundingRect([])).toBeNull();
  });
});
