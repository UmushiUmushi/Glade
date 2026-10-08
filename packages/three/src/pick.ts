// Picking and camera math for the 3D view, pure (tested in testkit/three/pick.test.ts). 3D x and z
// are world x and y times the scene view's scale; a ray hit on a pickable mesh goes through the
// scene view's pick, a drag off the meshes meets a horizontal plane.

import type { Bounds } from "@glade/render";
import type { Box } from "@glade/core";
import type { WalkCameraStyle } from "@glade/render";

export type V3 = [number, number, number];
export type { Bounds };

/** Where a ray meets the horizontal plane at height y, or null if it never does. */
export function rayPlaneY(origin: V3, dir: V3, y: number): V3 | null {
  if (Math.abs(dir[1]) < 1e-9) return null;
  const t = (y - origin[1]) / dir[1];
  if (t < 0) return null;
  return [origin[0] + dir[0] * t, y, origin[2] + dir[2] * t];
}

/** The 3D box of a world box between two heights. */
export function boxBounds(b: Box, scale: number, y0: number, y1: number): Bounds {
  return {
    x0: b.x * scale,
    x1: (b.x + b.w) * scale,
    z0: b.y * scale,
    z1: (b.y + b.h) * scale,
    y0,
    y1,
  };
}

/**
 * Camera position for orbiting `target` at `distance`, yaw degrees around the vertical (0 =
 * camera to the south looking north, 90 = camera to the east looking west) and pitch degrees
 * above the horizon (90 = straight down).
 */
export function orbitPosition(target: V3, distance: number, yaw: number, pitch: number): V3 {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  return [
    target[0] + distance * Math.sin(y) * Math.cos(p),
    target[1] + distance * Math.sin(p),
    target[2] + distance * Math.cos(y) * Math.cos(p),
  ];
}

/** Distance at which a perspective camera sees all of `b` (by its bounding sphere). */
export function fitDistance(b: Bounds, fovDeg: number, aspect: number): number {
  const r = 0.5 * Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  return r / Math.sin(Math.min(vfov, hfov) / 2);
}

export function boundsCenter(b: Bounds): V3 {
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
}

/** Half-height of an orthographic top-down frustum showing all of `b` at `aspect`. */
export function orthoHalfHeight(b: Bounds, aspect: number, margin = 1.04): number {
  return Math.max((b.z1 - b.z0) / 2, (b.x1 - b.x0) / 2 / aspect) * margin;
}

/** Yaw and pitch (degrees) of a camera at `pos` looking at `target`, inverse of orbitPosition. */
export function yawPitch(pos: V3, target: V3): { yaw: number; pitch: number; distance: number } {
  const d: V3 = [pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]];
  const distance = Math.hypot(...d);
  const pitch = (Math.asin(d[1] / (distance || 1)) * 180) / Math.PI;
  const yaw = (Math.atan2(d[0], d[2]) * 180) / Math.PI;
  return { yaw, pitch, distance };
}

/** How far the walk camera zooms: near.distance (else 0.4 x) to far.distance (else 1.6 x). */
export function walkRange(w: WalkCameraStyle): [number, number] {
  const lo = Math.min(w.near?.distance ?? w.distance * 0.4, w.distance);
  const hi = Math.max(w.far?.distance ?? w.distance * 1.6, w.distance);
  return [lo, hi];
}

/**
 * The walk pitch at a zoom distance, as in the game: the style's pitch at its distance, blending
 * linearly to near.pitch zoomed in and far.pitch zoomed out, flat past either end.
 */
export function walkPitch(w: WalkCameraStyle, distance: number): number {
  const stops = [w.near, { distance: w.distance, pitch: w.pitch }, w.far]
    .filter((s): s is { distance: number; pitch: number } => !!s)
    .sort((a, b) => a.distance - b.distance);
  if (distance <= stops[0].distance) return stops[0].pitch;
  for (let i = 1; i < stops.length; i++) {
    const [a, b] = [stops[i - 1], stops[i]];
    if (distance <= b.distance) {
      const k = (distance - a.distance) / (b.distance - a.distance || 1);
      return a.pitch + (b.pitch - a.pitch) * k;
    }
  }
  return stops[stops.length - 1].pitch;
}

export const CAMERA_PRESETS = {
  top: { yaw: 0, pitch: 90 },
  iso: { yaw: 45, pitch: 35 },
  walk: { yaw: 20, pitch: 15 },
} as const;

/** Shadow-map sizes the view picks from: enough texels that the blur stays a few texels wide. */
const SHADOW_SIZES = [1024, 2048, 4096];

/** Half-width of the sun's shadow box for a view `distance` away, and where to center it. */
export function shadowFit(
  distance: number,
  walking: boolean,
  worldRadius: number,
): { half: number; ahead: number } {
  const half = Math.min(worldRadius, Math.max(walking ? 30 : 18, distance * 1.3));
  return { half, ahead: walking ? half * 0.6 : half * 0.35 };
}

/** Shadow-map size for a box of `half` so a blur of `blur` 3D units spans about 4 texels. */
export function shadowMapSize(half: number, blur: number): number {
  const want = (2 * half) / Math.max(blur / 4, 1e-3);
  return SHADOW_SIZES.find((n) => n >= want) ?? SHADOW_SIZES[SHADOW_SIZES.length - 1];
}
