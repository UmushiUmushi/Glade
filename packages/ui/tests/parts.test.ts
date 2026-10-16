// The controls' plain logic without a browser: the stepper's steps and limits, and which icon ids
// have a drawing.

import { describe, expect, it } from "vitest";
import { SHARED_ICONS, iconResolves } from "../src/icons";
import { stepValue } from "../src/stepper";

describe("stepValue", () => {
  it("moves by a step and stays inside the limits", () => {
    expect(stepValue(1, 0.5, 0.5, 4)).toBe(1.5);
    expect(stepValue(4, 0.5, 0.5, 4)).toBe(4);
    expect(stepValue(0.5, -0.5, 0.5, 4)).toBe(0.5);
  });

  it("has no float drift", () => {
    expect(stepValue(0.1, 0.2, 0, 1)).toBe(0.3);
  });
});

describe("iconResolves", () => {
  it("finds shared icons and a game's own, and nothing else", () => {
    expect(iconResolves("close", {})).toBe(true);
    expect(iconResolves("mode-special", { "mode-special": "<svg/>" })).toBe(true);
    expect(iconResolves("mode-special", {})).toBe(false);
  });

  it("has an icon for every generic action the shared screens name", () => {
    for (const id of ["close", "undo", "redo", "eye", "search", "menu", "settings", "trash"]) {
      expect(id in SHARED_ICONS, id).toBe(true);
    }
  });
});
