// The planet from straight above (its plan view) on a 2D canvas, in the planner's flat colors lit
// like the 3D view (plan-style.ts): the sea, terrain, ponds and waterfalls, paths, the shadows
// raised ground casts, landmarks, plants and items; and what every view of it shares (its UI: layer toggles,
// grids, hover text, click selection). The host draws the grid lines, violations, flashes,
// selection, ruler and hover on top. Internally everything is drawn in minor cells (half a world
// tile), so the host's world transform is scaled by 1/2 here.

import { resolveLook, type MapUI, type PlanView, type RenderableMap } from "@glade/render";
import type { Entity, Selection } from "@glade/core";
import { boundingRect, type Box } from "@glade/core";
import type { BoxPart, Model, ModelPart } from "@glade/render";
import { fallSides } from "./analysis";
import {
  cornerCurve,
  cornerRegion,
  pathCellRegions,
  resolveTerrainCorner,
  vertexPoint,
} from "./corners";
import {
  surfaceHosts,
  cornerAt,
  cornerCells,
  itemRect,
  itemsOf,
  pathAt,
  pathCells,
  plantRect,
  plantsOf,
  terrainGrid,
  type MapDoc,
} from "./model";
import {
  gridSpec,
  isBeachMajor,
  isLandTerrain,
  landmarkTerrainRect,
  type Planet,
  type Profile,
} from "./profile";
import { catalogEntry, pathEntry, type Catalog } from "../../catalog";
import { profileOf } from "./data";
import { appModel, drawItem2D, itemSize } from "../../items";
import { LEVEL_MINOR } from "../../items/model";
import { levelColor, PLAN, POND_DROP, shadeFor, type Shade } from "../../plan-style";
import { onSurfaceBox, onSurfaces } from "../../surfaces";
import { armBacks, fenceArms, type Arm } from "./fences";
import { floodRegion } from "./select";
import { areaLabel, toMinorRect, type GridSpec, type Rect } from "./space";

export interface Layers {
  heights: boolean;
  water: boolean;
  paths: boolean;
  plants: boolean;
  items: boolean;
  landmarks: boolean;
}

export interface Scene {
  map: MapDoc;
  profile: Profile;
  catalog: Catalog;
  spec: GridSpec;
  /** The app's model for a placed thing, if it gives one (RenderableMap.itemModel). */
  modelOf(thing: Entity): Model | undefined;
  /** Where shadows fall, from the look's sun; none without it. */
  shade?: Shade;
}

