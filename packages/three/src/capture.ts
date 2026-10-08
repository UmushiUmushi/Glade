// Offscreen render to PNG for image capture: the live scene from a separate camera, at a requested
// preset, curvature and style, without overlays unless asked. Runs synchronously between frames, so
// it works while the tab shows the 2D view or sits in the background. A reference pose renders the
// game's walk camera with the figure, at the shot's aspect.

import {
  OrthographicCamera,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Group,
} from "three";
import { gridDef, rectToBox, type Space } from "@glade/core";
import type { Look, ReferencePose, WalkCameraStyle } from "@glade/render";
import type { RenderRequest } from "@glade/render";
import {
  boundsCenter,
  CAMERA_PRESETS,
  fitDistance,
  orbitPosition,
  orthoHalfHeight,
  boxBounds,
  shadowFit,
  walkPitch,
  type Bounds,
  type V3,
} from "./pick";
import type { Stage } from "./stage";
import { shared } from "./materials";
import { needsPost, Post } from "./post";

/** The offscreen post pass, made on the first render that needs it. */
let postOff: Post | null = null;

export const RENDER_SIZES = [256, 512, 768, 1024];

export interface CaptureHost {
  stage: Stage;
  space: Space;
  /** The game's finest grid (ground is sampled once per cell). */
  fine: string;
  /** 3D height at a world point. */
  ground: (x: number, y: number) => number;
  /** 3D units per world unit. */
  scale: number;
  overlays: Group;
  /** Apply a look for this render (preset, flat), returning nothing; restore() puts back the live one. */
  applyLook(look: Look, opts: { flat: boolean; curvature: boolean }): void;
  lookFor(preset?: string, season?: string, time?: number): Look;
  restore(): void;
}

/** World bounds for a request: its rect (default the whole map) between ground and a bit above. */
export function captureBounds(host: CaptureHost, req: RenderRequest): Bounds {
  if (!req.rect) return host.stage.world;
  const box = rectToBox(host.space, req.rect);
  const [cw, ch] = gridDef(host.space, host.fine).cell;
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = box.y + ch / 2; y < box.y + box.h; y += ch) {
    for (let x = box.x + cw / 2; x < box.x + box.w; x += cw) {
      const g = host.ground(x, y);
      lo = Math.min(lo, g);
      hi = Math.max(hi, g);
    }
  }
  if (lo === Infinity) lo = hi = 0;
  return boxBounds(box, host.scale, lo, hi + 2);
}

export function captureCamera(b: Bounds, req: RenderRequest): Camera {
  // "view" is handled by capture itself; framed renders treat it as iso.
  const kind = req.camera === "view" || !req.camera ? "iso" : req.camera;
  const center = boundsCenter(b);
  if (kind === "top" && req.pitch === undefined) {
    const half = orthoHalfHeight(b, 1);
    const cam = new OrthographicCamera(-half, half, half, -half, 0.1, 5000);
    cam.position.set(center[0], b.y1 + 400, center[2] + 0.001);
    cam.lookAt(center[0], center[1], center[2]);
    cam.updateMatrixWorld();
    return cam;
  }
  const preset = CAMERA_PRESETS[kind];
  const cam = new PerspectiveCamera(40, 1, 0.5, 5000);
  const dist = fitDistance(b, 40, 1) * (kind === "walk" ? 0.8 : 1);
  cam.position.set(
    ...orbitPosition(center, dist, req.yaw ?? preset.yaw, req.pitch ?? preset.pitch),
  );
  cam.lookAt(center[0], center[1], center[2]);
  cam.updateMatrixWorld();
  return cam;
}

/**
 * The walk camera for a reference pose: looking at `eye` above the figure's feet from the pose's
 * distance, yaw and pitch (the walk style's where the pose has none). Returns the look-at point.
 */
export function poseCamera(
  pose: ReferencePose,
  walk: WalkCameraStyle,
  feet: V3,
  aspect: number,
): { camera: PerspectiveCamera; target: V3; distance: number } {
  const distance = pose.distance ?? walk.distance;
  const pitch = pose.pitch ?? walkPitch(walk, distance);
  const target: V3 = [feet[0], feet[1] + walk.eye, feet[2]];
  const camera = new PerspectiveCamera(pose.fov ?? walk.fov, aspect, 0.5, 5000);
  camera.position.set(...orbitPosition(target, distance, pose.yaw, pitch));
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  return { camera, target, distance };
}

