// <MapViewport>: the viewport as a React component. It fills its parent, keeps the canvases sized
// to it, and passes each prop on to the viewport as it changes. The planner draws its controls
// over it; the viewport draws only the map.

import type { Doc } from "@glade/core";
import type { GladeError } from "@glade/errors";
import { useEffect, useRef } from "react";
import type { Environment } from "./environment";
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
  /** Loads the 3D code; tests pass their own. */
  load3d?: ViewportDeps["load3d"];
}

const canvasStyle = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;

/** The callbacks, kept fresh without remaking the viewport each render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function MapViewport(props: MapViewportProps) {
  const box = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLCanvasElement>(null);
  const scene = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<Viewport | null>(null);
  const latest = useLatest(props);

  // Make the viewport once, and size it with its box.
  useEffect(() => {
    if (!box.current || !plan.current || !scene.current) return;
    const vp = createViewport(
      { plan: plan.current, scene: scene.current },
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

  return (
    <div
      ref={box}
      role="img"
      aria-label={props.label}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      <canvas ref={plan} style={canvasStyle} aria-hidden="true" />
      <canvas ref={scene} style={canvasStyle} aria-hidden="true" />
    </div>
  );
}
