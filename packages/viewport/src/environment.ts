// The look for a moment: a time of day and a season, turned into the map's look by its own style
// (resolveLookAt). Also the slider's stops, from the style's presets (a game with four times of
// day has four stops).

import {
  presetHours,
  resolveLookAt,
  seasonNames,
  type Look,
  type RenderableMap,
} from "@glade/render";

export interface Environment {
  /** Hour of the day, 0 to 24. */
  hour: number;
  season?: string;
}

/** The map's look at an hour and season. */
export function lookAt(map: RenderableMap, env: Environment): Look {
  return resolveLookAt(map.style.defaults, env.hour, env.season);
}

/** The time stops the environment's slider snaps to, earliest first, with their preset names. */
export function timeStops(map: RenderableMap): { name: string; hour: number }[] {
  return presetHours(map.style.defaults);
}

/** The seasons the map's look has (none, or several: spring and winter). */
export function seasons(map: RenderableMap): string[] {
  return seasonNames(map.style.defaults);
}

/** Where a map starts: its style's default preset's hour and season. */
export function startEnvironment(map: RenderableMap): Environment {
  const style = map.style.defaults;
  const stops = timeStops(map);
  const start = stops.find((s) => s.name === style.defaultPreset) ?? stops[0];
  const env: Environment = { hour: start?.hour ?? 12 };
  if (style.defaultSeason) env.season = style.defaultSeason;
  return env;
}
