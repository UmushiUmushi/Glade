// How Petit Planet looks from above: the flat colors of the planner's design (soft greens, caramel
// sand, sky-blue ponds on a deep sea), with a darker band just south of raised ground, as the
// design draws cliffs, and soft short shadows south-east of things. The planet's plan, the home's plan and the item drawing share it.

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

/**
 * The drop just south of raised ground, on the lower ground: black over it at 31%, which is how
 * much darker the design's cliff face is than its meadow (any ground, path or pond under it
 * darkens the same way).
 */
export const DROP = "rgba(0,0,0,0.31)";

/**
 * How deep (minor units) a drop is drawn for `levels` of height: a quarter of a terrain block for
 * one level, as in the design, a little more for each level more, up to most of a block.
 */
export function dropDepth(levels: number): number {
  if (levels <= 0) return 0;
  return Math.min(1.2, 0.3 + 0.2 * levels);
}

/** How far below its banks a pond's surface lies, in levels, for the banks' drop. */
export const POND_DROP = 0.4;

/**
 * Things' shadows: soft and short, falling south-east (as if lit from the north-west), a quarter
 * of a thing's height long. `dx`, `dy` is the way they fall (unit, minor units).
 */
export const SHADE = {
  dx: Math.SQRT1_2,
  dy: Math.SQRT1_2,
  perHeight: 0.25,
  color: "rgba(36,48,30,0.13)",
} as const;

/** `hex` mixed toward white by `t` (0 to 1). */
export function lighten(hex: string, t: number): string {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map((c) => Math.round(c + (255 - c) * t));
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}
