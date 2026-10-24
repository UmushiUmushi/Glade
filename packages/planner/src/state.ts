// The planner's own state (not the map's): the active tool, how a new selection combines with the
// old, the ruler, which layer rows are hidden, the "Always on" ticks, the time of day and snow, the
// viewport's mode, view and camera, Preview, and whether the side panel and the viewport menu are
// open. A pure reducer, so the rules in docs/planner/screen.md are tested without a
// screen.

/** Tools that share the one "active tool" (paint tools join them with the toolbox). */
export type ToolId = "camera" | "pointer" | "lasso" | "select-rect" | "select-circle" | "magic";

export const SELECT_TOOLS: readonly ToolId[] = ["lasso", "select-rect", "select-circle", "magic"];

/** How a new selection combines with the old one. */
export type SelectMode = "set" | "add" | "subtract";

/** 2D (the plan) or 3D. */
export type ViewKind = "2d" | "3d";

/** The 3D camera. */
export type CameraKind = "iso" | "top" | "walk";

/** The host's own layer rows, after a game's: grid lines and area lines. */
export type HostLayer = "grid" | "area";

export interface PlannerState {
  tool: ToolId;
  /** The select tool used last: the rail's Select button shows it and picks it again. */
  lastSelectTool: ToolId;
  selectMode: SelectMode;
  ruler: boolean;
  /** Layer rows the user has hidden, by row id. */
  hidden: readonly string[];
  /** "Always on" ticks: unticked, the row is locked and only a spotlight shows. */
  alwaysOn: Readonly<Record<HostLayer, boolean>>;
  /** The time of day, in hours (0 to 24). */
  hour: number;
  /** Winter (Snow ticked). */
  snow: boolean;
  /** The viewport mode: one of the map's modes (the game's ui), "" for a map with none. */
  mode: string;
  view: ViewKind;
  camera: CameraKind;
  /** Preview: every panel and control hidden but a way back. */
  preview: boolean;
  /** The viewport menu, or its slim tag. */
  viewMenu: "open" | "closed";
  panel: "open" | "rail";
}

export type PlannerAction =
  | { type: "tool"; tool: ToolId }
  | { type: "select-mode"; mode: SelectMode }
  | { type: "ruler"; on: boolean }
  | { type: "toggle-layer"; id: string }
  | { type: "always-on"; layer: HostLayer; on: boolean }
  | { type: "hour"; hour: number }
  | { type: "mode"; mode: string }
  | { type: "view"; view: ViewKind }
  | { type: "camera"; camera: CameraKind }
  | { type: "preview"; on: boolean }
  | { type: "view-menu"; open: boolean }
  | { type: "snow"; on: boolean }
  | { type: "panel"; panel: "open" | "rail" };

/**
 * A new planner: the Pointer, Set, no ruler, every layer shown, the grid always on, no snow, at
 * `hour` (the look's default time).
 */
export function initialPlanner(
  start: { panel?: "open" | "rail"; hour?: number; mode?: string; view?: ViewKind } = {},
): PlannerState {
  return {
    tool: "pointer",
    lastSelectTool: "select-rect",
    selectMode: "set",
    ruler: false,
    hidden: [],
    alwaysOn: { grid: true, area: false },
    hour: start.hour ?? 12,
    snow: false,
    mode: start.mode ?? "",
    view: start.view ?? "3d",
    camera: "iso",
    preview: false,
    viewMenu: "open",
    panel: start.panel ?? "open",
  };
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case "tool":
      // Picking the active tool again does nothing (for Camera, Pointer and the select tools).
      if (state.tool === action.tool) return state;
      return {
        ...state,
        tool: action.tool,
        lastSelectTool: SELECT_TOOLS.includes(action.tool) ? action.tool : state.lastSelectTool,
      };
    case "select-mode":
      return state.selectMode === action.mode ? state : { ...state, selectMode: action.mode };
    case "ruler":
      return state.ruler === action.on ? state : { ...state, ruler: action.on };
    case "toggle-layer":
      if (isLocked(state, action.id)) return state;
      return {
        ...state,
        hidden: state.hidden.includes(action.id)
          ? state.hidden.filter((id) => id !== action.id)
          : [...state.hidden, action.id],
      };
    case "always-on":
      return state.alwaysOn[action.layer] === action.on
        ? state
        : { ...state, alwaysOn: { ...state.alwaysOn, [action.layer]: action.on } };
    case "hour":
      return state.hour === action.hour ? state : { ...state, hour: action.hour };
    case "snow":
      return state.snow === action.on ? state : { ...state, snow: action.on };
    case "mode":
      return state.mode === action.mode ? state : { ...state, mode: action.mode };
    case "view":
      return state.view === action.view ? state : { ...state, view: action.view };
    case "camera":
      return state.camera === action.camera ? state : { ...state, camera: action.camera };
    case "preview":
      return state.preview === action.on ? state : { ...state, preview: action.on };
    case "view-menu": {
      const viewMenu = action.open ? "open" : "closed";
      return state.viewMenu === viewMenu ? state : { ...state, viewMenu };
    }
    case "panel":
      return state.panel === action.panel ? state : { ...state, panel: action.panel };
  }
}

/** A host row is locked (greyed, its eye off) while its "Always on" is unticked. */
export function isLocked(state: PlannerState, rowId: string): boolean {
  return (rowId === "grid" || rowId === "area") && !state.alwaysOn[rowId];
}

/** Whether a layer row shows: not hidden, and not locked. */
export function isVisible(state: PlannerState, rowId: string): boolean {
  return !isLocked(state, rowId) && !state.hidden.includes(rowId);
}

/**
 * A row in the Layers section: a name, an icon, and the map's layer toggles it hides. The host's
 * grid and area rows say which "Always on" tick locks them, and hide no map layer.
 */
export interface LayerRow {
  id: string;
  label: string;
  icon: string;
  /** The map's layer toggles this row hides (RenderableMap ui.layerNames ids). */
  layers: readonly string[];
  host?: HostLayer;
}

/**
 * The map's layer toggles for the viewport: one shows unless a row that hides it is hidden. Toggles
 * no row names stay as the map starts them.
 */
export function mapLayers(
  state: PlannerState,
  rows: readonly LayerRow[],
  defaults: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const out = { ...defaults };
  for (const row of rows) {
    if (isVisible(state, row.id)) continue;
    for (const layer of row.layers) out[layer] = false;
  }
  return out;
}
