// The planet from straight above (its plan view) on a 2D canvas: terrain, waterfalls, cliff lines,
// paths, landmarks, plants and items; and what every view of it shares (its UI: layer toggles,
// grids, hover text, click selection). The host draws the grid lines, violations, flashes,
// selection, ruler and hover on top. Internally everything is drawn in minor cells (half a world tile), so the host's world
// transform is scaled by 1/2 here.

import type { MapUI, PlanView, RenderableMap } from "@glade/render";
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
}

const SAND = "#eadcb4";
const LEVELS = [
  "#6f9c58", // 0 (dug)
  "#88b566",
  "#9ac170",
  "#abcb7b",
  "#bbd586",
  "#c9de92",
  "#d6e69f",
  "#e2edad",
  "#ecf4bd", // 8
];
const WATER = "#5aa0d8";
const FALL = "#2f6ea8";
/** Visible world rect (minor cells) for a canvas of cssW x cssH under a view. */
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
  // Cliff lines between terrain cells of different height. Half an edge beside a cut or rounded
  // corner is left out; the corner draws its own line along the curve.
  if (layers.heights) {
    const grid = terrainGrid(map);
    const shaped = (X: number, Y: number) =>
      !!cornerAt(map, "terrainCorners", X, Y) &&
      resolveTerrainCorner(map, profile, X, Y).status === "shaped";
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const h = grid[ty][tx].h;
        const r = tRect(tx, ty);
        const right = grid[ty][tx + 1];
        const down = grid[ty + 1]?.[tx];
        const w = Math.max(px, 0.2);
        if (right && right.h !== h) {
          ctx.fillStyle = `rgba(35,45,25,${Math.min(0.85, 0.3 + 0.18 * Math.abs(right.h - h))})`;
          const [top, bottom] = [shaped(tx, ty - 1), shaped(tx, ty)];
          const y0 = top ? r.y + r.h / 2 : r.y;
          const y1 = bottom ? r.y + r.h / 2 : r.y + r.h;
          if (y1 > y0) ctx.fillRect(r.x + r.w - px, y0, w, y1 - y0);
        }
        if (down && down.h !== h) {
          ctx.fillStyle = `rgba(35,45,25,${Math.min(0.85, 0.3 + 0.18 * Math.abs(down.h - h))})`;
          const [left, rightEnd] = [shaped(tx - 1, ty), shaped(tx, ty)];
          const x0 = left ? r.x + r.w / 2 : r.x;
          const x1 = rightEnd ? r.x + r.w / 2 : r.x + r.w;
          if (x1 > x0) ctx.fillRect(x0, r.y + r.h - px, x1 - x0, w);
        }
      }
    }
  }

  // Cut and rounded water and cliff corners: the corner region in the color it takes, and a
  // cliff line along the curve.
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
          ? WATER
          : layers.heights
            ? LEVELS[Math.max(0, Math.min(8, c.surround.h))]
            : "#cfe0b8";
      polygon(ctx, pts);
      ctx.fill();
      if (layers.heights && c.kind === "cliff") {
        const curve = cornerCurve(V, c.dir, c.leg, c.shape);
        ctx.strokeStyle = `rgba(35,45,25,${Math.min(0.85, 0.3 + 0.18 * Math.abs(c.own.h - c.surround.h))})`;
        ctx.lineWidth = Math.max(px, 0.2);
        polygon(ctx, curve, false);
        ctx.stroke();
      }
    }
  }

  // Paths, with cut and rounded corners, in their catalog colors
  if (layers.paths) {
    const pathColor = (type: string) => pathEntry(s.catalog, type)?.color ?? "#999";
    for (const { X, Y } of pathCells(map)) {
      if (2 * X + 1 < vis.x0 || 2 * X > vis.x1 || 2 * Y + 1 < vis.y0 || 2 * Y > vis.y1) continue;
      const regions = pathCellRegions(map, profile, X, Y);
      if (regions === "square") {
        ctx.fillStyle = pathColor(pathAt(map, X, Y)!);
        ctx.fillRect(2 * X + 0.08, 2 * Y + 0.08, 1.84, 1.84);
        continue;
      }
      for (const { pts, type } of regions ?? []) {
        ctx.fillStyle = pathColor(type);
        polygon(ctx, pts);
        ctx.fill();
      }
    }
  }

  // Landmarks
  if (layers.landmarks) {
    for (const lm of profile.landmarks) {
      const r = toMinorRect(spec, { grid: "major", x: lm.x, y: lm.y, w: lm.w, h: lm.h });
      hatch(ctx, r, px);
      if (lm.lockTerrain) {
        const t = toMinorRect(spec, landmarkTerrainRect(lm));
        ctx.setLineDash([4 * px, 3 * px]);
        ctx.strokeStyle = "rgba(90,60,120,0.6)";
        ctx.lineWidth = px;
        ctx.strokeRect(t.x, t.y, t.w, t.h);
        ctx.setLineDash([]);
      }
      if (r.w * scale >= 60) {
        ctx.fillStyle = "rgba(60,40,90,0.85)";
        ctx.font = `${12 * px}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(lm.id, r.x + r.w / 2, r.y + r.h / 2);
      }
    }
  }

  // Plants
  if (layers.plants) {
    for (const p of plantsOf(map)) {
      const r = plantRect(p);
      if (!inVis(r, vis)) continue;
      drawItem2D(ctx, s.catalog, p.type, r, 0, px, { as: "plant", model: s.modelOf(p) });
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
      else drawItem2D(ctx, s.catalog, i.type, r, i.rot, px, { as: "item", model });
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
      drawItem2D(ctx, s.catalog, t.type, r, b.rot, px, { as: "item", model: s.modelOf(t) });
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
    sand: rgb(SAND),
    flat: rgb("#cfe0b8"),
    water: rgb(WATER),
    fall: rgb(FALL),
    levels: LEVELS.map(rgb),
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
              ? colors.levels[Math.max(0, Math.min(8, c.h))]
              : colors.flat;
      const o = (my * w + mx) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  canvas.getContext("2d")!.putImageData(img, 0, 0);
  cache = { map, key, canvas };
  return canvas;
}

function inVis(r: Rect, vis: { x0: number; y0: number; x1: number; y1: number }): boolean {
  return r.x <= vis.x1 && r.y <= vis.y1 && r.x + r.w >= vis.x0 && r.y + r.h >= vis.y0;
}

function hatch(ctx: CanvasRenderingContext2D, r: Rect, px: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = "rgba(120,90,160,0.12)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = "rgba(90,60,120,0.35)";
  ctx.lineWidth = px;
  ctx.beginPath();
  for (let d = -r.h; d < r.w; d += 3) {
    ctx.moveTo(r.x + d, r.y + r.h);
    ctx.lineTo(r.x + d + r.h, r.y);
  }
  ctx.stroke();
  ctx.restore();
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
      },
      layers as unknown as Layers,
      vis,
      scale,
    );
    ctx.restore();
  },
};
