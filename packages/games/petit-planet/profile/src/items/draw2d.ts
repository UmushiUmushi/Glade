// The item formula, in 2D: how one catalog entry looks from above, with no map around it. Drawn in
// minor units (a tile is 2), the units every map of the game draws in: its model's own top view,
// in its parts' colors, with no outlines, and on request a soft shadow south-east of it
// (plan-style.ts). Also the small rounded triangles that show which way a thing points.

import { convexHull, silhouettes, type Model, type Turn } from "@glade/render";
import { baseOf, catalogEntry, type BaseKind, type Catalog } from "../catalog";
import { lighten, PLAN, SHADE } from "../plan-style";
import { frontSide, LEVEL_MINOR } from "./model";

/** A rect in minor units. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The catalog entry named `type` seen from above, filling the rect `r` at rotation `rot`: its
 * model's top view (or `model`'s in its place), or a symbol for its shape when it has none, and
 * an incline's steps. `as` is the base kind to draw a type the catalog lacks as. `px` is one
 * screen pixel. With `shadow`, it casts a soft shadow, once it is big enough on screen to see it.
 */
export function drawItem2D(
  ctx: CanvasRenderingContext2D,
  catalog: Catalog,
  type: string,
  r: Box,
  rot: number,
  px: number,
  opts: { model?: Model; as?: BaseKind; shadow?: boolean } = {},
): void {
  const e = catalogEntry(catalog, type);
  const base = baseOf(catalog, type) ?? opts.as;
  const own = opts.model ?? e?.model;
  const shadow = !!opts.shadow && Math.min(r.w, r.h) / px >= SHADOW_MIN_PX;
  if (base === "plant") {
    if (own && e) drawModel(ctx, own, e.footprint, r, 0, px, shadow);
    else drawPlant(ctx, e?.shape ?? "blob", r, shadow);
    return;
  }
  if (base === "incline") drawShape(ctx, "incline", r, rot, px, false);
  else if (own && e) drawModel(ctx, own, e.footprint, r, rot, px, shadow);
  else drawShape(ctx, base === "bridge" ? "bridge" : (e?.shape ?? "block"), r, rot, px, shadow);
}

/** Below this many screen pixels across, a thing casts no shadow (it couldn't be seen). */
export const SHADOW_MIN_PX = 8;

/** How tall a symbol (a thing with no model) stands for its shadow, in levels. */
const SYMBOL_HEIGHT = 0.6;

/**
 * Draws filled round and square symbol shapes; with `shadow`, the first one drawn casts a soft
 * shadow as if it stood SYMBOL_HEIGHT tall.
 */
function flat(ctx: CanvasRenderingContext2D, shadow: boolean) {
  let first = true;
  const draw = (trace: (ox: number, oy: number) => void, color: string) => {
    if (first && shadow) {
      const len = SYMBOL_HEIGHT * LEVEL_MINOR * SHADE.perHeight;
      ctx.fillStyle = SHADE.color;
      ctx.beginPath();
      for (let k = 1; k <= 6; k++) trace((SHADE.dx * len * k) / 6, (SHADE.dy * len * k) / 6);
      ctx.fill();
    }
    first = false;
    ctx.fillStyle = color;
    ctx.beginPath();
    trace(0, 0);
    ctx.fill();
  };
  return {
    circle(x: number, y: number, rad: number, color: string) {
      draw((ox, oy) => {
        ctx.moveTo(x + ox + rad, y + oy);
        ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
      }, color);
    },
    rect(x: number, y: number, w: number, h: number, color: string) {
      draw((ox, oy) => ctx.rect(x + ox, y + oy, w, h), color);
    },
    ellipse(x: number, y: number, rx: number, ry: number, color: string) {
      draw((ox, oy) => {
        ctx.moveTo(x + ox + rx, y + oy);
        ctx.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2);
      }, color);
    },
  };
}

