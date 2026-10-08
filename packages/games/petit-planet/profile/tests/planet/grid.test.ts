import { describe, expect, it } from "vitest";
import {
  areaOfMajor,
  areaRect,
  areaRectFromLabel,
  cellOfMinor,
  convertRect,
  expandRect,
  fullRect,
  gridSize,
  inGrid,
  majorCellsOfTerrain,
  majorOfMinor,
  majorRangeOfTerrain,
  minorRangeOfMajor,
  minorRangeOfTerrain,
  minorRectOfCell,
  parseCellKey,
  parseRectSpec,
  rectInAllGrids,
  terrainCellsOfMajor,
  terrainOfMinor,
  terrainRangeOfMajor,
  toMinorRect,
  type GridSpec,
  type Rect,
} from "../../src/maps/planet/space";
import * as v1 from "./fixtures/grid-v1";

const spec: GridSpec = { majorW: 160, majorH: 160, areaSize: 16 };

describe("grid sizes", () => {
  it("has 160 major, 320 minor, 161 terrain", () => {
    expect(gridSize(spec, "major")).toEqual({ w: 160, h: 160 });
    expect(gridSize(spec, "minor")).toEqual({ w: 320, h: 320 });
    expect(gridSize(spec, "terrain")).toEqual({ w: 161, h: 161 });
  });

  it("bounds-checks each grid", () => {
    expect(inGrid(spec, "major", 159, 0)).toBe(true);
    expect(inGrid(spec, "major", 160, 0)).toBe(false);
    expect(inGrid(spec, "terrain", 160, 160)).toBe(true);
    expect(inGrid(spec, "minor", -1, 0)).toBe(false);
    expect(inGrid(spec, "minor", 1.5, 0)).toBe(false);
  });
});

describe("1D conversions", () => {
  it("majorOfMinor = floor(m / 2)", () => {
    expect([0, 1, 2, 3, 318, 319].map(majorOfMinor)).toEqual([0, 0, 1, 1, 159, 159]);
  });

  it("terrainOfMinor = floor((m + 1) / 2)", () => {
    expect([0, 1, 2, 3, 4, 318, 319].map(terrainOfMinor)).toEqual([0, 1, 1, 2, 2, 159, 160]);
  });

  it("round-trips ranges", () => {
    expect(minorRangeOfMajor(5)).toEqual([10, 11]);
    expect(minorRangeOfTerrain(5)).toEqual([9, 10]);
    expect(minorRangeOfTerrain(0)).toEqual([-1, 0]);
    expect(majorRangeOfTerrain(5)).toEqual([4, 5]);
    expect(terrainRangeOfMajor(5)).toEqual([5, 6]);
    for (let t = 1; t < 160; t++) {
      const [lo, hi] = minorRangeOfTerrain(t);
      expect(terrainOfMinor(lo)).toBe(t);
      expect(terrainOfMinor(hi)).toBe(t);
    }
    for (let M = 0; M < 160; M++) {
      const [lo, hi] = minorRangeOfMajor(M);
      expect(majorOfMinor(lo)).toBe(M);
      expect(majorOfMinor(hi)).toBe(M);
    }
  });
});

describe("cell conversions", () => {
  it("a major cell overlaps terrain X..X+1, Y..Y+1", () => {
    expect(terrainCellsOfMajor(3, 7).map((c) => [c.x, c.y])).toEqual([
      [3, 7],
      [4, 7],
      [3, 8],
      [4, 8],
    ]);
  });

  it("a terrain cell overlaps major tx-1..tx, ty-1..ty, clipped at the edge", () => {
    expect(majorCellsOfTerrain(spec, 4, 8).map((c) => [c.x, c.y])).toEqual([
      [3, 7],
      [4, 7],
      [3, 8],
      [4, 8],
    ]);
    expect(majorCellsOfTerrain(spec, 0, 0).map((c) => [c.x, c.y])).toEqual([[0, 0]]);
    expect(majorCellsOfTerrain(spec, 160, 5)).toHaveLength(2);
  });

  it("cellOfMinor agrees with the 1D functions", () => {
    expect(cellOfMinor("major", 7, 8)).toEqual({ grid: "major", x: 3, y: 4 });
    expect(cellOfMinor("terrain", 7, 8)).toEqual({ grid: "terrain", x: 4, y: 4 });
  });
});

