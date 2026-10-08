// Measuring and checking models (models.ts): the box a part fills, the problems that stop a model
// from fitting its footprint or the limits, and what each part looks like from above.

import { applyPoint, det3, multiply, type Mat4 } from "./matrix";
import type { V3 } from "./mesh";
import { partGeometry, partTriangles } from "./model-geometry";
import {
  FINISHES,
  flattenModel,
  footprintTurn,
  instancedShape,
  MODEL_LIMITS,
  partLabel,
  unitMatrix,
  type Model,
  type ModelLeaf,
  type ModelLimits,
  type ModelOptions,
  type ModelPart,
  type Turn,
} from "./models";
import type { Bounds } from "./render";

const EPS = 0.01;

const emptyBounds = (): Bounds => ({
  x0: Infinity,
  x1: -Infinity,
  y0: Infinity,
  y1: -Infinity,
  z0: Infinity,
  z1: -Infinity,
});

function grow(b: Bounds, [x, y, z]: V3): void {
  b.x0 = Math.min(b.x0, x);
  b.x1 = Math.max(b.x1, x);
  b.y0 = Math.min(b.y0, y);
  b.y1 = Math.max(b.y1, y);
  b.z0 = Math.min(b.z0, z);
  b.z1 = Math.max(b.z1, z);
}

/** A flat ring of radius r around the unit axis at height y, through m, into b (exact). */
function growRing(b: Bounds, m: Mat4, y: number, r: number): void {
  const c = applyPoint(m, [0, y, 0]);
  const e = [0, 1, 2].map((i) => r * Math.hypot(m[i], m[8 + i]));
  grow(b, [c[0] - e[0], c[1] - e[1], c[2] - e[2]]);
  grow(b, [c[0] + e[0], c[1] + e[1], c[2] + e[2]]);
}

/** The box a leaf fills in true space (tiles on every axis), after `m` (default: none). */
export function leafBounds(leaf: ModelLeaf, blockSize = 1, m?: Mat4): Bounds {
  const b = emptyBounds();
  const unit = instancedShape(leaf.part);
  if (unit) {
    const u = m ? multiply(m, unitMatrix(leaf, blockSize)) : unitMatrix(leaf, blockSize);
    if (unit === "box") {
      for (const x of [-0.5, 0.5])
        for (const y of [0, 1]) for (const z of [-0.5, 0.5]) grow(b, applyPoint(u, [x, y, z]));
    } else if (unit === "sphere") {
      const c = applyPoint(u, [0, 0, 0]);
      const e = [0, 1, 2].map((i) => Math.hypot(u[i], u[4 + i], u[8 + i]));
      grow(b, [c[0] - e[0], c[1] - e[1], c[2] - e[2]]);
      grow(b, [c[0] + e[0], c[1] + e[1], c[2] + e[2]]);
    } else {
      growRing(b, u, 0, 1);
      if (unit === "cylinder") growRing(b, u, 1, 1);
      else grow(b, applyPoint(u, [0, 1, 0]));
    }
    return b;
  }
  const f = m ? multiply(m, leaf.frame) : leaf.frame;
  const g = partGeometry(leaf.part, blockSize);
  for (let i = 0; i < g.position.length; i += 3) {
    grow(b, applyPoint(f, [g.position[i], g.position[i + 1], g.position[i + 2]]));
  }
  return b;
}

/**
 * The box a whole model fills, in model units (x and z in tiles, y in blocks), or null when it has
 * no parts.
 */
export function modelBounds(model: Model, opts: ModelOptions = {}): Bounds | null {
  const k = opts.blockSize ?? 1;
  const leaves = flattenModel(model, opts);
  if (!leaves.length) return null;
  const b = emptyBounds();
  for (const leaf of leaves) {
    const l = leafBounds(leaf, k);
    grow(b, [l.x0, l.y0 / k, l.z0]);
    grow(b, [l.x1, l.y1 / k, l.z1]);
  }
  return b;
}

// ---- problems ----

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const vec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(num);
const positive = (...vs: unknown[]) => vs.every((v) => num(v) && v > 0);

