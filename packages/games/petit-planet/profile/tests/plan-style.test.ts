// The cosy plan style's numbers: ground colors by height, face depths, outline widths, highlights.

import { describe, expect, it } from "vitest";
import { BASE_LEVEL, faceDepth, levelColor, lighten, outlineWidth, PLAN } from "../src/plan-style";

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
    expect(levelColor(0)).not.toBe(PLAN.grass);
    expect(brightness(levelColor(0))).toBeLessThan(brightness(PLAN.grass));
  });
});

describe("face depth", () => {
  it("is nothing without a drop, a quarter block for one level, deeper for more, up to a cap", () => {
    expect(faceDepth(0)).toBe(0);
    expect(faceDepth(1)).toBe(0.5);
    expect(faceDepth(2)).toBeGreaterThan(faceDepth(1));
    expect(faceDepth(30)).toBe(1.2);
  });
});

describe("outline width", () => {
  it("is an eighth of a minor cell, kept between half a pixel and three pixels", () => {
    expect(outlineWidth(0.1)).toBe(0.12);
    expect(outlineWidth(1)).toBe(0.5);
    expect(outlineWidth(0.01)).toBe(0.03);
  });
});

describe("lighten", () => {
  it("mixes toward white", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#3d3632", 0)).toBe("#3d3632");
    expect(lighten("#3d3632", 1)).toBe("#ffffff");
  });
});
