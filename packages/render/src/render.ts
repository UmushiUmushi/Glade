// Render contracts. A map can be seen in one or more views: from straight above (plan, drawn on a
// canvas) and in 3D (scene: geometry in chunks and material specs); more kinds of view can join
// them. Every view shares the map's UI: layer toggles, grids, hover text and click selection. The
// host owns everything else: canvas and renderer, camera and controls, picking loop, overlays
// (selection, hover, violations, flashes, grid lines), image capture, and the floor clip. Games
// stay free of three.js: meshes are typed arrays and materials are specs the host builds.

import type { Bound, Box, Doc, Selection } from "@glade/core";
import type { MeshArrays, V3 } from "./mesh";
import type { Look } from "./style";

// ---- 2D ----

/** World to screen: screen = offset + world * scale (CSS px per world unit). */
export interface WorldToScreen {
  scale: number;
  ox: number;
  oy: number;
}

export interface LayerToggle {
  id: string;
  label: string;
  default: boolean;
}

/** A grid the viewer can snap to and draw lines for. color: "r,g,b" and alpha for its lines. */
export interface SnapGrid {
  grid: string;
  label: string;
  color: string;
  alpha: number;
}

export interface ViewerGrids {
  /** Grids selections snap to and the ruler measures in; the first is the default. */
  snap: SnapGrid[];
  /** The finest grid: optional lines, zoom limits, and 3D overlay draping. */
  fine: string;
  /** Grid whose lines and labels the "Area grid" layer draws, if any. */
  areas?: string;
}

/** What every view of a map shares: layer toggles, grids, hover text and click selection. */
export interface MapUI {
  /** The map's layer toggles, in panel order (the host adds its grid and violations toggles). */
  layerNames(): LayerToggle[];
  grids(): ViewerGrids;
  /** Hover readout for a world point (the same text in every view). */
  hover(doc: Doc, game: Bound, p: { x: number; y: number }, floor?: number): string;
  /** What a click selects (e.g. a connected region), or null. */
  clickSelect?(
    doc: Doc,
    game: Bound,
    p: { x: number; y: number },
    floor?: number,
  ): Omit<Selection, "boxes" | "updated"> | null;
}

/** The plan view: the map from straight above, drawn on a canvas. */
export interface PlanView {
  /**
   * Draw the map's layers. The context is already transformed so one unit is one world unit;
   * `visible` is the world box on screen, `pxPerUnit` the zoom.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    doc: Doc,
    game: Bound,
    layers: Record<string, boolean>,
    visible: Box,
    pxPerUnit: number,
  ): void;
}

/** The views a map can be seen in; a viewer offers each one the map has. */
export interface MapViews {
  /** From straight above, on a canvas. */
  plan?: PlanView;
  /** In 3D. */
  scene?: Render3D;
}

// ---- 3D ----

export type ChunkId = string;

export interface MeshSpec {
  kind: "mesh";
  /** Layer toggle that hides it (see Render2D.layerNames); "" for always shown. */
  layer: string;
  /** Key into materials(). */
  material: string;
  arrays: MeshArrays;
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  /** Add an inverted-hull companion when the game's materials include "outline". */
  outline?: boolean;
  /** Raycast target for picking and hover. */
  pickable?: boolean;
  /** Drawn with the overlays: hidden in captures unless overlays are asked for. */
  overlay?: boolean;
}

/**
 * "quad" is a 2 x 2 square in the xy plane around the origin (corners at ±1), for sprites a
 * material turns toward the camera itself.
 */
export type Primitive = "box" | "cylinder" | "cone" | "sphere" | "quad";

/**
 * Copies of one shape placed by per-instance matrices (4x4, column by column) and colors
 * (#rrggbb). The shape is a unit primitive or a geometry of the game's own; give one of them.
 */
export interface InstancesSpec {
  kind: "instances";
  layer: string;
  material: string;
  primitive?: Primitive;
  /**
   * The game's own triangles (e.g. a model part's, model-geometry.ts). `key` names them: the same
   * key always means the same triangles, so the host builds each once and shares it.
   */
  geometry?: { key: string; arrays: MeshArrays };
  matrices: number[];
  colors: string[];
  outline?: boolean;
  /** Cast shadows (default true); sprites a material moves should not. */
  castShadow?: boolean;
}

/**
 * A texture: RGBA bytes, row by row, or an image the viewer loads from `url` (the game's own file,
 * e.g. new URL("./x.png", import.meta.url)); either way repeating in both directions, mipmapped
 * and linear (not sRGB). `key` names the pixels: the host uploads each key once, and a capture
 * waits for loading images.
 */
export interface TextureValue {
  texture:
    { key: string; width: number; height: number; data: Uint8Array } | { key: string; url: string };
}

export type UniformValue = number | number[] | string | string[] | TextureValue;

/**
 * A material as data. "toon" and "basic" are the host's built-in materials, patched with
 * [search, replace] pairs; "shader" takes full sources. The host adds the curvature chunk to
 * every material and registers `#include <glade_noise>` (gladeHash, gladeNoise, gladeFbm) and
 * `#include <glade_curve_pars>` (gladeCurve(world) for "shader" vertex sources). Shared uniforms
 * uTime and uFlat (1 when the viewer shows flat colors) are available to every material.
 */
export interface MaterialSpec {
  /** Program cache key: the same key must always mean the same shader source. */
  key: string;
  base: "toon" | "basic" | "shader";
  color?: string;
  side?: "front" | "back" | "double";
  transparent?: boolean;
  depthWrite?: boolean;
  opacity?: number;
  /** [factor, units] */
  polygonOffset?: [number, number];
  fog?: boolean;
  /** Toon shading bands. */
  gradientSteps?: number;
  /** Alpha from the fragment becomes multisample coverage: cut-outs with smooth edges. */
  alphaToCoverage?: boolean;
  /** Values are numbers, number arrays, "#rrggbb" colors, color arrays, or textures. */
  uniforms?: Record<string, UniformValue>;
  vertexPatches?: [string, string][];
  fragmentPatches?: [string, string][];
  vertexShader?: string;
  fragmentShader?: string;
}

/** A 3D world box (x and z horizontal, y up). */
export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface Render3D {
  /** 3D units per world unit on x and z (world x -> 3D x, world y -> 3D z). */
  scale: number;
  capabilities: { floors?: boolean; curvature?: boolean };
  chunks(doc: Doc, game: Bound): ChunkId[];
  /** Chunks to rebuild when a doc changed from `prev` (null: all). */
  chunksTouched(prev: Doc | null, next: Doc, game: Bound): ChunkId[];
  /** Changes when geometry-affecting look values change; the host then rebuilds every chunk. */
  geometryKey(look: Look): string;
  buildChunk(doc: Doc, game: Bound, look: Look, chunk: ChunkId): (MeshSpec | InstancesSpec)[];
  /**
   * The materials the chunks name. `doc` and `game` are the document and map being drawn, for
   * maps whose materials depend on them (a room's wallpaper); they are absent before there is one.
   */
  materials(
    look: Look,
    opts: { flat: boolean; layers: Record<string, boolean>; doc?: Doc; game?: Bound },
  ): Record<string, MaterialSpec>;
  /** A raycast hit on a pickable mesh as a world point (and floor). */
  pick(hit: { point: V3; normal: V3 }, game: Bound): { x: number; y: number; floor?: number };
  /** 3D height of what stands at a world point; the host drapes overlays on it. */
  ground(doc: Doc, game: Bound, look: Look): (x: number, y: number) => number;
  bounds(doc: Doc, game: Bound, look: Look): Bounds;
}
