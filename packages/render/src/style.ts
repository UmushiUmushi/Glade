// A game's look as data, in games/<game>/look/style.json. The envelope is generic: `units`, `world` (curvature, the walk
// camera, and anything else the game renders), `shared` values that do not change with time of day,
// named `presets` (day, night, ...) with a generic sky and light plus the game's own `colors`, and
// optional `seasons` (spring, winter, ...) that patch the shared values and each preset. Time of
// day and season are independent: a look is one preset in one season. The game checks `shared` and
// `colors`; the host renders sky, light, curvature and the walk camera itself. Pure, so the browser
// and the server both use it.

import type { ZodType } from "zod";
import type { Rect } from "@glade/core";

export interface SkyStyle {
  top: string;
  horizon: string;
  /** A third gradient stop between horizon and top, reached at `midAt` degrees up. */
  mid?: string;
  midAt?: number;
  /** Degrees above the horizon where the sky reaches `top` (default 90). */
  topAt?: number;
  /** Yellow five-pointed stars among the dot stars, 0..1: how strongly they show and glow. */
  sparkles?: number;
  stars?: boolean;
  starAlpha?: number;
  clouds?: string;
  /** Shooting stars: long parallel streaks with bright heads, 0..1 how many. */
  meteors?: number;
  /** Glowing shapes scattered in the sky: `amount` 0..1 how many, `size` in degrees. */
  glyphs?: SkyGlyphs;
  fog: { color: string; near: number; far: number };
}

export interface SkyGlyphs {
  shape: "paw" | "heart" | "moon";
  color: string;
  amount: number;
  size?: number;
}

export interface LightStyle {
  sun: {
    /** Degrees clockwise from north (0 north, 90 east, 180 south). */
    azimuth: number;
    /** Degrees above the horizon. */
    elevation: number;
    color: string;
    intensity: number;
    shadows?: boolean;
    /** Shadow blur radius in shadow-map texels (used when shadowBlur is not set). */
    shadowSoftness?: number;
    /** Shadow blur radius in 3D units; the viewer sizes the shadow map to keep it smooth. */
    shadowBlur?: number;
    /** 0..1, how dark a full shadow is. */
    shadowOpacity?: number;
  };
  ambient: { sky: string; ground: string; intensity: number };
  /** Soft glow around bright areas (bloom); none when absent or strength 0. */
  glow?: GlowStyle;
  /** The final color pass (a game's color grading); none when absent. */
  grade?: GradeStyle;
  /** Depth of field: the distance goes soft; none when absent or blur 0. */
  focus?: FocusStyle;
}

/**
 * Depth of field around the point the camera looks at, `d` away: sharp out to `start` x d, soft
 * by `end` x d and beyond, where the blur is `blur` pixels per 1000 pixels of frame height. The
 * sky stays sharp; soft land bleeds over its edge.
 */
export interface FocusStyle {
  blur: number;
  start: number;
  end: number;
}

/**
 * A color grade in display space, applied last: `gain` multiplies (#ffffff none), `lift` raises
 * the blacks toward its color (#000000 none), `contrast` pivots around mid grey, `saturation`
 * mixes from the luma (1 none), and then `tint` multiplies each channel ([1, 1, 1] none; values
 * may pass 1). Lowering saturation and then tinting turns every color toward one hue by its
 * brightness, as a night grade does.
 */
export interface GradeStyle {
  saturation?: number;
  contrast?: number;
  lift?: string;
  gain?: string;
  tint?: [number, number, number];
}

/** Bloom: `strength` of the glow, `radius` 0..1 how far it spreads, `threshold` 0..1 brightness it starts at. */
export interface GlowStyle {
  strength: number;
  radius: number;
  threshold: number;
}

export interface PresetStyle<C = unknown> {
  /** Hour of the day (0..24) this preset shows; presets with an hour make the time slider. */
  hour?: number;
  sky: SkyStyle;
  light: LightStyle;
  /** The game's palette for this preset. */
  colors: C;
}

/**
 * The walk camera: a player's-eye view behind a figure standing at the focus point. Lengths are in
 * 3D units, angles in degrees.
 */
