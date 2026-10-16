// The 2D plan's camera, as plain numbers: which world point is at the middle of the screen, and
// how many CSS pixels one world unit takes. Fitting the map, panning and zooming are pure
// functions of it, so they are tested without a canvas.

import type { Box } from "@glade/core";

export interface PlanCamera {
  /** World point at the middle of the canvas. */
  cx: number;
  cy: number;
  /** CSS pixels per world unit: the zoom. */
  pxPerUnit: number;
}

export interface Size {
  /** CSS pixels. */
  w: number;
  h: number;
}

/** Space left round the map when it is fitted, as a share of the canvas. */
export const FIT_MARGIN = 0.04;
/** How far the plan zooms out and in, relative to fitting the whole map. */
export const ZOOM_OUT_LIMIT = 0.5;
export const ZOOM_IN_LIMIT = 40;

/** The whole map, centred, with a small margin. */
export function fitPlan(bounds: Box, size: Size, margin = FIT_MARGIN): PlanCamera {
  const usable = 1 - 2 * margin;
  const pxPerUnit = Math.min((size.w * usable) / bounds.w, (size.h * usable) / bounds.h);
  return {
    cx: bounds.x + bounds.w / 2,
    cy: bounds.y + bounds.h / 2,
    pxPerUnit: Math.max(pxPerUnit, Number.EPSILON),
  };
}

/** The world box on screen. */
export function planVisible(cam: PlanCamera, size: Size): Box {
  const w = size.w / cam.pxPerUnit;
  const h = size.h / cam.pxPerUnit;
  return { x: cam.cx - w / 2, y: cam.cy - h / 2, w, h };
}

/** A world point in CSS pixels from the canvas's top left. */
export function planToScreen(cam: PlanCamera, size: Size, p: { x: number; y: number }) {
  return {
    x: (p.x - cam.cx) * cam.pxPerUnit + size.w / 2,
    y: (p.y - cam.cy) * cam.pxPerUnit + size.h / 2,
  };
}

/** A point in CSS pixels from the canvas's top left, as a world point. */
export function screenToPlan(cam: PlanCamera, size: Size, p: { x: number; y: number }) {
  return {
    x: (p.x - size.w / 2) / cam.pxPerUnit + cam.cx,
    y: (p.y - size.h / 2) / cam.pxPerUnit + cam.cy,
  };
}

/** Move the view by a screen delta: the map follows the pointer. */
export function panPlan(cam: PlanCamera, dx: number, dy: number): PlanCamera {
  return { ...cam, cx: cam.cx - dx / cam.pxPerUnit, cy: cam.cy - dy / cam.pxPerUnit };
}

/**
 * Zoom by `factor` (above 1 zooms in) keeping the world point under `at` (CSS pixels) where it
 * is, within limits relative to `fit`'s zoom.
 */
export function zoomPlan(
  cam: PlanCamera,
  factor: number,
  at: { x: number; y: number },
  size: Size,
  fit: PlanCamera,
): PlanCamera {
  const lo = fit.pxPerUnit * ZOOM_OUT_LIMIT;
  const hi = fit.pxPerUnit * ZOOM_IN_LIMIT;
  const pxPerUnit = Math.min(hi, Math.max(lo, cam.pxPerUnit * factor));
  const before = screenToPlan(cam, size, at);
  const zoomed = { ...cam, pxPerUnit };
  const after = screenToPlan(zoomed, size, at);
  return { ...zoomed, cx: cam.cx + before.x - after.x, cy: cam.cy + before.y - after.y };
}
