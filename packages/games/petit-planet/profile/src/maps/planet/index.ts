// The planet: the island of 10 x 9 areas, with a heightmap, water, paths, plants and items. Its map
// definition (grids, layers, base map, rules, file format) and its look (2D and 3D). Browser-safe:
// viewers import it too.

import type { Entity } from "@glade/core";
import type { RenderableMap, Style as CoreStyle } from "@glade/render";
import type { Catalog } from "../../catalog";
import { GAME_ID, PLANET } from "../../ids";
import { entryProblems, kinds } from "../../kinds";
import { coveringCells, onSurfaceBox, ON_SURFACES, type OnSurface } from "../../surfaces";
import { vertexCells } from "./corners";
import { params, profile } from "./data";
import { fitToProfile, migrateV1 } from "./migrate";
import {
  fitsProfile,
  itemRect,
  layerSchema,
  newMap,
  plantRect,
  surfaceHosts,
  terrainSize,
  type Item,
  type MapDoc,
  type Plant,
} from "./model";
import { gridSpec, type Planet } from "./profile";
import { plan, ui } from "./render2d";
import { render3d } from "./render3d";
import { decodeMap, MapFormatError } from "./rle";
import { rules, rulesDoc } from "./rules";
import { normRect, spaceOf, toMinorRect, type Rect } from "./space";
import styleJson from "../../../look/planet.json" with { type: "json" };
import { styleSchema } from "./style";

/** Where the look lives on disk, for tools that edit it (a file: URL). */
export const lookFile = new URL("../../../look/planet.json", import.meta.url).href;

const spec = gridSpec(profile);
const space = spaceOf(spec);

/** The planet as exported: a RenderableMap with typed params, and no catalog. */
export type PlanetMap = Omit<Planet, "catalog"> & RenderableMap;

/**
 * Minor-grid rects of where something the map holds sits: a terrain block, a path cell, the four
 * cells around a corner vertex, a plant's or item's footprint (item sizes come from the catalog),
 * or the cells under a thing on a surface (where its item is in `doc`).
 */
export function locate(
  game: Planet,
  doc: MapDoc,
  layer: string,
  at: [number, number] | Entity,
): Rect[] {
  if (Array.isArray(at)) {
    const [x, y] = at;
    if (layer === "terrain") return [toMinorRect(spec, { grid: "terrain", x, y, w: 1, h: 1 })];
    if (layer === "paths") return [{ grid: "minor", x: 2 * x, y: 2 * y, w: 2, h: 2 }];
    if (layer === "terrainCorners" || layer === "pathCorners") {
      // A vertex touches the four cells around it.
      const [a] = vertexCells(layer, x, y);
      const grid = layer === "terrainCorners" ? "terrain" : "major";
      return [toMinorRect(spec, { grid, x: a.x, y: a.y, w: 2, h: 2 })];
    }
    return [];
  }
  if (layer === "plants") return [plantRect(at as Plant)];
  if (layer === "items") return [itemRect(game.catalog, at as Item)];
  if (layer === ON_SURFACES) {
    const host = surfaceHosts(doc, game.catalog).get((at as OnSurface).on);
    const b = host && onSurfaceBox(game.catalog, host, at as OnSurface);
    return b ? [{ grid: "minor", ...coveringCells(b) }] : [];
  }
  return [];
}

function migrate(raw: Record<string, unknown>, opts: { refit?: boolean; catalog?: Catalog } = {}) {
  const notes: string[] = [];
  let doc: MapDoc = raw.version === 1 ? migrateV1(raw) : decodeMap(raw as never);
  if (raw.version === 1) notes.push("migrated from version 1");
  if (!fitsProfile(doc, profile)) {
    const t = terrainSize(doc);
    const want = space.grids.terrain.size;
    if (!opts.refit) {
      throw new MapFormatError(`terrain is ${t.w}x${t.h}, profile expects ${want[0]}x${want[1]}`);
    }
    const fit = fitToProfile(doc, profile, opts.catalog ?? { entries: [] });
    doc = fit.map;
    notes.push(
      `terrain ${t.w}x${t.h} -> ${want[0]}x${want[1]}`,
      `terrain cells reset to beach: ${fit.terrainReset}`,
      fit.dropped.length ? `dropped:\n  ${fit.dropped.join("\n  ")}` : "dropped: nothing",
    );
  }
  return { doc, notes };
}

export const planet: PlanetMap = {
  game: GAME_ID,
  id: PLANET,
  title: "Planet",
  space,
  layers: layerSchema(profile),
  selectionGrid: "major",
  validation: { grid: "terrain", margin: 2 },
  params: structuredClone(params),
  kinds,
  // Wall and ceiling items, wallpaper and flooring belong in homes.
  excludes: [
    { kind: "wallpaper" },
    { kind: "flooring" },
    { field: "mount", value: "wall" },
    { field: "mount", value: "ceiling" },
  ],
  entryProblems: (entry, catalog) => entryProblems(planet, entry, { catalog }),
  rules,
  rulebook: rulesDoc,
  newDoc: (name, _opts, now) => newMap(profile, name, now),
  migrate,
  locate: (game, doc, layer, at) => locate(game as Planet, doc, layer, at),
  rect: (input) => normRect(profile, input),
  style: { schema: styleSchema, defaults: styleJson as unknown as CoreStyle },
  ui,
  views: { plan, scene: render3d },
};
