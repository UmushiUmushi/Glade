// The viewer's selection: world-unit boxes, optionally on a floor, plus the grid rects they were
// snapped to and the exact cells of a flood selection. The game formats it in its own grids.

import type { Box, Cell, Rect, Space } from "./space";
import { rectToBox } from "./space";

export interface Selection {
  boxes: Box[];
  /** The same boxes as grid rects, when the viewer snapped them to a grid. */
  rects?: Rect[];
  /** Exact cells for a flood selection; boxes then hold its bbox. */
  cells?: Cell[];
  /** What was flood-selected, e.g. "level-3 region". */
  label?: string;
  updated?: string;
}

/** Normalize posted input ({boxes} or {rects}); throws on anything malformed. */
export function parseSelection(space: Space, body: unknown): Omit<Selection, "updated"> | null {
  if (body === null) return null;
  const o = body as { boxes?: unknown[]; rects?: unknown[]; cells?: Cell[]; label?: string };
  const isRect = (r: unknown): r is Rect => {
    const x = r as Rect;
    return (
      !!x &&
      typeof x.grid === "string" &&
      !!space.grids[x.grid] &&
      [x.x, x.y, x.w, x.h].every(Number.isInteger) &&
      x.w > 0 &&
      x.h > 0
    );
  };
  const isBox = (b: unknown): b is Box => {
    const x = b as Box;
    return !!x && [x.x, x.y, x.w, x.h].every(Number.isFinite) && x.w > 0 && x.h > 0;
  };
  let rects: Rect[] | undefined;
  let boxes: Box[];
  if (Array.isArray(o.rects)) {
    if (!o.rects.every(isRect)) {
      const grids = Object.keys(space.grids).join(", ");
      throw new Error(`selection rects need {grid, x, y, w, h} with grid one of ${grids}`);
    }
    rects = o.rects;
    boxes = rects.map((r) => rectToBox(space, r));
  } else if (Array.isArray(o.boxes) && o.boxes.every(isBox)) boxes = o.boxes;
  else throw new Error("selection needs boxes: [{x, y, w, h}] or rects: [{grid, x, y, w, h}]");
  if (o.cells?.some((c) => !space.grids[c.grid])) throw new Error("selection cells: unknown grid");
  const out: Omit<Selection, "updated"> = { boxes };
  if (rects) out.rects = rects;
  if (o.cells) out.cells = o.cells;
  if (o.label) out.label = o.label;
  return out;
}
