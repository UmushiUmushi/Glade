// Themes without a browser: token names and CSS variables, contrast maths against known values,
// and the contrast check catching a theme that fails it.

import { describe, expect, it } from "vitest";
import { contrastProblems, contrastRatio, parseHex } from "../src/theme/contrast";
import { gladeTheme } from "../src/theme/glade";
import { cssName, cssVars, inInterfaceUnits, UI_BASE_SCALE } from "../src/theme/tokens";

describe("tokens", () => {
  it("turn camelCase names into CSS custom properties", () => {
    expect(cssName("ink")).toBe("--ink");
    expect(cssName("inkTitle")).toBe("--ink-title");
    expect(cssName("shadowChunk")).toBe("--shadow-chunk");
  });

  it("give every colour and shape token a variable, for the chosen mode, plus --u", () => {
    const light = cssVars(gladeTheme, "light");
    const dark = cssVars(gladeTheme, "dark");
    expect(light["--paper"]).toBe(gladeTheme.light.paper);
    expect(dark["--paper"]).toBe(gladeTheme.dark.paper);
    expect(light["--radius-card"]).toBe(inInterfaceUnits(gladeTheme.shape.radiusCard));
    const count = Object.keys(gladeTheme.light).length + Object.keys(gladeTheme.shape).length;
    expect(Object.keys(light)).toHaveLength(count + 1);
  });
});

describe("interface size", () => {
  it("draws the design's sizes at the base scale, and Settings' size on top", () => {
    expect(cssVars(gladeTheme, "light")["--u"]).toBe(`${UI_BASE_SCALE}px`);
    expect(cssVars(gladeTheme, "light", 1.25)["--u"]).toBe(`${UI_BASE_SCALE * 1.25}px`);
    expect(UI_BASE_SCALE).toBeLessThan(1);
  });

  it("turns pixel sizes into interface units, and leaves everything else alone", () => {
    expect(inInterfaceUnits("28px")).toBe("calc(28 * var(--u))");
    expect(inInterfaceUnits("0 4px 0 rgba(61,54,50,0.22)")).toBe(
      "0 calc(4 * var(--u)) 0 rgba(61,54,50,0.22)",
    );
    expect(inInterfaceUnits("-1.5px 2px")).toBe("calc(-1.5 * var(--u)) calc(2 * var(--u))");
    expect(inInterfaceUnits("'Nunito', system-ui")).toBe("'Nunito', system-ui");
    expect(inInterfaceUnits("800")).toBe("800");
  });
});

describe("contrast", () => {
  it("parses #rgb and #rrggbb, and nothing else", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#3d3632")).toEqual([61, 54, 50]);
    expect(parseHex("rgba(0,0,0,1)")).toBeNull();
    expect(parseHex("#12")).toBeNull();
  });

  it("matches WCAG's known ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#000", "red")).toBeNull();
  });

  it("Glade's own theme passes in light and dark", () => {
    expect(contrastProblems(gladeTheme)).toEqual([]);
  });

  it("reports text that is too faint, or not a hex colour", () => {
    const faint = {
      ...gladeTheme,
      light: { ...gladeTheme.light, inkMuted: "#bbbbbb", onDanger: "white" },
    };
    const problems = contrastProblems(faint);
    expect(problems.some((p) => p.startsWith("light: inkMuted on paper is"))).toBe(true);
    expect(problems).toContain("light: onDanger on danger must be hex colours");
  });
});
