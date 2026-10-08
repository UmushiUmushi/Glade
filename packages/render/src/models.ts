// Item models: an item's look as data, built from parts, so planners, builders and any engine can
// draw it. A part is a solid (box, wedge, cylinder, cone, sphere, torus, or a small mesh of its
// own, or a tube along a curve) or a group of parts that can be moved, turned, scaled, mirrored
// and repeated together.
//
// Model space, at rotation 0: the origin is the footprint's top-left corner on the ground. x runs
// across the footprint's width (0..w tiles), z along its depth (0..d tiles, top to bottom), y up in
// blocks. Every part is placed by its anchor `at` and turned about it by `rotate`:
//   box       at = center of its base, size = [width x, height y, depth z]; round = edge radius
//   wedge     like a box whose top slopes from full height at the back (-z) to nothing at the front
//   cylinder  at = center of its base, radius, height; top = top radius; sides = a prism
//   cone      at = center of its base, radius, height; sides = a pyramid
//   sphere    at = its center, radius, squash = vertical scale; half = only the top half (a dome)
//   torus     at = its center, lying flat: radius to the middle of the tube, tube = tube radius;
//             arc = only that many degrees of the ring (an elbow), from +x counter-clockwise
//             seen from above
//   tube      a round pipe through `points` (around the anchor), smoothly curved unless
//             smooth is false; closed = a loop
//   mesh      vertices (x, y, z triples) and faces (index triples, counter-clockwise seen from
//             outside), around the anchor
//   group     at, rotate, scale; mirror = also mirrored copies across its own x = 0 / z = 0
//             planes; repeat = copies, each the one before moved by `step` and turned by
//             `turn` (so a turn walks the copies round a curve); parts are placed relative to `at`
// A part's own sizes are along its own axes, before it is turned: across (x) and deep (z) in tiles,
// tall (y) in blocks. `rotate` is [x, y, z] degrees about the anchor, right-handed, in three.js
// Euler order "XYZ"; [0, 90, 0] turns a part counter-clockwise seen from above.
//
// Blocks and tiles differ in size, so a turned part is worked out in true proportions: flattening
// a model (flattenModel) gives every solid with a matrix into "true space", where y is in tiles
// too (a block is `blockSize` tiles tall). Checks, top-down outlines and meshes all start there.

import {
  chain,
  det3,
  identity,
  multiply,
  rotation,
  scaling,
  translation,
  type Mat4,
} from "./matrix";
import type { V3 } from "./mesh";

export type Vec3 = [number, number, number];

/** How a part's surface takes the light: matte (the default), glowing, or see-through. */
export type Finish = "matte" | "glow" | "glass";
export const FINISHES: Finish[] = ["matte", "glow", "glass"];

interface Placed {
  at: Vec3;
  /** Degrees about x, y and z through the anchor (three.js Euler order "XYZ"). */
  rotate?: Vec3;
  /** A label for builders and messages, e.g. "seat". */
  name?: string;
}

interface Painted {
  /** "#rrggbb" */
  color: string;
  finish?: Finish;
}

export interface BoxPart extends Placed, Painted {
  shape: "box";
  size: Vec3;
  /** Radius that rounds every edge, in tiles (0 = sharp). */
  round?: number;
}

export interface WedgePart extends Placed, Painted {
  shape: "wedge";
  size: Vec3;
}

export interface CylinderPart extends Placed, Painted {
  shape: "cylinder";
  radius: number;
  height: number;
  /** Radius at the top (default: radius). Smaller makes a tapered post or a bucket. */
  top?: number;
  /** Flat sides instead of round: 3..32. */
  sides?: number;
}

export interface ConePart extends Placed, Painted {
  shape: "cone";
  radius: number;
  height: number;
  /** Flat sides instead of round: 3..32 (4 makes a pyramid). */
  sides?: number;
}

export interface SpherePart extends Placed, Painted {
  shape: "sphere";
  radius: number;
  /** Vertical scale (0.55 = a mushroom cap). */
  squash?: number;
  /** Only the top half: a dome whose flat base is at the anchor. */
  half?: boolean;
}

export interface TorusPart extends Placed, Painted {
  shape: "torus";
  /** From the center to the middle of the tube, in tiles. */
  radius: number;
  /** The tube's radius, in tiles across and blocks up. */
  tube: number;
  /** Degrees of the ring to draw (default 360): from +x, counter-clockwise seen from above. */
  arc?: number;
}

export interface TubePart extends Placed, Painted {
  shape: "tube";
  /** Points the tube runs through, around the anchor: x, z in tiles, y in blocks. */
  points: Vec3[];
  /** The tube's radius, in tiles; it stays round however it bends. */
  radius: number;
  /** Curve smoothly through the points (default) or run straight between them (false). */
  smooth?: boolean;
  /** Join the last point back to the first: a loop. */
  closed?: boolean;
}

export interface MeshPart extends Placed, Painted {
  shape: "mesh";
  /** x, y, z of each vertex, around the anchor, in the part's own units (tiles; y in blocks). */
  vertices: number[];
  /** Three vertex indices per triangle, counter-clockwise seen from outside. */
  faces: number[];
}