/** Problems with one part's own fields (not where it ends up). */
function fieldProblems(p: ModelPart): string[] {
  const out: string[] = [];
  if (p.shape === "group") {
    if (p.at !== undefined && !vec3(p.at)) out.push("at must be [x, y, z]");
    if (p.rotate !== undefined && !vec3(p.rotate)) out.push("rotate must be [x, y, z] degrees");
    const s = p.scale;
    if (s !== undefined && !(positive(s) || (vec3(s) && positive(...(s as number[]))))) {
      out.push("scale must be a positive number or [x, y, z] of them");
    }
    if (
      p.mirror !== undefined &&
      !(Array.isArray(p.mirror) && p.mirror.every((a) => a === "x" || a === "z"))
    ) {
      out.push('mirror must list "x" and/or "z"');
    }
    if (p.repeat !== undefined) {
      const r = p.repeat;
      if (!(Number.isInteger(r?.count) && r.count >= 1)) out.push("repeat count must be 1 or more");
      if (!vec3(r?.step)) out.push("repeat step must be [x, y, z]");
      if (r?.turn !== undefined && !vec3(r.turn)) out.push("repeat turn must be [x, y, z] degrees");
    }
    if (!Array.isArray(p.parts) || !p.parts.length) out.push("a group needs at least one part");
    return out;
  }
  if (!vec3(p.at)) out.push("at must be [x, y, z]");
  if (p.rotate !== undefined && !vec3(p.rotate)) out.push("rotate must be [x, y, z] degrees");
  if (!HEX.test(p.color ?? "")) out.push("color must be #rrggbb");
  if (p.finish !== undefined && !FINISHES.includes(p.finish)) {
    out.push(`finish must be ${FINISHES.join(", ")}`);
  }
  const sides = (s: number | undefined) => {
    if (s !== undefined && !(Number.isInteger(s) && s >= 3 && s <= 32)) {
      out.push("sides must be a whole number from 3 to 32");
    }
  };
  switch (p.shape) {
    case "box":
    case "wedge":
      if (!(vec3(p.size) && positive(...p.size))) out.push("sizes must be positive");
      if (p.shape === "box" && p.round !== undefined) {
        if (!(num(p.round) && p.round >= 0)) out.push("round must be 0 or more");
        else if (vec3(p.size) && p.round > Math.min(...p.size) / 2 + 1e-9) {
          out.push("round is more than half its smallest size");
        }
      }
      break;
    case "cylinder":
      if (!positive(p.radius, p.height)) out.push("sizes must be positive");
      if (p.top !== undefined && !(num(p.top) && p.top >= 0)) out.push("top must be 0 or more");
      sides(p.sides);
      break;
    case "cone":
      if (!positive(p.radius, p.height)) out.push("sizes must be positive");
      sides(p.sides);
      break;
    case "sphere":
      if (!positive(p.radius, p.squash ?? 1)) out.push("sizes must be positive");
      break;
    case "torus":
      if (!positive(p.radius, p.tube)) out.push("sizes must be positive");
      else if (p.tube > p.radius) out.push("tube must not be wider than the radius");
      if (p.arc !== undefined && !(num(p.arc) && p.arc > 0 && p.arc <= 360)) {
        out.push("arc must be more than 0 and at most 360 degrees");
      }
      break;
    case "tube": {
      if (!positive(p.radius)) out.push("radius must be positive");
      const pts = p.points;
      const least = p.closed ? 3 : 2;
      if (!(Array.isArray(pts) && pts.length >= least && pts.length <= 1024 && pts.every(vec3))) {
        out.push(`points must be ${least} to 1024 [x, y, z] points`);
      } else if (
        new Set(pts.map((q) => q.map((v) => Math.round(v * 1e6)).join())).size < Math.min(least, 2)
      ) {
        out.push("points must not all be the same");
      }
      break;
    }
    case "mesh": {
      const v = p.vertices;
      const f = p.faces;
      if (!(Array.isArray(v) && v.length >= 9 && v.length % 3 === 0 && v.every(num))) {
        out.push("vertices must be x, y, z numbers for 3 or more vertices");
      } else if (!(Array.isArray(f) && f.length >= 3 && f.length % 3 === 0)) {
        out.push("faces must be index triples");
      } else if (!f.every((i) => Number.isInteger(i) && i >= 0 && i < v.length / 3)) {
        out.push("faces must index its vertices");
      }
      break;
    }
    default:
      out.push(`unknown shape "${(p as { shape: unknown }).shape}"`);
  }
  return out;
}

/** Where a part is, for messages, without needing the model: part 2 > 1 (box "leg"). */
const tagOf = (p: ModelPart, path: number[]) =>
  `part ${path.map((i) => i + 1).join(" > ")} (${partLabel(p)})`;