/** A plant with no model, by its shape: a tree, a flower bed, a crop row or a bush. */
function drawPlant(ctx: CanvasRenderingContext2D, shape: string, r: Box, shadow: boolean) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (shape) {
    case "trunk-cone": {
      const st = flat(ctx, shadow);
      st.circle(cx, cy, 0.85, "#5f7d2a");
      st.circle(cx - 0.2, cy - 0.2, 0.45, "#6f8f34");
      return;
    }
    case "dots":
      for (const [dx, dy, col] of [
        [-0.45, -0.35, "#e39aac"],
        [0.4, -0.3, PLAN.sun],
        [-0.1, 0.4, "#c9a7e8"],
        [0.45, 0.45, "#e39aac"],
      ] as const) {
        flat(ctx, shadow).circle(cx + dx, cy + dy, 0.28, col);
      }
      return;
    case "row":
      for (let i = 0; i < 3; i++) {
        flat(ctx, shadow).rect(r.x + 0.25 + i * 0.55, r.y + 0.35, 0.35, 1.3, "#7fa83a");
      }
      return;
    default: {
      const st = flat(ctx, shadow);
      st.circle(cx, cy, 0.75, "#7f9f3a");
      st.circle(cx + 0.2, cy - 0.2, 0.35, lighten("#7f9f3a", 0.15));
    }
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  r: Box,
  rot: number,
  px: number,
  shadow: boolean,
) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const m = Math.min(r.w, r.h) / 2;
  const st = flat(ctx, shadow);
  const inset = (d: number, color: string) =>
    st.rect(r.x + d, r.y + d, r.w - 2 * d, r.h - 2 * d, color);
  const lines = (color: string, draw: () => void) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = px;
    ctx.beginPath();
    draw();
    ctx.stroke();
  };
  switch (shape) {
    case "incline": {
      // Four steps, lighter toward the high end (north at rotation 0, turning clockwise), with a
      // notch pointing up the incline.
      const alongY = rot === 0 || rot === 180;
      const highFirst = rot === 0 || rot === 270;
      const len = alongY ? r.h : r.w;
      const d = len / 4;
      for (let k = 0; k < 4; k++) {
        const off = highFirst ? k * d : len - (k + 1) * d;
        const shade = 230 - k * 18;
        ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 30})`;
        if (alongY) ctx.fillRect(r.x, r.y + off, r.w, d);
        else ctx.fillRect(r.x + off, r.y, d, r.h);
      }
      const [ux, uy] = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] }[
        rot as 0 | 90 | 180 | 270
      ];
      // A small rounded triangle pointing up the incline, its base across the middle.
      const size = Math.min(m * 0.9, Math.max(0.6, 14 * px));
      drawMarker(ctx, triangle(cx - (ux * size) / 2, cy - (uy * size) / 2, ux, uy, size), px);
      return;
    }
    case "bridge": {
      inset(0, "#c99a62");
      const alongY = rot === 0 || rot === 180;
      lines("rgba(61,54,50,0.45)", () => {
        for (let k = 0.5; k < (alongY ? r.h : r.w); k += 0.5) {
          if (alongY) {
            ctx.moveTo(r.x, r.y + k);
            ctx.lineTo(r.x + r.w, r.y + k);
          } else {
            ctx.moveTo(r.x + k, r.y);
            ctx.lineTo(r.x + k, r.y + r.h);
          }
        }
      });
      return;
    }
    case "lamp":
    case "tall-lamp":
      st.circle(cx, cy, m * 0.45, PLAN.ink);
      st.circle(cx, cy, m * (shape === "lamp" ? 0.25 : 0.32), PLAN.sun);
      return;
    case "lump":
      st.circle(cx, cy, m * 0.8, "#b9b4a6");
      st.circle(cx - m * 0.2, cy - m * 0.25, m * 0.3, lighten("#b9b4a6", 0.4));
      return;
    case "ring":
      st.circle(cx, cy, m * 0.9, "#b9b4a6");
      st.circle(cx, cy, m * 0.6, "#efa05a");
      st.circle(cx, cy, m * 0.28, PLAN.sun);
      return;
    case "brazier":
      st.circle(cx, cy, m * 0.7, "#6e6245");
      st.circle(cx, cy, m * 0.45, "#efa05a");
      return;
    case "pyramid":
      inset(0.1, "#efa05a");
      lines("rgba(61,54,50,0.45)", () => {
        ctx.moveTo(r.x + 0.1, r.y + 0.1);
        ctx.lineTo(r.x + r.w - 0.1, r.y + r.h - 0.1);
        ctx.moveTo(r.x + r.w - 0.1, r.y + 0.1);
        ctx.lineTo(r.x + 0.1, r.y + r.h - 0.1);
      });
      return;
    case "rail":
      if (r.w >= r.h) st.rect(r.x, cy - 0.15, r.w, 0.3, "#b98f52");
      else st.rect(cx - 0.15, r.y, 0.3, r.h, "#b98f52");
      return;
    case "hedge":
      inset(0.08, "#5f7d2a");
      inset(0.35, "#7f9f3a");
      return;
    case "topiary":
      st.circle(cx, cy, m * 0.8, "#5f7d2a");
      st.circle(cx - m * 0.25, cy - m * 0.25, m * 0.3, "#a4c148");
      return;
    case "pot":
      st.circle(cx, cy, m * 0.55, "#c98a5a");
      st.circle(cx, cy, m * 0.4, "#7f9f3a");
      return;
    case "fountain":
      st.circle(cx, cy, m * 0.95, PLAN.cream);
      st.circle(cx, cy, m * 0.75, PLAN.pond);
      st.circle(cx, cy, m * 0.25, PLAN.paper);
      return;
    case "tank":
      inset(0.12, "#bfe8f7");
      return;
    case "umbrella":
      st.circle(cx, cy, m * 0.95, "#e39aac");
      st.circle(cx, cy, m * 0.55, PLAN.paper);
      st.circle(cx, cy, m * 0.15, "#b98f52");
      return;
    case "sofa":
    case "lounge":
    case "bed":
    case "pillow":
      inset(0.1, shape === "bed" ? PLAN.cream : "#e39aac");
      st.rect(r.x + 0.4, r.y + 0.4, r.w - 0.8, r.h - 0.8, shape === "bed" ? "#89b5b2" : "#f3c3cf");
      return;
    case "tub":
      inset(0.1, PLAN.paper);
      st.rect(r.x + 0.35, r.y + 0.35, r.w - 0.7, r.h - 0.7, "#bfe8f7");
      return;
    case "stall":
      inset(0.1, "#b98f52");
      ctx.fillStyle = "#e39aac";
      for (let k = 0; k < r.w - 0.2; k += 0.5) {
        if (Math.round(k * 2) % 2 === 0)
          ctx.fillRect(r.x + 0.1 + k, r.y + 0.1, 0.5, (r.h - 0.2) / 2);
      }
      return;
    case "boat":
      st.ellipse(cx, cy, r.w / 2 - 0.1, r.h / 2 - 0.1, "#debe79");
      return;
    case "bin":
    case "stool":
      st.circle(cx, cy, m * 0.6, shape === "bin" ? "#89b5b2" : "#b98f52");
      return;
    case "decor":
    case "food":
      st.circle(cx, cy, m * 0.4, shape === "food" ? "#efc05a" : "#c9a7e8");
      return;
    case "sign":
      st.rect(r.x + 0.2, cy - 0.25, r.w - 0.4, 0.5, "#b98f52");
      return;
    case "shelf":
      inset(0.1, "#b98f52");
      lines("rgba(61,54,50,0.45)", () => {
        for (let k = 0.5; k < r.w - 0.1; k += 0.5) {
          ctx.moveTo(r.x + k, r.y + 0.1);
          ctx.lineTo(r.x + k, r.y + r.h - 0.1);
        }
      });
      return;
    default:
      // bench, chair, table, box and anything new: a cream block, as the design draws furniture.
      inset(0.1, PLAN.cream);
  }
}

/** One part from above, ready to trace: an ellipse, or rings of points going clockwise. */
interface Shape {
  color: string;
  glass: boolean;
  mesh: boolean;
  ellipse: { cx: number; cy: number; rx: number; ry: number } | null;
  /** Flat x, y lists in minor units from the footprint's corner. */
  rings: number[][];
  /** Lowest and highest point, in levels (blocks). */
  bottom: number;
  top: number;
}

/** A model at one size and rotation, ready to draw, and its shadow once it was needed. */
interface Prepared {
  shapes: Shape[];
  shadow: number[][] | null;
}

/** Prepared models, kept as long as the model lives: working out silhouettes is the slow part. */
const preparedModels = new WeakMap<Model, Map<string, Prepared>>();

/** Clockwise on screen, as ellipses go, so one nonzero fill of many outlines is their union. */
function clockwise(pts: number[]): number[] {
  let area = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    area += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  if (area >= 0) return pts;
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
  return out;
}

function prepare(model: Model, footprint: { w: number; h: number }, rot: number): Prepared {
  const key = `${footprint.w},${footprint.h},${rot}`;
  let byKey = preparedModels.get(model);
  const known = byKey?.get(key);
  if (known) return known;
  const shapes = silhouettes(model, footprint.w / 2, footprint.h / 2, rot as Turn).map(
    ({ leaf, outline: o, bottom, top }): Shape => {
      const base = { color: leaf.part.color, glass: leaf.part.finish === "glass", bottom, top };
      if (o.kind === "ellipse") {
        const ellipse = { cx: 2 * o.cx, cy: 2 * o.cz, rx: 2 * o.rx, ry: 2 * o.rz };
        return { ...base, mesh: false, ellipse, rings: [] };
      }
      if (o.kind === "polygon") {
        return {
          ...base,
          mesh: false,
          ellipse: null,
          rings: [clockwise(o.points.flat().map((v) => 2 * v))],
        };
      }
      const rings: number[][] = [];
      for (let i = 0; i < o.points.length; i += 6) {
        rings.push(clockwise(o.points.slice(i, i + 6).map((v) => 2 * v)));
      }
      return { ...base, mesh: true, ellipse: null, rings };
    },
  );
  const out: Prepared = { shapes, shadow: null };
  if (!byKey) preparedModels.set(model, (byKey = new Map()));
  byKey.set(key, out);
  return out;
}

/** Adds a shape to the current path, shifted by (ox, oy) minor units. */
function trace(ctx: CanvasRenderingContext2D, sh: Shape, ox: number, oy: number) {
  const e = sh.ellipse;
  if (e) {
    ctx.moveTo(ox + e.cx + e.rx, oy + e.cy);
    ctx.ellipse(ox + e.cx, oy + e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  for (const ring of sh.rings) {
    ctx.moveTo(ox + ring[0], oy + ring[1]);
    for (let i = 2; i < ring.length; i += 2) ctx.lineTo(ox + ring[i], oy + ring[i + 1]);
    ctx.closePath();
  }
}

/** The convex pieces of a shape's outline, as point lists (an ellipse as 16 points). */
function pieces(sh: Shape): [number, number][][] {
  const e = sh.ellipse;
  if (e) {
    return [
      Array.from({ length: 16 }, (_, i): [number, number] => {
        const a = (i / 16) * Math.PI * 2;
        return [e.cx + e.rx * Math.cos(a), e.cy + e.ry * Math.sin(a)];
      }),
    ];
  }
  return sh.rings.map((ring) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
    return pts;
  });
}

/**
 * A model's shadow: each part's outline swept from where its bottom's shadow falls to where its
 * top's does (the hull of the two), so taller parts cast longer shadows and thin tall ones a solid
 * streak. Worked out once per prepared model.
 */
function shadowOf(prepared: Prepared): number[][] {
  if (prepared.shadow) return prepared.shadow;
  const rings: number[][] = [];
  for (const sh of prepared.shapes) {
    const [t0, t1] = [sh.bottom, sh.top].map((h) => h * LEVEL_MINOR * SHADE.perHeight);
    for (const piece of pieces(sh)) {
      const moved = (t: number) =>
        piece.map(([x, y]): [number, number] => [x + SHADE.dx * t, y + SHADE.dy * t]);
      rings.push(clockwise(convexHull([...moved(t0), ...moved(t1)]).flat()));
    }
  }
  prepared.shadow = rings;
  return rings;
}

/**
 * A model seen from above: with `shadow`, its soft shadow first (filled once, so overlaps don't
 * darken), then its parts lowest top first, so taller parts cover shorter ones. Glass parts are
 * see-through.
 */
function drawModel(
  ctx: CanvasRenderingContext2D,
  model: Model,
  footprint: { w: number; h: number },
  r: Box,
  rot: number,
  px: number,
  shadow: boolean,
) {
  const prepared = prepare(model, footprint, rot);
  const { shapes } = prepared;
  if (shadow) {
    ctx.fillStyle = SHADE.color;
    ctx.beginPath();
    for (const ring of shadowOf(prepared)) {
      ctx.moveTo(r.x + ring[0], r.y + ring[1]);
      for (let i = 2; i < ring.length; i += 2) ctx.lineTo(r.x + ring[i], r.y + ring[i + 1]);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.lineWidth = px;
  for (const sh of shapes) {
    ctx.globalAlpha = sh.glass ? 0.45 : 1;
    ctx.fillStyle = sh.color;
    ctx.beginPath();
    trace(ctx, sh, r.x, r.y);
    if (sh.mesh) {
      // Close the hairline seams between a mesh's triangles.
      ctx.strokeStyle = sh.color;
      ctx.stroke();
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * A triangle `size` long whose base is centred on (bx, by), pointing along the unit (ux, uy), as
 * wide as it is long. Its first point is the tip.
 */
function triangle(
  bx: number,
  by: number,
  ux: number,
  uy: number,
  size: number,
): [number, number][] {
  const half = size * 0.5;
  return [
    [bx + ux * size, by + uy * size],
    [bx - uy * half, by + ux * half],
    [bx + uy * half, by - ux * half],
  ];
}

/**
 * The marker that shows a building's front (minor units): a small triangle just outside the
 * middle of its front edge (the side rule B1 checks), pointing out, `size` long. Its first point
 * is the tip.
 */
export function frontArrow(r: Box, rot: number, size: number): [number, number][] {
  const [ux, uy] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[frontSide(rot)];
  const gap = size * 0.25;
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  return triangle(cx + ux * (r.w / 2 + gap), cy + uy * (r.h / 2 + gap), ux, uy, size);
}

/**
 * A pointing marker in Petit Planet's style: a small ink triangle with rounded corners and a thin
 * cream edge, so it reads on any roof, step or ground.
 */
function drawMarker(ctx: CanvasRenderingContext2D, pts: [number, number][], px: number) {
  const [a, b, c] = pts;
  const round = Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.12;
  ctx.beginPath();
  ctx.moveTo((c[0] + a[0]) / 2, (c[1] + a[1]) / 2);
  ctx.arcTo(a[0], a[1], b[0], b[1], round);
  ctx.arcTo(b[0], b[1], c[0], c[1], round);
  ctx.arcTo(c[0], c[1], a[0], a[1], round);
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.strokeStyle = PLAN.paper;
  ctx.lineWidth = 3 * px;
  ctx.stroke();
  ctx.fillStyle = PLAN.ink;
  ctx.fill();
  ctx.lineJoin = "miter";
}

/** Draws a building's front marker, readable at any zoom. */
export function drawFrontArrow(ctx: CanvasRenderingContext2D, r: Box, rot: number, px: number) {
  drawMarker(ctx, frontArrow(r, rot, Math.max(0.9, 13 * px)), px);
}
