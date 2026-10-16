// The placer: the one way the island generator adds things. It checks a quick list first (on the
// map, flat dry ground, nothing there yet), then puts the thing down and asks the profile's own
// rules about the area around it. Anything that breaks a rule is taken back out, so the island
// stays free of problems the whole way through.

import { validate, type Rule } from "@glade/core";
import {
  baseOf,
  catalogEntry,
  convertRect,
  gridSpec,
  itemRect,
  notFlatEarth,
  placementBlocked,
  putItem,
  putPlant,
  removeObjects,
  type Item,
  type MapDoc,
  type Planet,
  type Plant,
  type Profile,
  type Rotation,
} from "../../src";
import type { Rng } from "./rng";

export interface Placer {
  doc: MapDoc;
  game: Planet;
  profile: Profile;
  rng: Rng;
  /** Put an item down, or null when it can't go there. */
  item(type: string, mx: number, my: number, rot?: Rotation): Item | null;
  /** Put a plant on a tile, or null when it can't go there. */
  plant(type: string, X: number, Y: number): Plant | null;
  /** Stand a placeable thing on an item's surface, at half cells (x, y) of its grid. */
  onSurface(type: string, host: Item, x: number, y: number): boolean;
  /** Whether a minor cell already holds something. */
  taken(mx: number, my: number): boolean;
}

const MINOR_W = 320;
const MINOR_H = 288;

export function createPlacer(doc: MapDoc, game: Planet, profile: Profile, rng: Rng): Placer {
  const spec = gridSpec(profile);
  const local: Rule[] = game.rules.filter((r) => r.local);
  /** The surface rules (S1 to S3) look at the whole map; they are cheap. */
  const surfaceRules: Rule[] = game.rules.filter((r) => /^S\d$/.test(r.id));
  const taken = new Uint8Array(MINOR_W * MINOR_H);
  let ids = 0;
  const nextId = (prefix: string) => `${prefix}${++ids}`;

  const inMap = (r: { x: number; y: number; w: number; h: number }) =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= MINOR_W && r.y + r.h <= MINOR_H;

  function free(r: { x: number; y: number; w: number; h: number }): boolean {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if (taken[y * MINOR_W + x]) return false;
    return true;
  }

  function mark(r: { x: number; y: number; w: number; h: number }): void {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) taken[y * MINOR_W + x] = 1;
  }

  /** Off the beach and the landmarks, on every tile the rect touches. */
  function placeable(r: { x: number; y: number; w: number; h: number }): boolean {
    for (let y = r.y >> 1; y <= (r.y + r.h - 1) >> 1; y++)
      for (let x = r.x >> 1; x <= (r.x + r.w - 1) >> 1; x++)
        if (placementBlocked(profile, x, y)) return false;
    return true;
  }

  /** The profile's local rules around a rect: true when nothing is wrong there. */
  function clean(r: { x: number; y: number; w: number; h: number }): boolean {
    return validate(doc, game, { region: { grid: "minor", ...r }, rules: local }).length === 0;
  }

  return {
    doc,
    game,
    profile,
    rng,
    taken: (mx, my) => taken[my * MINOR_W + mx] === 1,
    item(type, mx, my, rot = 0) {
      const entry = catalogEntry(game.catalog, type);
      if (!entry) return null;
      const placed: Item = { id: nextId("i"), type, mx, my, rot };
      const rect = itemRect(game.catalog, placed);
      if (!inMap(rect) || !free(rect) || !placeable(rect)) return null;
      const base = baseOf(game.catalog, type);
      const ground = convertRect(spec, rect, "terrain");
      if (base === "item" && !entry.onWater && notFlatEarth(doc, ground)) return null;
      putItem(doc, placed);
      if (!clean(rect)) {
        removeObjects(doc, [placed.id]);
        return null;
      }
      mark(rect);
      return placed;
    },
    plant(type, X, Y) {
      const rect = { x: 2 * X, y: 2 * Y, w: 2, h: 2 };
      if (!inMap(rect) || !free(rect) || !placeable(rect)) return null;
      if (notFlatEarth(doc, { grid: "terrain", x: X, y: Y, w: 2, h: 2 })) return null;
      const placed: Plant = { id: nextId("p"), type, X, Y };
      putPlant(doc, placed);
      if (!clean(rect)) {
        removeObjects(doc, [placed.id]);
        return null;
      }
      mark(rect);
      return placed;
    },
    onSurface(type, host, x, y) {
      const layer = doc.layers.onSurfaces as { items: Record<string, unknown> } | undefined;
      if (!layer) return false;
      const id = nextId("s");
      layer.items[id] = { id, type, on: host.id, x, y, rot: 0 };
      const region = itemRect(game.catalog, host);
      const wrong =
        validate(doc, game, { region, rules: local }).length +
        validate(doc, game, { rules: surfaceRules }).length;
      if (wrong) {
        delete layer.items[id];
        return false;
      }
      return true;
    },
  };
}