describe("rect conversions", () => {
  it("rejects an unknown grid instead of returning NaN", () => {
    const area = { grid: "area", x: 3, y: 3, w: 1, h: 1 } as unknown as Rect;
    expect(() => toMinorRect(spec, area)).toThrow(/unknown rect grid "area".*rects\.area/);
  });

  it("major rect -> minor doubles", () => {
    expect(toMinorRect(spec, { grid: "major", x: 2, y: 3, w: 4, h: 5 })).toEqual({
      grid: "minor",
      x: 4,
      y: 6,
      w: 8,
      h: 10,
    });
  });

  it("terrain rect -> minor is offset by one and clipped at the map edge", () => {
    expect(toMinorRect(spec, { grid: "terrain", x: 5, y: 5, w: 2, h: 1 })).toEqual({
      grid: "minor",
      x: 9,
      y: 9,
      w: 4,
      h: 2,
    });
    expect(toMinorRect(spec, { grid: "terrain", x: 0, y: 160, w: 1, h: 1 })).toEqual({
      grid: "minor",
      x: 0,
      y: 319,
      w: 1,
      h: 1,
    });
  });

  it("a w-wide major rect overlaps w+1 terrain cells", () => {
    expect(convertRect(spec, { grid: "major", x: 78, y: 70, w: 20, h: 28 }, "terrain")).toEqual({
      grid: "terrain",
      x: 78,
      y: 70,
      w: 21,
      h: 29,
    });
  });

  it("the whole terrain grid maps to the whole major grid and back", () => {
    const all = rectInAllGrids(spec, { grid: "terrain", x: 0, y: 0, w: 161, h: 161 });
    expect(all.major).toEqual({ grid: "major", x: 0, y: 0, w: 160, h: 160 });
    expect(all.minor).toEqual({ grid: "minor", x: 0, y: 0, w: 320, h: 320 });
    expect(all.terrain).toEqual({ grid: "terrain", x: 0, y: 0, w: 161, h: 161 });
  });

  it("an odd-aligned minor rect covers two majors and two terrains per side", () => {
    const all = rectInAllGrids(spec, { grid: "minor", x: 3, y: 3, w: 2, h: 2 });
    expect(all.major).toEqual({ grid: "major", x: 1, y: 1, w: 2, h: 2 });
    expect(all.terrain).toEqual({ grid: "terrain", x: 2, y: 2, w: 1, h: 1 });
  });

  it("expandRect clips to the grid", () => {
    expect(expandRect(spec, { grid: "terrain", x: 1, y: 159, w: 1, h: 1 }, 2)).toEqual({
      grid: "terrain",
      x: 0,
      y: 157,
      w: 4,
      h: 4,
    });
  });
});

describe("areas", () => {
  it("area column 6 row 6 is major 80..95", () => {
    expect(areaRectFromLabel(spec, 6, 6)).toEqual({ grid: "major", x: 80, y: 80, w: 16, h: 16 });
    expect(areaRect(spec, 5, 5)).toEqual(areaRectFromLabel(spec, 6, 6));
  });

  it("areaOfMajor floors by 16", () => {
    expect(areaOfMajor(spec, 95, 96)).toEqual({ aX: 5, aY: 6 });
  });
});

describe("cell keys", () => {
  it("parses X,Y and rejects junk", () => {
    expect(parseCellKey("12,34")).toEqual({ x: 12, y: 34 });
    expect(parseCellKey("12, 34")).toBeNull();
    expect(parseCellKey("a,b")).toBeNull();
  });
});

// space.ts is a set of wrappers over the generic Space. The original grid math is kept verbatim in
// tests/fixtures/grid-v1.ts; every conversion must agree with it.
describe("equivalence with the original grid math", () => {
  const specs: GridSpec[] = [
    { majorW: 160, majorH: 144, areaSize: 16 },
    { majorW: 160, majorH: 160, areaSize: 16 },
    { majorW: 7, majorH: 5, areaSize: 4 },
  ];
  const grids = ["major", "minor", "terrain"] as const;
  // Deterministic pseudo-random rects, including ones hanging off every edge.
  let seed = 7;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  function* rects(spec: GridSpec): Generator<Rect> {
    for (const grid of grids) {
      const { w, h } = v1.gridSize(spec, grid);
      for (let i = 0; i < 400; i++) {
        yield {
          grid,
          x: rnd(w + 6) - 3,
          y: rnd(h + 6) - 3,
          w: 1 + rnd(Math.min(w, 40)),
          h: 1 + rnd(Math.min(h, 40)),
        };
      }
      yield { grid, x: 0, y: 0, w, h };
      yield { grid, x: w - 1, y: h - 1, w: 1, h: 1 };
    }
  }

  for (const spec of specs) {
    const tag = `${spec.majorW}x${spec.majorH}`;
    it(`sizes, bounds, full rects (${tag})`, () => {
      for (const g of grids) {
        expect(gridSize(spec, g)).toEqual(v1.gridSize(spec, g));
        expect(fullRect(spec, g)).toEqual(v1.fullRect(spec, g));
        const { w, h } = v1.gridSize(spec, g);
        for (const [x, y] of [
          [0, 0],
          [w - 1, h - 1],
          [w, 0],
          [-1, 2],
          [1.5, 1],
        ])
          expect(inGrid(spec, g, x, y)).toBe(v1.inGrid(spec, g, x, y));
      }
    });

    it(`rect conversions (${tag})`, () => {
      for (const r of rects(spec)) {
        expect(toMinorRect(spec, r)).toEqual(v1.toMinorRect(spec, r));
        for (const g of grids) expect(convertRect(spec, r, g)).toEqual(v1.convertRect(spec, r, g));
        expect(rectInAllGrids(spec, r)).toEqual(v1.rectInAllGrids(spec, r));
        expect(expandRect(spec, r, 2)).toEqual(v1.expandRect(spec, r, 2));
      }
    });

    it(`cell conversions (${tag})`, () => {
      const t = v1.gridSize(spec, "terrain");
      for (let ty = 0; ty < Math.min(t.h, 12); ty++) {
        for (let tx = 0; tx < Math.min(t.w, 12); tx++) {
          expect(majorCellsOfTerrain(spec, tx, ty)).toEqual(v1.majorCellsOfTerrain(spec, tx, ty));
          const cell = { grid: "terrain" as const, x: tx, y: ty };
          expect(minorRectOfCell(spec, cell)).toEqual(v1.minorRectOfCell(spec, cell));
        }
      }
    });
  }

  it("parses rect specs the same way", () => {
    const spec = specs[0];
    for (const text of ["all", "area:3,3", "major:1,2,3,4", "terrain:0,0,5,5", "minor:9,9,1,1"]) {
      expect(parseRectSpec(spec, text)).toEqual(v1.parseRectSpec(spec, text));
    }
    expect(() => parseRectSpec(spec, "hex:1,1,1,1")).toThrow(/bad rect/);
  });
});
