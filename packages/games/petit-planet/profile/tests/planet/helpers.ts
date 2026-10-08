// Fixture builders. Fixtures are candidate map states handed to the validator, the same thing a
// transaction validates before committing, so building them directly is fine here.

import {
  itemsOf,
  newMap,
  pathAt,
  pathCells,
  plantsOf,
  putItem,
  putPlant,
  setPathAt,
  terrainGrid,
  type Item,
  type MapDoc,
  type Plant,
  type Rotation,
  type TerrainCell,
} from "../../src/maps/planet/model";
import { bind } from "@glade/core";
import { planet, profile } from "../../src";
import { testCatalog } from "../../samples";

/** Petit Planet bound to the test items (samples/catalogs/test.ts). */
export const game = bind(planet, testCatalog);
export const catalog = testCatalog;

export { profile };

export function blankMap(name = "test"): MapDoc {
  return newMap(profile, name, new Date("2026-09-27T00:00:00.000Z"));
}

/**
 * Stamp terrain with its top-left at (tx, ty). Each row is a string of height digits; a `~`
 * after a digit makes that cell water. `.` leaves a cell unchanged.
 *   stamp(map, 50, 50, ["333", "3~3~3", "222"])
 */
export function stamp(map: MapDoc, tx: number, ty: number, rows: string[]): MapDoc {
  const t = terrainGrid(map);
  rows.forEach((row, dy) => {
    let dx = 0;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") {
        dx++;
        continue;
      }
      if (!/\d/.test(ch)) throw new Error(`bad stamp char ${ch}`);
      const water = row[i + 1] === "~";
      if (water) i++;
      t[ty + dy][tx + dx] = { h: Number(ch), water };
      dx++;
    }
  });
  return map;
}

/** Fill a terrain rect (inclusive of x..x+w-1) with one height. */
export function fillTerrain(
  map: MapDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  level: number,
  water = false,
): MapDoc {
  const t = terrainGrid(map);
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) t[ty][tx] = { h: level, water };
  }
  return map;
}

/** The terrain block at (tx, ty). */
export function T(map: MapDoc, tx: number, ty: number): TerrainCell {
  return terrainGrid(map)[ty][tx];
}

/** Add plants to a fixture. */
export function addPlants(map: MapDoc, ...plants: Plant[]): MapDoc {
  for (const p of plants) putPlant(map, p);
  return map;
}

/** Add items to a fixture. */
export function addItems(map: MapDoc, ...items: Item[]): MapDoc {
  for (const i of items) putItem(map, i);
  return map;
}

/** Set path cells from a {"X,Y": type} record. */
export function addPaths(map: MapDoc, paths: Record<string, string>): MapDoc {
  for (const [key, type] of Object.entries(paths)) {
    const [X, Y] = key.split(",").map(Number);
    setPathAt(map, X, Y, type);
  }
  return map;
}

export { pathAt };

let seq = 0;

export function plant(type: string, X: number, Y: number): Plant {
  return { id: `p${++seq}`, type, X, Y };
}

export function item(type: string, mx: number, my: number, rot: Rotation = 0): Item {
  return { id: `i${++seq}`, type, mx, my, rot };
}

/** Path cells as the original {"X,Y": type} record, for assertions. */
export function pathsRecord(map: MapDoc): Record<string, string> {
  return Object.fromEntries(pathCells(map).map((p) => [`${p.X},${p.Y}`, p.type]));
}

export { itemsOf, plantsOf, setPathAt, terrainGrid };
