// The island's profile: the fixed world (world.json) plus the rule params (params.json), and the
// map type the planet's code passes around (its MapDefinition, bound to an app's catalog, with
// typed params).

import type { Bound, MapDefinition } from "@glade/core";
import type { ModelLimits } from "@glade/render";
import type { Catalog } from "../../catalog";
import type { GridSpec, Rect } from "./space";

export interface Landmark {
  id: string;
  grid: "major";
  x: number;
  y: number;
  w: number;
  h: number;
  lockTerrain?: boolean;
  /** Height locked terrain must keep. Absent: the cell's default (beach or land level). */
  lockLevel?: number;
  lockPlacement?: boolean;
  /** "outside" (default) locks terrain blocks whose center is inside or on the boundary. */
  terrainLockExtent?: "outside" | "inside";
}

/** The island's fixed shape: size, beach, land and landmarks (world.json). */
export interface World {
  id: string;
  major: { w: number; h: number };
  minorPerMajor: 2;
  areaSize: number;
  /** Major cells with X < width or X >= W - width (same for Y with H) are beach. */
  beach: { width: number; level: number };
  /** Terrain cells with tx in x and ty in y (inclusive [lo, hi]) are land; the rest is beach. */
  land: { x: [number, number]; y: [number, number]; defaultLevel: number };
  /** Terrain cells with tx in x and ty in y (inclusive) are editable. */
  terrainEditable: { x: [number, number]; y: [number, number] };
  /**
   * How far a cut or rounded corner reaches along each edge from the corner, in tiles: `path`
   * for path cells, `terrain` for water and cliff blocks (corners.ts).
   */
  corners: { path: number; terrain: number };
  landmarks: Landmark[];
}

/** The numbers the rules read (params.json). Apps change them with customizeMap. */
export interface Params {
  /** Lowest terrain level land can be dug to. */
  minLandLevel: number;
  /** Highest terrain level. */
  maxHeight: number;
  /** Largest height difference between neighboring terrain blocks. */
  maxStepBetweenNeighbors: number;
  /** Which neighbors count for the step limit: "4" (sides) or "8" (sides and corners). */
  stepNeighborhood: "4" | "8";
  /** Fewest blocks in a waterfall's edge run, counting the two edge blocks beside the water. */
  waterfallMinRun: number;
  /**
   * Shortest and longest bridge, in tiles. A bridge is one tile longer than its gap; the shortest
   * also crosses a gap two tiles shorter (rule I4).
   */
  bridge: { minLength: number; maxLength: number };
  /** How many levels an incline climbs (rule I6). */
  inclineRise: number;
  /**
   * Limits on a catalog entry's model (entryProblems): solids once groups are mirrored and
   * repeated, height in blocks, triangles drawn, and how deep groups nest.
   */
  modelLimits: ModelLimits;
}

/** Everything the game's code reads: the world plus the current params. */
export type Profile = World & Params;

/** The planet map, with an app's catalog, as the game's own code sees it. */
export interface Planet extends Bound<MapDefinition, Catalog> {
  params: Params;
}

export function gridSpec(profile: Profile): GridSpec {
  return { majorW: profile.major.w, majorH: profile.major.h, areaSize: profile.areaSize };
}

export function isBeachMajor(profile: Profile, X: number, Y: number): boolean {
  const b = profile.beach.width;
  const { w, h } = profile.major;
  return X < b || Y < b || X >= w - b || Y >= h - b;
}

function inRanges(r: { x: [number, number]; y: [number, number] }, tx: number, ty: number) {
  return tx >= r.x[0] && tx <= r.x[1] && ty >= r.y[0] && ty <= r.y[1];
}

export function isLandTerrain(profile: Profile, tx: number, ty: number): boolean {
  return inRanges(profile.land, tx, ty);
}

export function isEditableTerrain(profile: Profile, tx: number, ty: number): boolean {
  return inRanges(profile.terrainEditable, tx, ty);
}

/** Height a terrain cell has on a fresh map: beach level off-land, default level on land. */
export function defaultTerrainLevel(profile: Profile, tx: number, ty: number): number {
  return isLandTerrain(profile, tx, ty) ? profile.land.defaultLevel : profile.beach.level;
}

/** Terrain rect (inclusive corners) locked by a landmark, per its terrainLockExtent. */
export function landmarkTerrainRect(lm: Landmark): Rect {
  return lm.terrainLockExtent === "inside"
    ? { grid: "terrain", x: lm.x + 1, y: lm.y + 1, w: lm.w - 1, h: lm.h - 1 }
    : { grid: "terrain", x: lm.x, y: lm.y, w: lm.w + 1, h: lm.h + 1 };
}

/** Terrain that may never change: outside the editable zone or under a terrain-locked landmark. */
export function isTerrainLocked(profile: Profile, tx: number, ty: number): boolean {
  if (!isEditableTerrain(profile, tx, ty)) return true;
  return profile.landmarks.some((lm) => {
    if (!lm.lockTerrain) return false;
    const r = landmarkTerrainRect(lm);
    return tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h;
  });
}

/** Why nothing may be placed on a major cell (beach or a placement-locked landmark), or null. */
export function placementBlocked(profile: Profile, X: number, Y: number): string | null {
  if (isBeachMajor(profile, X, Y)) return "beach";
  const lm = landmarkAtMajor(profile, X, Y);
  if (lm?.lockPlacement) return `landmark ${lm.id}`;
  return null;
}

export function landmarkAtMajor(profile: Profile, X: number, Y: number): Landmark | undefined {
  return profile.landmarks.find(
    (lm) => X >= lm.x && Y >= lm.y && X < lm.x + lm.w && Y < lm.y + lm.h,
  );
}
