// The item formula, in 2D: how one catalog entry looks from above, with no map around it. Drawn in
// minor units (a tile is 2), the units every map of the game draws in.

import { silhouettes, type Model, type Turn } from "@glade/render";
import { baseOf, catalogEntry, isA, type BaseKind, type Catalog } from "../catalog";
import { frontSide } from "./model";

/** A rect in minor units. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The catalog entry named `type` seen from above, filling the rect `r` at rotation `rot`: a plant's
 * symbol for its shape; an item's model as silhouettes (or `model` in its place), or a symbol for
 * its shape when it has none; an incline's steps; and a building's front, as a door bar and an
 * arrow (in 3D it is a door). `as` is the base kind to draw a type the catalog lacks as. `px` is
 * one screen pixel.
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
  if (base === "plant") return drawPlant(ctx, e?.shape ?? "blob", r);
  const own = opts.model ?? e?.model;
  if (base === "incline") drawShape(ctx, "incline", r, rot, px);
  else if (own && e) drawModel(ctx, own, e.footprint, r, rot, px);
  else drawShape(ctx, base === "bridge" ? "bridge" : (e?.shape ?? "block"), r, rot, px);
  if (isA(catalog, type, "building")) drawFront(ctx, r, rot, px);
}

function drawPlant(ctx: CanvasRenderingContext2D, shape: string, r: Box) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (shape) {
    case "trunk-cone":
      circle(ctx, cx, cy, 0.9, "#2f6b35");
      circle(ctx, cx - 0.2, cy - 0.2, 0.45, "#3f8646");
      circle(ctx, cx, cy, 0.18, "#6b4a2b");
      return;
    case "dots":
      for (const [dx, dy, col] of [
        [-0.45, -0.35, "#f06292"],
        [0.4, -0.3, "#ffd54f"],
        [-0.1, 0.4, "#ba68c8"],
        [0.45, 0.45, "#f06292"],
      ] as const) {
        circle(ctx, cx + dx, cy + dy, 0.28, col);
      }
      return;
    case "row":
      ctx.fillStyle = "#4e8a2c";
      for (let i = 0; i < 3; i++) ctx.fillRect(r.x + 0.25 + i * 0.55, r.y + 0.35, 0.35, 1.3);
      return;
    default:
      circle(ctx, cx, cy, 0.75, "#4f8f3f");
      circle(ctx, cx + 0.25, cy - 0.2, 0.35, "#63a652");
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: string, r: Box, rot: number, px: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const m = Math.min(r.w, r.h) / 2;
  const inset = (d: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(r.x + d, r.y + d, r.w - 2 * d, r.h - 2 * d);
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
        const shade = 214 - k * 24;
        ctx.fillStyle = `rgb(${shade},${shade - 14},${shade - 34})`;
        if (alongY) ctx.fillRect(r.x, r.y + off, r.w, d);
        else ctx.fillRect(r.x + off, r.y, d, r.h);
      }
      const dir = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] }[rot as 0 | 90 | 180 | 270];
      const tip = [cx + dir[0] * (r.w / 2) * 0.7, cy + dir[1] * (r.h / 2) * 0.7];
      const side = m * 0.45;
      ctx.fillStyle = "rgba(60,45,30,0.7)";
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
      inset(0, "#9b7048");
      ctx.strokeStyle = "rgba(60,40,20,0.6)";
      ctx.lineWidth = px;
      ctx.beginPath();
      const alongY = rot === 0 || rot === 180;
      for (let k = 0.5; k < (alongY ? r.h : r.w); k += 0.5) {
        if (alongY) {
          ctx.moveTo(r.x, r.y + k);
          ctx.lineTo(r.x + r.w, r.y + k);
        } else {
          ctx.moveTo(r.x + k, r.y);
          ctx.lineTo(r.x + k, r.y + r.h);
        }
      }
      ctx.stroke();
      return;
    }
    case "lamp":
    case "tall-lamp":
      circle(ctx, cx, cy, m * 0.45, "#4a4a4a");
      circle(ctx, cx, cy, m * (shape === "lamp" ? 0.25 : 0.32), "#ffd54f");
      return;
    case "lump":
      circle(ctx, cx, cy, m * 0.8, "#8d8d8d");
      circle(ctx, cx - m * 0.2, cy - m * 0.25, m * 0.35, "#a9a9a9");
      return;
    case "ring":
      circle(ctx, cx, cy, m * 0.9, "#7a7a7a");
      circle(ctx, cx, cy, m * 0.6, "#ff8a3d");
      circle(ctx, cx, cy, m * 0.28, "#ffd54f");
      return;
    case "brazier":
      circle(ctx, cx, cy, m * 0.7, "#3d3d3d");
      circle(ctx, cx, cy, m * 0.45, "#ff7a2d");
      return;
    case "pyramid":
      inset(0.1, "#e98a3f");
      ctx.strokeStyle = "#a85b22";
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.moveTo(r.x + 0.1, r.y + 0.1);
      ctx.lineTo(r.x + r.w - 0.1, r.y + r.h - 0.1);
      ctx.moveTo(r.x + r.w - 0.1, r.y + 0.1);
      ctx.lineTo(r.x + 0.1, r.y + r.h - 0.1);
      ctx.stroke();
      return;
    case "rail":
      ctx.fillStyle = "#7a5a3a";
      if (r.w >= r.h) ctx.fillRect(r.x, cy - 0.15, r.w, 0.3);
      else ctx.fillRect(cx - 0.15, r.y, 0.3, r.h);
      return;
    case "hedge":
      inset(0.08, "#3f7d3a");
      inset(0.35, "#4f9147");
      return;
    case "topiary":
      circle(ctx, cx, cy, m * 0.8, "#3f7d3a");
      circle(ctx, cx - m * 0.2, cy - m * 0.2, m * 0.35, "#5aa24f");
      return;
    case "pot":
      circle(ctx, cx, cy, m * 0.55, "#b5653a");
      circle(ctx, cx, cy, m * 0.4, "#4f9147");
      return;
    case "fountain":
      circle(ctx, cx, cy, m * 0.95, "#bdbdbd");
      circle(ctx, cx, cy, m * 0.75, "#5aa0d8");
      circle(ctx, cx, cy, m * 0.25, "#e8f4fc");
      return;
    case "tank":
      inset(0.12, "#9fd3e6");
      ctx.strokeStyle = "#4b8fa8";
      ctx.lineWidth = 2 * px;
      ctx.strokeRect(r.x + 0.12, r.y + 0.12, r.w - 0.24, r.h - 0.24);
      return;
    case "umbrella":
      circle(ctx, cx, cy, m * 0.95, "#e45b5b");
      circle(ctx, cx, cy, m * 0.55, "#f5f0e6");
      circle(ctx, cx, cy, m * 0.15, "#7a5a3a");
      return;
    case "sofa":
    case "lounge":
    case "bed":
    case "pillow":
      inset(0.1, shape === "bed" ? "#e9e2d0" : "#c77c9a");
      inset(0.4, shape === "bed" ? "#8fb3d9" : "#d998b3");
      return;
    case "tub":
      inset(0.1, "#f2f2f2");
      inset(0.35, "#bfe0f5");
      return;
    case "stall":
      inset(0.1, "#8a633f");
      ctx.fillStyle = "#e45b5b";
      for (let k = 0; k < r.w - 0.2; k += 0.5) {
        if (Math.round(k * 2) % 2 === 0)
          ctx.fillRect(r.x + 0.1 + k, r.y + 0.1, 0.5, (r.h - 0.2) / 2);
      }
      return;
    case "boat":
      ctx.fillStyle = "#9b6a3c";
      ctx.beginPath();
      ctx.ellipse(cx, cy, r.w / 2 - 0.1, r.h / 2 - 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "bin":
    case "stool":
      circle(ctx, cx, cy, m * 0.6, shape === "bin" ? "#6f7a73" : "#8a633f");
      return;
    case "decor":
    case "food":
      circle(ctx, cx, cy, m * 0.4, shape === "food" ? "#f2a33a" : "#c792ea");
      return;
    case "sign":
      ctx.fillStyle = "#8a633f";
      ctx.fillRect(r.x + 0.2, cy - 0.25, r.w - 0.4, 0.5);
      return;
    case "shelf":
      inset(0.1, "#8a633f");
      ctx.strokeStyle = "#5a3e24";
      ctx.lineWidth = px;
      ctx.beginPath();
      for (let k = 0.5; k < r.w - 0.1; k += 0.5) {
        ctx.moveTo(r.x + k, r.y + 0.1);
        ctx.lineTo(r.x + k, r.y + r.h - 0.1);
      }
      ctx.stroke();
      return;
    default:
      // bench, chair, table, box and anything new: a wooden block.
      inset(0.1, "#8a633f");
      ctx.strokeStyle = "#5a3e24";
      ctx.lineWidth = px;
      ctx.strokeRect(r.x + 0.1, r.y + 0.1, r.w - 0.2, r.h - 0.2);
  }
}

/**
 * A model seen from above: parts drawn lowest top first, so taller parts cover shorter ones. Glass
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
  const [w, d] = [footprint.w / 2, footprint.h / 2];
  for (const { leaf, outline: o } of silhouettes(model, w, d, rot as Turn)) {
    ctx.fillStyle = leaf.part.color;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = px;
    ctx.globalAlpha = leaf.part.finish === "glass" ? 0.45 : 1;
    ctx.beginPath();
    if (o.kind === "ellipse") {
      ctx.ellipse(r.x + 2 * o.cx, r.y + 2 * o.cz, 2 * o.rx, 2 * o.rz, 0, 0, Math.PI * 2);
    } else if (o.kind === "polygon") {
      o.points.forEach(([x, z], i) =>
        i ? ctx.lineTo(r.x + 2 * x, r.y + 2 * z) : ctx.moveTo(r.x + 2 * x, r.y + 2 * z),
      );
      ctx.closePath();
    } else {
      // Every triangle that faces up, wound alike, in one path: stroked first at twice the width,
      // then filled, so only the outer edges (and the edges of holes) keep a line.
      const q = o.points;
      for (let i = 0; i < q.length; i += 6) {
        ctx.moveTo(r.x + 2 * q[i], r.y + 2 * q[i + 1]);
        ctx.lineTo(r.x + 2 * q[i + 2], r.y + 2 * q[i + 3]);
        ctx.lineTo(r.x + 2 * q[i + 4], r.y + 2 * q[i + 5]);
        ctx.closePath();
      }
      ctx.lineWidth = 2 * px;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.fill();
      ctx.lineJoin = "miter";
      continue;
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A building's front: a yellow door bar along the front edge and an arrow pointing out. */
function drawFront(ctx: CanvasRenderingContext2D, r: Box, rot: number, px: number) {
  const m = frontMarker(r, rot);
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = Math.max(3 * px, 0.45);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(m.bar[0], m.bar[1]);
  ctx.lineTo(m.bar[2], m.bar[3]);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#ffd54f";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = Math.max(px, 0.08);
  ctx.beginPath();
  ctx.moveTo(...m.arrow[0]);
  ctx.lineTo(...m.arrow[1]);
  ctx.lineTo(...m.arrow[2]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Where to draw a building's front (minor units): a door bar along the middle of the front edge,
 * just inside it, and an arrow whose tip points out of the front. Same side as rule B1.
 */
export function frontMarker(
  r: Box,
  rot: number,
): { side: string; bar: [number, number, number, number]; arrow: [number, number][] } {
  const side = frontSide(rot);
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  const inset = 0.35;
  const out = 1.1;
  const half = 0.8;
  switch (side) {
    case "north": {
      const e = r.y;
      return {
        side,
        bar: [cx - r.w * 0.3, e + inset, cx + r.w * 0.3, e + inset],
        arrow: [
          [cx - half, e],
          [cx + half, e],
          [cx, e - out],
        ],
      };
    }
    case "west": {
      const e = r.x;
      return {
        side,
        bar: [e + inset, cy - r.h * 0.3, e + inset, cy + r.h * 0.3],
        arrow: [
          [e, cy - half],
          [e, cy + half],
          [e - out, cy],
        ],
      };
    }
    case "east": {
      const e = r.x + r.w;
      return {
        side,
        bar: [e - inset, cy - r.h * 0.3, e - inset, cy + r.h * 0.3],
        arrow: [
          [e, cy - half],
          [e, cy + half],
          [e + out, cy],
        ],
      };
    }
    default: {
      const e = r.y + r.h;
      return {
        side,
        bar: [cx - r.w * 0.3, e - inset, cx + r.w * 0.3, e - inset],
        arrow: [
          [cx - half, e],
          [cx + half, e],
          [cx, e + out],
        ],
      };
    }
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
}
