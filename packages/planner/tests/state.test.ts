// The planner's own state: one active tool, the select mode and ruler, hiding layer rows, the
// "Always on" ticks locking the grid and area rows, the panel, and the map layers that follow.

import { describe, expect, it } from "vitest";
import {
  initialPlanner,
  isLocked,
  isVisible,
  mapLayers,
  plannerReducer,
  type LayerRow,
  type PlannerAction,
  type PlannerState,
} from "../src/state";

const run = (...actions: PlannerAction[]): PlannerState =>
  actions.reduce(plannerReducer, initialPlanner());

describe("a new planner", () => {
  it("starts with the Pointer, Set, no ruler, every row shown, the grid always on", () => {
    const s = initialPlanner();
    expect(s.tool).toBe("pointer");
    expect(s.selectMode).toBe("set");
    expect(s.ruler).toBe(false);
    expect(s.hidden).toEqual([]);
    expect(s.alwaysOn).toEqual({ grid: true, area: false });
    expect(s.panel).toBe("open");
    expect(s.hour).toBe(12);
    expect(s.snow).toBe(false);
    expect(initialPlanner({ panel: "rail", hour: 7 })).toMatchObject({ panel: "rail", hour: 7 });
  });
});

describe("tools", () => {
  it("hold one active tool: picking one puts the last one down", () => {
    expect(run({ type: "tool", tool: "camera" }).tool).toBe("camera");
    expect(run({ type: "tool", tool: "camera" }, { type: "tool", tool: "lasso" }).tool).toBe(
      "lasso",
    );
  });

  it("remember the select tool used last, through other tools", () => {
    expect(initialPlanner().lastSelectTool).toBe("select-rect");
    const s = run({ type: "tool", tool: "lasso" }, { type: "tool", tool: "camera" });
    expect(s.tool).toBe("camera");
    expect(s.lastSelectTool).toBe("lasso");
  });

  it("do nothing when the active one is picked again", () => {
    const s = initialPlanner();
    expect(plannerReducer(s, { type: "tool", tool: "pointer" })).toBe(s);
  });
});

describe("select mode and ruler", () => {
  it("change, and stay the same object when nothing changes", () => {
    const s = run({ type: "select-mode", mode: "add" }, { type: "ruler", on: true });
    expect(s.selectMode).toBe("add");
    expect(s.ruler).toBe(true);
    expect(plannerReducer(s, { type: "ruler", on: true })).toBe(s);
    expect(plannerReducer(s, { type: "select-mode", mode: "add" })).toBe(s);
  });
});

describe("layer rows", () => {
  it("hide and show again", () => {
    const hidden = run({ type: "toggle-layer", id: "flowers" });
    expect(isVisible(hidden, "flowers")).toBe(false);
    expect(
      isVisible(plannerReducer(hidden, { type: "toggle-layer", id: "flowers" }), "flowers"),
    ).toBe(true);
  });

  it("lock the area row until Always on: Area is ticked, and the grid row when it's unticked", () => {
    const s = initialPlanner();
    expect(isLocked(s, "area")).toBe(true);
    expect(isVisible(s, "area")).toBe(false);
    expect(isLocked(s, "grid")).toBe(false);
    expect(plannerReducer(s, { type: "toggle-layer", id: "area" })).toBe(s);
    const ticked = plannerReducer(s, { type: "always-on", layer: "area", on: true });
    expect(isVisible(ticked, "area")).toBe(true);
    const gridOff = plannerReducer(s, { type: "always-on", layer: "grid", on: false });
    expect(isVisible(gridOff, "grid")).toBe(false);
    expect(plannerReducer(gridOff, { type: "always-on", layer: "grid", on: false })).toBe(gridOff);
  });
});

describe("time and snow", () => {
  it("change, and stay the same object when nothing changes", () => {
    const s = run({ type: "hour", hour: 16.5 }, { type: "snow", on: true });
    expect(s).toMatchObject({ hour: 16.5, snow: true });
    expect(plannerReducer(s, { type: "hour", hour: 16.5 })).toBe(s);
    expect(plannerReducer(s, { type: "snow", on: true })).toBe(s);
  });
});

describe("the viewport", () => {
  it("starts in 3D with the iso camera, the menu open, no preview, in the mode given", () => {
    expect(initialPlanner({ mode: "first" })).toMatchObject({
      mode: "first",
      view: "3d",
      camera: "iso",
      preview: false,
      viewMenu: "open",
    });
    expect(initialPlanner({ view: "2d" }).view).toBe("2d");
  });

  it("changes mode, view, camera, preview and the menu, and stays the same when nothing changes", () => {
    const s = run(
      { type: "mode", mode: "second" },
      { type: "view", view: "2d" },
      { type: "camera", camera: "walk" },
      { type: "preview", on: true },
      { type: "view-menu", open: false },
    );
    expect(s).toMatchObject({
      mode: "second",
      view: "2d",
      camera: "walk",
      preview: true,
      viewMenu: "closed",
    });
    for (const a of [
      { type: "mode", mode: "second" },
      { type: "view", view: "2d" },
      { type: "camera", camera: "walk" },
      { type: "preview", on: true },
      { type: "view-menu", open: false },
    ] as PlannerAction[]) {
      expect(plannerReducer(s, a)).toBe(s);
    }
  });
});

describe("the panel", () => {
  it("opens and shrinks to the rail", () => {
    const rail = run({ type: "panel", panel: "rail" });
    expect(rail.panel).toBe("rail");
    expect(plannerReducer(rail, { type: "panel", panel: "rail" })).toBe(rail);
  });
});

describe("mapLayers", () => {
  const rows: LayerRow[] = [
    { id: "big", label: "Big things", icon: "x", layers: ["things"] },
    { id: "small", label: "Small things", icon: "x", layers: ["things"] },
    { id: "ground", label: "Ground", icon: "x", layers: ["ground", "edges"] },
  ];
  const defaults = { things: true, ground: true, edges: true, sky: true };

  it("shows every map layer while every row shows", () => {
    expect(mapLayers(initialPlanner(), rows, defaults)).toEqual(defaults);
  });

  it("hides a map layer when any row that names it is hidden, and leaves unnamed ones alone", () => {
    const s = run({ type: "toggle-layer", id: "small" }, { type: "toggle-layer", id: "ground" });
    expect(mapLayers(s, rows, defaults)).toEqual({
      things: false,
      ground: false,
      edges: false,
      sky: true,
    });
  });
});
