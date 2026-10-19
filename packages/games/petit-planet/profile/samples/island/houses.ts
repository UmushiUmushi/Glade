// Step 3: houses along the roads. Each faces a road (a building's front is south at rotation 0
// and turns clockwise: 90 west, 180 north, 270 east), one tile back, with a garden path from its
// door to the road. Houses keep a few tiles apart.

import { catalogEntry, pathAt, rotatedSize, setPathAt, type Item, type Rotation } from "../../src";
import type { Placer } from "./placer";
import { roadable, type RoadTile } from "./roads";

const HOUSES: [type: string, weight: number][] = [
  ["island-cottage", 4],
  ["island-log-cabin", 3],
  ["island-blue-house", 3],
  ["island-bakery", 2],
  ["island-big-house", 2],
  ["island-greenhouse", 1],
  ["island-barn", 1],
];

/** Tiles between houses, at least. */
const HOUSE_GAP = 3;

export interface House {
  item: Item;
  /** Its rect in minor cells. */
  rect: { x: number; y: number; w: number; h: number };
  /** The garden tile in front of its door. */
  door: { X: number; Y: number };
  rot: Rotation;
}

function weighted(placer: Placer): string {
  const total = HOUSES.reduce((s, [, w]) => s + w, 0);
  let r = placer.rng.range(0, total);
  for (const [type, w] of HOUSES) if ((r -= w) < 0) return type;
  return HOUSES[0][0];
}

/** Where a house of size (w, h) sits, one tile back from road tile (X, Y), facing it. */
function siteFacing(X: number, Y: number, rot: Rotation, w: number, h: number) {
  const center = (minor: number, size: number) => (minor + 1 - Math.floor(size / 2)) & ~1;
  switch (rot) {
    case 0: // front south: the house is north of the road
      return { mx: center(2 * X, w), my: 2 * (Y - 1) - h, door: { X, Y: Y - 1 } };
    case 180: // front north: south of the road
      return { mx: center(2 * X, w), my: 2 * (Y + 2), door: { X, Y: Y + 1 } };
    case 90: // front west: east of the road
      return { mx: 2 * (X + 2), my: center(2 * Y, h), door: { X: X + 1, Y } };
    default: // 270, front east: west of the road
      return { mx: 2 * (X - 1) - w, my: center(2 * Y, h), door: { X: X - 1, Y } };
  }
}

function farFrom(houses: House[], r: { x: number; y: number; w: number; h: number }): boolean {
  const gap = 2 * HOUSE_GAP;
  return houses.every(
    (o) =>
      r.x + r.w + gap <= o.rect.x ||
      o.rect.x + o.rect.w + gap <= r.x ||
      r.y + r.h + gap <= o.rect.y ||
      o.rect.y + o.rect.h + gap <= r.y,
  );
}

/** No road under the house. */
function offRoads(placer: Placer, r: { x: number; y: number; w: number; h: number }): boolean {
  for (let Y = r.y >> 1; Y <= (r.y + r.h - 1) >> 1; Y++)
    for (let X = r.x >> 1; X <= (r.x + r.w - 1) >> 1; X++)
      if (pathAt(placer.doc, X, Y)) return false;
  return true;
}

/** Try one house at one road tile, facing one way. */
function tryHouse(placer: Placer, road: RoadTile, rot: Rotation, houses: House[]): House | null {
  const type = weighted(placer);
  const entry = catalogEntry(placer.game.catalog, type);
  if (!entry) return null;
  const { w, h } = rotatedSize(entry, rot);
  const site = siteFacing(road.X, road.Y, rot, w, h);
  const rect = { x: site.mx, y: site.my, w, h };
  if (!farFrom(houses, rect) || !offRoads(placer, rect)) return null;
  // The garden path in front of the door needs flat, dry ground like a road (the game checks
  // nothing in front of a house, so the generator does).
  const { X, Y } = site.door;
  if (pathAt(placer.doc, X, Y) || !roadable(placer.doc, placer.profile, X, Y)) return null;
  const item = placer.item(type, site.mx, site.my, rot);
  if (!item) return null;
  setPathAt(placer.doc, site.door.X, site.door.Y, "island-garden");
  return { item, rect, door: site.door, rot };
}

/** Up to `count` houses along the roads. */
export function buildHouses(placer: Placer, roads: RoadTile[], count: number): House[] {
  const houses: House[] = [];
  const rotations: Rotation[] = [0, 180, 90, 270];
  for (const road of placer.rng.shuffle(roads)) {
    if (houses.length >= count) break;
    for (const rot of placer.rng.shuffle(rotations)) {
      const house = tryHouse(placer, road, rot, houses);
      if (house) {
        houses.push(house);
        break;
      }
    }
  }
  return houses;
}