/** Visible minor cells for a canvas of cssW x cssH under a minor-cell view. */
export function visibleMinor(
  spec: GridSpec,
  view: { scale: number; ox: number; oy: number },
  cssW: number,
  cssH: number,
) {
  const x0 = Math.max(0, Math.floor(-view.ox / view.scale));
  const y0 = Math.max(0, Math.floor(-view.oy / view.scale));
  const x1 = Math.min(spec.majorW * 2 - 1, Math.ceil((cssW - view.ox) / view.scale));
  const y1 = Math.min(spec.majorH * 2 - 1, Math.ceil((cssH - view.oy) / view.scale));
  return { x0, y0, x1, y1 };
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  s: Scene,
  layers: Layers,
  vis: { x0: number; y0: number; x1: number; y1: number },
  scale: number,
): void {
  const { map, profile, spec } = s;
  const px = 1 / scale; // one CSS pixel in world units
  const t0x = Math.max(0, Math.floor((vis.x0 + 1) / 2));
  const t0y = Math.max(0, Math.floor((vis.y0 + 1) / 2));
  const t1x = Math.min(spec.majorW, Math.floor((vis.x1 + 1) / 2));
  const t1y = Math.min(spec.majorH, Math.floor((vis.y1 + 1) / 2));
  const tRect = (tx: number, ty: number) =>
    toMinorRect(spec, { grid: "terrain", x: tx, y: ty, w: 1, h: 1 });

  // Terrain: one bitmap pixel per minor cell, scaled up without smoothing, so adjacent cells
  // never show anti-aliased seams.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(terrainBitmap(map, profile, spec, layers), 0, 0);
  const blocks = { t0x, t0y, t1x, t1y };
  // Waterfall streaks
  if (layers.water) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(px, 0.15);
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        for (const [, dx, dy] of fallSides(map, tx, ty)) {
          const r = tRect(tx, ty);
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx * 1.6, cy + dy * 1.6);
          ctx.stroke();
        }
      }
    }
  }

  // Cut and rounded water and cliff corners: the corner region in the color it takes.
  if (layers.heights || layers.water) {
    for (const v of cornerCells(map, "terrainCorners")) {
      if (
        2 * v.x + 3 < vis.x0 ||
        2 * v.x - 1 > vis.x1 ||
        2 * v.y + 3 < vis.y0 ||
        2 * v.y - 1 > vis.y1
      )
        continue;
      const r = resolveTerrainCorner(map, profile, v.x, v.y);
      if (r.status !== "shaped") continue;
      const c = r.corner;
      const V = vertexPoint(c.layer, c.vx, c.vy);
      const pts = cornerRegion(V, c.dir, c.leg, c.shape);
      ctx.fillStyle =
        layers.water && c.surround.water
          ? PLAN.pond
          : layers.heights
            ? levelColor(c.surround.h)
            : PLAN.grass;
      polygon(ctx, pts);
      ctx.fill();
    }
  }

  // Paths, with cut and rounded corners, in their catalog colors
  if (layers.paths) {
    const pathColor = (type: string) => pathEntry(s.catalog, type)?.color ?? PLAN.cream;
    for (const { X, Y, type } of pathCells(map)) {
      if (2 * X + 1 < vis.x0 || 2 * X > vis.x1 || 2 * Y + 1 < vis.y0 || 2 * Y > vis.y1) continue;
      const regions = pathCellRegions(map, profile, X, Y);
      if (regions === "square") {
        ctx.fillStyle = pathColor(type);
        ctx.fillRect(2 * X, 2 * Y, 2, 2);
        continue;
      }
      for (const { pts, type } of regions ?? []) {
        ctx.fillStyle = pathColor(type);
        polygon(ctx, pts);
        ctx.fill();
      }
    }
  }

  // The shadows raised ground casts on lower ground (and banks on ponds), over paths too.
  if (s.shade && (layers.heights || layers.water)) {
    drawGroundShadows(ctx, map, profile, spec, blocks, s.shade, layers);
  }

  // Landmarks: a pale plaza and its name on an ink tag, like the design's area labels. The dashed
  // line is the terrain it locks.
  if (layers.landmarks) {
    for (const lm of profile.landmarks) {
      const r = toMinorRect(spec, { grid: "major", x: lm.x, y: lm.y, w: lm.w, h: lm.h });
      drawLandmark(ctx, r, lm.name ?? lm.id, px, scale);
      if (lm.lockTerrain) {
        const t = toMinorRect(spec, landmarkTerrainRect(lm));
        ctx.setLineDash([4 * px, 3 * px]);
        ctx.strokeStyle = "rgba(61,54,50,0.35)";
        ctx.lineWidth = px;
        ctx.strokeRect(t.x, t.y, t.w, t.h);
        ctx.setLineDash([]);
      }
    }
  }

  // Plants
  if (layers.plants) {
    for (const p of plantsOf(map)) {
      const r = plantRect(p);
      if (!inVis(r, vis)) continue;
      drawItem2D(ctx, s.catalog, p.type, r, 0, px, {
        as: "plant",
        model: s.modelOf(p),
        shade: s.shade,
      });
    }
  }

  // Items
  if (layers.items) {
    const arms = fenceArms(map, s.catalog);
    for (const i of itemsOf(map)) {
      const r = itemRect(s.catalog, i);
      if (!inVis(r, vis)) continue;
      const model = s.modelOf(i);
      const linked = arms.get(i.id);
      if (linked) drawLinked(ctx, linked, r, px, linkLook(model));
      else drawItem2D(ctx, s.catalog, i.type, r, i.rot, px, { as: "item", model, shade: s.shade });
    }
    // Things on surfaces, at their own size, centered on their place in the surface's grid.
    const hosts = surfaceHosts(map, s.catalog);
    for (const t of onSurfaces(map)) {
      const host = hosts.get(t.on);
      const b = host && onSurfaceBox(s.catalog, host, t);
      if (!b) continue;
      const { w, d } = itemSize(catalogEntry(s.catalog, t.type));
      const [tw, td] = b.rot === 90 || b.rot === 270 ? [d, w] : [w, d];
      const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
      const r = { x: cx - tw, y: cy - td, w: 2 * tw, h: 2 * td };
      drawItem2D(ctx, s.catalog, t.type, r, b.rot, px, {
        as: "item",
        model: s.modelOf(t),
        shade: s.shade,
      });
    }
  }
}