export interface WalkCameraStyle {
  /** Vertical field of view. */
  fov: number;
  /** Degrees above the horizon. */
  pitch: number;
  /** From the camera to the point it looks at. */
  distance: number;
  /** Height of the point it looks at above the ground (about the figure's middle). */
  eye: number;
  /** The game's screen aspect (width / height); the walk view letterboxes to it. */
  aspect?: number;
  /** Zoomed all the way in: distance and pitch there (zooming blends toward them). */
  near?: { distance: number; pitch: number };
  /** Zoomed all the way out, likewise. Without it the zoom stops at 1.6 x distance. */
  far?: { distance: number; pitch: number };
}

/**
 * Where a reference screenshot was taken from: the walk
 * camera's pose, fitted by the game's calibration. Kept in the game's reference/poses.json by image
 * path.
 */
export interface ReferencePose {
  /** The map the shot shows, when it is one of the game's maps. */
  map?: string;
  /** The figure's feet, in world units (the game's space). */
  at: [number, number];
  /** Degrees around the vertical, 0 = camera to the south looking north, 90 = from the east. */
  yaw: number;
  /** The walk camera's values for this shot; missing ones come from world.camera.walk. */
  distance?: number;
  pitch?: number;
  fov?: number;
  /** The shot's width / height. */
  aspect?: number;
}

/** A figure the size of the player in the walk view, for scale. */
export interface FigureStyle {
  height: number;
  radius: number;
  color: string;
}

export interface WorldStyle {
  curvature: { enabled: boolean; radius: number };
  camera?: { walk?: WalkCameraStyle };
  figure?: FigureStyle;
  [k: string]: unknown;
}

/** A season: patches over the shared values and over each preset (sky, light, colors). */
export interface SeasonStyle {
  shared?: unknown;
  presets?: Record<string, unknown>;
}

export interface Style<S = unknown, C = unknown> {
  units: { heightScale: number };
  world: WorldStyle;
  /** The game's values shared by every preset. */
  shared: S;
  presets: Record<string, PresetStyle<C>>;
  /** Preset the viewer starts with. */
  defaultPreset?: string;
  /** Seasons that patch the shared values and the presets; none means one fixed season. */
  seasons?: Record<string, SeasonStyle>;
  defaultSeason?: string;
}

/** Everything the renderer needs for one preset: the shared values with the preset over them. */
export type Look<S = unknown, C = unknown> = S &
  PresetStyle<C> & {
    preset: string;
    /** The season applied, or "" when the style has none. */
    season: string;
    /** The hour shown, when the look was resolved for a time of day (resolveLookAt). */
    time?: number;
    units: Style["units"];
    world: WorldStyle;
  };

/**
 * What a game adds to style handling: a schema for its parts,
 * checked once per preset as { shared, colors, world }, and the style to use when the game's file
 * is missing.
 */
export interface StyleHooks {
  schema: ZodType;
  defaults: Style;
}

/**
 * What a capture asks an open viewer to draw. rect is a grid rect.
 */
