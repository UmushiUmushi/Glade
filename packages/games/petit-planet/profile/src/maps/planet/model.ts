// Map document, as layers of a generic Doc: terrain is a grid over the terrain lattice ({h, water}
// per block, so earth never floats and water is a flag on the top block), paths a grid over the
// major lattice (path type or null), corner shapes grids over their vertices, and plants and items
// are entity layers. The accessors here are the only code that knows where each layer lives;
// apps read and write maps through them (the profile itself never changes a map).

import { rotatedSize } from "../../items";
import { onSurfacesLayer, type Host } from "../../surfaces";
import { GAME_ID, PLANET } from "../../ids";
import {
  blankDoc,
  entityLayer,
  gridLayer,
  type Doc,
  type Entity,
  type LayerSchema,
} from "@glade/core";
import { cellsInRect, gridSize, spaceOf, type Rect } from "./space";
import { defaultTerrainLevel, gridSpec, type Profile } from "./profile";
import { catalogEntry, type Catalog } from "../../catalog";

export interface TerrainCell {
  /** Integer 0..maxHeight. */
  h: number;
  /** The top block at level h is water. */
  water: boolean;
}

export interface Plant extends Entity {
  id: string;
  type: string;
  /** Major grid. */
  X: number;
  Y: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface Item extends Entity {
  id: string;
  type: string;
  /** Minor grid, top-left of the rotated footprint. */
  mx: number;
  my: number;
  rot: Rotation;
  /** Style note for finding the exact piece in game, e.g. "white wrought-iron". */
  note?: string;
}

/** A Petit Planet map: a Doc with the layers below. */
export type MapDoc = Doc;

/** Terrain cell token in files: "<h>" or "<h>~" for water. */
const TERRAIN_TOKEN = /^(\d+)(~?)$/;

/**
 * The layers of a map. Terrain starts at the profile's default levels; without a profile the
 * schema can still read and write files, but not make fresh terrain.
 */
export function layerSchema(profile?: Profile): LayerSchema {
  return {
    terrain: {
      kind: "grid",
      grid: "terrain",
      description: "heights 0..8 per terrain block, and whether its top block is water",
      initial: (x: number, y: number): TerrainCell => {
        if (!profile) throw new Error("fresh terrain needs a profile");
        return { h: defaultTerrainLevel(profile, x, y), water: false };
      },
      codec: {
        kind: "rle",
        token: (c: TerrainCell) => `${c.h}${c.water ? "~" : ""}`,
        parse: (t: string): TerrainCell => {
          const m = TERRAIN_TOKEN.exec(t);
          if (!m) throw new Error(`bad terrain token "${t}"`);
          return { h: Number(m[1]), water: m[2] === "~" };
        },
      },
    },
    paths: {
      kind: "grid",
      grid: "major",
      description: "path (floor) type per major cell, or null",
      initial: () => null,
      codec: { kind: "sparse" },
    },
    // Corner shapes live on vertices (corners.ts). The vertex where four terrain blocks meet is the
    // center of a major cell, so terrain corners sit on the major grid; the vertex where four path
    // cells meet is a major corner, which is where a terrain cell sits.
    terrainCorners: {
      kind: "grid",
      grid: "major",
      description:
        "water and cliff corner shape ('cut' or 'round') at the vertex in the middle of each " +
        "major cell (where terrain blocks X..X+1, Y..Y+1 meet), or null",
      initial: () => null,
      codec: { kind: "sparse" },
      label: "terrain corners",
      quiet: true,
      omitWhenEmpty: true,
    },
    pathCorners: {
      kind: "grid",
      grid: "terrain",
      description:
        "path corner shape ('cut' or 'round') at each major corner (where path cells " +
        "tx-1..tx, ty-1..ty meet), or null",
      initial: () => null,
      codec: { kind: "sparse" },
      label: "path corners",
      quiet: true,
      omitWhenEmpty: true,
    },
    plants: { kind: "entities", description: "plants on major cells" },
    items: { kind: "entities", description: "items on minor cells, with rotation" },
    onSurfaces: onSurfacesLayer,
  };
}

export function newMap(profile: Profile, name: string, now = new Date()): MapDoc {
  return blankDoc(
    { game: GAME_ID, map: PLANET },
    spaceOf(gridSpec(profile)),
    layerSchema(profile),
    name,
    now,
  );
}

export function cloneMap(map: MapDoc): MapDoc {
  return structuredClone(map);
}

// ---- accessors ----

export function terrainGrid(map: MapDoc): TerrainCell[][] {
  return gridLayer<TerrainCell>(map, "terrain").cells;
}

export function terrainAt(map: MapDoc, tx: number, ty: number): TerrainCell | undefined {
  return terrainGrid(map)[ty]?.[tx];
}

/** Replace one terrain block. */
export function setTerrain(map: MapDoc, tx: number, ty: number, cell: TerrainCell): void {
  terrainGrid(map)[ty][tx] = cell;
}

export function pathGrid(map: MapDoc): (string | null)[][] {
  return gridLayer<string | null>(map, "paths").cells;
}

export function pathAt(map: MapDoc, X: number, Y: number): string | undefined {
  return pathGrid(map)[Y]?.[X] ?? undefined;
}

/** Set or clear (null) a path cell; off-map cells are ignored. */
export function setPathAt(map: MapDoc, X: number, Y: number, type: string | null): void {
  const row = pathGrid(map)[Y];
  if (row && X >= 0 && X < row.length) row[X] = type;
}

/** Every path cell, in row order. */
export function pathCells(map: MapDoc): { X: number; Y: number; type: string }[] {
  const out: { X: number; Y: number; type: string }[] = [];
  pathGrid(map).forEach((row, Y) =>
    row.forEach((type, X) => {
      if (type) out.push({ X, Y, type });
    }),
  );
  return out;
}

export type CornerShape = "cut" | "round";
export type CornerLayer = "terrainCorners" | "pathCorners";

/** A corner layer's cells; maps from before corner shapes read as all square. */
export function cornerGrid(map: MapDoc, layer: CornerLayer): (CornerShape | null)[][] | null {
  return map.layers[layer] ? gridLayer<CornerShape | null>(map, layer).cells : null;
}

/** Shape at a vertex (see corners.ts for where each layer's vertices are), or undefined. */
export function cornerAt(
  map: MapDoc,
  layer: CornerLayer,
  x: number,
  y: number,
): CornerShape | undefined {
  return cornerGrid(map, layer)?.[y]?.[x] ?? undefined;
}

/** Set or clear (null) a vertex's shape; off-grid vertices are ignored. */
export function setCornerAt(
  map: MapDoc,
  layer: CornerLayer,
  x: number,
  y: number,
  shape: CornerShape | null,
): void {
  const row = cornerGrid(map, layer)?.[y];
  if (row && x >= 0 && x < row.length) row[x] = shape;
}

/** Every shaped vertex of a layer, in row order. */
export function cornerCells(
  map: MapDoc,
  layer: CornerLayer,
): { x: number; y: number; shape: CornerShape }[] {
  const out: { x: number; y: number; shape: CornerShape }[] = [];
  cornerGrid(map, layer)?.forEach((row, y) =>
    row.forEach((shape, x) => {
      if (shape) out.push({ x, y, shape });
    }),
  );
  return out;
}

export function plantsOf(map: MapDoc): Plant[] {
  return Object.values(entityLayer<Plant>(map, "plants").items);
}

export function itemsOf(map: MapDoc): Item[] {
  return Object.values(entityLayer<Item>(map, "items").items);
}

export function plantById(map: MapDoc, id: string): Plant | undefined {
  return entityLayer<Plant>(map, "plants").items[id];
}

export function itemById(map: MapDoc, id: string): Item | undefined {
  return entityLayer<Item>(map, "items").items[id];
}

/** Add or replace a plant. */
export function putPlant(map: MapDoc, plant: Plant): void {
  entityLayer<Plant>(map, "plants").items[plant.id] = plant;
}

/** Add or replace an item. */
export function putItem(map: MapDoc, item: Item): void {
  entityLayer<Item>(map, "items").items[item.id] = item;
}

/** Remove plants and items by id; returns the ids that existed. */
export function removeObjects(map: MapDoc, ids: Iterable<string>): string[] {
  const plants = entityLayer<Plant>(map, "plants").items;
  const items = entityLayer<Item>(map, "items").items;
  const found: string[] = [];
  for (const id of ids) {
    if (plants[id] || items[id]) found.push(id);
    delete plants[id];
    delete items[id];
  }
  return found;
}

/** Terrain grid dimensions of a map, as [w, h]. */
export function terrainSize(map: MapDoc): { w: number; h: number } {
  const t = terrainGrid(map);
  return { w: t[0]?.length ?? 0, h: t.length };
}

/** The map's size check against a profile's grids. */
export function fitsProfile(map: MapDoc, profile: Profile): boolean {
  const { w, h } = gridSize(gridSpec(profile), "terrain");
  const t = terrainSize(map);
  return t.w === w && t.h === h;
}

// ---- catalog and footprints ----

/** Minor-grid rect an item occupies. Unknown types get a 1x1 footprint. */
export function itemRect(catalog: Catalog, item: Item): Rect {
  const entry = catalogEntry(catalog, item.type);
  const { w, h } = entry ? rotatedSize(entry, item.rot) : { w: 1, h: 1 };
  return { grid: "minor", x: item.mx, y: item.my, w, h };
}

/** Minor-grid rect a plant occupies (one major cell). */
export function plantRect(plant: Plant): Rect {
  return { grid: "minor", x: 2 * plant.X, y: 2 * plant.Y, w: 2, h: 2 };
}

export { compareIds } from "@glade/core";

/** Terrain rect under a major cell (its four corners). */
export function terrainOfMajor(X: number, Y: number): Rect {
  return { grid: "terrain", x: X, y: Y, w: 2, h: 2 };
}

/** Why a terrain rect is not flat, dry ground; null when it is. */
export function notFlatEarth(map: MapDoc, terrain: Rect): string | null {
  const heights = new Set<number>();
  for (const c of cellsInRect(terrain)) {
    const cell = terrainAt(map, c.x, c.y);
    if (!cell) return "off the map";
    if (cell.water) return `water at terrain ${c.x},${c.y}`;
    heights.add(cell.h);
  }
  return heights.size > 1 ? `uneven ground (heights ${[...heights].sort().join(", ")})` : null;
}

/** Items on the map that things on surfaces can stand on, by id (surfaces/). */
export function surfaceHosts(map: MapDoc, catalog: Catalog): Map<string, Host> {
  const out = new Map<string, Host>();
  for (const i of itemsOf(map))
    out.set(i.id, { type: i.type, rect: itemRect(catalog, i), rot: i.rot });
  return out;
}