export type SolidPart =
  BoxPart | WedgePart | CylinderPart | ConePart | SpherePart | TorusPart | TubePart | MeshPart;

export interface GroupPart {
  shape: "group";
  /** Where the group's own origin sits (default [0, 0, 0]). */
  at?: Vec3;
  rotate?: Vec3;
  /** Size multiplier: one number, or [x, y, z]. */
  scale?: number | Vec3;
  /** Also draw the group mirrored across its own x = 0 and/or z = 0 plane. */
  mirror?: ("x" | "z")[];
  /**
   * `count` copies, each the one before moved by `step` (in its own units: tiles, y in blocks)
   * and then turned by `turn` degrees (three.js Euler order "XYZ"). With only a turn the copies go
   * round the group's origin (a ring of posts); with both they walk along a curve or a spiral.
   */
  repeat?: { count: number; step: Vec3; turn?: Vec3 };
  name?: string;
  parts: ModelPart[];
}

export type ModelPart = SolidPart | GroupPart;
export type Shape = ModelPart["shape"];
export type SolidShape = SolidPart["shape"];
export const SOLID_SHAPES: SolidShape[] = [
  "box",
  "wedge",
  "cylinder",
  "cone",
  "sphere",
  "torus",
  "tube",
  "mesh",
];

export interface Model {
  parts: ModelPart[];
}

/**
 * Limits on one model. `maxParts` counts solids after groups are mirrored and repeated;
 * `maxTriangles` counts what is drawn; `maxDepth` is how deep groups may nest.
 */
export interface ModelLimits {
  maxParts: number;
  maxHeight: number;
  maxTriangles: number;
  maxDepth: number;
}

export const MODEL_LIMITS: ModelLimits = {
  maxParts: 256,
  maxHeight: 6,
  maxTriangles: 10000,
  maxDepth: 6,
};

export interface ModelOptions {
  /** How many tiles tall a block is (default 1). */
  blockSize?: number;
}

// ---- flattening ----

/** One solid of a model, placed. */
export interface ModelLeaf {
  part: SolidPart;
  /** Indices from the model's parts down to this part: [2, 0] = the first part of the third. */
  path: number[];
  /** Which copy of it, when groups mirror or repeat (0 = the first). */
  copy: number;
  /**
   * Part space -> true space. Part space has the anchor at its origin and the part's own axes,
   * in true proportions (tiles on every axis).
   */
  frame: Mat4;
  /** The frame mirrors (an odd number of mirrored groups or negative scales). */
  mirrored: boolean;
}

const K = (v: Vec3, k: number): V3 => [v[0], v[1] * k, v[2]];

/** Every combination of a group's mirrors, as matrices, the unmirrored one first. */
function mirrors(m: GroupPart["mirror"]): Mat4[] {
  let out: Mat4[] = [identity()];
  for (const axis of new Set(m ?? [])) {
    const flip = axis === "x" ? scaling(-1, 1, 1) : scaling(1, 1, -1);
    out = out.flatMap((a) => [a, multiply(flip, a)]);
  }
  return out;
}

/** How many solids a part becomes once groups are mirrored and repeated. */
export function solidCount(part: ModelPart): number {
  if (part.shape !== "group") return 1;
  const copies = Math.max(1, part.repeat?.count ?? 1) * 2 ** new Set(part.mirror ?? []).size;
  return copies * part.parts.reduce((n, p) => n + solidCount(p), 0);
}

/**
 * Every solid of a model with its place in true space, in part order (each group's copies one
 * after another). Stops after `cap` solids, so a runaway repeat cannot hang a caller.
 */
export function flattenModel(
  model: Model,
  opts: ModelOptions & { cap?: number } = {},
): ModelLeaf[] {
  const k = opts.blockSize ?? 1;
  const cap = opts.cap ?? 100_000;
  const out: ModelLeaf[] = [];
  const walk = (parts: ModelPart[], parent: Mat4, path: number[], copy: number) => {
    parts.forEach((p, i) => {
      if (out.length >= cap) return;
      const here = [...path, i];
      const place = chain(
        parent,
        translation(...K(p.at ?? [0, 0, 0], k)),
        rotation(p.rotate ?? [0, 0, 0]),
      );
      if (p.shape !== "group") {
        out.push({ part: p, path: here, copy, frame: place, mirrored: det3(place) < 0 });
        return;
      }
      const s = p.scale ?? 1;
      const own = multiply(place, typeof s === "number" ? scaling(s, s, s) : scaling(...s));
      const count = Math.max(1, Math.floor(p.repeat?.count ?? 1));
      // Each copy is the one before, moved by step and then turned.
      const next = multiply(
        translation(...K(p.repeat?.step ?? [0, 0, 0], k)),
        rotation(p.repeat?.turn ?? [0, 0, 0]),
      );
      const flips = mirrors(p.mirror);
      let n = 0;
      for (const m of flips) {
        let copyFrame = multiply(own, m);
        for (let r = 0; r < count; r++) {
          walk(p.parts, copyFrame, here, copy * flips.length * count + n++);
          copyFrame = multiply(copyFrame, next);
        }
      }
    });
  };
  walk(model.parts ?? [], identity(), [], 0);
  return out;
}

