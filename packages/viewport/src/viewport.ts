// The viewport: shows one map on two canvases, the 2D plan and the 3D scene, one visible at a time,
// with a third over the plan for hover marks. One frame loop draws the 3D scene every frame and
// the plan only when something changed (the hover layer alone when only the pointer moved), and
// counts frames for the FPS readout. The 3D code loads the first time 3D is shown, so the first
// page load stays small. If 3D can't start, or the GPU drops it, the viewport says so
// (GLD-STAGE-001) and shows the plan.

import type { Bound, Doc } from "@glade/core";
import { gladeError, type GladeError } from "@glade/errors";
import type { RenderableMap } from "@glade/render";
import type { MapScene } from "@glade/three";
import { lookAt, type Environment } from "./environment";
import { createFpsMeter } from "./fps";
import { fitPlan, planVisible, type PlanCamera, type Size } from "./plan-camera";
import { viewsOf, type CameraKind, type ViewKind } from "./views";

export interface ViewportCanvases {
  plan: HTMLCanvasElement;
  scene: HTMLCanvasElement;
  /** Over the plan, for what the map marks under the pointer (PlanView.drawHover). */
  hover?: HTMLCanvasElement;
}

export interface ViewportDeps {
  requestFrame(run: (now: number) => void): number;
  cancelFrame(id: number): void;
  /** Loads the 3D code (a separate bundle): `() => import("@glade/three")`. */
  load3d(): Promise<{ MapScene: new (canvas: HTMLCanvasElement) => MapScene }>;
  onFps?(fps: number): void;
  onError?(error: GladeError): void;
  /** The view changed by itself (3D lost: back to the plan). */
  onView?(view: ViewKind): void;
}

export type ShownMap = Bound<RenderableMap>;

export interface Viewport {
  /** Show a map and one of its documents; the camera fits the whole map. */
  show(map: ShownMap, doc: Doc): void;
  /** The same map, another document (after an edit). */
  setDoc(doc: Doc): void;
  setView(view: ViewKind): Promise<void>;
  setCamera(camera: CameraKind): void;
  setEnvironment(env: Environment): void;
  setLayers(layers: Record<string, boolean>): void;
  /** Frame the whole map again. */
  fit(): void;
  /** The canvas size in CSS pixels, and the screen's pixel ratio. */
  resize(size: Size, dpr: number): void;
  /** The plan's camera, for input and overlays. */
  planCamera(): PlanCamera | null;
  setPlanCamera(cam: PlanCamera): void;
  /** The world point under the pointer in the plan, or null when it leaves. */
  setHover(p: { x: number; y: number } | null): void;
  state(): { view: ViewKind; camera: CameraKind; ready3d: boolean };
  /** Frames drawn so far, and how long the 3D scene's last build took. */
  stats(): { frames: number; build: { ms: number; chunks: number } | null };
  dispose(): void;
}

interface State {
  map: ShownMap | null;
  doc: Doc | null;
  view: ViewKind;
  camera: CameraKind;
  env: Environment;
  layers: Record<string, boolean>;
  size: Size;
  dpr: number;
  plan: PlanCamera | null;
  planDirty: boolean;
  hover: { x: number; y: number } | null;
  hoverDirty: boolean;
  scene: MapScene | null;
  loading: Promise<MapScene | null> | null;
}

/** Clears a plan canvas and moves its context so one unit is one world unit; null if it can't. */
function worldContext(canvas: HTMLCanvasElement, s: State): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx || !s.plan) return null;
  const { w, h } = s.size;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const k = s.plan.pxPerUnit * s.dpr;
  ctx.setTransform(
    k,
    0,
    0,
    k,
    (w / 2 - s.plan.cx * s.plan.pxPerUnit) * s.dpr,
    (h / 2 - s.plan.cy * s.plan.pxPerUnit) * s.dpr,
  );
  return ctx;
}

/** The plan. */
function drawPlan(canvas: HTMLCanvasElement, s: State): void {
  const plan = s.map?.views.plan;
  if (!plan || !s.map || !s.doc || !s.plan) return;
  const ctx = worldContext(canvas, s);
  if (ctx) plan.draw(ctx, s.doc, s.map, s.layers, planVisible(s.plan, s.size), s.plan.pxPerUnit);
}

/** The hover layer: cleared, then the map's marks for the point under the pointer, if any. */
function drawHover(canvas: HTMLCanvasElement, s: State): void {
  const ctx = worldContext(canvas, s);
  const plan = s.map?.views.plan;
  if (!ctx || !plan?.drawHover || !s.map || !s.doc || !s.plan || !s.hover) return;
  plan.drawHover(ctx, s.doc, s.map, s.hover, s.plan.pxPerUnit);
}

/** Point the 3D camera at the whole map with the chosen preset. */
function frameScene(scene: MapScene, camera: CameraKind): void {
  scene.stage.frame(camera, scene.stage.world);
}

function applyLook(scene: MapScene, s: State): void {
  if (!s.map) return;
  const curvature = !!s.map.views.scene?.capabilities.curvature;
  scene.setLook(lookAt(s.map, s.env), { flat: false, curvature });
}

