// A home's document: what stands on its floors (items, on half tiles of the home's plane, turned),
// hangs on its walls (wall items, in half cells of a wall's grid: across from the left as seen
// from inside, and up from the floor), and hangs from its ceilings (ceiling items, on the plane
// like the floor); each room's coverings (one wallpaper and one flooring at most); and things on
// surfaces (surfaces/). The accessors here are the only code that knows where each layer lives.

import {
  blankDoc,
  entities,
  entityLayer,
  type Doc,
  type Entity,
  type LayerSchema,
  type Space,
} from "@glade/core";
import { catalogEntry, type Catalog } from "../../catalog";
import { GAME_ID } from "../../ids";
import { rotatedSize } from "../../items";
import { onSurfacesLayer, type Host, type Turn } from "../../surfaces";
import { layoutBounds, wallLength, type HomeLayout, type Room, type Side } from "./layout";

export type HomeDoc = Doc;

/** An item on a floor: top-left of its turned footprint in half tiles of the home's plane. */
export interface FloorItem extends Entity {
  id: string;
  type: string;
  mx: number;
  my: number;
  rot: Turn;
}

/** An item on a wall: its footprint's bottom-left in half cells of the wall's grid. */
export interface WallItem extends Entity {
  id: string;
  type: string;
  room: string;
  wall: Side;
  /** Half tiles across from the left, as seen from inside. */
  x: number;
  /** Half blocks up from the floor. */
  y: number;
}

/** An item hanging from a ceiling: top-left of its turned footprint, on the plane like the floor. */
export type CeilingItem = FloorItem;

/** A room's wallpaper or flooring. */
export interface Covering extends Entity {
  id: string;
  type: string;
  room: string;
}

/** A rect of half tiles on the home's plane. */
export interface Half {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The home's plane in tiles (major) and half tiles (minor), the box around its rooms. */
export function homeSpace(layout: HomeLayout): Space {
  const b = layoutBounds(layout);
  return {
    unit: "tile",
    bounds: { x: b.x, y: b.y, w: b.w, h: b.h },
    grids: {
      major: { cell: [1, 1], origin: [b.x, b.y], size: [b.w, b.h], abbr: "M" },
      minor: { cell: [0.5, 0.5], origin: [b.x, b.y], size: [2 * b.w, 2 * b.h], abbr: "m" },
    },
  };
}

export const homeLayers: LayerSchema = {
  items: { kind: "entities", description: "items on floors, on half tiles, turned" },
  wallItems: {
    kind: "entities",
    description: "items on walls, by room and wall, in half cells across and up the wall",
    label: "wall items",
    omitWhenEmpty: true,
  },
  ceilingItems: {
    kind: "entities",
    description: "items hanging from ceilings, on half tiles, turned",
    label: "ceiling items",
    omitWhenEmpty: true,
  },
  coverings: {
    kind: "entities",
    description: "each room's wallpaper and flooring",
    omitWhenEmpty: true,
  },
  onSurfaces: onSurfacesLayer,
};

export function newHome(layout: HomeLayout, name: string, now = new Date()): HomeDoc {
  return blankDoc({ game: GAME_ID, map: layout.id }, homeSpace(layout), homeLayers, name, now);
}

export const floorItems = (doc: Doc): FloorItem[] => entities<FloorItem>(doc, "items");
export const wallItems = (doc: Doc): WallItem[] =>
  doc.layers.wallItems ? entities<WallItem>(doc, "wallItems") : [];
export const ceilingItems = (doc: Doc): CeilingItem[] =>
  doc.layers.ceilingItems ? entities<CeilingItem>(doc, "ceilingItems") : [];
export const coverings = (doc: Doc): Covering[] =>
  doc.layers.coverings ? entities<Covering>(doc, "coverings") : [];

export function putFloorItem(doc: Doc, item: FloorItem): void {
  entityLayer<FloorItem>(doc, "items").items[item.id] = item;
}
export function putWallItem(doc: Doc, item: WallItem): void {
  entityLayer<WallItem>(doc, "wallItems").items[item.id] = item;
}
export function putCeilingItem(doc: Doc, item: CeilingItem): void {
  entityLayer<CeilingItem>(doc, "ceilingItems").items[item.id] = item;
}
export function putCovering(doc: Doc, c: Covering): void {
  entityLayer<Covering>(doc, "coverings").items[c.id] = c;
}

/** The half tiles a floor or ceiling item covers on the plane (a type the catalog lacks: one). */
export function planeRect(catalog: Catalog, item: FloorItem): Half {
  const e = catalogEntry(catalog, item.type);
  const { w, h } = e ? rotatedSize(e, item.rot) : { w: 1, h: 1 };
  return { x: item.mx, y: item.my, w, h };
}

/** The half cells a wall item covers on its wall's grid: across and up. */
export function wallRect(catalog: Catalog, item: WallItem): Half {
  const f = catalogEntry(catalog, item.type)?.footprint ?? { w: 1, h: 1 };
  return { x: item.x, y: item.y, w: f.w, h: f.h };
}

/** A wall's grid size in half cells: across (half tiles) and up (half blocks). */
export const wallGrid = (r: Room, side: Side) => ({
  w: 2 * wallLength(r, side),
  h: 2 * r.wallHeight,
});

/** Floor items things on surfaces can stand on, by id (surfaces/). */
export function homeHosts(doc: Doc, catalog: Catalog): Map<string, Host> {
  const out = new Map<string, Host>();
  for (const i of floorItems(doc))
    out.set(i.id, { type: i.type, rect: planeRect(catalog, i), rot: i.rot });
  return out;
}
