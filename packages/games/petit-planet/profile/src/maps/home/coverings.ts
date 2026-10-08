// How a room's wallpaper and flooring are laid: copies of the pattern 2 tiles across (a floor's
// also 2 tiles deep; a wall's the wall's full height), with a seam on the middle line. So an 8-tile
// wall takes 4 whole copies, and a 10-tile wall half a copy, 4 whole ones and half a copy.

import type { Doc } from "@glade/core";
import { baseOf, coveringEntry, type Catalog, type CoveringEntry } from "../../catalog";
import type { Room } from "./layout";
import { coverings } from "./model";

/** Tiles a copy of a pattern spans, across a wall or a floor. */
export const COPY_TILES = 2;

/** Where copies start along a length (tiles), seams on its middle: every start that shows. */
export function copyStarts(length: number): number[] {
  const mid = length / 2;
  const first = mid - COPY_TILES * Math.ceil(mid / COPY_TILES);
  const out: number[] = [];
  for (let s = first; s < length; s += COPY_TILES) out.push(s);
  return out;
}

/** A pattern coordinate along a length: copies are 1 apart, with a seam (a whole number) mid-way. */
export const patternU = (s: number, length: number) => (s - length / 2) / COPY_TILES;

/** A room's wallpaper and flooring, if it has them (the first of each, as rule H4 allows one). */
export function roomCoverings(
  doc: Doc,
  catalog: Catalog,
  room: Room,
): { wallpaper?: CoveringEntry; flooring?: CoveringEntry } {
  const out: { wallpaper?: CoveringEntry; flooring?: CoveringEntry } = {};
  for (const c of coverings(doc)) {
    if (c.room !== room.id) continue;
    const e = coveringEntry(catalog, c.type);
    const base = baseOf(catalog, c.type);
    if (e && (base === "wallpaper" || base === "flooring")) out[base] ??= e;
  }
  return out;
}
