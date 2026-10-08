// Plants and items on the planet, as instances. How each looks comes from the game's item formula
// (items/: its model, a door on buildings, an incline's steps), or from the app's own model for a
// placed thing (RenderableMap.itemModel). This file places them on the island: on the ground under
// them, inclines climbing to the cliff top, fence pieces linked to their neighbors, and grass round
// their feet; winter's snow on them comes from the materials. Models are flattened into solids: a
// box, cylinder, cone or sphere becomes one instance of the host's unit primitive; any other solid
// (a rounded box, a wedge, a dome, a torus, a mesh...) gets its own geometry, built once per shape
// and instanced wherever it appears. Each finish has its own material ("objects", "objects-glow",
// "objects-glass"), so instances are grouped by finish and shape.
//
// Units: model x/z are tiles (2 world units), y is blocks (heightScale world units). Parts are
// turned in true proportions: a block is heightScale / 2 tiles. Rotation follows the item's `rot`
// (clockwise seen from above, as footprintTurn() in @glade/render).
//
// Every part standing on grass gets a ring of leaf stamps round its foot, toned as the lawn there,
// so the grass overlaps it as in the game; none on paths or water.

import { terrainOfMinor, type Rect } from "../space";
import {
  itemRect,
  itemsOf,
  pathAt,
  plantRect,
  plantsOf,
  surfaceHosts,
  type MapDoc,
} from "../model";
import {
  instancedShape,
  modelBounds,
  silhouettes,
  type BoxPart,
  type Finish,
  type Model,
  type ModelPart,
  type Turn,
} from "@glade/render";
import type { Entity } from "@glade/core";
import { baseOf, catalogEntry, type Catalog } from "../../../catalog";
import { itemModel, itemSize } from "../../../items";
import {
  emptyInstances,
  Instancer,
  placement,
  type LayerInstances,
  type Solid,
} from "../../../items/instances";
import { onSurfaceBox, onSurfaces } from "../../../surfaces";
import { armBacks, fenceArms, type Arm } from "../fences";
import type { TerrainSampler } from "./terrain";
import { groundLift, pushLine, pushRing, type LandLook, type LeafList } from "./land";

/** Leaf stamps for objects' feet, and what the ground's tone lift needs. */
export interface FootLeaves {
  land: LandLook;
  heightScale: number;
  baseLevel: number;
}

/** A point moved out from a convex polygon's corner so both its edges move out by d (a miter). */
function miter(pts: [number, number][], i: number, d: number): [number, number] {
  const n = pts.length;
  const [p, a, b] = [pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n]];
  const out = (u: [number, number], v: [number, number]): [number, number] => {
    const len = Math.hypot(v[0] - u[0], v[1] - u[1]) || 1;
    // Points go round clockwise on screen (x right, z down): outward is to the left of travel.
    return [(v[1] - u[1]) / len, -(v[0] - u[0]) / len];
  };
  const [n1, n2] = [out(p, a), out(a, b)];
  const k = d / Math.max(0.2, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
  return [a[0] + (n1[0] + n2[0]) * k, a[1] + (n1[1] + n2[1]) * k];
}

/** Stamps round the foot of each part standing on the ground, where the ground is grass. */
function footRing(
  out: LeafList,
  f: FootLeaves,
  map: MapDoc,
  s: TerrainSampler,
  model: Model,
  w: number,
  d: number,
  rot: Turn,
  r: Rect,
  ground: number,
): void {
  // Grass here: dry land at the object's own height, no path.
  const keep = (x: number, z: number) => {
    const [tx, ty] = [Math.floor(x / 2 + 0.5), Math.floor(z / 2 + 0.5)];
    if (!s.isLand(tx, ty) || s.isWater(tx, ty)) return false;
    if (Math.abs(s.ground(tx, ty) - ground) > 0.05) return false;
    return !pathAt(map, Math.floor(x / 2), Math.floor(z / 2));
  };
  // As high as the lawn's own stamps stand.
  const y = ground + f.land.cushion.coreInset + f.land.leaves.push;
  const lift = groundLift(f.land, ground, f.heightScale, f.baseLevel);
  const out0 = 0.03;
  for (const sil of silhouettes(model, w, d, rot, { blockSize: f.heightScale / 2 })) {
    if (sil.bottom > 0.05) continue;
    const o = sil.outline;
    if (o.kind === "ellipse") {
      const rad = Math.max(2 * o.rx, 2 * o.rz) + out0;
      pushRing(out, f.land, r.x + 2 * o.cx, r.y + 2 * o.cz, rad, y, lift, keep);
      continue;
    }
    // Rings, tubes and meshes: no stamps (their outline from above is not one edge to follow).
    if (o.kind === "triangles") continue;
    const pts = o.points.map(([x, z]): [number, number] => [r.x + 2 * x, r.y + 2 * z]);
    if (pts.length < 3) continue;
    const c = pts.map((_, i) => miter(pts, i, out0));
    for (let k = 0; k < c.length; k++) {
      pushLine(out, f.land, c[k], c[(k + 1) % c.length], y, 60 + k, lift, keep);
    }
  }
}