/** The terrain blocks on screen, inclusive. */
interface Blocks {
  t0x: number;
  t0y: number;
  t1x: number;
  t1y: number;
}

/** Adds a quad to the current path, going clockwise, so one nonzero fill of many is their union. */
function addQuad(ctx: CanvasRenderingContext2D, q: [number, number][]) {
  let area = 0;
  for (let i = 0; i < q.length; i++) {
    const [a, b] = [q[i], q[(i + 1) % q.length]];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const pts = area < 0 ? [...q].reverse() : q;
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Point in polygon (even-odd), for points in minor units. */
function inside(pts: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * The shadows the ground casts, lit as the 3D view is: every edge where ground drops, facing away
 * from the sun, swept the way shadows fall, as long as the drop over the sun's elevation. A pond
 * lies a little below its banks, so banks shade it too. No lines: only the shadow shows an edge.
 * Half an edge beside a cut or rounded corner is left out; the corner's curve casts in its place.
 */
function drawGroundShadows(
  ctx: CanvasRenderingContext2D,
  map: MapDoc,
  profile: Profile,
  spec: GridSpec,
  b: Blocks,
  shade: Shade,
  layers: Layers,
) {
  const grid = terrainGrid(map);
  const level = (c: { h: number; water: boolean }) =>
    (layers.heights ? c.h : 0) - (layers.water && c.water ? POND_DROP : 0);
  const shaped = (X: number, Y: number) =>
    !!cornerAt(map, "terrainCorners", X, Y) &&
    resolveTerrainCorner(map, profile, X, Y).status === "shaped";
  const sweep = (drop: number) => drop * LEVEL_MINOR * shade.perHeight;
  /** Casts from the segment a-b toward normal n (pointing to the lower side). */
  let casts = 0;
  const cast: Cast = (a, b2, n, drop) => {
    if (n[0] * shade.dx + n[1] * shade.dy <= 0) return;
    const [vx, vy] = [shade.dx * sweep(drop), shade.dy * sweep(drop)];
    casts++;
    addQuad(ctx, [a, b2, [b2[0] + vx, b2[1] + vy], [a[0] + vx, a[1] + vy]]);
  };
  ctx.beginPath();
  for (let ty = b.t0y; ty <= b.t1y; ty++) {
    for (let tx = b.t0x; tx <= b.t1x; tx++) {
      const here = level(grid[ty][tx]);
      const r = toMinorRect(spec, { grid: "terrain", x: tx, y: ty, w: 1, h: 1 });
      const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.w, r.y + r.h];
      const [xm, ym] = [r.x + r.w / 2, r.y + r.h / 2];
      // Each side: its neighbor, its corners' vertices, its two ends and its outward normal.
      const sides = [
        [0, -1, [tx - 1, ty - 1], [tx, ty - 1], [x0, y0], [x1, y0]],
        [1, 0, [tx, ty - 1], [tx, ty], [x1, y0], [x1, y1]],
        [0, 1, [tx - 1, ty], [tx, ty], [x0, y1], [x1, y1]],
        [-1, 0, [tx - 1, ty - 1], [tx - 1, ty], [x0, y0], [x0, y1]],
      ] as const;
      for (const [dx, dy, va, vb, ea, eb] of sides) {
        const next = grid[ty + dy]?.[tx + dx];
        if (!next) continue;
        const drop = here - level(next);
        if (drop <= 0) continue;
        const a: [number, number] = shaped(...va) ? [dx ? ea[0] : xm, dy ? ea[1] : ym] : [...ea];
        const e: [number, number] = shaped(...vb) ? [dx ? eb[0] : xm, dy ? eb[1] : ym] : [...eb];
        if (a[0] !== e[0] || a[1] !== e[1]) cast(a, e, [dx, dy], drop);
      }
    }
  }
  castCorners(map, profile, b, level, cast);
  if (!casts) return;
  ctx.fillStyle = shade.color;
  ctx.fill();
}

/** Casts from a segment toward a normal (pointing to the lower side), for a drop in levels. */
type Cast = (a: [number, number], b: [number, number], n: [number, number], drop: number) => void;

/** Cut and rounded corners: the curve between a corner's two heights casts in place of its edges. */
function castCorners(
  map: MapDoc,
  profile: Profile,
  b: Blocks,
  level: (c: { h: number; water: boolean }) => number,
  cast: Cast,
) {
  for (const v of cornerCells(map, "terrainCorners")) {
    if (v.x < b.t0x - 1 || v.x > b.t1x || v.y < b.t0y - 1 || v.y > b.t1y) continue;
    const res = resolveTerrainCorner(map, profile, v.x, v.y);
    if (res.status !== "shaped") continue;
    const c = res.corner;
    const drop = level(c.own) - level(c.surround);
    if (drop === 0) continue;
    const V = vertexPoint(c.layer, c.vx, c.vy);
    const region = cornerRegion(V, c.dir, c.leg, c.shape).map(([x, y]): [number, number] => [
      2 * x,
      2 * y,
    ]);
    const curve = cornerCurve(V, c.dir, c.leg, c.shape).map(([x, y]): [number, number] => [
      2 * x,
      2 * y,
    ]);
    for (let i = 0; i + 1 < curve.length; i++) {
      const [p, q] = [curve[i], curve[i + 1]];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      let n: [number, number] = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const intoRegion = inside(region, mid[0] + n[0] * 0.05, mid[1] + n[1] * 0.05);
      // The region takes the surrounding height: it is the low side when the corner's own is higher.
      if (intoRegion !== drop > 0) n = [-n[0], -n[1]];
      cast(p, q, n, Math.abs(drop));
    }
  }
}

let cache: { map: MapDoc; key: string; canvas: HTMLCanvasElement } | null = null;

function terrainBitmap(map: MapDoc, profile: Profile, spec: GridSpec, layers: Layers) {
  const key = `${layers.heights}${layers.water}`;
  if (cache && cache.map === map && cache.key === key) return cache.canvas;
  const w = spec.majorW * 2;
  const h = spec.majorH * 2;
  const canvas = cache?.canvas ?? document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const img = new ImageData(w, h);
  const grid = terrainGrid(map);
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const colors = {
    sand: rgb(PLAN.sand),
    flat: rgb(PLAN.grass),
    water: rgb(PLAN.pond),
    fall: rgb(PLAN.fall),
    levels: new Map<number, number[]>(),
  };
  const level = (h: number) => {
    let c = colors.levels.get(h);
    if (!c) colors.levels.set(h, (c = rgb(levelColor(h))));
    return c;
  };
  for (let my = 0; my < h; my++) {
    const ty = Math.floor((my + 1) / 2);
    for (let mx = 0; mx < w; mx++) {
      const tx = Math.floor((mx + 1) / 2);
      const c = grid[ty][tx];
      // The buildable tiles' half of a beach block is land-colored: the game's grass border.
      const land =
        isLandTerrain(profile, tx, ty) ||
        !isBeachMajor(profile, Math.floor(mx / 2), Math.floor(my / 2));
      const col =
        layers.water && c.water
          ? fallSides(map, tx, ty).length
            ? colors.fall
            : colors.water
          : !land
            ? colors.sand
            : layers.heights
              ? level(c.h)
              : colors.flat;
      const o = (my * w + mx) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- a new canvas always gives a 2D context
  canvas.getContext("2d")!.putImageData(img, 0, 0);
  cache = { map, key, canvas };
  return canvas;
}

function inVis(r: Rect, vis: { x0: number; y0: number; x1: number; y1: number }): boolean {
  return r.x <= vis.x1 && r.y <= vis.y1 && r.x + r.w >= vis.x0 && r.y + r.h >= vis.y0;
}

/** A landmark's plaza and name tag (minor units; `px` is one screen pixel). */
function drawLandmark(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  name: string,
  px: number,
  scale: number,
) {
  ctx.fillStyle = "rgba(252,249,232,0.55)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 1.5);
  ctx.fill();
  if (r.w * scale < 60) return;
  ctx.font = `900 ${12 * px}px Nunito, ui-rounded, system-ui, sans-serif`;
  const [padX, h] = [10 * px, 22 * px];
  const w = ctx.measureText(name).width + 2 * padX;
  const [x, y] = [r.x + 8 * px, r.y - h / 2];
  ctx.fillStyle = PLAN.ink;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = PLAN.sun;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x + padX, y + h / 2);
}

/** A linking piece's rail (its first part spanning the tile, fences.ts) and whether it has posts. */
/** A rail of a linking piece: a plain box spanning the tile (as in 3D). */
const isRail = (p: ModelPart): p is BoxPart =>
  p.shape === "box" && !p.round && !p.rotate && p.size[0] >= 0.9;

function linkLook(model: Model | undefined): { color: string; depth: number; posts: boolean } {
  const rail = model?.parts.find(isRail);
  return {
    color: rail?.color ?? "#7a5a3a",
    depth: rail?.size[2] ?? 0.06,
    posts: !model || model.parts.some((p) => !isRail(p)),
  };
}

/**
 * A linking piece from above (fences.ts): along each arm a rail as deep as the model's, from its
 * miter behind the center to the arm's end (as in 3D), and a post at each end if it has posts.
 */
function drawLinked(
  ctx: CanvasRenderingContext2D,
  arms: Arm[],
  r: Rect,
  px: number,
  look: { color: string; depth: number; posts: boolean },
) {
  const [cx, cy] = [r.x + 1, r.y + 1];
  // Minor units: a tile is 2.
  const w = Math.max(2 * look.depth, 2.5 * px, 0.25);
  ctx.fillStyle = look.color;
  const backs = armBacks(arms);
  for (const [k, [dx, dy]] of arms.entries()) {
    const len = Math.hypot(dx, dy);
    const [ux, uy] = [dx / len, dy / len];
    const [nx, ny] = [-uy * (w / 2), ux * (w / 2)];
    const [bx, by] = [cx - (ux * w * backs[k]) / 2, cy - (uy * w * backs[k]) / 2];
    const [ex, ey] = [cx + dx, cy + dy];
    ctx.beginPath();
    ctx.moveTo(bx + nx, by + ny);
    ctx.lineTo(ex + nx, ey + ny);
    ctx.lineTo(ex - nx, ey - ny);
    ctx.lineTo(bx - nx, by - ny);
    ctx.closePath();
    ctx.fill();
  }
  if (!look.posts) return;
  ctx.fillStyle = "#5a3e24";
  for (const [dx, dy] of arms) ctx.fillRect(cx + dx - 0.15, cy + dy - 0.15, 0.3, 0.3);
}

/** A path through points given in tiles (this canvas draws in minor cells). */
function polygon(ctx: CanvasRenderingContext2D, pts: [number, number][], close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(2 * x, 2 * y) : ctx.moveTo(2 * x, 2 * y)));
  if (close) ctx.closePath();
}

/** Terrain cell under a minor-space point (terrain tx covers minor 2tx-1..2tx). */
export function terrainAtPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.floor((Math.floor(p.x) + 1) / 2), y: Math.floor((Math.floor(p.y) + 1) / 2) };
}