export interface ModelCheckOptions extends ModelOptions {
  limits?: Partial<ModelLimits>;
}

/**
 * Problems with a model for a w x d tile footprint, each naming the part: bad fields first (then
 * nothing else is checked), then parts that reach outside the footprint, below the ground or above
 * the height limit, and models over the part or triangle limits. Empty when the model is fine.
 */
export function modelProblems(
  model: Model,
  w: number,
  d: number,
  opts: ModelCheckOptions = {},
): string[] {
  const lim = { ...MODEL_LIMITS, ...opts.limits };
  const k = opts.blockSize ?? 1;
  if (!Array.isArray(model?.parts) || !model.parts.length) {
    return ["a model needs at least one part"];
  }
  const out: string[] = [];
  const walk = (parts: ModelPart[], path: number[], depth: number) => {
    parts.forEach((p, i) => {
      const here = [...path, i];
      if (!p || typeof p !== "object") {
        out.push(`part ${here.map((j) => j + 1).join(" > ")}: not a part`);
        return;
      }
      for (const m of fieldProblems(p)) out.push(`${tagOf(p, here)}: ${m}`);
      if (p.shape === "group" && Array.isArray(p.parts)) {
        if (depth + 1 > lim.maxDepth) {
          out.push(`${tagOf(p, here)}: groups nest deeper than ${lim.maxDepth}`);
        } else walk(p.parts, here, depth + 1);
      }
    });
  };
  walk(model.parts, [], 0);
  if (out.length) return out;

  const leaves = flattenModel(model, { blockSize: k, cap: lim.maxParts + 1 });
  if (leaves.length > lim.maxParts) {
    return [`more than ${lim.maxParts} parts once groups are mirrored and repeated`];
  }
  let triangles = 0;
  const seen = new Set<string>();
  for (const leaf of leaves) {
    triangles += partTriangles(leaf.part);
    const b = leafBounds(leaf, k);
    const tag = tagOf(leaf.part, leaf.path);
    const say = (m: string) => {
      const line = `${tag}: ${m}`;
      if (!seen.has(line)) out.push(line);
      seen.add(line);
    };
    if (b.x0 < -EPS || b.x1 > w + EPS || b.z0 < -EPS || b.z1 > d + EPS) {
      say(`reaches outside the ${w}x${d} tile footprint`);
    }
    if (b.y0 < -EPS * k) say("goes below the ground");
    if (b.y1 > (lim.maxHeight + EPS) * k) say(`taller than ${lim.maxHeight} blocks`);
  }
  if (triangles > lim.maxTriangles) {
    out.push(`${triangles} triangles; the limit is ${lim.maxTriangles}`);
  }
  return out;
}

// ---- seen from above ----

/**
 * A part seen from above: an ellipse, a convex polygon, or (for rings, tubes and meshes, which can
 * have holes and inside curves) the triangles that face up, as x, z pairs, six numbers each, all
 * wound the same way so one path fills their union.
 */
export type Outline =
  | { kind: "ellipse"; cx: number; cz: number; rx: number; rz: number }
  | { kind: "polygon"; points: [number, number][] }
  | { kind: "triangles"; points: number[] };

export interface Silhouette {
  leaf: ModelLeaf;
  /** Lowest and highest point, in blocks. */
  bottom: number;
  top: number;
  /** Seen from above, in tiles from the turned footprint's top-left corner. */
  outline: Outline;
}