export interface RenderRequest {
  rect?: Rect;
  /** "view": the viewer's own camera as it is now (its aspect, curvature and figure). */
  camera?: "top" | "iso" | "walk" | "view";
  yaw?: number;
  pitch?: number;
  size?: number;
  preset?: string;
  /** Hour of the day (0..24), blending the presets around it; wins over `preset`. */
  time?: number;
  season?: string;
  curvature?: boolean;
  style?: "look" | "flat";
  overlays?: boolean;
  /** Render from a reference shot's pose instead (width = size, height from its aspect). */
  pose?: ReferencePose;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Merge `patch` into `base` without mutating either. Objects merge key by key, anything else
 * (arrays, strings, numbers) replaces; a null in the patch deletes the key.
 */
export function mergeStyle<T>(base: T, patch: unknown): T {
  if (!isObject(patch) || !isObject(base)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = isObject(v) && isObject(out[k]) ? mergeStyle(out[k], v) : v;
  }
  return out as T;
}

export function presetNames(style: Style<unknown, unknown>): string[] {
  return Object.keys(style.presets);
}

export function seasonNames(style: Style<unknown, unknown>): string[] {
  return Object.keys(style.seasons ?? {});
}

/** A known name, else the default, else the first; "" when there are none. */
function pick(names: string[], want?: string, fallback?: string): string {
  if (want && names.includes(want)) return want;
  if (fallback && names.includes(fallback)) return fallback;
  return names[0] ?? "";
}

/**
 * The shared values with one preset applied, in one season (the season's patches first merged
 * over the shared values and the preset). Unknown names fall back to the defaults.
 */
export function resolveLook<S, C>(
  style: Style<S, C>,
  preset?: string,
  season?: string,
): Look<S, C> {
  const name = pick(presetNames(style), preset, style.defaultPreset);
  const seasonName = pick(seasonNames(style), season, style.defaultSeason);
  const patch = seasonName ? style.seasons![seasonName] : undefined;
  const shared = mergeStyle(style.shared, patch?.shared);
  const p = mergeStyle(style.presets[name], patch?.presets?.[name]);
  return {
    ...(shared as object),
    ...p,
    preset: name,
    season: seasonName,
    units: style.units,
    world: style.world,
  } as Look<S, C>;
}

/** Presets that have an hour, earliest first: the time slider's snap points. */
export function presetHours(style: Style<unknown, unknown>): { name: string; hour: number }[] {
  return Object.entries(style.presets)
    .filter(([, p]) => typeof p.hour === "number")
    .map(([name, p]) => ({ name, hour: ((p.hour! % 24) + 24) % 24 }))
    .sort((a, b) => a.hour - b.hour);
}

/**
 * The look at an hour of the day: the two presets whose
 * hours bracket it, going round the clock, blended (numbers and colors interpolate; anything else,
 * and arrays of different lengths, come from the nearer one). At a preset's own hour this is
 * exactly that preset. A style without hours falls back to resolveLook.
 */
export function resolveLookAt<S, C>(style: Style<S, C>, hour: number, season?: string): Look<S, C> {
  const hours = presetHours(style as Style<unknown, unknown>);
  if (!hours.length) return resolveLook(style, undefined, season);
  const h = ((hour % 24) + 24) % 24;
  let i = hours.length - 1;
  while (i > 0 && hours[i].hour > h) i--;
  if (hours[i].hour > h) i = hours.length - 1; // before the first: after the last, yesterday
  const a = hours[i];
  const b = hours[(i + 1) % hours.length];
  const span = (b.hour - a.hour + 24) % 24 || 24;
  const t = hours.length === 1 ? 0 : ((h - a.hour + 24) % 24) / span;
  const la = resolveLook(style, a.name, season);
  if (t === 0) return { ...la, time: h };
  const lb = resolveLook(style, b.name, season);
  const out = blendJson(la as unknown as Json, lb as unknown as Json, t) as unknown as Look<S, C>;
  return { ...out, preset: t < 0.5 ? a.name : b.name, time: h };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function mixHex(a: string, b: string, t: number): string {
  const c = (s: string, i: number) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${[0, 1, 2].map((i) => hex(c(a, i) + (c(b, i) - c(a, i)) * t)).join("")}`;
}

/** Blend two JSON values at t (0 = a, 1 = b); see resolveLookAt. */
export function blendJson(a: Json, b: Json, t: number): Json {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
  if (typeof a === "string" && typeof b === "string" && HEX.test(a) && HEX.test(b)) {
    return t === 0 ? a : mixHex(a, b, t);
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.map((x, i) => blendJson(x, b[i], t));
  }
  if (isObject(a) && isObject(b)) {
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k in a && k in b) out[k] = blendJson(a[k] as Json, b[k] as Json, t);
      else if (k in a ? t < 0.5 : t >= 0.5) out[k] = (k in a ? a[k] : b[k]) as Json;
    }
    return out;
  }
  return t < 0.5 ? a : b;
}

/** Problems that would stop a style from rendering; empty when usable. */
export function styleProblems(style: Style, hooks?: StyleHooks): string[] {
  const out: string[] = [];
  const hex = /^#[0-9a-fA-F]{6}$/;
  if (!isObject(style)) return ["style must be an object"];
  if (!(style.units?.heightScale > 0)) out.push("units.heightScale must be > 0");
  if (!isObject(style.shared)) out.push("missing shared");
  if (!isObject(style.presets) || !Object.keys(style.presets).length) {
    out.push("needs at least one preset");
    return out;
  }
  for (const [name, p] of Object.entries(style.presets)) {
    const colors = collectColors(p as unknown as Json, `presets.${name}`);
    for (const [path, v] of colors) if (!hex.test(v)) out.push(`${path}: "${v}" is not #rrggbb`);
    if (!p.sky?.fog) out.push(`presets.${name}.sky.fog is missing`);
    if (!p.light?.sun || !p.light?.ambient) out.push(`presets.${name}.light needs sun and ambient`);
    const f = p.light?.focus;
    if (f && ![f.blur, f.start, f.end].every((v) => typeof v === "number" && v >= 0)) {
      out.push(`presets.${name}.light.focus needs blur, start and end as numbers >= 0`);
    }
    const tint = p.light?.grade?.tint;
    if (
      tint !== undefined &&
      !(
        Array.isArray(tint) &&
        tint.length === 3 &&
        tint.every((v) => typeof v === "number" && v >= 0)
      )
    ) {
      out.push(`presets.${name}.light.grade.tint needs three numbers >= 0`);
    }
    if (p.hour !== undefined && !(typeof p.hour === "number" && p.hour >= 0 && p.hour < 24)) {
      out.push(`presets.${name}.hour must be a number in 0..24`);
    }
  }
  const seasons = style.seasons ?? {};
  if (!isObject(seasons)) out.push("seasons must be an object");
  for (const [season, patch] of Object.entries(seasons)) {
    for (const name of Object.keys(patch?.presets ?? {})) {
      if (!style.presets[name]) out.push(`seasons.${season}.presets.${name}: no such preset`);
    }
    for (const [path, v] of collectColors(patch?.presets as Json, `seasons.${season}.presets`)) {
      if (!hex.test(v)) out.push(`${path}: "${v}" is not #rrggbb`);
    }
  }
  if (hooks) {
    // Each preset alone, then each season over it; a season's problems are named after it.
    for (const season of ["", ...Object.keys(seasons)]) {
      for (const name of Object.keys(style.presets)) {
        const look = resolveLook(style, name, season || undefined);
        const r = hooks.schema.safeParse({
          shared: season ? mergeStyle(style.shared, seasons[season]?.shared) : style.shared,
          colors: season ? look.colors : style.presets[name].colors,
          world: style.world,
        });
        if (r.success) continue;
        for (const issue of r.error.issues) {
          const [part, ...rest] = issue.path.map(String);
          const where = part === "colors" ? `presets.${name}.colors` : part;
          const path = [where, ...rest].join(".");
          const problem = `${season ? `seasons.${season}: ` : ""}${path}: ${issue.message}`;
          const plain = `${path}: ${issue.message}`;
          if (!out.includes(problem) && !out.includes(plain)) out.push(problem);
        }
      }
    }
  }
  return out;
}

/** Keys whose strings are names, not colors (sky.glyphs.shape). */
const NAME_KEYS = new Set(["shape"]);

/** Every string value with its path; in a preset every string is a color, but for NAME_KEYS. */
function collectColors(v: Json, path: string): [string, string][] {
  if (typeof v === "string") return NAME_KEYS.has(path.split(".").pop()!) ? [] : [[path, v]];
  if (Array.isArray(v)) return v.flatMap((x, i) => collectColors(x, `${path}[${i}]`));
  if (isObject(v)) return Object.entries(v).flatMap(([k, x]) => collectColors(x, `${path}.${k}`));
  return [];
}

/** Read a dotted path ("presets.night.sky.top") from a style. */
export function stylePath(style: Style, path?: string): unknown {
  if (!path) return style;
  let cur: unknown = style;
  for (const key of path.split(".")) {
    if (!isObject(cur) && !Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}
