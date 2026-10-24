// The planner's own state for one map, and the keys that change it: open on a desktop, the rail on
// a tablet (the phone layout, a top bar, arrives in step 1.9), the first of the game's modes, the
// map's first view, the look's starting time; the map layer toggles the layer rows give the
// viewport, the time stops, and the look the time and snow ask for.

import {
  initialPlanner,
  keyAction,
  mapLayers,
  plannerReducer,
  timeStopsFor,
  useScreenLayout,
  type LayoutSetting,
  type PlannerAction,
  type PlannerKey,
  type PlannerState,
} from "@glade/planner";
import { seasons, startEnvironment, startView, timeStops, type Environment } from "@glade/viewport";
import { useEffect, useMemo, useReducer, useRef } from "react";
import type { GamePlanner } from "../games";

/** Whether a key went to a field that takes typing. */
function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement && !["range", "checkbox", "radio"].includes(target.type)
  );
}

type Commands = { fit: () => void; clearSelection: () => void };

/** The planner's keys, on the whole window, with the newest state each time. */
function usePlannerKeys(
  state: PlannerState,
  dispatch: (action: PlannerAction) => void,
  planner: GamePlanner,
  commands: Commands,
) {
  const latest = useRef({ state, planner, commands });
  useEffect(() => {
    latest.current = { state, planner, commands };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { state: now, planner: p, commands: run } = latest.current;
      const press = {
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        typing: typingIn(e.target),
      };
      const action: PlannerKey | null = keyAction(
        press,
        now,
        p.modes.map((m) => m.id),
      );
      if (!action) return;
      e.preventDefault();
      if (action.type === "fit") run.fit();
      else if (action.type === "clear-selection") run.clearSelection();
      else dispatch(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);
}

export function usePlanner(
  planner: GamePlanner,
  layout: LayoutSetting | undefined,
  commands: Commands,
) {
  const screen = useScreenLayout(layout);
  const start = useMemo(() => startEnvironment(planner.map), [planner]);
  const [state, dispatch] = useReducer(
    plannerReducer,
    {
      panel: screen === "desktop" ? "open" : "rail",
      hour: start.hour,
      mode: planner.modes[0]?.id,
      view: startView(planner.map),
    },
    initialPlanner,
  );
  useEffect(
    () => dispatch({ type: "panel", panel: screen === "desktop" ? "open" : "rail" }),
    [screen],
  );

  usePlannerKeys(state, dispatch, planner, commands);
  const defaults = useMemo(
    () => Object.fromEntries(planner.map.ui.layerNames().map((l) => [l.id, l.default])),
    [planner],
  );
  const layers = useMemo(
    () => mapLayers(state, planner.layers, defaults),
    [state, planner, defaults],
  );
  const time = useMemo(() => {
    const stops = timeStopsFor(timeStops(planner.map), planner.timeStops);
    const snow = planner.snowSeason;
    return { stops, hasSnow: !!snow && seasons(planner.map).includes(snow) };
  }, [planner]);
  const environment = useMemo<Environment>(
    () => ({
      hour: state.hour,
      season: state.snow && planner.snowSeason ? planner.snowSeason : start.season,
    }),
    [state.hour, state.snow, planner, start],
  );
  return { state, dispatch, layers, time, environment };
}

export type Plan = ReturnType<typeof usePlanner>;