/** Lowest ground (world y) under a minor rect: where an incline's foot stands. */
export function groundBelow(s: TerrainSampler, r: Rect): number {
  let y = Infinity;
  for (let ty = terrainOfMinor(r.y); ty <= terrainOfMinor(r.y + r.h - 1); ty++) {
    for (let tx = terrainOfMinor(r.x); tx <= terrainOfMinor(r.x + r.w - 1); tx++) {
      y = Math.min(y, s.ground(tx, ty));
    }
  }
  return y;
}

/** Highest ground (world y) under a minor rect; objects stand on flat ground by rule. */
export function groundUnder(s: TerrainSampler, r: Rect): number {
  let y = -Infinity;
  for (let ty = terrainOfMinor(r.y); ty <= terrainOfMinor(r.y + r.h - 1); ty++) {
    for (let tx = terrainOfMinor(r.x); tx <= terrainOfMinor(r.x + r.w - 1); tx++) {
      y = Math.max(y, s.ground(tx, ty));
    }
  }
  return y;
}

/** A unit primitive scaled to (sx, sy, sz) world units, turned so its x axis runs along (ux, uz). */
function pushTurned(
  out: LayerInstances,
  shape: Solid,
  finish: Finish,
  at: [number, number, number],
  size: [number, number, number],
  [ux, uz]: [number, number],
  color: string,
): void {
  const [sx, sy, sz] = size;
  const [c, s] = [ux, -uz];
  const key = finish === "matte" ? shape : `${finish} ${shape}`;
  const g = (out[key] ??= { finish, primitive: shape, matrices: [], colors: [] });
  g.matrices.push(c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, ...at, 1);
  g.colors.push(color);
}

/** A part a linking piece lays along its links: a plain box spanning the tile (0.9 wide or more). */
const isRail = (p: ModelPart): p is BoxPart =>
  p.shape === "box" && !p.round && !p.rotate && p.size[0] >= 0.9;

/**
 * A linking piece (fences.ts): its model's rails (plain boxes at least 0.9 tiles wide at rotation
 * 0) laid from the tile's center along each arm, and its other parts (posts) at each arm's end. A
 * rail as deep as the tile makes a solid wall: pieces join like the game's square hedges. Posts
 * shared by two pieces are drawn once (`posts` collects them across pieces). A plain post (an
 * unturned box, cylinder, cone or sphere) stands right on the end; any other part keeps its place
 * relative to the tile's center.
 */
