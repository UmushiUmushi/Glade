// Where a patch changed the map, as one world box: what the profile's rules check after a change
// (validate with a region). Each map type says where its cells and entities sit (`map.locate`).

import { rectToBox, unionBox, type Bound, type Box, type Doc, type Rect } from "@glade/core";
import type { Patch } from "./patch";

/** The box around every change, before and after, or null for an empty patch. */
export function changedRegion(game: Bound, before: Doc, after: Doc, patch: Patch): Box | null {
  const rects: Rect[] = [];
  for (const c of patch.changes) {
    if (c.kind === "cell") rects.push(...game.locate(game, after, c.layer, [c.x, c.y]));
    else {
      if (c.before) rects.push(...game.locate(game, before, c.layer, c.before));
      if (c.after) rects.push(...game.locate(game, after, c.layer, c.after));
    }
  }
  return unionBox(rects.map((r) => rectToBox(game.space, r)));
}
