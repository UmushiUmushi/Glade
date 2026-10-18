// Design tokens: the names every shared screen uses, never raw colours. Each game fills them in
// with its own look (its `ui` package); the names say what a colour is for, not what it looks like,
// so they fit every game. They become CSS custom properties on a theme root.

/** Colours that change between light and dark. */
export interface ThemeColors {
  /** The tray behind the cards. */
  ground: string;
  /** Cards and panels. */
  paper: string;
  /** Wells, tabs, slider tracks: a step in from paper. */
  inset: string;
  /** Dotted dividers and quiet outlines. Never the only edge of a control. */
  line: string;
  /** Card borders. */
  frame: string;
  /** The solid edge under a card (its bottom lip). */
  lip: string;
  /** Popups and menus. */
  pop: string;
  popLine: string;
  /** Text and glyphs. */
  ink: string;
  /** Titles. */
  inkTitle: string;
  /** Secondary text. */
  inkMuted: string;
  /** Problems: alert discs and text. */
  alert: string;
  /** The selected state (a pressed tool, the current tab). */
  selected: string;
  onSelected: string;
  /** The one dark fill: round buttons, info pills, toasts. */
  strong: string;
  onStrong: string;
  /** Buttons that float over the map, and the stepper's buttons inside them. */
  float: string;
  onFloat: string;
  floatPress: string;
  /** Destroying things: Delete. */
  danger: string;
  onDanger: string;
  /** The keyboard focus ring. Always high contrast. */
  focus: string;
  /** Behind a dialog. */
  scrim: string;
}

/** Shapes, shadows and type. */
export interface ThemeShape {
  /** Corner radius of cards (the panel, the viewport, the toolbox) and dialogs. */
  radiusCard: string;
  /** Corner radius of menus and popups. */
  radiusPop: string;
  /** Corner radius of small boxes (tick boxes). */
  radiusBox: string;
  borderCard: string;
  borderPop: string;
  /** Space between and around cards. */
  gap: string;
  /** The hard drop under buttons. */
  shadowChunk: string;
  /** Popups and windows. */
  shadowFloat: string;
  fontTitle: string;
  fontUi: string;
  weightTitle: string;
  weightUi: string;
  weightStrong: string;
}

export interface Theme {
  id: string;
  name: string;
  light: ThemeColors;
  dark: ThemeColors;
  shape: ThemeShape;
}

export type ColorMode = "light" | "dark";

/** `inkTitle` → `--ink-title`. */
export function cssName(token: string): string {
  return `--${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/**
 * How big Glade draws the design's sizes. The design's pixel sizes read far too big on a desktop
 * screen, so every interface size is drawn at this share of them (the map is not scaled).
 * Settings → Interface size multiplies it again.
 */
export const UI_BASE_SCALE = 0.8;

/** Sizes in pixels as interface units: `0 4px 0` → `0 calc(4 * var(--u)) 0`. */
export function inInterfaceUnits(value: string): string {
  return value.replace(/(?<![\w.-])(-?\d+(?:\.\d+)?)px\b/g, "calc($1 * var(--u))");
}

/**
 * A theme's tokens for one mode, as CSS custom properties, with `--u`: one interface pixel, the
 * design's pixel at `interfaceSize` (1 is 100 %) of the base scale. Every size in the shared
 * screens is a number of `--u`.
 */
export function cssVars(theme: Theme, mode: ColorMode, interfaceSize = 1): Record<string, string> {
  const vars: Record<string, string> = { "--u": `${UI_BASE_SCALE * interfaceSize}px` };
  for (const [token, value] of Object.entries(theme[mode])) vars[cssName(token)] = value;
  for (const [token, value] of Object.entries(theme.shape)) {
    vars[cssName(token)] = inInterfaceUnits(value);
  }
  return vars;
}
