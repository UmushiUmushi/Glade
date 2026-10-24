// The planner's keys: tools, modes by number, the ruler, Preview, Fit and Esc; nothing while typing
// or with Ctrl, Cmd or Alt; in Preview only the ways back; and never Tab.

import { describe, expect, it } from "vitest";
import { keyAction } from "../src/keys";
import { initialPlanner, plannerReducer } from "../src/state";

const MODES = ["first", "second", "third"];
const s = initialPlanner({ mode: "first" });
const press = (key: string, extra = {}) => keyAction({ key, ...extra }, s, MODES);

describe("keys", () => {
  it("pick tools: H, V, L, M, O and Y, in either case", () => {
    expect(press("h")).toEqual({ type: "tool", tool: "camera" });
    expect(press("V")).toEqual({ type: "tool", tool: "pointer" });
    expect(press("l")).toEqual({ type: "tool", tool: "lasso" });
    expect(press("m")).toEqual({ type: "tool", tool: "select-rect" });
    expect(press("o")).toEqual({ type: "tool", tool: "select-circle" });
    expect(press("y")).toEqual({ type: "tool", tool: "magic" });
  });

  it("pick the map's modes by number, and nothing past the last", () => {
    expect(press("2")).toEqual({ type: "mode", mode: "second" });
    expect(press("4")).toBeNull();
  });

  it("toggle the ruler, open Preview, fit, and clear the selection with Esc", () => {
    expect(press("r")).toEqual({ type: "ruler", on: true });
    expect(press("p")).toEqual({ type: "preview", on: true });
    expect(press("f")).toEqual({ type: "fit" });
    expect(press("Escape")).toEqual({ type: "clear-selection" });
  });

  it("in Preview, only come back (Esc or P)", () => {
    const preview = plannerReducer(s, { type: "preview", on: true });
    expect(keyAction({ key: "Escape" }, preview, MODES)).toEqual({ type: "preview", on: false });
    expect(keyAction({ key: "p" }, preview, MODES)).toEqual({ type: "preview", on: false });
    expect(keyAction({ key: "h" }, preview, MODES)).toBeNull();
  });

  it("leave typing, Ctrl, Cmd, Alt and Tab alone", () => {
    expect(press("h", { typing: true })).toBeNull();
    expect(press("z", { ctrlKey: true })).toBeNull();
    expect(press("h", { metaKey: true })).toBeNull();
    expect(press("h", { altKey: true })).toBeNull();
    expect(press("Tab")).toBeNull();
    expect(press("q")).toBeNull();
  });
});
