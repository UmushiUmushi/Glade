// <MapViewport>: the viewport as a React component. It fills its parent, keeps the canvases sized
// to it, passes each prop on to the viewport as it changes, and tells it where the pointer is over
// the plan, for the map's hover marks. The planner draws its controls over it; the viewport draws
// only the map.

import type { Doc } from "@glade/core";
import type { GladeError } from "@glade/errors";
import { useEffect, useRef, type RefObject } from "react";
import type { Environment } from "./environment";
import { screenToPlan } from "./plan-camera";
import type { CameraKind, ViewKind } from "./views";
import { createViewport, type ShownMap, type Viewport, type ViewportDeps } from "./viewport";

export interface MapViewportProps {
  map: ShownMap;
  doc: Doc;
  view: ViewKind;
  camera: CameraKind;
  environment: Environment;
  layers?: Record<string, boolean>;
  /** What the map shows, for screen readers: "Island, 3D view". */
  label: string;
  onFps?: (fps: number) => void;
  onError?: (error: GladeError) => void;
  onView?: (view: ViewKind) => void;
  /** The viewport, once made, for input and overlays. */
  onReady?: (viewport: Viewport) => void;
  /** The map point under the pointer in the plan (2D), or null when it leaves or in 3D. */
  onPointer?: (p: { x: number; y: number } | null) => void;
  /** Loads the 3D code; tests pass their own. */
  load3d?: ViewportDeps["load3d"];
}

const canvasStyle = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
const hoverStyle = { ...canvasStyle, pointerEvents: "none" } as const;

/** The callbacks, kept fresh without remaking the viewport each render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** The world point under the pointer, in the plan, or null before the plan has a camera. */
function planPoint(e: React.PointerEvent<HTMLElement>, vp: Viewport | null) {
  const cam = vp?.planCamera();
  if (!cam) return null;
  const r = e.currentTarget.getBoundingClientRect();
  const at = { x: e.clientX - r.left, y: e.clientY - r.top };
  return screenToPlan(cam, { w: r.width, h: r.height }, at);
}

/** The pointer's map point: the hover marks follow it, and so does onPointer (in 2D). */
function usePointerAt(viewport: RefObject<Viewport | null>, latest: RefObject<MapViewportProps>) {
  return (p: { x: number; y: number } | null) => {
    const vp = viewport.current;
    vp?.setHover(p);
    latest.current.onPointer?.(p && vp?.state().view === "2d" ? p : null);
  };
}

export function MapViewport(props: MapViewportProps) {
  const box = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLCanvasElement>(null);
  const scene = useRef<HTMLCanvasElement>(null);
  const hover = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<Viewport | null>(null);
  const latest = useLatest(props);

  // Make the viewport once, and size it with its box.
  useEffect(() => {
    if (!box.current || !plan.current || !scene.current) return;
    const vp = createViewport(
      { plan: plan.current, scene: scene.current, hover: hover.current ?? undefined },
      {
        requestFrame: (run) => requestAnimationFrame(run),
        cancelFrame: (id) => cancelAnimationFrame(id),
        load3d: () => (latest.current.load3d ?? (() => import("@glade/three")))(),
        onFps: (fps) => latest.current.onFps?.(fps),
        onError: (e) => latest.current.onError?.(e),
        onView: (v) => latest.current.onView?.(v),
      },
    );
    viewport.current = vp;
    const el = box.current;
    const fitBox = () =>
      vp.resize({ w: el.clientWidth, h: el.clientHeight }, devicePixelRatio || 1);
    fitBox();
    const observer = new ResizeObserver(fitBox);
    observer.observe(el);
    latest.current.onReady?.(vp);
    return () => {
      observer.disconnect();
      vp.dispose();
      viewport.current = null;
    };
  }, [latest]);

  useEffect(() => viewport.current?.show(props.map, props.doc), [props.map]); // eslint-disable-line react-hooks/exhaustive-deps -- a new document alone is setDoc below
  useEffect(() => viewport.current?.setDoc(props.doc), [props.doc]);
  useEffect(() => void viewport.current?.setView(props.view), [props.view, props.map]);
  useEffect(() => viewport.current?.setCamera(props.camera), [props.camera]);
  useEffect(() => viewport.current?.setEnvironment(props.environment), [props.environment]);
  useEffect(() => {
    if (props.layers) viewport.current?.setLayers(props.layers);
  }, [props.layers]);

  const pointerAt = usePointerAt(viewport, latest);

  return (
    <div
      ref={box}
      role="img"
      aria-label={props.label}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
      onPointerMove={(e) => pointerAt(planPoint(e, viewport.current))}
      onPointerLeave={() => pointerAt(null)}
    >
      <canvas ref={plan} data-layer="plan" style={canvasStyle} aria-hidden="true" />
      <canvas ref={hover} data-layer="hover" style={hoverStyle} aria-hidden="true" />
      <canvas ref={scene} data-layer="scene" style={canvasStyle} aria-hidden="true" />
    </div>
  );
}
