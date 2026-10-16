// Step 4: what makes the island lived in. Things by each house (a mailbox, pots, a bench), fenced
// gardens, the town square round the town center, lamps along the roads, and picnic spots in the
// meadows. Every piece goes through the placer, so nothing breaks a rule.

import { pathAt, type Item, type Rotation } from "../../src";
import type { House } from "./houses";
import type { Placer } from "./placer";
import type { RoadTile } from "./roads";

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Try a thing at random spots within `radius` tiles of a tile, until it fits. */
export function near(
  placer: Placer,
  type: string,
  X: number,
  Y: number,
  radius: number,
  tries = 30,
  rot?: Rotation,
): Item | null {
  for (let i = 0; i < tries; i++) {
    const mx = 2 * X + placer.rng.int(-2 * radius, 2 * radius);
    const my = 2 * Y + placer.rng.int(-2 * radius, 2 * radius);
    if (pathAt(placer.doc, mx >> 1, my >> 1)) continue;
    const placed = placer.item(type, mx, my, rot ?? placer.rng.pick(ROTATIONS));
    if (placed) return placed;
  }
  return null;
}

const HOUSE_THINGS = [
  "island-flower-barrel",
  "island-potted-fern",
  "island-planter-box",
  "island-park-bench",
  "island-pinwheel",
  "island-clay-figure",
  "island-crate-stack",
  "island-log-pile",
  "island-bird-bath",
  "island-topiary",
  "island-basket-post",
  "island-water-pump",
  "island-bin",
  "island-armchair",
  "island-sofa",
  "island-round-rug",
  "island-floor-lamp",
  "island-stool",
  "island-square-table",
  "island-coat-stand",
];

/** By each house: a mailbox at the door, then a handful of things in its yard. */
export function dressHouses(placer: Placer, houses: House[]): void {
  for (const h of houses) {
    near(placer, "island-mailbox", h.door.X, h.door.Y, 1, 20, 0);
    near(placer, "island-street-lamp", h.door.X, h.door.Y, 2, 20, 0);
    const cx = (h.rect.x + h.rect.w / 2) >> 1;
    const cy = (h.rect.y + h.rect.h / 2) >> 1;
    const reach = Math.max(h.rect.w, h.rect.h) / 4 + 3;
    for (const type of placer.rng.shuffle(HOUSE_THINGS).slice(0, placer.rng.int(5, 8))) {
      near(placer, type, cx, cy, reach);
    }
  }
}

const FENCES = ["island-picket-fence", "island-rail-fence", "island-stone-wall", "island-hedge"];
const BEDS = [
  "island-tulips",
  "island-daisies",
  "island-lavender",
  "island-roses",
  "island-sunflowers",
];

/** A fenced garden of w × h tiles at (X, Y): fence on the edge with a gap for a gate, beds inside. */
function fencedGarden(placer: Placer, X: number, Y: number, w: number, h: number): number {
  const fence = placer.rng.pick(FENCES);
  const gate = { X: X + Math.floor(w / 2), Y: Y + h - 1 };
  let placed = 0;
  for (let y = Y; y < Y + h; y++) {
    for (let x = X; x < X + w; x++) {
      const edge = x === X || y === Y || x === X + w - 1 || y === Y + h - 1;
      if (!edge || (x === gate.X && y === gate.Y)) continue;
      if (placer.item(fence, 2 * x, 2 * y, 0)) placed++;
    }
  }
  const bed = placer.rng.pick(BEDS);
  for (let y = Y + 1; y < Y + h - 1; y++) {
    for (let x = X + 1; x < X + w - 1; x++) {
      if (placer.rng.next() < 0.75) placer.plant(bed, x, y);
    }
  }
  return placed;
}

