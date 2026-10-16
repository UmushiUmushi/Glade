// The item formula, in 2D: how one catalog entry looks from above, with no map around it. Drawn in
// minor units (a tile is 2), the units every map of the game draws in, in the planner's cosy
// style (plan-style.ts): each thing is a sticker, with one ink outline round it and a drop shadow.

import { silhouettes, type Model, type Turn } from "@glade/render";
import { baseOf, catalogEntry, isA, type BaseKind, type Catalog } from "../catalog";
import { lighten, outlineWidth, PLAN, SHADOW } from "../plan-style";
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
 * model as a sticker (or `model` in its place), or a symbol for its shape when it has none; an
 * incline's steps; and a building's door on its front. `as` is the base kind to draw a type the
 * catalog lacks as. `px` is one screen pixel.
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
    if (own && e) drawModel(ctx, own, e.footprint, r, 0, px, true);
    else drawPlant(ctx, e?.shape ?? "blob", r, px);
    return;
  }
  if (base === "incline") drawShape(ctx, "incline", r, rot, px);
  else if (own && e) drawModel(ctx, own, e.footprint, r, rot, px, false);
  else drawShape(ctx, base === "bridge" ? "bridge" : (e?.shape ?? "block"), r, rot, px);
  if (isA(catalog, type, "building")) drawDoor(ctx, r, rot);
}

/**
 * Draws round and square shapes as stickers: the first shape drawn gets the shadow and the ink
 * outline, the ones after sit on it as detail.
 */
function sticker(ctx: CanvasRenderingContext2D, px: number) {
  let first = true;
  const line = outlineWidth(px);
  const draw = (trace: (dy: number) => void, color: string) => {
    if (first) {
      ctx.fillStyle = SHADOW.color;
      trace(SHADOW.dy);
      ctx.fill();
      ctx.strokeStyle = PLAN.ink;
      ctx.lineWidth = 2 * line;
      trace(0);
      ctx.stroke();
      first = false;
    }
    ctx.fillStyle = color;
    trace(0);
    ctx.fill();
  };
  return {
    circle(x: number, y: number, rad: number, color: string) {
      draw((dy) => {
        ctx.beginPath();
        ctx.arc(x, y + dy, rad, 0, Math.PI * 2);
      }, color);
    },
    rect(x: number, y: number, w: number, h: number, color: string) {
      draw((dy) => {
        ctx.beginPath();
        ctx.roundRect(x, y + dy, w, h, Math.min(w, h) * 0.2);
      }, color);
    },
    ellipse(x: number, y: number, rx: number, ry: number, color: string) {
      draw((dy) => {
        ctx.beginPath();
        ctx.ellipse(x, y + dy, rx, ry, 0, 0, Math.PI * 2);
      }, color);
    },
  };
}

