// A home's look: one fixed look inside (no times of day or seasons: a window that shows the night
// is an app's own item state), with the colors of a room that has no wallpaper or flooring, its
// doors, and the dark outside. The generic envelope (sky, light, the walk camera) is @glade/render's.

import { z } from "zod";
import type { Look as CoreLook, Style as CoreStyle } from "@glade/render";

export interface HomeColors {
  /** A floor without flooring. */
  floor: string;
  /** Walls without wallpaper. */
  wall: string;
  door: string;
  /** The top edge of a wall, where it is cut off. */
  edge: string;
  /** Around the rooms, in the plan view. */
  outside: string;
  /** The light glowing parts give (black for none, white for full). */
  glow: string;
}

export interface HomeShared {
  /** toonSteps: shading bands; glass 0..1: how solid glass parts look. */
  objects: { toonSteps: number; glass?: number };
}

export type HomeStyle = CoreStyle<HomeShared, HomeColors>;
export type HomeLook = CoreLook<HomeShared, HomeColors>;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const homeStyleSchema = z.object({
  shared: z.object({
    objects: z.object({
      toonSteps: z.number().int().min(1),
      glass: z.number().min(0).max(1).optional(),
    }),
  }),
  colors: z.object({
    floor: color,
    wall: color,
    door: color,
    edge: color,
    outside: color,
    glow: color,
  }),
  world: z.unknown(),
});
