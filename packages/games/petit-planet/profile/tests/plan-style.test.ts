// The plan style's numbers: ground colors by height, the drop below raised ground, highlights.

import { describe, expect, it } from "vitest";
import { BASE_LEVEL, DROP, dropDepth, levelColor, lighten, PLAN, SHADE } from "../src/plan-style";

const brightness = (hex: string) =>
  [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

describe("ground colors", () => {
  it("are the design's grass at the base level and its meadow one level up", () => {
    expect(levelColor(BASE_LEVEL)).toBe(PLAN.grass);
    expect(levelColor(BASE_LEVEL + 1)).toBe("#a1af66");
  });

  it("get lighter toward the hilltops, and stop at the lightest", () => {
    for (let h = BASE_LEVEL + 1; h < 8; h++) {
      expect(brightness(levelColor(h + 1))).toBeGreaterThan(brightness(levelColor(h)));
    }
    expect(levelColor(20)).toBe(levelColor(8));
  });

  it("are a deeper green below the base level", () => {
    expect(brightness(levelColor(0))).toBeLessThan(brightness(PLAN.grass));
  });
});

describe("drops", () => {
  it("darken what they fall on as the design's face darkens its meadow (#a1af66 to #6f7a3f)", () => {
    const alpha = Number(DROP.match(/[\d.]+\)$/)?.[0].slice(0, -1));
    const meadow = [0xa1, 0xaf, 0x66];
    const design = [0x6f, 0x7a, 0x3f];
    meadow.forEach((c, i) => expect(Math.abs(c * (1 - alpha) - design[i])).toBeLessThanOrEqual(8));
  });

  it("are nothing without a drop, a quarter block for one level, deeper for more, up to a cap", () => {
    expect(dropDepth(0)).toBe(0);
    expect(dropDepth(1)).toBeCloseTo(0.5);
    expect(dropDepth(2)).toBeGreaterThan(dropDepth(1));
    expect(dropDepth(0.4)).toBeLessThan(dropDepth(1));
    expect(dropDepth(30)).toBe(1.2);
  });
});

describe("shadows", () => {
  it("fall south-east, soft, and shorter than the thing is tall", () => {
    expect(SHADE.dx).toBeGreaterThan(0);
    expect(SHADE.dy).toBeGreaterThan(0);
    expect(Math.hypot(SHADE.dx, SHADE.dy)).toBeCloseTo(1);
    expect(SHADE.perHeight).toBeLessThan(1);
    expect(Number(SHADE.color.match(/[\d.]+\)$/)?.[0].slice(0, -1))).toBeLessThan(0.2);
  });
});

describe("lighten", () => {
  it("mixes toward white", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#3d3632", 0)).toBe("#3d3632");
    expect(lighten("#3d3632", 1)).toBe("#ffffff");
  });
});