export function createViewport(canvases: ViewportCanvases, deps: ViewportDeps): Viewport {
  const s: State = {
    map: null,
    doc: null,
    view: "2d",
    camera: "iso",
    env: { hour: 12 },
    layers: {},
    size: { w: 1, h: 1 },
    dpr: 1,
    plan: null,
    planDirty: true,
    hover: null,
    hoverDirty: false,
    scene: null,
    loading: null,
  };
  const fps = createFpsMeter();
  let last: number | null = null;
  let frames = 0;
  let frameId: number | null = null;

  /** Show the canvas of the current view only. */
  function showCanvas(): void {
    canvases.plan.style.visibility = s.view === "2d" ? "visible" : "hidden";
    if (canvases.hover) canvases.hover.style.visibility = s.view === "2d" ? "visible" : "hidden";
    canvases.scene.style.visibility = s.view === "3d" ? "visible" : "hidden";
  }

  /** Back to the plan with an error, when 3D can't run. */
  function lose3d(cause?: unknown): void {
    deps.onError?.(gladeError("GLD-STAGE-001", { cause }));
    s.view = "2d";
    s.planDirty = true;
    showCanvas();
    deps.onView?.("2d");
  }

  /** Make the 3D scene the first time it is needed, with everything the viewport already has. */
  async function ensureScene(): Promise<MapScene | null> {
    if (s.scene) return s.scene;
    s.loading ??= (async () => {
      try {
        const { MapScene: Scene } = await deps.load3d();
        const scene = new Scene(canvases.scene);
        canvases.scene.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          lose3d();
        });
        s.scene = scene;
        syncScene(true);
        return scene;
      } catch (cause) {
        lose3d(cause);
        return null;
      }
    })();
    return s.loading;
  }

  /** Bring the scene up to date: size, map, document, layers, look and (when asked) the camera. */
  function syncScene(reframe: boolean): void {
    const scene = s.scene;
    if (!scene || !s.map || !s.doc) return;
    // The renderer applies the pixel ratio itself: it takes CSS pixels.
    scene.stage.resize(s.size.w, s.size.h);
    scene.setMap(s.map);
    scene.setDoc(s.doc);
    scene.setLayers(s.layers);
    applyLook(scene, s);
    if (reframe) frameScene(scene, s.camera);
  }

  function loop(now: number): void {
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    if (s.view === "3d" && s.scene) {
      s.scene.render(dt);
      frames++;
    } else if (s.view === "2d" && (s.planDirty || s.hoverDirty)) {
      if (s.planDirty) drawPlan(canvases.plan, s);
      // The hover marks follow the plan's camera, so they redraw with it.
      if (canvases.hover) drawHover(canvases.hover, s);
      s.planDirty = false;
      s.hoverDirty = false;
      frames++;
    }
    const reading = fps.frame(now);
    if (reading !== null) deps.onFps?.(reading);
    frameId = deps.requestFrame(loop);
  }
  frameId = deps.requestFrame(loop);

  const viewport: Viewport = {
    show(map, doc) {
      s.map = map;
      s.doc = doc;
      s.layers = Object.fromEntries(map.ui.layerNames().map((l) => [l.id, l.default]));
      s.plan = fitPlan(map.space.bounds, s.size);
      s.planDirty = true;
      if (!viewsOf(map).includes(s.view)) s.view = viewsOf(map)[0] ?? "2d";
      showCanvas();
      syncScene(true);
    },
    setDoc(doc) {
      s.doc = doc;
      s.planDirty = true;
      s.scene?.setDoc(doc);
    },
    async setView(view) {
      if (!s.map || !viewsOf(s.map).includes(view)) return;
      s.view = view;
      s.planDirty = true;
      showCanvas();
      if (view === "3d") await ensureScene();
    },
    setCamera(camera) {
      s.camera = camera;
      s.scene?.stage.switchPreset(camera);
    },
    setEnvironment(env) {
      s.env = env;
      if (s.scene) applyLook(s.scene, s);
      s.planDirty = true;
    },
    setLayers(layers) {
      s.layers = layers;
      s.scene?.setLayers(layers);
      s.planDirty = true;
    },
    fit() {
      if (s.map) s.plan = fitPlan(s.map.space.bounds, s.size);
      s.planDirty = true;
      if (s.scene) frameScene(s.scene, s.camera);
    },
    resize(size, dpr) {
      const first = s.size.w <= 1;
      s.size = size;
      s.dpr = dpr;
      canvases.plan.width = Math.max(1, Math.round(size.w * dpr));
      canvases.plan.height = Math.max(1, Math.round(size.h * dpr));
      if (canvases.hover) {
        canvases.hover.width = canvases.plan.width;
        canvases.hover.height = canvases.plan.height;
      }
      if (first && s.map) s.plan = fitPlan(s.map.space.bounds, size);
      s.scene?.stage.resize(size.w, size.h);
      s.planDirty = true;
    },
    planCamera: () => s.plan,
    setPlanCamera(cam) {
      s.plan = cam;
      s.planDirty = true;
    },
    setHover(p) {
      const same = p && s.hover ? p.x === s.hover.x && p.y === s.hover.y : p === s.hover;
      if (same) return;
      s.hover = p ? { x: p.x, y: p.y } : null;
      s.hoverDirty = true;
    },
    state: () => ({ view: s.view, camera: s.camera, ready3d: !!s.scene }),
    stats: () => ({ frames, build: s.scene ? { ...s.scene.lastBuild } : null }),
    dispose() {
      if (frameId !== null) deps.cancelFrame(frameId);
      frameId = null;
      s.scene?.stage.renderer.dispose();
    },
  };
  return viewport;
}
