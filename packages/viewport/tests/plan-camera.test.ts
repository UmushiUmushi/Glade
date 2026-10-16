// The plan's camera maths: fitting a map, the box on screen, screen and world points both ways,
// panning with the pointer, and zooming toward a point within limits.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  fitPlan,
  panPlan,
  planToScreen,
  planVisible,
  screenToPlan,
  zoomPlan,
  ZOOM_IN_LIMIT,
  ZOOM_OUT_LIMIT,
} from "../src/plan-camera";

const map = { x: 0, y: 0, w: 320, h: 288 };
const size = { w: 1000, h: 600 };

describe("fitPlan", () => {
  it("centres the whole map, fitting the tighter side with a margin", () => {
    const cam = fitPlan(map, size, 0.05);
    expect(cam.cx).toBe(160);
    expect(cam.cy).toBe(144);
    expect(cam.pxPerUnit).toBeCloseTo((600 * 0.9) / 288);
    const seen = planVisible(cam, size);
    expect(seen.x).toBeLessThan(0);
    expect(seen.y).toBeLessThan(0);
    expect(seen.x + seen.w).toBeGreaterThan(320);
  });
});

describe("screen and world", () => {
  it("round-trip for any point and camera", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 400, noNaN: true }),
        fc.double({ min: -50, max: 400, noNaN: true }),
        fc.double({ min: 0.1, max: 40, noNaN: true }),
        (x, y, pxPerUnit) => {
          const cam = { cx: 160, cy: 144, pxPerUnit };
          const back = screenToPlan(cam, size, planToScreen(cam, size, { x, y }));
          expect(back.x).toBeCloseTo(x, 6);
          expect(back.y).toBeCloseTo(y, 6);
        },
      ),
    );
  });

  it("puts the camera's centre in the middle of the screen", () => {
    expect(planToScreen({ cx: 10, cy: 20, pxPerUnit: 3 }, size, { x: 10, y: 20 })).toEqual({
      x: 500,
      y: 300,
    });
  });
});

describe("panPlan", () => {
  it("moves the map with the pointer", () => {
    const cam = { cx: 100, cy: 100, pxPerUnit: 2 };
    const before = planToScreen(cam, size, { x: 120, y: 80 });
    const after = planToScreen(panPlan(cam, 30, -10), size, { x: 120, y: 80 });
    expect(after.x - before.x).toBeCloseTo(30);
    expect(after.y - before.y).toBeCloseTo(-10);
  });
});

describe("zoomPlan", () => {
  const fit = fitPlan(map, size);

  it("keeps the point under the pointer where it is", () => {
    const at = { x: 700, y: 150 };
    const under = screenToPlan(fit, size, at);
    const zoomed = zoomPlan(fit, 2, at, size, fit);
    expect(zoomed.pxPerUnit).toBeCloseTo(fit.pxPerUnit * 2);
    const still = screenToPlan(zoomed, size, at);
    expect(still.x).toBeCloseTo(under.x);
    expect(still.y).toBeCloseTo(under.y);
  });

  it("stops at the zoom limits", () => {
    const at = { x: 500, y: 300 };
    expect(zoomPlan(fit, 1000, at, size, fit).pxPerUnit).toBeCloseTo(fit.pxPerUnit * ZOOM_IN_LIMIT);
    expect(zoomPlan(fit, 0.001, at, size, fit).pxPerUnit).toBeCloseTo(
      fit.pxPerUnit * ZOOM_OUT_LIMIT,
    );
  });
});
