// The plan style's numbers: ground colors by height, where shadows fall for a sun, highlights.

import { describe, expect, it } from "vitest";
import { BLOCK_TILES, LEVEL_MINOR } from "../src/items/model";
import { BASE_LEVEL, levelColor, lighten, PLAN, shadeFor } from "../src/plan-style";

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

describe("shadows", () => {
  it("fall away from the sun: a sun due south casts them north, one due east casts them west", () => {
    const south = shadeFor({ azimuth: 180, elevation: 60 });
    expect(south.dx).toBeCloseTo(0);
    expect(south.dy).toBeCloseTo(-1);
    const east = shadeFor({ azimuth: 90, elevation: 60 });
    expect(east.dx).toBeCloseTo(-1);
    expect(east.dy).toBeCloseTo(0);
  });

  it("are as long as the height at 45 degrees, shorter for a higher sun", () => {
    expect(shadeFor({ azimuth: 0, elevation: 45 }).perHeight).toBeCloseTo(1);
    expect(shadeFor({ azimuth: 0, elevation: 60 }).perHeight).toBeCloseTo(1 / Math.sqrt(3));
  });

  it("stay finite for a sun on the horizon or straight overhead", () => {
    expect(Number.isFinite(shadeFor({ azimuth: 0, elevation: 0 }).perHeight)).toBe(true);
    expect(shadeFor({ azimuth: 0, elevation: 90 }).perHeight).toBeGreaterThan(0);
  });

  it("measure height in blocks, as 3D does", () => {
    expect(LEVEL_MINOR).toBe(2 * BLOCK_TILES);
  });
});

describe("lighten", () => {
  it("mixes toward white", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#3d3632", 0)).toBe("#3d3632");
    expect(lighten("#3d3632", 1)).toBe("#ffffff");
  });
});
