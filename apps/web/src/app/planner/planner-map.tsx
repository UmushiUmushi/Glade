// The planner's map: the viewport and the controls over it (modes, undo and redo, the viewport
// menu, FPS and coordinates). The view, camera, look and layers come from the planner's state;
// the coordinates are the game's words for the point under the pointer.

import { ViewportHud } from "@glade/planner";
import type { Doc } from "@glade/core";
import { MapViewport, viewsOf, type Viewport } from "@glade/viewport";
import { useMemo, useState } from "react";
import type { GamePlanner } from "../games";
import type { Plan } from "./use-planner";

export function PlannerMap(props: {
  title: string;
  planner: GamePlanner;
  doc: Doc;
  plan: Plan;
  /** The viewport, once made, for Fit. */
  onViewport: (viewport: Viewport) => void;
  onFit: () => void;
}) {
  const { planner, plan, doc } = props;
  const [fps, setFps] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const views = useMemo(() => viewsOf(planner.map), [planner]);
  const coords = pointer ? (planner.coords?.(plan.state.mode, doc, pointer) ?? null) : null;
  return (
    <div className="glade-planner-stack">
      <MapViewport
        map={planner.map}
        doc={doc}
        view={plan.state.view}
        camera={plan.state.camera}
        environment={plan.environment}
        layers={plan.layers}
        label={`${props.title} map, new and empty`}
        onFps={setFps}
        onPointer={setPointer}
        onView={(view) => plan.dispatch({ type: "view", view })}
        onReady={props.onViewport}
      />
      <ViewportHud
        state={plan.state}
        dispatch={plan.dispatch}
        modes={planner.modes}
        views={views}
        onFit={props.onFit}
        fps={fps}
        coords={coords}
      />
    </div>
  );
}