function pushLinked(
  out: LayerInstances,
  inst: Instancer,
  model: Model,
  arms: Arm[],
  r: Rect,
  ground: number,
  hs: number,
  posts: Set<string>,
): void {
  const [cx, cz] = [r.x + 1, r.y + 1];
  const backs = armBacks(arms);
  for (const [k, [dx, dz]] of arms.entries()) {
    const len = Math.hypot(dx, dz);
    const u: [number, number] = [dx / len, dz / len];
    const [ex, ez] = [cx + dx, cz + dz];
    for (const p of model.parts) {
      if (isRail(p)) {
        // Across the rail, keep the part's offset from the piece's center line. Along it, the
        // rail runs from just behind the center (up to half its depth: the miter, armBacks, so a
        // bend's outer corner is filled as square hedges join in the game, without jutting) to
        // the arm's end, flush with the next piece.
        const off = 2 * (p.at[2] - 0.5);
        const back = backs[k] * p.size[2];
        const mid = (len - back) / 2;
        const at: [number, number, number] = [
          cx + u[0] * mid - u[1] * off,
          ground + p.at[1] * hs,
          cz + u[1] * mid + u[0] * off,
        ];
        const size: [number, number, number] = [len + back, p.size[1] * hs, 2 * p.size[2]];
        pushTurned(out, "box", p.finish ?? "matte", at, size, u, p.color);
        continue;
      }
      const key = `${ex},${ez},${ground},${JSON.stringify(p)}`;
      if (posts.has(key)) continue;
      posts.add(key);
      // A plain post stands centered on the end; anything else keeps its offset from the center.
      const plain = p.shape !== "group" && !p.rotate && instancedShape(p);
      const post: ModelPart = plain ? { ...p, at: [0.5, p.at[1], 0.5] } : p;
      inst.model(out, { parts: [post] }, placement(ex - 1, ground, ez - 1, 0, 1, 1));
    }
  }
}

/** Instances for every plant and item on the map. Pure. */
export function buildInstances(
  map: MapDoc,
  catalog: Catalog,
  s: TerrainSampler,
  heightScale: number,
  feet: FootLeaves | null = null,
  modelOf: (thing: Entity) => Model | undefined = () => undefined,
): {
  plants: LayerInstances;
  items: LayerInstances;
  plantLeaves: LeafList;
  itemLeaves: LeafList;
} {
  const plants = emptyInstances();
  const items = emptyInstances();
  const plantLeaves: LeafList = { matrices: [], colors: [] };
  const itemLeaves: LeafList = { matrices: [], colors: [] };
  const inst = new Instancer(heightScale / 2);
  for (const p of plantsOf(map)) {
    const r = plantRect(p);
    const g = groundUnder(s, r);
    const model = itemModel(catalog, p.type, { model: modelOf(p) });
    inst.model(plants, model, placement(r.x, g, r.y, 0, 1, 1));
    if (feet) footRing(plantLeaves, feet, map, s, model, 1, 1, 0, r, g);
  }
  const arms = fenceArms(map, catalog);
  const posts = new Set<string>();
  for (const i of itemsOf(map)) {
    const e = catalogEntry(catalog, i.type);
    const r = itemRect(catalog, i);
    const g = groundUnder(s, r);
    const { w, d } = itemSize(e);
    const own = modelOf(i);
    if (baseOf(catalog, i.type) === "incline" && e) {
      // Stands on the low ground and climbs to the cliff top (rule I6).
      const low = groundBelow(s, r);
      const look = itemModel(catalog, i.type, { model: own, rise: (g - low) / heightScale });
      inst.model(items, look, placement(r.x, low, r.y, i.rot, w, d));
      continue;
    }
    const full = itemModel(catalog, i.type, { model: own });
    const linked = arms.get(i.id);
    if (linked) {
      pushLinked(items, inst, full, linked, r, g, heightScale, posts);
      continue;
    }
    inst.model(items, full, placement(r.x, g, r.y, i.rot, w, d));
    if (feet) footRing(itemLeaves, feet, map, s, full, w, d, i.rot, r, g);
  }
  // Things on surfaces stand on the top of their item's model, at their own size, centered on
  // their place in the surface's grid.
  const hosts = surfaceHosts(map, catalog);
  for (const t of onSurfaces(map)) {
    const host = hosts.get(t.on);
    const b = host && onSurfaceBox(catalog, host, t);
    if (!host || !b) continue;
    const top = modelBounds(itemModel(catalog, host.type), { blockSize: heightScale / 2 })?.y1 ?? 0;
    const g = groundUnder(s, { grid: "minor", ...host.rect }) + top * heightScale;
    const { w, d } = itemSize(catalogEntry(catalog, t.type));
    const [tw, td] = b.rot === 90 || b.rot === 270 ? [d, w] : [w, d];
    const [cx, cz] = [b.x + b.w / 2, b.y + b.h / 2];
    const model = itemModel(catalog, t.type, { model: modelOf(t) });
    inst.model(items, model, placement(cx - tw, g, cz - td, b.rot, w, d));
  }
  return { plants, items, plantLeaves, itemLeaves };
}
