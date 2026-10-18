// The time of day in the side panel (docs/planner/screen.md, Environment): the slider's stops (an
// hour each from the game's look, a name and a sky colour from its ui), evenly spaced along the
// track as in the design, with the hours between them blended. Snapping, the keys, what screen
// readers hear and the sky's colour are plain functions, tested without a screen.

export interface TimeStop {
  /** Its name: "Dusk". */
  label: string;
  /** Its hour, from the game's look: 16.5. */
  hour: number;
  /** The sky dome's colour at this stop. */
  sky: string;
}

/** How a game names one of its look's presets on the slider. */
export interface TimeStopName {
  /** The look's preset: "afternoon". */
  preset: string;
  label: string;
  sky: string;
}

/**
 * The slider's stops: each preset of the map's look (name and hour, earliest first) that the game
 * names, in the look's order. A look with fewer than two named stops has no time of day to slide.
 */
export function timeStopsFor(
  look: readonly { name: string; hour: number }[],
  names: readonly TimeStopName[],
): TimeStop[] {
  return look.flatMap((preset) => {
    const named = names.find((n) => n.preset === preset.name);
    return named ? [{ label: named.label, hour: preset.hour, sky: named.sky }] : [];
  });
}

/** Within this many hours of a stop, the slider snaps to it. */
export const SNAP_HOURS = 0.75;

/** The arrow keys move this many hours. */
export const KEY_STEP_HOURS = 0.25;

/** The hour at a place on the track: 0 is the first stop, 1 the second, and so on. */
export function hourAt(stops: readonly TimeStop[], position: number): number {
  const last = stops.length - 1;
  const p = Math.max(0, Math.min(last, position));
  const i = Math.min(last - 1, Math.floor(p));
  if (last === 0) return stops[0].hour;
  return stops[i].hour + (stops[i + 1].hour - stops[i].hour) * (p - i);
}

/** Where an hour sits on the track (the inverse of hourAt). */
export function positionOf(stops: readonly TimeStop[], hour: number): number {
  const last = stops.length - 1;
  if (last <= 0 || hour <= stops[0].hour) return 0;
  if (hour >= stops[last].hour) return last;
  let i = 0;
  while (hour > stops[i + 1].hour) i++;
  return i + (hour - stops[i].hour) / (stops[i + 1].hour - stops[i].hour);
}

/** An hour, snapped to the nearest stop when it is within SNAP_HOURS of it. */
export function snapHour(stops: readonly TimeStop[], hour: number): number {
  const near = nearestStop(stops, hour);
  return Math.abs(near.hour - hour) <= SNAP_HOURS ? near.hour : hour;
}

/** The stop nearest an hour. */
export function nearestStop(stops: readonly TimeStop[], hour: number): TimeStop {
  return stops.reduce((best, s) =>
    Math.abs(s.hour - hour) < Math.abs(best.hour - hour) ? s : best,
  );
}

/**
 * The hour after a key on the slider, or null for a key it ignores: arrows move 15 minutes, Page
 * Up and Page Down jump to the next and the previous stop, Home and End go to the ends.
 */
export function hourAfterKey(stops: readonly TimeStop[], hour: number, key: string): number | null {
  const first = stops[0].hour;
  const last = stops[stops.length - 1].hour;
  const clamp = (h: number) => Math.max(first, Math.min(last, h));
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return clamp(hour + KEY_STEP_HOURS);
    case "ArrowLeft":
    case "ArrowDown":
      return clamp(hour - KEY_STEP_HOURS);
    case "PageUp":
      return stops.find((s) => s.hour > hour + 1e-9)?.hour ?? last;
    case "PageDown":
      return [...stops].reverse().find((s) => s.hour < hour - 1e-9)?.hour ?? first;
    case "Home":
      return first;
    case "End":
      return last;
    default:
      return null;
  }
}

/** An hour as a clock: 16.5 → "4:30 PM". */
export function clockText(hour: number): string {
  const minutes = Math.round(hour * 60) % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** What screen readers hear for the slider's value: "Dusk, 4:30 PM". */
export function timeText(stops: readonly TimeStop[], hour: number): string {
  return `${nearestStop(stops, hour).label}, ${clockText(hour)}`;
}

/** `a` mixed toward `b` by `t` (0 to 1), both #rrggbb. */
export function mixColor(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** The sky dome's colour at a place on the track, blended between its two stops. */
export function skyAt(stops: readonly TimeStop[], position: number): string {
  const last = stops.length - 1;
  const p = Math.max(0, Math.min(last, position));
  const i = Math.min(last - 1, Math.floor(p));
  if (last === 0) return stops[0].sky;
  return mixColor(stops[i].sky, stops[i + 1].sky, p - i);
}

/** How far into night a place on the track is: 0 until the last stop's span, then up to 1. */
export function nightAt(stops: readonly TimeStop[], position: number): number {
  return Math.max(0, Math.min(1, position - (stops.length - 2)));
}
