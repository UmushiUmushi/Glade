// Small helpers for writing the island catalog's models: one function per part shape, and the
// colours the made-up items share. Models are in tiles, with x and z across the footprint and y up;
// `at` is a part's foot (spheres: their middle).

import type { Model } from "@glade/render";

type Part = Model["parts"][number];
type Xyz = [number, number, number];
type Extra = Record<string, unknown>;

export const C = {
  wood: "#9a7350",
  darkWood: "#6e4f36",
  lightWood: "#c49a6c",
  iron: "#4a4f57",
  stone: "#a8a39a",
  darkStone: "#7d7870",
  white: "#f4efe4",
  cream: "#efe3c8",
  red: "#b5523b",
  roof: "#8c4a3c",
  teal: "#5f9e96",
  blue: "#5a86b0",
  sun: "#f2d16b",
  pink: "#e39aac",
  lilac: "#a68bc4",
  leaf: "#5d9a48",
  leafLight: "#7cb35a",
  leafDark: "#3f7a3a",
  bark: "#7a5a3c",
  clay: "#c07a52",
  glow: "#ffe6a0",
  glass: "#bfe3ef",
} as const;

export function box(at: Xyz, size: Xyz, color: string, extra: Extra = {}): Part {
  return { shape: "box", at, size, color, ...extra } as Part;
}

export function cyl(
  at: Xyz,
  radius: number,
  height: number,
  color: string,
  extra: Extra = {},
): Part {
  return { shape: "cylinder", at, radius, height, color, ...extra } as Part;
}

export function cone(
  at: Xyz,
  radius: number,
  height: number,
  color: string,
  extra: Extra = {},
): Part {
  return { shape: "cone", at, radius, height, color, ...extra } as Part;
}

export function ball(at: Xyz, radius: number, color: string, extra: Extra = {}): Part {
  return { shape: "sphere", at, radius, color, ...extra } as Part;
}

export function wedge(at: Xyz, size: Xyz, color: string, extra: Extra = {}): Part {
  return { shape: "wedge", at, size, color, ...extra } as Part;
}

/** Parts mirrored across the footprint's middle, on x, z or both. */
export function mirrored(at: Xyz, axes: ("x" | "z")[], parts: Part[]): Part {
  return { shape: "group", at, mirror: axes, parts } as Part;
}

/** Four legs under a top of `w` × `d` tiles, centred on (cx, cz). */
export function legs(cx: number, cz: number, w: number, d: number, h: number, color: string): Part {
  const t = 0.07;
  return mirrored([cx, 0, cz], ["x", "z"], [box([w / 2 - t, 0, d / 2 - t], [t, h, t], color)]);
}

export function model(...parts: Part[]): Model {
  return { parts };
}
