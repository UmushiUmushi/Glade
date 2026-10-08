// Petit Planet's parts of the style envelope: the palette each preset gives (`colors`) and the
// values shared by every preset (`shared`). The generic envelope, sky, light, seasons and the walk
// camera are in @glade/render (style). Presets are the time of day (day, night); seasons (spring,
// winter) patch them: winter turns the grass to snow and caps objects with it.

import { z } from "zod";
import type { Look as CoreLook, Style as CoreStyle } from "@glade/render";
import type { LandLook } from "./render3d/land";

export interface ColorStyle {
  /**
   * The land in this preset, as it looks lit by the day's light:
   * `grass` the leaves' ramp (dark, mid, light), `face` the cliff faces (top line and haze, upper,
   * band, lower, seam).
   */
  land: {
    grass: [string, string, string];
    face: [string, string, string, string, string];
    /**
     * Levels above the base: light salmon, salmon, seam, lavender, lower
     *.
     */
    upper: [string, string, string, string, string];
    /**
     * The faces' exposure in this preset (1 = as lit). The game's faces stay as bright in the
     * morning as at noon while its lawn darkens ("morning wide shot"), beyond what a color can
     * say.
     */
    faceGain: number;
  };
  /** Grass in 2D and plain views: lip, lit ground, plateau top. */
  grassTop: string[];
  grassShade?: string;
  /** Cliff bands, top to bottom, about bandsPerLevel per level; repeats for taller faces. */
  strata: string[];
  /**
   * Cliff bands by height instead, bottom up from the land's default
   * level, bandsPerLevel per level; the last level's repeat above. Wins over `strata` when given.
   */
  strataUp?: string[];
  sand: string;
  sandWet: string;
  /** Earth under water. Defaults to the darkest stratum. */
  bed?: string;
  water: string;
  fall: string;
  foam: string;
  /** Sea around the island. Defaults to water. */
  sea?: string;
  /** Snow on top of plants and items, where shared.objects.snow > 0. */
  snow?: string;
  /**
   * Light that glowing model parts (finish "glow") give, times their own color: black for none,
   * white for full. Lamps glow faintly by day and fully at night.
   */
  glow?: string;
  /** Multiplies shaded ground (1 = none), so shade takes the light's hue: blue snow, not grey. */
  shadowTint?: string;
  /** What fully occluded light looks like (contact strips, cliff feet, under the snow roll). */
  occlusion?: string;
}

export interface SharedStyle {
  toon: { steps: number; outline: { enabled: boolean; color: string; width: number } };
  terrain: {
    /** Cushions, leaf stamps, the lawn, tone and cliff faces. */
    land: LandLook;
    /**
     * `grassBorder`: a strip of grass at beach level, one minor cell wide, between the beach and
     * the land: the half of the outermost buildable tiles that lies on beach terrain.
     */
    sand: { wetWidth: number; grassBorder?: boolean };
    /** Soft darkening on the ground at the foot of every cliff (a cheap contact shadow). */
    contact?: { width: number; strength: number };
  };
  water: {
    /** Surface below the block's top, in levels. 0 = flush with the banks. */
    inset: number;
    /** Riverbed below the surface, in levels. */
    bed?: number;
    opacity: number;
    /** 0..1 lighter tint in the two blocks next to the shore. */
    shallow?: number;
    /** 0..1 foam ring strength right at the shore. */
    shoreFoam?: number;
    /** 0..1 soft lighter patches drifting on the surface (the ground's stamps, stretched). */
    patches?: number;
    /** 0..1 darker toward the banks (their shade on the water). */
    edgeDark?: number;
    /** Brightness of the caustic lines on the bed (0 none). */
    caustics?: number;
    waves: { amplitude: number; speed: number; scale: number };
    /**
     * `streaks`: broad bands across the sheet; `white` 0..1 thin white streaks; `edge` 0..1
     * light at the fall's two ends; `lip`: radius (3D units) of the rounded edge where the
     * surface tips over into the fall (0 = a sharp edge).
     */
    fall: {
      streaks: number;
      speed: number;
      white?: number;
      edge?: number;
      lip?: number;
      foam: { height: number; spread: number };
    };
  };
  /**
   * `snow` 0..1: how much of the upward faces of plants and items is snow-covered. `glass` 0..1:
   * how solid see-through model parts (finish "glass") look.
   */
  objects: { toonSteps: number; snow?: number; glass?: number };
  /**
   * How every path is drawn (each path's color and pattern are its catalog entry's). `gap`: how far
   * (tiles) a path stops short of a different path type beside it; different types never merge.
   * `fringe`: how far (3D units) the grass's lobes reach over a path's edge where it borders
   * grass. `corner`: the radius (3D units; a tile is 2) that rounds a path's outer corners, where
   * neither side has a path beside it.
   */
  paths?: {
    gap?: number;
    fringe?: number;
    corner?: number;
  };
}

export interface WorldExtras {
  /** The sea plane around the island. */
  sea?: { enabled: boolean; level: number };
}

export type Style = CoreStyle<SharedStyle, ColorStyle> & { world: WorldExtras };

/** Everything the renderer needs for one preset. */
export type Look = CoreLook<SharedStyle, ColorStyle> & { world: WorldExtras };

