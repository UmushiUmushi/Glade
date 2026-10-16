// Which views a map can be seen in: the 2D plan, 3D, or both. A viewer offers only what the map
// has, so a map with no 3D (the fixture game's sheet) shows no 2D/3D switch.

import type { RenderableMap } from "@glade/render";

export type ViewKind = "2d" | "3d";

/** The 3D cameras (the 2D plan is always from above). */
export type CameraKind = "iso" | "top" | "walk";

export const CAMERAS: readonly CameraKind[] = ["iso", "top", "walk"];

export function viewsOf(map: RenderableMap): ViewKind[] {
  const out: ViewKind[] = [];
  if (map.views.plan) out.push("2d");
  if (map.views.scene) out.push("3d");
  return out;
}

/** The view a map opens in: 3D when it has one, otherwise the plan. */
export function startView(map: RenderableMap): ViewKind {
  return map.views.scene ? "3d" : "2d";
}
