// The planner's keys (docs/planner/screen.md): one key per tool, mode and view control, as a plain
// function from a key press to what it does, so the table is tested without a screen. Keys pressed
// while typing in a field, or with Ctrl, Cmd or Alt, are left alone (those are the browser's, or
// undo and redo's, later). Tab is never taken: it moves the keyboard between controls.

import type { PlannerAction, PlannerState, ToolId } from "./state";

/** What a key does: a change to the planner's state, or a command for the page. */
export type PlannerKey = PlannerAction | { type: "fit" } | { type: "clear-selection" };

export interface KeyPress {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Whether the key went to a field that takes typing (an input, a text area). */
  typing?: boolean;
}

const TOOL_KEYS: Record<string, ToolId> = {
  h: "camera",
  v: "pointer",
  l: "lasso",
  m: "select-rect",
  o: "select-circle",
  y: "magic",
};

/** The key's action, given the planner's state and the map's modes in order (keys 1, 2, 3…). */
export function keyAction(
  press: KeyPress,
  state: PlannerState,
  modes: readonly string[],
): PlannerKey | null {
  if (press.typing || press.ctrlKey || press.metaKey || press.altKey) return null;
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  if (key === "Escape")
    return state.preview ? { type: "preview", on: false } : { type: "clear-selection" };
  if (state.preview) return key === "p" ? { type: "preview", on: false } : null;
  const tool = TOOL_KEYS[key];
  if (tool) return { type: "tool", tool };
  if (/^[1-9]$/.test(key)) {
    const mode = modes[Number(key) - 1];
    return mode ? { type: "mode", mode } : null;
  }
  switch (key) {
    case "r":
      return { type: "ruler", on: !state.ruler };
    case "p":
      return { type: "preview", on: true };
    case "f":
      return { type: "fit" };
    default:
      return null;
  }
}
