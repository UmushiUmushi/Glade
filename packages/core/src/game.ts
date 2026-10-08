// The game contract. A game's profile (packages/games/<id>/profile) exports a GameProfile: its
// kinds and its maps. A game can have several maps (an island, the inside of a home), each a world
// of its own with its own grids, layers, rules and look, described by a MapDefinition; shared code
// only ever talks to games through these. Everything a map means by a cell, an entity or a rule
// lives behind it. A profile describes maps and never changes them: editing happens outside it, and
// the rules say what is wrong. Other shared packages extend the contract (render adds the look),
// and apps extend it again with their own needs, so it holds only what every planner needs.

import type { Bound, Catalog, KindDef, KindPattern } from "./catalog";
import type { Doc, Entity, LayerSchema } from "./doc";
import type { Rect, Space } from "./space";
import type { Rule, RuleDoc } from "./validate";

/** A game: the kinds of things it places, and its maps. */
export interface GameProfile<M extends MapDefinition = MapDefinition> {
  id: string;
  /** Ids this game had before (a rename); maps saved under them still load. */
  formerIds?: string[];
  title: string;
  /** The kinds of things the game places; each map's rules say where they may go. */
  kinds: KindDef[];
  /** The game's maps, by id. */
  maps: Record<string, M>;
  /** The map that files saved before maps had ids are. */
  defaultMap: string;
}

/** One of a game's maps: its world, what a document of it stores, its rules. */
export interface MapDefinition {
  /** The game's id. */
  game: string;
  /** The map's id within its game, e.g. "planet". */
  id: string;
  title: string;
  space: Space;
  layers: LayerSchema;
  /** Grid that selections snap to and violations are shown in. */
  selectionGrid: string;
  /** Local rules look this many cells of this grid around the region they are asked about. */
  validation: { grid: string; margin: number };
  newDoc(name: string, opts?: Record<string, unknown>, now?: Date): Doc;
  /**
   * Any stored form of a map (older versions; with refit, older geometry) to a current Doc.
   * notes say what changed or was dropped.
   */
  migrate(
    raw: Record<string, unknown>,
    opts?: { refit?: boolean; catalog?: Catalog },
  ): { doc: Doc; notes: string[] };
  /**
   * The game's kinds, which the map's rules are written for. Profiles ship no items: a catalog
   * is bound to the map (catalog.ts).
   */
  kinds: KindDef[];
  /** Problems with one catalog entry of a known kind (its fields, its model), or []. */
  entryProblems?(entry: unknown, catalog: Catalog): string[];
  /** Entries this map does not take (kinds, or entries by a field); see excludesRule. */
  excludes?: KindPattern[];
  rules: Rule[];
  /**
   * Values the map's rules read (a height limit, a span range), so apps can change them with
   * customizeMap. Each game documents its own.
   */
  params?: object;
  /** Every rule with its description, including informational entries. */
  rulebook(): RuleDoc[];
  /**
   * Where something a document holds sits, as rects of the map's grids: a grid layer's cell (`at`
   * is [x, y]), or an entity (its footprint, from the bound catalog; a thing placed on another
   * thing sits where that one is in `doc`). Apps that change a map use it to validate only around
   * the change (validate's region) and to highlight it.
   */
  locate(game: Bound, doc: Doc, layer: string, at: [number, number] | Entity): Rect[];
  /** Rect input (which may use shorthand grids) to a rect of the map's space. */
  rect(input: { grid: string; x: number; y: number; w?: number; h?: number }): Rect;
}
