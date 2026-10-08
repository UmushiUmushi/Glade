// Petit Planet's catalog entries, as apps write them, and how the game reads them: each entry's
// base kind (plant, item, bridge, incline, path, wallpaper or flooring; a tree is a plant), and
// lookups by type. Every map of the game reads catalogs the same way.

import { entryOf, kindChain, typeIs, type Catalog as CoreCatalog } from "@glade/core";
import type { Model } from "@glade/render";
import { kinds } from "./kinds";

/** The kinds Petit Planet places things by; every other kind is a sort of one (kinds.ts). */
export type ObjectKind = "plant" | "item" | "bridge" | "incline";
/** Wallpaper and flooring cover a room's walls and floor (homes). */
export type CoveringKind = "wallpaper" | "flooring";
export type BaseKind = ObjectKind | "path" | CoveringKind;

/** Where an item goes: on the floor or ground (the default), on a wall, or on a ceiling. */
export type Mount = "floor" | "wall" | "ceiling";

export interface CatalogEntry {
  type: string;
  /** A plant, item, bridge or incline kind, or a sub-kind of one ("tree", "building", ...). */
  kind: string;
  /** Minor cells at rotation 0. For bridges, h is the long axis (N-S at rot 0). */
  footprint: { w: number; h: number };
  /** Generic glyph hint for renderers. */
  shape: string;
  /** One character for ASCII views: uppercase for plants, lowercase for items. */
  glyph: string;
  /** Items that may also sit on water (boats): the whole footprint water at one level. */
  onWater?: boolean;
  /** Optional 3D model made of parts (@glade/render models), checked by entryProblems. */
  model?: Model;
  /** What it is. */
  description?: string;
  /** Bridges only: size as the game names it, in major cells (width x length). */
  majorSize?: { w: number; l: number };
  /**
   * Fences: one-tile pieces of the same type link to their neighbors, diagonals included
   * (fences.ts). The model is one straight piece along x at rotation 0: parts spanning the tile
   * (0.9 wide or more) are rails, laid along every link; the rest are posts, set at link ends.
   */
  connects?: boolean;
  /**
   * A top things can stand on (a table, a stall, a counter): its grid's size in half cells, at
   * rotation 0. A 2x2 table's 6x6 top is { w: 12, h: 12 } (surfaces/).
   */
  surface?: { w: number; h: number };
  /**
   * Can stand on a surface, taking this much of its grid (half cells, at rotation 0): a tray that
   * is one tile on the ground may take { w: 4, h: 4 } of a table's 12 x 12.
   */
  placeable?: { w: number; h: number };
  /**
   * Where it goes (homes): "floor" (the default; the ground outside), "wall" or "ceiling". A wall
   * item's footprint is across the wall and up it (half tiles across, half blocks up); its model
   * faces south at rotation 0 with its back on the wall.
   */
  mount?: Mount;
}

/**
 * A 2D sheet, repeated across a wall or a floor: an image the app gives, or simple shapes on a
 * unit square (x right, y down), painted in order over its color.
 */
export interface Pattern {
  /** The sheet's main color: under the shapes, and wherever an image cannot be shown. */
  color: string;
  /** An image (a URL, or a data: URL); the app gives it, the profile never stores one. */
  image?: string;
  shapes?: PatternShape[];
}

export type PatternShape =
  | { rect: [number, number, number, number]; color: string }
  | { circle: [number, number, number]; color: string };

/** Wallpaper or flooring: a room's walls or floor covered with a pattern (homes). */
export interface CoveringEntry {
  type: string;
  /** "wallpaper" or "flooring", or a sub-kind of one. */
  kind: string;
  glyph: string;
  pattern: Pattern;
  description?: string;
}

/**
 * A path the app ships (the profile ships the path kind, not paths): it fills whole tiles, so it has no
 * footprint or model; its look is a color and a surface pattern.
 */
export interface PathEntry {
  type: string;
  /** "path", or a sub-kind of it. */
  kind: string;
  /** One character for ASCII views. Paths use symbols so they never collide with objects. */
  glyph: string;
  /** Whether plants may stand on it (rule L4). */
  allowsPlants: boolean;
  /** #rrggbb, in every time of day and season (the light and grade do the rest). */
  color: string;
  /** "cobble" (rounded stones with grout, the default) or "plain". */
  pattern?: "cobble" | "plain";
  description?: string;
}

/** Anything in the catalog: an object (plant, item, bridge, incline) or a path. */
export type Entry = CatalogEntry | PathEntry | CoveringEntry;

export type Catalog = CoreCatalog<Entry>;

const OBJECT_KINDS: readonly string[] = ["plant", "item", "bridge", "incline"];
const BASE_KINDS: readonly string[] = [...OBJECT_KINDS, "path", "wallpaper", "flooring"];

/** The game's kinds and a catalog's, for looking kinds up. */
const source = (catalog: Catalog) => ({ kinds, catalog });

/** The base kind a kind is a sort of ("tree" is a plant), or undefined for an unknown kind. */
export function baseKind(catalog: Catalog, kind: string): BaseKind | undefined {
  const chain = kindChain(source(catalog), kind);
  const base = chain[chain.length - 1];
  return BASE_KINDS.includes(base) ? (base as BaseKind) : undefined;
}

/** The base kind of the entry named `type`. */
export function baseOf(catalog: Catalog, type: string): BaseKind | undefined {
  const e = entryOf(source(catalog), type);
  return e && baseKind(catalog, e.kind);
}

/** Whether the entry named `type` is of `kind` or one of its sub-kinds ("tree", "building"). */
export function isA(catalog: Catalog, type: string, kind: string): boolean {
  return typeIs(source(catalog), type, kind);
}

const isPath = (catalog: Catalog, e: Entry | undefined): e is PathEntry =>
  !!e && baseKind(catalog, e.kind) === "path";

const isObject = (catalog: Catalog, e: Entry | undefined): e is CatalogEntry =>
  !!e && OBJECT_KINDS.includes(baseKind(catalog, e.kind) ?? "");

const isCovering = (catalog: Catalog, e: Entry | undefined): e is CoveringEntry => {
  const b = e && baseKind(catalog, e.kind);
  return b === "wallpaper" || b === "flooring";
};

/** The plant, item, bridge or incline named `type` (paths: pathEntry). */
export function catalogEntry(catalog: Catalog, type: string): CatalogEntry | undefined {
  const e = entryOf(source(catalog), type);
  return isObject(catalog, e) ? e : undefined;
}

/** The path named `type`. */
export function pathEntry(catalog: Catalog, type: string): PathEntry | undefined {
  const e = entryOf(source(catalog), type);
  return isPath(catalog, e) ? e : undefined;
}

/** Every path in the catalog. */
export function pathEntries(catalog: Catalog): PathEntry[] {
  return catalog.entries.filter((e): e is PathEntry => isPath(catalog, e));
}

/** Every plant, item, bridge and incline in the catalog. */
export function objectEntries(catalog: Catalog): CatalogEntry[] {
  return catalog.entries.filter((e): e is CatalogEntry => isObject(catalog, e));
}

/** The wallpaper or flooring named `type`. */
export function coveringEntry(catalog: Catalog, type: string): CoveringEntry | undefined {
  const e = entryOf(source(catalog), type);
  return isCovering(catalog, e) ? e : undefined;
}

/** Where the item named `type` goes: on the floor (the default), a wall or a ceiling. */
export function mountOf(catalog: Catalog, type: string): Mount {
  return catalogEntry(catalog, type)?.mount ?? "floor";
}