const num = z.number();
const color = z.string();
const shared = z.object({
  toon: z.object({
    steps: num,
    outline: z.object({ enabled: z.boolean(), color, width: num }),
  }),
  terrain: z.object({
    land: z.object({
      cushion: z.object({
        overhang: num.min(0),
        depth: num.positive(),
        radius: num.positive(),
        tuck: num.min(0),
        corner: num.min(0),
        coreInset: num.min(0),
        coreShade: num.min(0),
        coreUnder: num.min(0).max(1),
        coreDrop: num.min(0),
      }),
      leaves: z.object({
        size: num.positive(),
        spacing: num.positive(),
        rowStep: num.positive(),
        topSpacing: num.min(0.05),
        jitter: num.min(0).max(1),
        push: num,
        layer: num,
        rowWave: num.min(0),
        edgeBand: num.min(0),
        rand: num.min(0),
        soft: num.min(0),
        foot: z.array(z.tuple([num, num])),
        pathRows: z.array(z.tuple([num, num])),
      }),
      tone: z.object({
        bias: num,
        byHeight: num,
        byNormal: num,
        normalPower: num.positive(),
        under: num,
        underWidth: num.min(0),
        rim: num,
        rimWidth: num.min(0),
        rimWarp: num.min(0),
        rimWarpSize: num.positive(),
        detail: num.min(0),
        detailSize: num.positive(),
        patch: num.min(0),
        patchSize: num.positive(),
        clumps: num.min(0).max(1),
        bands: num.positive(),
        clumpEdge: num.positive(),
        shadePatch: num.min(0),
        shadeSize: num.positive(),
        ground: num,
        blend: num.min(0).max(1),
        blendFrom: num.min(0),
        blendTo: num.min(0),
        groundRim: num.min(0).max(1),
      }),
      face: z.object({
        topLine: num.min(0),
        bandAt: num,
        bandWidth: num.min(0),
        soft: num.min(0),
        wobble: num.min(0),
        wobbleScale: num.positive(),
        streaks: num.min(0),
        streakScale: num.positive(),
        haze: num.min(0).max(1),
        hazeWidth: num.min(0),
        hazeWave: num.min(0),
        ambient: num.min(0),
        sun: num.min(0),
        shade: num.min(0),
        shadeTint: color,
        follow: num.min(0).max(1),
        round: num.min(0),
        period: num.positive(),
        lightTo: num,
        seamDepth: num,
        seamSpread: num.positive(),
        lavenderAt: num,
        pinkFrom: num,
        pinkTo: num,
        lowAt: num,
        line: num.min(0).max(1),
        blend: num.min(0),
        bandSoft: num.min(0),
        dent: num.min(0),
        dentSize: num.positive(),
        blotch: num.min(0),
        blotchSize: num.positive(),
        vStreaks: num.min(0),
        topLight: num,
        seam: num.min(0).max(1),
        seamAt: num,
        seamWidth: num.positive(),
      }),
      daylight: z.object({
        sun: z.object({ color, intensity: num, azimuth: num, elevation: num }),
        ambient: z.object({ sky: color, ground: color, intensity: num }),
        /** The grade the land's colors were sampled under (midday's): the land undoes it. */
        grade: z
          .object({
            saturation: num.optional(),
            contrast: num.optional(),
            lift: color.optional(),
            gain: color.optional(),
          })
          .optional(),
      }),
    }),
    sand: z.object({ wetWidth: num, grassBorder: z.boolean().optional() }),
    contact: z.object({ width: num, strength: num }).optional(),
  }),
  water: z.object({
    inset: num,
    bed: num.optional(),
    opacity: num,
    shallow: num.optional(),
    shoreFoam: num.optional(),
    patches: num.min(0).max(1).optional(),
    edgeDark: num.min(0).max(1).optional(),
    caustics: num.min(0).optional(),
    waves: z.object({ amplitude: num, speed: num, scale: num }),
    fall: z.object({
      streaks: num,
      speed: num,
      white: num.min(0).max(1).optional(),
      edge: num.min(0).max(1).optional(),
      lip: num.min(0).max(1).optional(),
      foam: z.object({ height: num, spread: num }),
    }),
  }),
  objects: z.object({
    toonSteps: num,
    snow: num.min(0).max(1).optional(),
    glass: num.min(0).max(1).optional(),
  }),
  paths: z
    .object({
      gap: num.min(0).max(0.4).optional(),
      fringe: num.min(0).max(1).optional(),
      corner: num.min(0).max(1).optional(),
    })
    .optional(),
});
const colors = z.object({
  land: z.object({
    grass: z.tuple([color, color, color]),
    face: z.tuple([color, color, color, color, color]),
    upper: z.tuple([color, color, color, color, color]),
    faceGain: num.positive(),
  }),
  grassTop: z.array(color).min(1, "is empty"),
  grassShade: color.optional(),
  strata: z.array(color).min(1, "is empty"),
  strataUp: z.array(color).optional(),
  sand: color,
  sandWet: color,
  bed: color.optional(),
  water: color,
  fall: color,
  foam: color,
  sea: color.optional(),
  snow: color.optional(),
  glow: color.optional(),
  shadowTint: color.optional(),
  occlusion: color.optional(),
});
const world = z
  .object({ sea: z.object({ enabled: z.boolean(), level: num }).optional() })
  .passthrough();

/** Petit Planet's parts of a style (checked once per preset by the core). */
export const styleSchema = z.object({ shared, colors, world });
