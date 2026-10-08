// Homes: the inside of a house, a map made from a layout (layout.ts). homeMap(layout) gives the
// map for any layout; the game lists its homes by layout id (interior_home_1_10: one room, 10 x 10).
// A home takes furniture on its floors, walls and ceilings, wallpaper and flooring, and things on
// surfaces; no plants, paths, bridges, inclines or buildings. It is seen in plan and in 3D, in one
// fixed look. Browser-safe: viewers import it too.

import { MapFormatError, type Entity } from "@glade/core";
import type { RenderableMap, Style as CoreStyle } from "@glade/render";
import type { Catalog } from "../../catalog";
import { GAME_ID } from "../../ids";
import { entryProblems, kinds } from "../../kinds";
import { coveringCells, onSurfaceBox, ON_SURFACES, type OnSurface } from "../../surfaces";
import styleJson from "../../../look/home.json" with { type: "json" };
import { layoutProblems, type HomeLayout } from "./layout";
import home10 from "./layouts/interior_home_1_10.json" with { type: "json" };
import home8 from "./layouts/interior_home_1_8.json" with { type: "json" };
import {
  homeHosts,
  homeLayers,
  homeSpace,
  newHome,
  planeRect,
  type FloorItem,
  type WallItem,
} from "./model";
import { homeViews2D } from "./render2d";
import { homeScene } from "./render3d";
import { homeRules, HomePlane } from "./rules";
import { homeStyleSchema } from "./style";

export type { HomeLayout } from "./layout";

/** The homes the game knows, by layout. */
export const HOME_LAYOUTS: HomeLayout[] = [home10 as HomeLayout, home8 as HomeLayout];

/** Where the homes' look lives on disk, for tools that edit it (a file: URL). */
export const homeLookFile = new URL("../../../look/home.json", import.meta.url).href;

/** A home map for a layout. Throws on a layout that does not hold together (layoutProblems). */
export function homeMap(layout: HomeLayout): RenderableMap {
  const problems = layoutProblems(layout);
  if (problems.length) throw new Error(`layout ${layout.id}: ${problems.join("; ")}`);
  const plane = new HomePlane(layout);
  const { ui, plan } = homeViews2D(layout);
  const map: RenderableMap = {
    game: GAME_ID,
    id: layout.id,
    title: layout.title,
    space: homeSpace(layout),
    layers: homeLayers,
    selectionGrid: "major",
    validation: { grid: "minor", margin: 1 },
    kinds,
    // Homes take furniture, wallpaper and flooring: nothing that grows or is built outdoors.
    excludes: [
      { kind: "plant" },
      { kind: "path" },
      { kind: "bridge" },
      { kind: "incline" },
      { kind: "building" },
    ],
    entryProblems: (entry, catalog) => entryProblems(map, entry, { catalog }),
    rules: homeRules(layout),
    rulebook: () => map.rules.map((r) => ({ id: r.id, name: r.name, description: r.description })),
    newDoc: (name, _opts, now) => newHome(layout, name, now),
    migrate(raw) {
      throw new MapFormatError(`homes have no version ${String(raw.version)}`);
    },
    locate(game, doc, layer, at) {
      const catalog = game.catalog as Catalog;
      if (Array.isArray(at)) return [];
      const e = at as Entity;
      if (layer === "items" || layer === "ceilingItems") {
        return [{ grid: "minor", ...planeRect(catalog, e as FloorItem) }];
      }
      if (layer === "wallItems") {
        const c = plane.wallItemCells(catalog, e as WallItem);
        return c ? [{ grid: "minor", ...c }] : [];
      }
      if (layer === "coverings") {
        const r = plane.room(String(e.room));
        return r ? [{ grid: "minor", ...plane.floor(r) }] : [];
      }
      if (layer === ON_SURFACES) {
        const host = homeHosts(doc, catalog).get((e as OnSurface).on);
        const b = host && onSurfaceBox(catalog, host, e as OnSurface);
        return b ? [{ grid: "minor", ...coveringCells(b) }] : [];
      }
      return [];
    },
    rect: (r) => ({ grid: r.grid, x: r.x, y: r.y, w: r.w ?? 1, h: r.h ?? 1 }),
    style: { schema: homeStyleSchema, defaults: styleJson as unknown as CoreStyle },
    ui,
    views: { plan, scene: homeScene(layout) },
  };
  return map;
}
