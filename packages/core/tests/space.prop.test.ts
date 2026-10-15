// Property tests for coordinate spaces: conversions that must hold for any rect, cell or box, not
// just the hand-picked ones in core.test.ts. fast-check makes the inputs and shrinks failures.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  boundingRect,
  boxesIntersect,
  cellKey,
  convertRect,
  parseCellKey,
  rectContains,
  rectToBox,
  boxToRect,
  type Rect,
  type Space,
} from "../src/space";

/** A 20 × 16 world with a coarse grid (1 unit cells) and a fine grid nested in it (½ unit). */
const SPACE: Space = {
  unit: "u",
  bounds: { x: 0, y: 0, w: 20, h: 16 },
  grids: {
    coarse: { cell: [1, 1], origin: [0, 0], size: [20, 16] },
    fine: { cell: [0.5, 0.5], origin: [0, 0], size: [40, 32] },
  },
};

/** A rect that fits inside the coarse grid. */
const coarseRect = fc
  .record({ x: fc.integer({ min: 0, max: 19 }), y: fc.integer({ min: 0, max: 15 }) })
  .chain(({ x, y }) =>
    fc.record({
      grid: fc.constant("coarse"),
      x: fc.constant(x),
      y: fc.constant(y),
      w: fc.integer({ min: 1, max: 20 - x }),
      h: fc.integer({ min: 1, max: 16 - y }),
    }),
  );

const box = fc.record({
  x: fc.double({ min: -5, max: 25, noNaN: true }),
  y: fc.double({ min: -5, max: 20, noNaN: true }),
  w: fc.double({ min: 0, max: 10, noNaN: true }),
  h: fc.double({ min: 0, max: 10, noNaN: true }),
});

describe("space properties", () => {
  it("a rect inside its grid round-trips through the world box it covers", () => {
    fc.assert(
      fc.property(coarseRect, (r: Rect) => {
        expect(boxToRect(SPACE, rectToBox(SPACE, r), r.grid)).toEqual(r);
      }),
    );
  });

  it("a coarse rect becomes fine cells and back without change", () => {
    fc.assert(
      fc.property(coarseRect, (r: Rect) => {
        const fine = convertRect(SPACE, r, "fine");
        expect(fine.w).toBe(2 * r.w);
        expect(convertRect(SPACE, fine, "coarse")).toEqual(r);
      }),
    );
  });

  it("the bounding rect of any cells contains every one of them", () => {
    const cell = fc.record({ grid: fc.constant("coarse"), x: fc.integer(), y: fc.integer() });
    fc.assert(
      fc.property(fc.array(cell, { minLength: 1, maxLength: 50 }), (cells) => {
        const r = boundingRect(cells);
        expect(r).not.toBeNull();
        for (const c of cells) expect(r && rectContains(r, c.x, c.y)).toBe(true);
      }),
    );
  });

  it("a cell key parses back to the same cell", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (x, y) => {
        expect(parseCellKey(cellKey(x, y))).toEqual({ x, y });
      }),
    );
  });

  it("box overlap is the same both ways round", () => {
    fc.assert(
      fc.property(box, box, (a, b) => {
        expect(boxesIntersect(a, b)).toBe(boxesIntersect(b, a));
      }),
    );
  });
});
