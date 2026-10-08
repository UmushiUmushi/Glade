// Petit Planet: a game of decorating a little planet and the homes on it. This file is its game
// profile, with the kinds it places and its maps; everything shared code knows about the game
// comes through here. It ships kinds, not items: apps bind a catalog of their own (bind,
// @glade/core). Browser-safe: viewers import it too.

import type { GameProfile } from "@glade/core";
import type { RenderableMap } from "@glade/render";
import { FORMER_GAME_IDS, GAME_ID, PLANET } from "./ids";
import { kinds } from "./kinds";
import { HOME_LAYOUTS, homeMap } from "./maps/home";
import { planet, type PlanetMap } from "./maps/planet";
import { MapFormatError } from "./maps/planet/rle";
import { rules, rulesDoc } from "./maps/planet/rules";
import { params, profile, world } from "./maps/planet/data";

/** The homes, by layout id (interior_home_1_10: one room, 10 x 10). */
const homes = Object.fromEntries(HOME_LAYOUTS.map((l) => [l.id, homeMap(l)]));

/** The game: its kinds and its maps (the planet, and the homes on it). */
export const petitPlanet = {
  id: GAME_ID,
  formerIds: FORMER_GAME_IDS,
  title: "Petit Planet",
  kinds,
  maps: { planet, ...homes } as { planet: PlanetMap } & Record<string, RenderableMap>,
  defaultMap: PLANET,
} satisfies GameProfile<RenderableMap>;

export type PetitPlanet = typeof petitPlanet;

// The public API: the game, its kinds and entry checks, and each map with its world and params,
// its file format (typed readers and writers for each layer), its grids, and what a corner shape
// resolves to.

// Kinds and catalogs (the items are the app's own).
export { commonFields, entryProblems, entrySchemas, kinds, upgradeCatalog } from "./kinds";
export { gridSpec } from "./maps/planet/profile";
export {
  baseKind,
  baseOf,
  catalogEntry,
  isA,
  objectEntries,
  pathEntries,
  pathEntry,
} from "./catalog";
export type { Landmark, Params, Planet, Profile, World } from "./maps/planet/profile";
export type { BaseKind, Catalog, CatalogEntry, Entry, ObjectKind, PathEntry } from "./catalog";

// The item formula: how one entry looks, in 2D and 3D, on any map.
export {
  appModel,
  BLOCK_TILES,
  drawItem2D,
  frontMarker,
  frontSide,
  itemModel,
  itemSize,
  rotatedSize,
} from "./items";

// Homes: the map for any layout, and the game's layouts.
export { HOME_LAYOUTS, homeLookFile, homeMap, type HomeLayout } from "./maps/home";
export { layoutProblems, type Door, type Room, type Side } from "./maps/home/layout";
export {
  ceilingItems,
  coverings,
  floorItems,
  putCeilingItem,
  putCovering,
  putFloorItem,
  putWallItem,
  wallItems,
  type CeilingItem,
  type Covering,
  type FloorItem,
  type WallItem,
} from "./maps/home/model";

// Things on surfaces, on any map.
export { onSurfaceBox, onSurfaces, type OnSurface } from "./surfaces";

// The planet: its map, world, params and rules, and facts about its world that tools need.
export { lookFile, planet, type PlanetMap } from "./maps/planet";
export { profileOf } from "./maps/planet/data";
export {
  defaultTerrainLevel,
  isBeachMajor,
  isEditableTerrain,
  isLandTerrain,
  isTerrainLocked,
  landmarkAtMajor,
  landmarkTerrainRect,
  placementBlocked,
} from "./maps/planet/profile";
export { notFlatEarth, terrainOfMajor } from "./maps/planet/model";
// Waterfalls: the sides water falls off, and the cliff face a fall sits in (rule W2).
export { edgeRun, fallSides } from "./maps/planet/analysis";
export { boundingRect, floodRegion, type Point } from "./maps/planet/select";
export { decodeTerrainRow, encodeTerrainRow } from "./maps/planet/rle";
export { rules, rulesDoc };
export { params, profile, world };

// The map format: layers and the typed accessors for them.
export {
  cornerAt,
  cornerCells,
  itemById,
  itemRect,
  itemsOf,
  pathAt,
  pathCells,
  plantById,
  plantRect,
  plantsOf,
  putItem,
  putPlant,
  removeObjects,
  setCornerAt,
  setPathAt,
  setTerrain,
  terrainAt,
  terrainGrid,
  type CornerLayer,
  type CornerShape,
  type Item,
  type MapDoc,
  type Plant,
  type Rotation,
  type TerrainCell,
} from "./maps/planet/model";
export { MapFormatError };

// Grids: major (tiles), minor (half tiles) and terrain (blocks, on tile corners).
export {
  areaLabel,
  areaRect,
  areaRectFromLabel,
  cellKey,
  cellOfMinor,
  cellsInRect,
  convertRect,
  expandRect,
  fullRect,
  gridSize,
  inGrid,
  majorCellsOfTerrain,
  majorOfMinor,
  normRect,
  parseCellKey,
  parseRectSpec,
  rectContains,
  rectInAllGrids,
  rectsIntersect,
  terrainCellsOfMajor,
  terrainOfMinor,
  toMinorRect,
  type Cell,
  type GridName,
  type GridSpec,
  type Rect,
} from "./maps/planet/space";

// Corners: where a corner shape sits, and what it resolves to on the map.
export {
  CORNER_DIRS,
  cornerName,
  resolveCorner,
  resolvePathCorner,
  resolveTerrainCorner,
  vertexCells,
  vertexOf,
  type CornerKind,
  type CornerName,
  type PathCorner,
  type Resolution,
  type TerrainCorner,
} from "./maps/planet/corners";

// The look's types.
export type { Look, Style } from "./maps/planet/style";
