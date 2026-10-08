// Old map formats to the current one.
//
// migrateV1: a version-1 map file (phase 1 and 2: terrain rows, a "X,Y" -> type path record,
// plant/item arrays) becomes a current Doc with the same content.
//
// fitToProfile: a map made for older profile geometry is fitted to the current profile: same
// origin, new size. Terrain inside the current land is kept; everything outside it becomes the
// profile default (beach). Paths, plants, and items that end up off the map or on beach are
// dropped and listed.

import { sortedItems, type Entity } from "@glade/core";
import { GAME_ID, PLANET } from "../../ids";
import { onSurfaces } from "../../surfaces";
import { cellsInRect, gridSize, inGrid, parseCellKey } from "./space";
import {
  cornerCells,
  itemRect,
  itemsOf,
  newMap,
  pathCells,
  plantsOf,
  setCornerAt,
  terrainGrid,
  type Item,
  type MapDoc,
  type Plant,
  type TerrainCell,
} from "./model";
import { gridSpec, isBeachMajor, isLandTerrain, type Profile } from "./profile";
import { type Catalog } from "../../catalog";
import { decodeTerrainRow, MapFormatError } from "./rle";

/** A version-1 map file's parsed JSON as a current Doc. Path keys off the grid are dropped. */
export function migrateV1(raw: Record<string, unknown>): MapDoc {
  let terrain: TerrainCell[][];
  const t = raw.terrain as { encoding?: string; rows?: string[] } | TerrainCell[][] | undefined;
  if (Array.isArray(t)) {
    terrain = t.map((row) => row.map((c) => ({ h: c.h, water: !!c.water })));
  } else if (t && t.encoding === "rle" && Array.isArray(t.rows)) {
    terrain = t.rows.map(decodeTerrainRow);
  } else {
    throw new MapFormatError("missing terrain");
  }
  if (!terrain.length || terrain.some((r) => r.length !== terrain[0].length)) {
    throw new MapFormatError("terrain rows must be non-empty and equal length");
  }
  const [W, H] = [terrain[0].length - 1, terrain.length - 1];
  const paths: (string | null)[][] = Array.from({ length: H }, () => new Array(W).fill(null));
  for (const [key, type] of Object.entries((raw.paths ?? {}) as Record<string, string>)) {
    const xy = parseCellKey(key);
    if (xy && xy.x >= 0 && xy.y >= 0 && xy.x < W && xy.y < H) paths[xy.y][xy.x] = type;
  }
  const byId = <E extends Entity>(list: E[]) =>
    sortedItems(Object.fromEntries(list.map((e) => [e.id, { ...e }])));
  const meta = (raw.meta ?? {}) as { created?: string; updated?: string; notes?: string };
  return {
    version: 3,
    game: String(raw.profile ?? GAME_ID),
    map: PLANET,
    name: String(raw.name),
    layers: {
      terrain: { kind: "grid", grid: "terrain", cells: terrain },
      paths: { kind: "grid", grid: "major", cells: paths },
      terrainCorners: { kind: "grid", grid: "major", cells: blank(W, H) },
      pathCorners: { kind: "grid", grid: "terrain", cells: blank(W + 1, H + 1) },
      plants: { kind: "entities", items: byId((raw.plants ?? []) as Plant[]) },
      items: { kind: "entities", items: byId((raw.items ?? []) as Item[]) },
      onSurfaces: { kind: "entities", items: {} },
    },
    meta: {
      created: meta.created ?? "",
      updated: meta.updated ?? "",
      ...(meta.notes !== undefined ? { notes: meta.notes } : {}),
    },
  };
}

const blank = (w: number, h: number) =>
  Array.from({ length: h }, () => new Array<null>(w).fill(null));

export interface FitResult {
  map: MapDoc;
  /** Human-readable list of what was dropped. */
  dropped: string[];
  /** Terrain cells outside the new land that were not already at the default. */
  terrainReset: number;
}

export function fitToProfile(old: MapDoc, profile: Profile, catalog: Catalog): FitResult {
  const spec = gridSpec(profile);
  const fresh = newMap(profile, old.name);
  const freshTerrain = terrainGrid(fresh);
  const oldTerrain = terrainGrid(old);
  const { w, h } = gridSize(spec, "terrain");
  let terrainReset = 0;
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const was = oldTerrain[ty]?.[tx];
      if (!was) continue;
      if (isLandTerrain(profile, tx, ty)) freshTerrain[ty][tx] = { ...was };
      else if (was.h !== freshTerrain[ty][tx].h || was.water) terrainReset++;
    }
  }
  // Rows or columns beyond the new edge count as reset if they held anything but beach.
  for (let ty = 0; ty < oldTerrain.length; ty++) {
    for (let tx = 0; tx < oldTerrain[ty].length; tx++) {
      if (ty < h && tx < w) continue;
      const was = oldTerrain[ty][tx];
      if (was.h !== profile.beach.level || was.water) terrainReset++;
    }
  }

  const dropped: string[] = [];
  const onMap = (X: number, Y: number) =>
    inGrid(spec, "major", X, Y) && !isBeachMajor(profile, X, Y);
  const freshPaths = fresh.layers.paths;
  if (freshPaths.kind !== "grid") throw new Error("paths must be a grid");
  for (const { X, Y, type } of pathCells(old)) {
    if (onMap(X, Y)) freshPaths.cells[Y][X] = type;
    else dropped.push(`path ${X},${Y} (${type})`);
  }
  for (const layer of ["terrainCorners", "pathCorners"] as const) {
    for (const { x, y, shape } of cornerCells(old, layer)) setCornerAt(fresh, layer, x, y, shape);
  }
  const plants = plantsOf(old).filter((p) => {
    const ok = onMap(p.X, p.Y);
    if (!ok) dropped.push(`plant ${p.id} (${p.type}) at major ${p.X},${p.Y}`);
    return ok;
  });
  const cat = catalog;
  const items = itemsOf(old).filter((i) => {
    const majors = [...cellsInRect({ ...itemRect(cat, i), grid: "minor" })].map((c) => [
      Math.floor(c.x / 2),
      Math.floor(c.y / 2),
    ]);
    const ok = majors.every(([X, Y]) => onMap(X, Y));
    if (!ok) dropped.push(`item ${i.id} (${i.type}) at minor ${i.mx},${i.my}`);
    return ok;
  });
  // Things on surfaces go with the items they stand on.
  const kept = new Set(items.map((i) => i.id));
  const onTop = onSurfaces(old).filter((t) => {
    if (!kept.has(t.on)) dropped.push(`${t.type} ${t.id} on ${t.on}, which was dropped`);
    return kept.has(t.on);
  });
  const entities = <E extends Entity>(list: E[]) =>
    sortedItems(Object.fromEntries(list.map((e) => [e.id, structuredClone(e)])));
  return {
    map: {
      ...fresh,
      layers: {
        ...fresh.layers,
        plants: { kind: "entities", items: entities(plants) },
        items: { kind: "entities", items: entities(items) },
        onSurfaces: { kind: "entities", items: entities(onTop) },
      },
      meta: { ...old.meta },
    },
    dropped,
    terrainReset,
  };
}
