// Fence links. Fence pieces are one-tile items whose catalog entry `connects`; in the game, pieces
// next to each other join into one fence, diagonals included, so a fence can run on a slant. Here
// each piece gets arms: rails from its tile's center out to an edge (a straight link) or a corner
// (a diagonal link), with a post at each arm's end. A turn bends at the center, as in the game (a
// straight piece followed by a diagonal one bends halfway along the straight).
//
// Two pieces of the same type on the same level link when they are one tile apart and
// - side by side (whatever their rotation: a column of pieces is a north-south fence), or
// - diagonal, with no piece of that type beside both (else the fence turns through that one).
// A piece with no links shows its own rotation (rot 0/180 runs east-west); with one link it runs
// straight through; with more it has exactly its links. Pure.

import { catalogEntry, type Catalog } from "../../catalog";
import { itemsOf, terrainAt, type Item, type MapDoc } from "./model";
import { terrainOfMinor } from "./space";

/** Direction from a piece's center, in tiles: each of dx, dy is -1, 0 or 1. */
export type Arm = [number, number];

const DIRS: Arm[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

const back = ([dx, dy]: Arm): Arm => [0 - dx || 0, 0 - dy || 0];

/** Whether an item links to its neighbors (a one-tile piece of a connecting type). */
export function isLinking(catalog: Catalog, item: Item): boolean {
  const e = catalogEntry(catalog, item.type);
  return !!e?.connects && e.footprint.w === 2 && e.footprint.h === 2;
}

/** Arms of every linking piece, by id. Pieces key on their minor position. */
export function fenceArms(map: MapDoc, catalog: Catalog): Map<string, Arm[]> {
  const pieces = itemsOf(map).filter((i) => isLinking(catalog, i));
  const out = new Map<string, Arm[]>();
  if (!pieces.length) return out;
  const at = new Map(pieces.map((p) => [`${p.mx},${p.my}`, p]));
  const level = (p: Item) => terrainAt(map, terrainOfMinor(p.mx), terrainOfMinor(p.my))?.h;
  const partner = (p: Item, dx: number, dy: number) => {
    const q = at.get(`${p.mx + 2 * dx},${p.my + 2 * dy}`);
    return q && q.type === p.type && level(q) === level(p) ? q : undefined;
  };
  for (const p of pieces) {
    const links = DIRS.filter(([dx, dy]) => {
      if (!partner(p, dx, dy)) return false;
      return dx === 0 || dy === 0 || (!partner(p, dx, 0) && !partner(p, 0, dy));
    });
    const own: Arm = p.rot % 180 === 0 ? [1, 0] : [0, 1];
    const arms: Arm[] =
      links.length === 0
        ? [own, back(own)]
        : links.length === 1
          ? [links[0], back(links[0])]
          : links;
    out.set(p.id, arms);
  }
  return out;
}

/**
 * How far each arm's rail reaches back past the piece's center, as a share of the rail's half
 * depth, so rails meet in a miter: their outer edges end at one point instead of the corners
 * jutting out. cot(angle / 2) for the smallest angle to another arm: 1 at a right-angle turn (a
 * square corner), about 0.41 where a straight run meets a diagonal, 0 on a straight run; capped at
 * 1 so a sharp turn does not stick out behind.
 */
export function armBacks(arms: Arm[]): number[] {
  const angle = ([dx, dy]: Arm) => Math.atan2(dy, dx);
  return arms.map((a, i) => {
    let min = Math.PI;
    arms.forEach((b, j) => {
      if (j === i) return;
      const d = Math.abs(angle(a) - angle(b));
      min = Math.min(min, d, 2 * Math.PI - d);
    });
    return min >= Math.PI - 1e-9 ? 0 : Math.min(1, 1 / Math.tan(min / 2));
  });
}