/** Fenced gardens beside some of the houses, wherever one fits. */
export function fenceGardens(placer: Placer, houses: House[], count: number): void {
  let made = 0;
  for (const h of placer.rng.shuffle(houses)) {
    if (made >= count) break;
    for (let tries = 0; tries < 12; tries++) {
      const w = placer.rng.int(5, 8);
      const d = placer.rng.int(4, 6);
      const X = (h.rect.x >> 1) + placer.rng.int(-w - 2, (h.rect.w >> 1) + 2);
      const Y = (h.rect.y >> 1) + placer.rng.int(-d - 2, (h.rect.h >> 1) + 2);
      if (!roomFor(placer, X, Y, w, d)) continue;
      if (fencedGarden(placer, X, Y, w, d) > (w + d) * 1.5) made++;
      break;
    }
  }
}

/** Whether a w × h tile rect is empty and road-free. */
function roomFor(placer: Placer, X: number, Y: number, w: number, h: number): boolean {
  for (let y = Y; y < Y + h; y++) {
    for (let x = X; x < X + w; x++) {
      if (x < 0 || y < 0 || pathAt(placer.doc, x, y)) return false;
      if (placer.taken(2 * x, 2 * y) || placer.taken(2 * x + 1, 2 * y + 1)) return false;
    }
  }
  return true;
}

const SQUARE_THINGS: [type: string, count: number][] = [
  ["island-market-stall", 5],
  ["island-park-bench", 8],
  ["island-street-lamp", 10],
  ["island-cafe-table", 4],
  ["island-wood-chair", 8],
  ["island-parasol", 3],
  ["island-bin", 4],
  ["island-notice-board", 2],
  ["island-well", 1],
  ["island-stone-statue", 2],
  ["island-signpost", 2],
  ["island-flower-barrel", 6],
  ["island-planter-box", 4],
  ["island-sundial", 1],
  ["island-long-table", 2],
  ["island-workbench", 1],
  ["island-stool", 4],
  ["island-bookshelf", 1],
  ["island-cupboard", 1],
  ["island-fireplace", 1],
  ["island-tall-clock", 1],
];

/** The town square: shops, seats and lamps in the band just outside the ring road. */
export function dressTown(placer: Placer): Item[] {
  const lm = placer.profile.landmarks[0];
  const placed: Item[] = [];
  for (const [type, count] of SQUARE_THINGS) {
    for (let n = 0; n < count; n++) {
      for (let tries = 0; tries < 40; tries++) {
        const side = placer.rng.int(0, 3);
        const t = placer.rng.range(0, 1);
        const out = placer.rng.int(3, 6);
        const X =
          side < 2
            ? Math.round(lm.x - 2 + t * (lm.w + 4))
            : side === 2
              ? lm.x - out
              : lm.x + lm.w + out - 1;
        const Y =
          side >= 2
            ? Math.round(lm.y - 2 + t * (lm.h + 4))
            : side === 0
              ? lm.y - out
              : lm.y + lm.h + out - 1;
        const item = near(placer, type, X, Y, 0, 1);
        if (item) {
          placed.push(item);
          break;
        }
      }
    }
  }
  return placed;
}

/** A lamp beside the road every few tiles. */
export function lightRoads(placer: Placer, roads: RoadTile[], every: number): void {
  roads.forEach((road, i) => {
    if (i % every !== 0) return;
    for (const [dx, dy] of placer.rng.shuffle([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)) {
      if (pathAt(placer.doc, road.X + dx, road.Y + dy)) continue;
      if (placer.item("island-street-lamp", 2 * (road.X + dx) + 1, 2 * (road.Y + dy) + 1, 0)) break;
    }
  });
}

const PICNIC = [
  "island-picnic-blanket",
  "island-campfire",
  "island-log-bench",
  "island-log-bench",
  "island-swing",
  "island-parasol",
  "island-picnic-table",
  "island-rose-arch",
];

/** Picnic spots in the open: a blanket, a fire, logs to sit on. */
export function picnicSpots(placer: Placer, count: number): void {
  for (let n = 0, tries = 0; n < count && tries < 200; tries++) {
    const X = placer.rng.int(25, 135);
    const Y = placer.rng.int(25, 120);
    const first = near(placer, PICNIC[0], X, Y, 0, 1);
    if (!first) continue;
    for (const type of PICNIC.slice(1)) near(placer, type, X, Y, 4, 25);
    n++;
  }
}
