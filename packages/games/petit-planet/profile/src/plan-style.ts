// How Petit Planet looks from above: the flat colors of the planner's design (soft greens, caramel
// sand, sky-blue ponds on a deep sea), lit like the 3D view. Raised ground, items and plants cast
// a soft shadow away from the 3D look's sun, longer for taller things. The planet's plan, the
// home's plan and the item drawing share it.

/** The design's named colors. */
export const PLAN = {
  /** Open water around the island. */
  sea: "#0c6d8f",
  sand: "#debe79",
  /** The ground at the island's base level. */
  grass: "#a4c148",
  pond: "#69d2ff",
  fall: "#3fb4e8",
  ink: "#3d3632",
  cream: "#efe9d4",
  paper: "#fcf9e8",
  sun: "#f9e260",
} as const;

/** The island's base ground level (the town center's). */
export const BASE_LEVEL = 1;

/** Level colors above the base: the design's meadow, then a step lighter each level. */
const UP = ["#a1af66", "#b0bb76", "#bec686", "#cbd197", "#d6dba8", "#e0e4b8", "#e8ecc6"];
/** Below the base (dug out): a deeper green. */
const DOWN = "#8ea53e";

/** The ground's color at height `h`. */
export function levelColor(h: number): string {
  if (h < BASE_LEVEL) return DOWN;
  if (h === BASE_LEVEL) return PLAN.grass;
  return UP[Math.min(UP.length - 1, h - BASE_LEVEL - 1)];
}

/** How far below its banks a pond's surface lies, in levels, for the banks' shadow. */
export const POND_DROP = 0.4;

/** Shadows, from the sun's azimuth and elevation in degrees, as the 3D view places it. */
export interface Shade {
  /** The way shadows fall on the map (unit, minor units: x east, y south). */
  dx: number;
  dy: number;
  /** Shadow length for each minor unit of height. */
  perHeight: number;
  color: string;
}

/**
 * Where shadows fall for a sun at `azimuth` (degrees clockwise from north) and `elevation`
 * (degrees up): away from the sun, as long as the height over the elevation's tangent. Same
 * direction as the 3D stage's sun (azimuth 180 is due south, so shadows fall north).
 */
export function shadeFor(sun: { azimuth: number; elevation: number }): Shade {
  const az = (sun.azimuth * Math.PI) / 180;
  const el = (Math.max(5, Math.min(89, sun.elevation)) * Math.PI) / 180;
  return {
    dx: -Math.sin(az),
    dy: Math.cos(az),
    perHeight: 1 / Math.tan(el),
    color: "rgba(36,48,30,0.18)",
  };
}

/** `hex` mixed toward white by `t` (0 to 1). */
export function lighten(hex: string, t: number): string {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map((c) => Math.round(c + (255 - c) * t));
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}