const LAYERS: { id: keyof Layers; label: string }[] = [
  { id: "heights", label: "Heights" },
  { id: "water", label: "Water" },
  { id: "paths", label: "Paths" },
  { id: "plants", label: "Plants" },
  { id: "items", label: "Items" },
  { id: "landmarks", label: "Landmarks" },
];

/** A world point (tiles) as a minor-space point. */
const toMinor = (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 });

/** What every view of the planet shares: layer toggles, grids, hover text, click selection. */
export const ui: MapUI = {
  layerNames: () => LAYERS.map((l) => ({ ...l, default: true })),

  grids: () => ({
    // Base cells start at even minor lines; terrain blocks at odd ones (block t spans 2t-1..2t).
    snap: [
      { grid: "major", label: "Base", color: "20,20,20", alpha: 0.35 },
      { grid: "terrain", label: "Terrain", color: "236,220,255", alpha: 0.6 },
    ],
    fine: "minor",
    areas: "area",
  }),

  hover(doc, g, world) {
    const game = g as Planet;
    const map = doc as MapDoc;
    const spec = gridSpec(profileOf(game));
    const catalog = game.catalog;
    const p = toMinor(world);
    const mx = Math.floor(p.x);
    const my = Math.floor(p.y);
    if (mx < 0 || my < 0 || mx >= spec.majorW * 2 || my >= spec.majorH * 2) return "off map";
    const X = Math.floor(mx / 2);
    const Y = Math.floor(my / 2);
    const t = terrainAtPoint(p);
    const cell = terrainGrid(map)[t.y][t.x];
    const contains = (r: Rect) => mx >= r.x && my >= r.y && mx < r.x + r.w && my < r.y + r.h;
    const objs = [
      ...plantsOf(map)
        .filter((pl) => contains(plantRect(pl)))
        .map((pl) => `${pl.type} ${pl.id}`),
      ...itemsOf(map)
        .filter((i) => contains(itemRect(catalog, i)))
        .map((i) => {
          const e = catalogEntry(catalog, i.type);
          const extra = !e ? " (not in the catalog)" : i.note ? ` "${i.note}"` : "";
          return `${i.type} ${i.id}${extra}`;
        }),
    ];
    // Things on surfaces under the point (their boxes are in fractions of a half tile).
    const hosts = surfaceHosts(map, catalog);
    for (const thing of onSurfaces(map)) {
      const host = hosts.get(thing.on);
      const b = host && onSurfaceBox(catalog, host, thing);
      if (b && p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h) {
        objs.push(`${thing.type} ${thing.id} on ${thing.on}`);
      }
    }
    return [
      `major ${X},${Y} · minor ${mx},${my}`,
      `terrain ${t.x},${t.y} · h ${cell.h}${cell.water ? " · water" : ""}`,
      areaLabel(Math.floor(X / spec.areaSize), Math.floor(Y / spec.areaSize)),
      `path: ${pathAt(map, X, Y) ?? "none"}`,
      `objects: ${objs.join(", ") || "none"}`,
    ].join("\n");
  },

  /** A click flood-selects a water body, or the same-level dry terrain around the point. */
  clickSelect(doc, g, world): Omit<Selection, "boxes" | "updated"> | null {
    const game = g as Planet;
    const spec = gridSpec(profileOf(game));
    const grid = terrainGrid(doc as MapDoc);
    const t = terrainAtPoint(toMinor(world));
    const seed = grid[t.y]?.[t.x];
    if (!seed) return null;
    const cells = seed.water
      ? floodRegion(spec, "terrain", [t.x, t.y], (x, y) => grid[y][x].water)
      : floodRegion(
          spec,
          "terrain",
          [t.x, t.y],
          (x, y) => !grid[y][x].water && grid[y][x].h === seed.h,
        );
    const bbox = boundingRect(cells);
    if (!bbox) return null;
    return { rects: [bbox], cells, label: seed.water ? "water body" : `level-${seed.h} terrain` };
  },
};