/** Render a request and return the PNG as base64 (no data: prefix). */
export function capture(host: CaptureHost, req: RenderRequest): string {
  const size = RENDER_SIZES.includes(req.size ?? 0) ? req.size! : 512;
  const { renderer, scene, sky, figure } = host.stage;
  const look = host.lookFor(req.preset, req.season, req.time);
  const pose = req.pose;
  const view = !pose && req.camera === "view";
  const st = host.stage;
  // The viewer's own frame: the walk view letterboxes to the game's aspect.
  const viewAspect = st.walking && st.walkCam.aspect ? st.walkCam.aspect : st.persp.aspect;
  const aspect = pose ? (pose.aspect ?? 1) : view ? viewAspect : 1;
  const [w, h] = [size, Math.round(size / aspect)];
  const saved = {
    curve: shared.uCurve.value,
    center: shared.uCurveCenter.value.clone(),
    ground: shared.uCurveGround.value,
    sky: sky.position.clone(),
    overlays: host.overlays.visible,
    figure: figure.visible,
    figureAt: figure.position.clone(),
  };
  const rt = new WebGLRenderTarget(w, h, { samples: 4, colorSpace: SRGBColorSpace });
  try {
    // Bend like the viewer: the walk camera and reference poses do, other views only if asked.
    const curvature = req.curvature ?? (!!pose || req.camera === "walk" || (view && st.curveOn));
    host.applyLook(look, { flat: req.style === "flat", curvature });
    let cam: Camera;
    let focus: V3;
    let shadowBox: { at: Vector3; half: number };
    if (view) {
      // What the viewer shows: its camera, bend, figure and shadow box as they are.
      const live = st.camera;
      cam = live.clone();
      if (cam instanceof PerspectiveCamera) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      cam.updateMatrixWorld();
      const t = st.controls.target;
      focus = [t.x, t.y, t.z];
      shadowBox = { at: t.clone(), half: 0 };
    } else if (pose) {
      const s = host.scale;
      const feet: V3 = [pose.at[0] * s, host.ground(pose.at[0], pose.at[1]), pose.at[1] * s];
      const pc = poseCamera(pose, host.stage.walkCam, feet, w / h);
      cam = pc.camera;
      focus = pc.target;
      figure.position.set(...feet);
      const { half, ahead } = shadowFit(pc.distance, true, host.stage.worldRadius());
      const fwd = new Vector3(...focus).sub(cam.position).setY(0).normalize();
      shadowBox = { at: new Vector3(...focus).addScaledVector(fwd, ahead), half };
    } else {
      const b = captureBounds(host, req);
      cam = captureCamera(b, req);
      focus = boundsCenter(b);
      shadowBox = { at: new Vector3(...focus), half: Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.75 };
    }
    if (!view) {
      shared.uCurveCenter.value.set(focus[0], focus[2]);
      shared.uCurveGround.value = pose ? focus[1] - host.stage.walkCam.eye : focus[1];
      shared.uCurve.value =
        curvature && look.world.curvature.enabled ? 1 / (2 * look.world.curvature.radius) : 0;
    }
    sky.position.copy(cam.position);
    host.stage.fitFog(
      cam instanceof PerspectiveCamera ? cam.position.distanceTo(new Vector3(...focus)) : Infinity,
    );
    host.overlays.visible = !!req.overlays;
    figure.visible = !!pose || (view && st.walking);
    if (view) st.fitShadowsToView();
    else host.stage.fitShadows(shadowBox.at, shadowBox.half);
    renderer.shadowMap.needsUpdate = true;
    const post = host.stage.post;
    if (needsPost(post)) {
      postOff ??= new Post(renderer, true);
      postOff.setSize(w, h);
      postOff.render(scene, cam, post, cam.position.distanceTo(new Vector3(...focus)));
      return toPngBase64(postOff.read(), w, h);
    }
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const pixels = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
    return toPngBase64(pixels, w, h);
  } finally {
    renderer.setRenderTarget(null);
    rt.dispose();
    shared.uCurve.value = saved.curve;
    shared.uCurveCenter.value.copy(saved.center);
    shared.uCurveGround.value = saved.ground;
    sky.position.copy(saved.sky);
    host.overlays.visible = saved.overlays;
    figure.visible = saved.figure;
    figure.position.copy(saved.figureAt);
    host.restore();
  }
}

/**
 * GL rows run bottom-up; flip into a canvas and encode, opaque: cut-outs with multisampled edges
 * (alpha to coverage) leave alpha below 1 in the target, which a PNG would keep as see-through.
 */
function toPngBase64(pixels: Uint8Array, w: number, h: number): string {
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const row = w * 4;
  for (let y = 0; y < h; y++) {
    img.data.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
