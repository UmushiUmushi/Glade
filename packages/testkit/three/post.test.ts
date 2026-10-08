// Post-processing decisions for a look (grading, focus, the sky undone against the grade), checked
// against Petit Planet's style.

import { board } from "@glade/fixture-profile";
import type { Style } from "@glade/petit-planet-profile";
import styleJson from "@glade/petit-planet-profile/look/planet.json" with { type: "json" };
import { mergeStyle, styleProblems as coreProblems } from "@glade/render";
import { describe, expect, it } from "vitest";
import { focusing, grading, needsPost, ungraded } from "../../three/src/post";

const style = styleJson as unknown as Style;

describe("post-processing", () => {
  it("every stop of the day is graded, so one grade pass runs all day and stops blend", async () => {
    for (const [name, p] of Object.entries(style.presets)) {
      expect(grading(p.light.grade), name).toBe(true);
    }
    expect(grading(undefined)).toBe(false);
    expect(grading({ gain: "#FFFFFF", lift: "#000000", tint: [1, 1, 1] })).toBe(false);
    expect(grading({ tint: [0.4, 0.8, 1.4] })).toBe(true);
    expect(needsPost({ glow: null, grade: null })).toBe(false);
    expect(needsPost({ glow: null, grade: { saturation: 1.1 } })).toBe(true);
  });

  it("every preset softens the distance; the fixture asks for no focus", async () => {
    for (const [name, p] of Object.entries(style.presets)) {
      expect(focusing(p.light.focus), name).toBe(true);
    }
    expect(focusing({ blur: 0, start: 1, end: 2 })).toBe(false);
    expect(needsPost({ glow: null, grade: null, focus: { blur: 4, start: 1, end: 2 } })).toBe(true);
    for (const p of Object.values(board.style.defaults.presets)) {
      expect(p.light.focus).toBeUndefined();
    }
    const bad = mergeStyle(style, {
      presets: { midday: { light: { focus: { blur: -1, start: 1, end: 2 } } } },
    });
    expect(coreProblems(bad as never)).toEqual([
      "presets.midday.light.focus needs blur, start and end as numbers >= 0",
    ]);
    const badTint = mergeStyle(style, {
      presets: { night: { light: { grade: { tint: [1, 2] } } } },
    });
    expect(coreProblems(badTint as never)).toEqual([
      "presets.night.light.grade.tint needs three numbers >= 0",
    ]);
  });

  it("the sky is undone against the grade, so it shows as written", async () => {
    expect(ungraded("#1a6cae", null).getHexString()).toBe("1a6cae");
    expect(ungraded("#1a6cae", { saturation: 1, contrast: 1 }).getHexString()).toBe("1a6cae");
    // lift and gain are display colors: black lifts to the lift, white scales to the gain.
    expect(ungraded("#141828", { lift: "#141828" }).getHexString()).toBe("000000");
    expect(ungraded("#e7e7e7", { gain: "#e7e7e7" }).getHexString()).toBe("ffffff");
    expect(ungraded("#808080", { contrast: 1.2 }).getHexString()).toBe("808080");
    // The tint is undone too: a sky written #404080 under a half-red tint is drawn #804080.
    expect(ungraded("#404080", { tint: [0.5, 1, 1] }).getHexString()).toBe("804080");
  });
});
