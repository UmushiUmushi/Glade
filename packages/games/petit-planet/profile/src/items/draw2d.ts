// The item formula, in 2D: how one catalog entry looks from above, with no map around it. Drawn in
// minor units (a tile is 2), the units every map of the game draws in: its model's own top view,
// in its parts' colors, with no outlines or shadows.

import { silhouettes, type Model, type Turn } from "@glade/render";
import { baseOf, catalogEntry, type BaseKind, type Catalog } from "../catalog";
import { lighten, PLAN } from "../plan-style";
import { frontSide } from "./model";

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
 * screen pixel.
 */
export function drawItem2D(
  ctx: CanvasRenderingContext2D,
  catalog: Catalog,
  type: string,
  r: Box,
  rot: number,
  px: number,
  opts: { model?: Model; as?: BaseKind } = {},
): void {
  const e = catalogEntry(catalog, type);
  const base = baseOf(catalog, type) ?? opts.as;
  const own = opts.model ?? e?.model;
  if (base === "plant") {
    if (own && e) drawModel(ctx, own, e.footprint, r, 0, px);
    else drawPlant(ctx, e?.shape ?? "blob", r);
    return;
  }
  if (base === "incline") drawShape(ctx, "incline", r, rot, px);
  else if (own && e) drawModel(ctx, own, e.footprint, r, rot, px);
  else drawShape(ctx, base === "bridge" ? "bridge" : (e?.shape ?? "block"), r, rot, px);
}

/** Draws filled round and square symbol shapes. */
function flat(ctx: CanvasRenderingContext2D) {
  const draw = (trace: () => void, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    trace();
    ctx.fill();
  };
  return {
    circle(x: number, y: number, rad: number, color: string) {
      draw(() => ctx.arc(x, y, rad, 0, Math.PI * 2), color);
    },
    rect(x: number, y: number, w: number, h: number, color: string) {
      draw(() => ctx.rect(x, y, w, h), color);
    },
    ellipse(x: number, y: number, rx: number, ry: number, color: string) {
      draw(() => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), color);
    },
  };
}

/** A plant with no model, by its shape: a tree, a flower bed, a crop row or a bush. */
function drawPlant(ctx: CanvasRenderingContext2D, shape: string, r: Box) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (shape) {
    case "trunk-cone": {
      const st = flat(ctx);
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
        flat(ctx).circle(cx + dx, cy + dy, 0.28, col);
      }
      return;
    case "row":
      for (let i = 0; i < 3; i++) {
        flat(ctx).rect(r.x + 0.25 + i * 0.55, r.y + 0.35, 0.35, 1.3, "#7fa83a");
      }
      return;
    default: {
      const st = flat(ctx);
      st.circle(cx, cy, 0.75, "#7f9f3a");
      st.circle(cx + 0.2, cy - 0.2, 0.35, lighten("#7f9f3a", 0.15));
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: string, r: Box, rot: number, px: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const m = Math.min(r.w, r.h) / 2;
  const st = flat(ctx);
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
      const dir = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] }[rot as 0 | 90 | 180 | 270];
      const tip = [cx + dir[0] * (r.w / 2) * 0.7, cy + dir[1] * (r.h / 2) * 0.7];
      const side = m * 0.45;
      ctx.fillStyle = PLAN.ink;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(
        cx - dir[1] * side - dir[0] * side * 0.2,
        cy + dir[0] * side - dir[1] * side * 0.2,
      );
      ctx.lineTo(
        cx + dir[1] * side - dir[0] * side * 0.2,
        cy - dir[0] * side - dir[1] * side * 0.2,
      );
      ctx.closePath();
      ctx.fill();
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
}

/** A model at one size and rotation, ready to draw. */
interface Prepared {
  shapes: Shape[];
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
    ({ leaf, outline: o }): Shape => {
      const base = { color: leaf.part.color, glass: leaf.part.finish === "glass" };
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
  const out = { shapes };
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

/**
 * A model seen from above: its parts lowest top first, so taller parts cover shorter ones. Glass
 * parts are see-through.
 */
function drawModel(
  ctx: CanvasRenderingContext2D,
  model: Model,
  footprint: { w: number; h: number },
  r: Box,
  rot: number,
  px: number,
) {
  const { shapes } = prepare(model, footprint, rot);
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
 * The arrow that shows a building's front (minor units): an arrow with a shaft, just outside the
 * middle of its front edge (the side rule B1 checks), pointing out, `size` long and kept off the
 * edge by a small gap. Its first point is the tip.
 */
export function frontArrow(r: Box, rot: number, size: number): [number, number][] {
  const side = frontSide(rot);
  const [ox, oy] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[side];
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  const gap = size * 0.2;
  // The middle of the arrow's base, then points along (a) and across (c) the arrow.
  const [bx, by] = [cx + (ox * r.w) / 2 + ox * gap, cy + (oy * r.h) / 2 + oy * gap];
  const at = (a: number, c: number): [number, number] => [
    bx + ox * a * size - oy * c * size,
    by + oy * a * size + ox * c * size,
  ];
  return [
    at(1, 0),
    at(0.5, 0.45),
    at(0.5, 0.18),
    at(0, 0.18),
    at(0, -0.18),
    at(0.5, -0.18),
    at(0.5, -0.45),
  ];
}

/**
 * Draws a building's front arrow: ink with a light edge, so it reads on any roof or ground and
 * isn't mistaken for the yellow problem marker.
 */
export function drawFrontArrow(ctx: CanvasRenderingContext2D, r: Box, rot: number, px: number) {
  const pts = frontArrow(r, rot, Math.max(1.2, 18 * px));
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.strokeStyle = PLAN.paper;
  ctx.lineWidth = 3 * px;
  ctx.stroke();
  ctx.fillStyle = PLAN.ink;
  ctx.fill();
  ctx.lineJoin = "miter";
}