/** Convex hull, starting at the smallest x (then z) and going toward +x along the smallest z. */
export function convexHull(points: [number, number][]): [number, number][] {
  const r = (v: number) => Math.round(v * 1e9) / 1e9;
  const keyed = new Map(
    points.map(([x, z]) => [`${r(x)},${r(z)}`, [r(x), r(z)] as [number, number]]),
  );
  const pts = [...keyed.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: [number, number][]) => {
    const h: [number, number][] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 1e-12) h.pop();
      h.push(p);
    }
    return h;
  };
  const lower = chain(pts);
  const upper = chain([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const near0 = (v: number) => Math.abs(v) < 1e-9;

/** Points of a leaf's surface (enough for its outline from above), after m. */
function outlinePoints(leaf: ModelLeaf, k: number, m: Mat4): V3[] {
  const unit = instancedShape(leaf.part);
  if (!unit) {
    const f = multiply(m, leaf.frame);
    const g = partGeometry(leaf.part, k);
    const out: V3[] = [];
    for (let i = 0; i < g.position.length; i += 3) {
      out.push(applyPoint(f, [g.position[i], g.position[i + 1], g.position[i + 2]]));
    }
    return out;
  }
  const u = multiply(m, unitMatrix(leaf, k));
  const pts: V3[] = [];
  if (unit === "box") {
    for (const x of [-0.5, 0.5])
      for (const y of [0, 1]) for (const z of [-0.5, 0.5]) pts.push([x, y, z]);
  } else {
    const n = 32;
    const rings: [number, number][] =
      unit === "sphere"
        ? [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].map((s) => [
            Math.sin(s * (Math.PI / 2)),
            Math.cos(s * (Math.PI / 2)),
          ])
        : [
            [0, 1],
            [1, unit === "cone" ? 0 : 1],
          ];
    for (const [y, r] of rings) {
      for (let j = 0; j < n; j++) {
        // Circumscribed, so the outline never falls inside the round part.
        const a = (2 * Math.PI * j) / n;
        const R = r / Math.cos(Math.PI / n);
        pts.push([R * Math.cos(a), y, R * Math.sin(a)]);
      }
    }
    if (unit === "sphere") pts.push([0, 1, 0], [0, -1, 0]);
  }
  return pts.map((p) => applyPoint(u, p));
}

/** Shapes whose outline from above is drawn from their triangles: they may have holes. */
const HOLLOW = new Set(["torus", "tube", "mesh"]);

/**
 * The triangles of a leaf that face up (all but edge-on ones for meshes, which may be open), after
 * m, projected from above and wound counter-clockwise in x, z.
 */
function topTriangles(leaf: ModelLeaf, k: number, m: Mat4): number[] {
  const f = multiply(m, leaf.frame);
  const g = partGeometry(leaf.part, k);
  const P = g.position;
  const at = (i: number) => applyPoint(f, [P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
  const flip = leaf.mirrored !== det3(m) < 0 ? -1 : 1;
  const both = leaf.part.shape === "mesh";
  const out: number[] = [];
  for (let t = 0; t < g.index.length; t += 3) {
    const [a, b, c] = [at(g.index[t]), at(g.index[t + 1]), at(g.index[t + 2])];
    // The face normal's y, from the triangle's winding (counter-clockwise from outside).
    const ny = flip * ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]));
    if (both ? Math.abs(ny) < 1e-12 : ny <= 1e-12) continue;
    // Area in x, z: wind every triangle the same way.
    const area = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
    if (area >= 0) out.push(a[0], a[2], b[0], b[2], c[0], c[2]);
    else out.push(a[0], a[2], c[0], c[2], b[0], b[2]);
  }
  return out;
}

/**
 * Every solid of a model seen from above in its footprint turned by `rot`, lowest top first (draw
 * in this order and taller parts cover shorter ones). Upright round parts are ellipses; rings,
 * tubes and meshes are their triangles that face up; everything else is the convex outline of its
 * corners or surface.
 */
export function silhouettes(
  model: Model,
  w: number,
  d: number,
  rot: Turn,
  opts: ModelOptions = {},
): Silhouette[] {
  const k = opts.blockSize ?? 1;
  const turn = footprintTurn(rot, w, d);
  const out: Silhouette[] = flattenModel(model, opts).map((leaf) => {
    const b = leafBounds(leaf, k, turn);
    const unit = instancedShape(leaf.part);
    const u = unit ? multiply(turn, unitMatrix(leaf, k)) : null;
    // An upright round part with its axes along x and z: an ellipse.
    const upright =
      u &&
      unit !== "box" &&
      near0(u[1]) &&
      near0(u[9]) &&
      near0(u[4]) &&
      near0(u[6]) &&
      ((near0(u[2]) && near0(u[8])) || (near0(u[0]) && near0(u[10])));
    const outline: Outline = HOLLOW.has(leaf.part.shape)
      ? { kind: "triangles", points: topTriangles(leaf, k, turn) }
      : upright
        ? {
            kind: "ellipse",
            cx: u[12],
            cz: u[14],
            rx: Math.abs(u[0]) + Math.abs(u[8]),
            rz: Math.abs(u[2]) + Math.abs(u[10]),
          }
        : {
            kind: "polygon",
            points: convexHull(outlinePoints(leaf, k, turn).map((p) => [p[0], p[2]])),
          };
    return { leaf, bottom: b.y0 / k, top: b.y1 / k, outline };
  });
  return out.sort((a, b) => a.top - b.top);
}
