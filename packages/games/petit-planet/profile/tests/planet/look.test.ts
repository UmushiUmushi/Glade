// The time of day: four stops (morning, midday, afternoon, night) that the viewer's time slider
// blends between. Every stop has the same fields, so every value blends rather than jumping.

import { mergeStyle, presetHours, resolveLook, resolveLookAt, styleProblems } from "@glade/render";
import { describe, expect, it } from "vitest";
import styleJson from "../../look/planet.json" with { type: "json" };
import { BLOCK_TILES, planet } from "../../src";
import type { Style } from "../../src/maps/planet/style";

const style = styleJson as unknown as Style;

/** Every leaf path of a JSON value ("light.sun.azimuth", ...). */
function paths(v: unknown, pre = ""): string[] {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return Object.entries(v).flatMap(([k, x]) => paths(x, pre ? `${pre}.${k}` : k));
  }
  return [pre];
}

describe("time of day", () => {
  it("has four stops in order through the day", () => {
    expect(presetHours(style as never)).toEqual([
      { name: "morning", hour: 7 },
      { name: "midday", hour: 12 },
      { name: "afternoon", hour: 16.5 },
      { name: "night", hour: 21 },
    ]);
    expect(styleProblems(style as never, planet.style)).toEqual([]);
  });

  it("gives every stop the same fields, so every value blends", () => {
    const [first, ...rest] = Object.values(style.presets).map((p) => paths(p).sort());
    for (const r of rest) expect(r).toEqual(first);
  });

  it("blends halfway between stops, in every season", () => {
    for (const season of ["spring", "winter"]) {
      const a = resolveLook(style, "midday", season);
      const b = resolveLook(style, "afternoon", season);
      const mid = resolveLookAt(style, (12 + 16.5) / 2, season);
      expect(mid.light.sun.azimuth).toBeCloseTo((a.light.sun.azimuth + b.light.sun.azimuth) / 2);
      const t = mid.light.grade!.tint!;
      expect(t[1]).toBeCloseTo((a.light.grade!.tint![1] + b.light.grade!.tint![1]) / 2);
      expect(mid.sky.top).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("wraps from night through midnight to morning", () => {
    const late = resolveLookAt(style, 2);
    const n = resolveLook(style, "night");
    const m = resolveLook(style, "morning");
    // 2:00 is half way from 21:00 to 7:00.
    expect(late.light.grade!.tint![2]).toBeCloseTo(
      (n.light.grade!.tint![2] + m.light.grade!.tint![2]) / 2,
    );
  });

  it("has no paw prints: the sky's glyphs are not a game default", () => {
    for (const p of Object.values(style.presets)) expect(p.sky.glyphs).toBeUndefined();
  });

  it("tints night teal-blue and afternoon warm, keeping morning and midday neutral", () => {
    const tint = (name: string) => style.presets[name].light.grade!.tint!;
    expect(tint("morning")).toEqual([1, 1, 1]);
    expect(tint("midday")).toEqual([1, 1, 1]);
    const [ar, ag, ab] = tint("afternoon");
    expect(ar).toBeGreaterThan(ag);
    expect(ag).toBeGreaterThanOrEqual(ab);
    const [nr, ng, nb] = tint("night");
    expect(nb).toBeGreaterThan(ng);
    expect(ng).toBeGreaterThan(nr);
  });
});

describe("the look's data", () => {
  it("the land's daylight is the midday light, the light its colors were sampled in", () => {
    const midday = style.presets.midday.light;
    const ref = style.shared.terrain.land.daylight;
    expect(ref.sun).toEqual({
      color: midday.sun.color,
      intensity: midday.sun.intensity,
      azimuth: midday.sun.azimuth,
      elevation: midday.sun.elevation,
    });
    expect(ref.ambient).toEqual(midday.ambient);
    const { tint: _tint, ...grade } = midday.grade!;
    expect(ref.grade).toEqual(grade);
  });

  it("every stop has occlusion colors; paths take theirs from the catalog, not the look", () => {
    for (const p of Object.values(style.presets)) {
      expect(p.colors.occlusion).toMatch(/^#/);
      expect("paths" in p.colors).toBe(false);
    }
    expect("pattern" in (style.shared.paths ?? {})).toBe(false);
  });

  it("winter snows the grass and the objects; spring keeps them green", () => {
    expect(Object.keys(style.seasons!)).toEqual(["spring", "winter"]);
    for (const name of Object.keys(style.presets)) {
      const spring = resolveLook(style, name, "spring");
      const winter = resolveLook(style, name, "winter");
      expect(spring.colors.grassTop).toEqual(style.presets[name].colors.grassTop);
      expect(winter.colors.grassTop).not.toEqual(spring.colors.grassTop);
      expect(winter.objects.snow).toBeGreaterThan(0);
      expect(spring.objects.snow ?? 0).toBe(0);
    }
  });

  it("the game's schema checks shared values and every stop's colors", () => {
    const bad = mergeStyle(style, {
      presets: { night: { colors: { strata: [] } } },
      shared: { water: { opacity: null } },
    });
    const problems = styleProblems(bad as never, planet.style);
    expect(problems).toContain("presets.night.colors.strata: is empty");
    expect(problems.some((p) => p.startsWith("shared.water.opacity:"))).toBe(true);
  });
});

describe("units", () => {
  it("a block is as tall as the item formula says, next to a tile", () => {
    expect(style.units.heightScale / 2).toBe(BLOCK_TILES);
  });
});
