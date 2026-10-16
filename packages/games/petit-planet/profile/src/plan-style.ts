// How Petit Planet looks from above: the cosy flat style of the planner's design. Ground in soft
// greens with a darker face below each raised edge, caramel sand, sky-blue ponds on a deep sea,
// and things drawn as stickers (an ink outline and a drop shadow). The planet's plan, the home's
// plan and the item drawing share it.

/** The design's named colors. */
export const PLAN = {
  /** Open water around the island. */
  sea: "#0c6d8f",
  sand: "#debe79",
  /** The ground at the island's base level. */
  grass: "#a4c148",
  /** One level up. */
  meadow: "#a1af66",
  /** The face of a raised edge, seen from the south. */
  face: "#6f7a3f",
  pond: "#69d2ff",
  fall: "#3fb4e8",
  /** Outlines and the darkest marks. */
  ink: "#3d3632",
  cream: "#efe9d4",
  paper: "#fcf9e8",
  sun: "#f9e260",
} as const;

/** The island's base ground level (the town center's). */
export const BASE_LEVEL = 1;

/** Level colors above the base: meadow, then a step lighter each level, toward the hilltops. */
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
 * How deep (minor units) the face below a raised edge is drawn, for a drop of `levels`: a quarter
 * of a terrain block for one level, a little more for each level after, up to most of a block.
 */
export function faceDepth(levels: number): number {
  if (levels <= 0) return 0;
  return Math.min(1.2, 0.5 + 0.2 * (levels - 1));
}

/** Water's soft inner rim: a share of a terrain block, and its color. */
export const POND_RIM = { width: 0.2, color: "rgba(255,255,255,0.22)" };

/** A thin line where ground meets higher ground to its north, east or west. */
export const EDGE_LINE = "rgba(61,54,50,0.28)";

/**
 * A sticker's ink outline for a canvas at `px` minor units per screen pixel: an eighth of a minor
 * cell, kept between half a pixel and three pixels so it reads at any zoom.
 */
export function outlineWidth(px: number): number {
  return Math.min(3 * px, Math.max(0.5 * px, 0.12));
}

/** A sticker's drop shadow: straight down, in ink, see-through. */
export const SHADOW = { dy: 0.28, color: "rgba(61,54,50,0.28)" };

/** `hex` mixed toward white by `t` (0 to 1): a highlight. */
export function lighten(hex: string, t: number): string {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map((c) => Math.round(c + (255 - c) * t));
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}
