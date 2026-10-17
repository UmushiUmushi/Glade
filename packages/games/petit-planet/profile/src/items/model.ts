// The item formula, in 3D: how one catalog entry looks on its own, with no map around it. Every map
// of the game draws its plants and items through it, then adds what its own surroundings do (snow,
// grass at their feet, links between fence pieces). Model space is tiles across and blocks up.

import { entryOf, type Bound, type Entity } from "@glade/core";
import {
  flattenModel,
  leafBounds,
  type Model,
  type ModelPart,
  type RenderableMap,
} from "@glade/render";
import { baseOf, catalogEntry, isA, type Catalog, type CatalogEntry } from "../catalog";

/** Tiles per block: how tall a block is next to a tile, for parts turned in true proportions. */
export const BLOCK_TILES = 0.825;

/** The side a building's front faces: south at rotation 0, turning clockwise with rotation. */
export function frontSide(rot: number): "south" | "west" | "north" | "east" {
  return rot === 90 ? "west" : rot === 180 ? "north" : rot === 270 ? "east" : "south";
}

/**
 * The model an entry renders with: its own, or a plain block of its size. An item whose type is not
 * in the catalog gets a small grey stub, so it shows without pretending to be anything.
 */
function standIn(entry: CatalogEntry | undefined): Model {
  if (entry?.model) return entry.model;
  const w = (entry?.footprint.w ?? 1) / 2;
  const d = (entry?.footprint.h ?? 1) / 2;
  const color = entry ? "#8a633f" : "#9a9a9a";
  return {
    parts: [{ shape: "box", at: [w / 2, 0, d / 2], size: [w * 0.9, 0.5, d * 0.9], color }],
  };
}

/** A dark door on the front (south at rot 0) of a building's lowest wall, in model space. */
export function doorPart(model: Model, w: number): ModelPart | null {
  // Model units: with a block one tile tall, true space is model space.
  const walls = flattenModel(model)
    .map((leaf) => leafBounds(leaf))
    .filter((b) => b.y0 < 0.05);
  if (!walls.length) return null;
  let front = walls[0];
  for (const b of walls) if (b.z1 > front.z1) front = b;
  const width = Math.min(0.6, (front.x1 - front.x0) / 2);
  const height = Math.min(1.1, (front.y1 - front.y0) * 0.7);
  const x = Math.min(Math.max((front.x0 + front.x1) / 2, width / 2), w - width / 2);
  return {
    shape: "box",
    at: [x, 0, front.z1 + 0.03],
    size: [width, height, 0.06],
    color: "#3b2a1c",
  };
}

/**
 * An incline's default look at rotation 0 (high end north, z = 0): four steps across its width
 * `w` (tiles), each half a tile deep, climbing `rise` blocks to the cliff top.
 */
export function inclineModel(w: number, rise: number, color = "#b8a888"): Model {
  return {
    parts: [0, 1, 2, 3].map((k) => ({
      shape: "box" as const,
      at: [w / 2, 0, 2 - 0.25 - 0.5 * k] as [number, number, number],
      size: [w, (rise * (k + 1)) / 4, 0.5] as [number, number, number],
      color,
    })),
  };
}

/**
 * How the catalog entry named `type` looks: its own model (or `model` in its place, e.g. an app's
 * model for one of its states), a plain block of its size when it has none, or a small grey stub
 * for a type the catalog lacks. An incline without a model is four steps climbing `rise` blocks
 * (default 1); a building gets a door on its front.
 */
export function itemModel(
  catalog: Catalog,
  type: string,
  opts: { model?: Model; rise?: number } = {},
): Model {
  const e = catalogEntry(catalog, type);
  const own = opts.model ?? e?.model;
  const w = (e?.footprint.w ?? 1) / 2;
  if (!own && e && baseOf(catalog, type) === "incline") return inclineModel(w, opts.rise ?? 1);
  const model = own ?? standIn(e);
  const door = isA(catalog, type, "building") ? doorPart(model, w) : null;
  return door ? { parts: [...model.parts, door] } : model;
}

/** A catalog entry's footprint in tiles, at rotation 0. */
export function itemSize(entry: CatalogEntry | undefined): { w: number; d: number } {
  return { w: (entry?.footprint.w ?? 1) / 2, d: (entry?.footprint.h ?? 1) / 2 };
}

/** The app's model for a placed thing (RenderableMap.itemModel), if it gives one. */
export function appModel(map: Bound<RenderableMap>, thing: Entity): Model | undefined {
  return map.itemModel?.(thing, entryOf(map, thing.type));
}

/** Footprint size in minor cells after rotation. */
export function rotatedSize(entry: CatalogEntry, rot: number): { w: number; h: number } {
  const { w, h } = entry.footprint;
  return rot === 90 || rot === 270 ? { w: h, h: w } : { w, h };
}