/** Shadows for the look's default time of day (the 3D view's midday sun), kept per style. */
const shades = new WeakMap<object, Shade>();
function shadeOf(game: Planet & RenderableMap): Shade | undefined {
  const style = game.style?.defaults;
  if (!style) return undefined;
  let shade = shades.get(style);
  if (!shade) shades.set(style, (shade = shadeFor(resolveLook(style).light.sun)));
  return shade;
}

/** The plan view: the island from straight above. */
export const plan: PlanView = {
  draw(ctx, doc, g, layers, visible: Box, pxPerUnit) {
    const game = g as Planet;
    const spec = gridSpec(profileOf(game));
    const scale = pxPerUnit / 2;
    const vis = {
      x0: Math.max(0, Math.floor(visible.x * 2)),
      y0: Math.max(0, Math.floor(visible.y * 2)),
      x1: Math.min(spec.majorW * 2 - 1, Math.ceil((visible.x + visible.w) * 2)),
      y1: Math.min(spec.majorH * 2 - 1, Math.ceil((visible.y + visible.h) * 2)),
    };
    const map = doc as MapDoc;
    // The sea round the island, as far as the screen shows.
    ctx.fillStyle = PLAN.sea;
    ctx.fillRect(visible.x, visible.y, visible.w, visible.h);
    ctx.save();
    ctx.scale(0.5, 0.5);
    drawScene(
      ctx,
      {
        map,
        profile: profileOf(game),
        catalog: game.catalog,
        spec,
        modelOf: (thing) => appModel(game as Planet & RenderableMap, thing),
        shade: shadeOf(game as Planet & RenderableMap),
      },
      layers as unknown as Layers,
      vis,
      scale,
    );
    ctx.restore();
  },
};