// ---- instancing ----

/** The unit primitives an engine instances (see Primitive in render.ts). */
export type InstancedShape = "box" | "cylinder" | "cone" | "sphere";

/**
 * The unit primitive a solid can be drawn as, scaled by a matrix, or null when it needs its own
 * geometry (model-geometry.ts): rounded boxes, wedges, tapered or faceted cylinders and cones,
 * domes, tori and meshes.
 */
export function instancedShape(p: SolidPart): InstancedShape | null {
  switch (p.shape) {
    case "box":
      return p.round ? null : "box";
    case "cylinder":
      return p.sides || (p.top !== undefined && p.top !== p.radius) ? null : "cylinder";
    case "cone":
      return p.sides ? null : "cone";
    case "sphere":
      return p.half ? null : "sphere";
    default:
      return null;
  }
}

/**
 * Unit primitive -> true space for a leaf that instancedShape() allows. Unit primitives: a 1x1x1
 * box and radius-1, height-1 cylinder and cone with their base at y = 0, and a radius-1 sphere
 * around the origin. All four are symmetric across x = 0, so a mirrored leaf is drawn unmirrored
 * (keeping its faces' winding) with the same result.
 */
export function unitMatrix(leaf: ModelLeaf, blockSize = 1): Mat4 {
  const p = leaf.part;
  const k = blockSize;
  let s: V3;
  if (p.shape === "box") s = [p.size[0], p.size[1] * k, p.size[2]];
  else if (p.shape === "sphere") s = [p.radius, p.radius * (p.squash ?? 1) * k, p.radius];
  else if (p.shape === "cylinder" || p.shape === "cone") s = [p.radius, p.height * k, p.radius];
  else throw new Error(`a ${p.shape} has no unit primitive`);
  const m = multiply(leaf.frame, scaling(...s));
  return leaf.mirrored ? multiply(m, scaling(-1, 1, 1)) : m;
}

// ---- turning the footprint ----

export type Turn = 0 | 90 | 180 | 270;

/**
 * Model space at rotation 0 -> the footprint turned clockwise by `rot` (seen from above), with the
 * turned footprint's top-left corner at the origin. At 90 the model's x axis points down (+z).
 */
export function footprintTurn(rot: Turn, w: number, d: number): Mat4 {
  switch (rot) {
    case 0:
      return identity();
    case 90:
      return [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, d, 0, 0, 1];
    case 180:
      return [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, w, 0, d, 1];
    case 270:
      return [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, w, 1];
  }
}

// ---- parts by path (for builders) ----

/** The part at `path`, or undefined. */
export function partAt(model: Model, path: number[]): ModelPart | undefined {
  let parts: ModelPart[] = model.parts;
  let part: ModelPart | undefined;
  for (const i of path) {
    part = parts?.[i];
    if (!part) return undefined;
    parts = part.shape === "group" ? part.parts : [];
  }
  return part;
}

/** A copy of `parts` with fn applied to the list that holds `path`'s last index. */
function editList(
  parts: ModelPart[],
  path: number[],
  fn: (list: ModelPart[], i: number) => ModelPart[],
): ModelPart[] {
  const [i, ...rest] = path;
  if (!rest.length) return fn(parts, i);
  const g = parts[i];
  if (!g || g.shape !== "group") throw new Error(`no group at ${i}`);
  const copy = [...parts];
  copy[i] = { ...g, parts: editList(g.parts, rest, fn) };
  return copy;
}

/** A new model with the part at `path` replaced (or removed, with null). The model is unchanged. */
export function replacePart(model: Model, path: number[], part: ModelPart | null): Model {
  if (!partAt(model, path)) throw new Error(`no part at [${path.join(", ")}]`);
  return {
    ...model,
    parts: editList(model.parts, path, (list, i) =>
      part ? list.map((p, j) => (j === i ? part : p)) : list.filter((_, j) => j !== i),
    ),
  };
}

/**
 * A new model with `part` inserted so that it ends up at `path` (the last index may be one past
 * the end of its list to append). The model is unchanged.
 */
export function insertPart(model: Model, path: number[], part: ModelPart): Model {
  return {
    ...model,
    parts: editList(model.parts, path, (list, i) => {
      if (i < 0 || i > list.length) throw new Error(`index ${i} is outside 0..${list.length}`);
      return [...list.slice(0, i), part, ...list.slice(i)];
    }),
  };
}

/** A part's label for messages and lists: "box", or `box "seat"`. */
export function partLabel(p: ModelPart): string {
  return p.name ? `${p.shape} "${p.name}"` : p.shape;
}

/** Where a part is, for messages: "part 2 > 1 (box "leg")", 1-based like a person counts. */
export function partTag(model: Model, path: number[]): string {
  const p = partAt(model, path);
  return `part ${path.map((i) => i + 1).join(" > ")}${p ? ` (${partLabel(p)})` : ""}`;
}