/** A plant with no model, by its shape: a tree, a flower bed, a crop row or a bush. */
function drawPlant(ctx: CanvasRenderingContext2D, shape: string, r: Box, px: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (shape) {
    case "trunk-cone": {
      const st = sticker(ctx, px);
      st.circle(cx, cy, 0.85, "#5f7d2a");
      st.circle(cx - 0.3, cy - 0.3, 0.3, "#a4c148");
      return;
    }
    case "dots":
      for (const [dx, dy, col] of [
        [-0.45, -0.35, "#e39aac"],
        [0.4, -0.3, PLAN.sun],
        [-0.1, 0.4, "#c9a7e8"],
        [0.45, 0.45, "#e39aac"],
      ] as const) {
        const st = sticker(ctx, px);
        st.circle(cx + dx, cy + dy, 0.3, col);
        st.circle(cx + dx, cy + dy, 0.1, col === PLAN.sun ? "#e39aac" : PLAN.sun);
      }
      return;
    case "row":
      for (let i = 0; i < 3; i++) {
        sticker(ctx, px).rect(r.x + 0.25 + i * 0.55, r.y + 0.35, 0.35, 1.3, "#7fa83a");
      }
      return;
    default: {
      const st = sticker(ctx, px);
      st.circle(cx, cy, 0.75, "#7f9f3a");
      st.circle(cx - 0.25, cy - 0.25, 0.28, lighten("#7f9f3a", 0.35));
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: string, r: Box, rot: number, px: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const m = Math.min(r.w, r.h) / 2;
  const st = sticker(ctx, px);
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

/** A model at one size and rotation, ready to draw, and its plant's light spot. */
interface Prepared {
  shapes: Shape[];
  spot: { x: number; y: number; r: number; color: string } | null;
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
  const top = shapes.at(-1)?.ellipse;
  const spot = top
    ? {
        x: top.cx - top.rx * 0.35,
        y: top.cy - top.ry * 0.35,
        r: Math.min(top.rx, top.ry) * 0.32,
        color: lighten(shapes[shapes.length - 1].color, 0.35),
      }
    : null;
  const out = { shapes, spot };
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

/** Below this many screen pixels across, a sticker is drawn flat: no shadow, outline or spot. */
export const STICKER_MIN_PX = 8;

/**
 * A model seen from above, as a sticker: its shadow, one ink outline round all its parts, then
 * the parts lowest top first, so taller parts cover shorter ones, with a faint line where they
 * meet. Glass parts are see-through and get no outline. A plant (`shine`) gets a light spot on
 * its top, as the design's trees do. Too small to see those, it is just its parts.
 */
function drawModel(
  ctx: CanvasRenderingContext2D,
  model: Model,
  footprint: { w: number; h: number },
  r: Box,
  rot: number,
  px: number,
  shine: boolean,
) {
  const { shapes, spot } = prepare(model, footprint, rot);
  const full = Math.min(r.w, r.h) / px >= STICKER_MIN_PX;
  if (full) {
    ctx.lineJoin = "round";
    ctx.fillStyle = SHADOW.color;
    ctx.beginPath();
    for (const sh of shapes) trace(ctx, sh, r.x, r.y + SHADOW.dy);
    ctx.fill();
    // The ink: every solid outline stroked twice as wide as the line; the parts then cover its
    // inner half, so only a line round the whole thing is left.
    ctx.strokeStyle = PLAN.ink;
    ctx.lineWidth = 2 * outlineWidth(px);
    ctx.beginPath();
    for (const sh of shapes) if (!sh.glass) trace(ctx, sh, r.x, r.y);
    ctx.stroke();
    ctx.lineWidth = px;
  }
  for (const sh of shapes) {
    ctx.globalAlpha = sh.glass ? 0.45 : 1;
    ctx.fillStyle = sh.color;
    ctx.beginPath();
    trace(ctx, sh, r.x, r.y);
    if (full && sh.mesh) {
      // Close the hairline seams between a mesh's triangles.
      ctx.strokeStyle = sh.color;
      ctx.stroke();
    }
    ctx.fill();
    if (full) {
      ctx.strokeStyle = "rgba(61,54,50,0.3)";
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineJoin = "miter";
  if (full && shine && spot) {
    ctx.fillStyle = spot.color;
    ctx.beginPath();
    ctx.arc(r.x + spot.x, r.y + spot.y, spot.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A building's door: an ink arch on the middle of its front edge, as the design draws it. */
function drawDoor(ctx: CanvasRenderingContext2D, r: Box, rot: number) {
  const door = frontDoor(r, rot);
  ctx.save();
  ctx.translate(door.x, door.y);
  ctx.rotate(door.angle);
  ctx.fillStyle = PLAN.ink;
  ctx.beginPath();
  ctx.roundRect(-door.w / 2, -door.h, door.w, door.h, [door.w / 2, door.w / 2, 0, 0]);
  ctx.fill();
  ctx.restore();
}

/**
 * Where a building's door goes (minor units): the middle of its front edge (the side rule B1
 * checks), the turn that points the door's sill outward (0 for the south edge, clockwise in
 * radians), and its size, a fifth of the building's short side, kept readable.
 */
export function frontDoor(
  r: Box,
  rot: number,
): { side: string; x: number; y: number; angle: number; w: number; h: number } {
  const side = frontSide(rot);
  const w = Math.min(1.2, Math.max(0.5, Math.min(r.w, r.h) * 0.2));
  const h = w * 1.3;
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  switch (side) {
    case "north":
      return { side, x: cx, y: r.y, angle: Math.PI, w, h };
    case "east":
      return { side, x: r.x + r.w, y: cy, angle: -Math.PI / 2, w, h };
    case "west":
      return { side, x: r.x, y: cy, angle: Math.PI / 2, w, h };
    default:
      return { side, x: cx, y: r.y + r.h, angle: 0, w, h };
  }
}
