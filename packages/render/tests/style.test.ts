// The style engine, on a small made-up style: merging patches, resolving a preset in a season,
// blending between presets by the hour, reading dotted paths, and the problems that stop a style
// from rendering.

import { describe, expect, it } from "vitest";
import {
  blendJson,
  mergeStyle,
  presetHours,
  resolveLook,
  resolveLookAt,
  styleProblems,
  stylePath,
  type Style,
} from "../src";

const preset = (hour: number, sky: string, sun: number, paint: string) => ({
  hour,
  sky: { top: sky, horizon: sky, fog: { color: sky, near: 10, far: 100 } },
  light: {
    sun: { color: "#ffffff", intensity: sun, azimuth: 180, elevation: 40 },
    ambient: { sky: "#ffffff", ground: "#000000", intensity: 0.5 },
  },
  colors: { paint, ground: ["#808080"] },
});

const style = {
  units: { heightScale: 1 },
  world: {},
  shared: { paint: { inset: 0.1 } },
  presets: {
    dawn: preset(6, "#000000", 0.2, "#204060"),
    dusk: preset(18, "#ff8040", 1, "#406080"),
  },
  defaultPreset: "dawn",
  seasons: {
    wet: {},
    dry: { presets: { dusk: { colors: { paint: "#a08040" } } } },
  },
  defaultSeason: "wet",
} as unknown as Style;

describe("mergeStyle", () => {
  it("merges objects by key, replaces arrays, and deletes on null, without mutating", () => {
    const base = { a: { b: 1, c: [1, 2] }, d: 2 };
    expect(mergeStyle(base, { a: { c: [3] }, d: null })).toEqual({ a: { b: 1, c: [3] } });
    expect(base).toEqual({ a: { b: 1, c: [1, 2] }, d: 2 });
  });
});

describe("resolveLook", () => {
  it("applies a preset over the shared values", () => {
    const dusk = resolveLook(style, "dusk");
    expect(dusk.preset).toBe("dusk");
    expect((dusk as unknown as { colors: { paint: string } }).colors.paint).toBe("#406080");
    expect((dusk as unknown as { paint: { inset: number } }).paint.inset).toBe(0.1);
  });

  it("applies a season's patches, and falls back to the defaults for unknown names", () => {
    const paint = (season?: string) =>
      (resolveLook(style, "dusk", season) as unknown as { colors: { paint: string } }).colors.paint;
    expect(paint("dry")).toBe("#a08040");
    expect(paint("wet")).toBe("#406080");
    expect(resolveLook(style, "nope").preset).toBe("dawn");
    expect(resolveLook(style, "dusk", "monsoon").season).toBe("wet");
  });
});

describe("resolveLookAt", () => {
  it("lists the hours in order", () => {
    expect(presetHours(style)).toEqual([
      { name: "dawn", hour: 6 },
      { name: "dusk", hour: 18 },
    ]);
  });

  it("is exactly a preset at its own hour", () => {
    for (const { name, hour } of presetHours(style)) {
      for (const season of ["wet", "dry"]) {
        const { time, ...at } = resolveLookAt(style, hour, season);
        expect(time).toBe(hour);
        expect(at).toEqual(resolveLook(style, name, season));
      }
    }
  });

  it("blends numbers and colors between presets, going round the clock", () => {
    const noon = resolveLookAt(style, 12);
    expect(noon.light.sun.intensity).toBeCloseTo(0.6);
    expect(noon.sky.top).toBe("#804020");
    // Midnight is half way from dusk (18) back round to dawn (6).
    expect(resolveLookAt(style, 0).light.sun.intensity).toBeCloseTo(0.6);
    expect(resolveLookAt(style, 26).time).toBe(2);
    // Names come from the nearer preset.
    expect(resolveLookAt(style, 11).preset).toBe("dawn");
    expect(resolveLookAt(style, 13).preset).toBe("dusk");
  });
});

describe("blendJson", () => {
  it("blends colors by channel and keeps one-sided keys from the nearer side", () => {
    expect(blendJson("#000000", "#ff8040", 0.5)).toBe("#804020");
    expect(blendJson({ a: 1, only: 2 }, { a: 3 }, 0.25)).toEqual({ a: 1.5, only: 2 });
    expect(blendJson({ a: 1, only: 2 }, { a: 3 }, 0.75)).toEqual({ a: 2.5 });
    expect(blendJson([1, 2], [3], 0.4)).toEqual([1, 2]);
    expect(blendJson("#abcdef", "#000000", 0)).toBe("#abcdef");
  });
});

describe("stylePath", () => {
  it("reads dotted paths", () => {
    expect(stylePath(style, "presets.dawn.colors.ground.0")).toBe("#808080");
    expect(stylePath(style, "presets.noon")).toBeUndefined();
  });
});

describe("styleProblems", () => {
  it("accepts a good style", () => {
    expect(styleProblems(style)).toEqual([]);
  });

  it("reports bad colors, bad hours and missing presets", () => {
    expect(
      styleProblems(mergeStyle(style, { presets: { dawn: { colors: { paint: "teal" } } } })),
    ).toEqual(['presets.dawn.colors.paint: "teal" is not #rrggbb']);
    expect(styleProblems(mergeStyle(style, { presets: { dawn: { hour: 25 } } }))).toEqual([
      "presets.dawn.hour must be a number in 0..24",
    ]);
    expect(styleProblems({ ...style, presets: {} })).toEqual(["needs at least one preset"]);
  });

  it("reports season problems by season", () => {
    const bad = mergeStyle(style, {
      seasons: { dry: { presets: { noon: {}, dawn: { colors: { ground: ["mud"] } } } } },
    });
    expect(styleProblems(bad)).toEqual([
      "seasons.dry.presets.noon: no such preset",
      'seasons.dry.presets.dawn.colors.ground[0]: "mud" is not #rrggbb',
    ]);
  });
});
