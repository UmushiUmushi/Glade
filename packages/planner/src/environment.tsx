// The side panel's Environment section (docs/planner/screen.md, Environment): a small dome of sky
// over the time slider, and the Snow tick. The sun travels the dome's arc as the time slides and
// becomes a moon at night; clouds by day turn into stars; a little skyline in the panel's colour
// stands in front, its windows lit at night. The game gives the stops' names and sky colours.

import { Checkbox, Slider } from "@glade/ui";
import { PanelSection } from "./side-panel";
import type { PlannerAction, PlannerState } from "./state";
import {
  hourAfterKey,
  hourAt,
  mixColor,
  nearestStop,
  nightAt,
  positionOf,
  skyAt,
  snapHour,
  timeText,
  type TimeStop,
} from "./time";
import "./environment.css";

/** The dome: a chord 184 wide and 80 tall, so a circle of radius 92.9 centred at (92, 92.9). */
const DOME_R = 92.9;
const DOME_HALF_ANGLE = (Math.asin(92 / DOME_R) * 180) / Math.PI;

const circle = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 1 ${2 * rx} 0a${rx} ${ry} 0 1 1 ${-2 * rx} 0z`;
const rounded = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
  `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const puff = (cx: number, cy: number, s: number) =>
  circle(cx - 6 * s, cy, 4.5 * s) +
  circle(cx, cy - 3 * s, 6 * s) +
  circle(cx + 6 * s, cy, 4.5 * s) +
  rounded(cx - 10.5 * s, cy, 21 * s, 4.5 * s, 2.25 * s);
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}l${0.3 * r} ${0.7 * r} ${0.7 * r} ${0.3 * r} ${-0.7 * r} ${0.3 * r} ` +
  `${-0.3 * r} ${0.7 * r} ${-0.3 * r} ${-0.7 * r} ${-0.7 * r} ${-0.3 * r} ${0.7 * r} ${-0.3 * r}z`;

const CLOUDS = puff(42, 34, 1) + puff(140, 28, 0.85) + puff(96, 14, 0.7);
const STARS =
  sparkle(40, 34, 4) +
  sparkle(140, 28, 3.5) +
  sparkle(96, 14, 3) +
  sparkle(64, 24, 2.5) +
  sparkle(156, 46, 2.5) +
  sparkle(24, 54, 2) +
  circle(80, 30, 1.2) +
  circle(120, 40, 1.2) +
  circle(50, 50, 1);
/** Little houses and trees at the edges, rounded towers in the middle. */
const SKYLINE = [
  "M12 80V72l7-6 7 6V80z",
  "M30 80V58a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4V80z",
  circle(51, 70, 6) + "M50 80v-6h2v6z",
  "M60 80V46a8 8 0 0 1 16 0V80z",
  "M80 80V52a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4V80zM94 48v-5h5v5z",
  "M108 80V40a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V80zM113 38v-7h2v7z",
  circle(128, 71, 6) + "M127 80v-6h2v6z",
  "M136 80V68l10-8 10 8V80z",
  "M158 80V73a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3V80z",
].join("");
const WINDOW_AT = [
  [34, 60],
  [40, 60],
  [34, 68],
  [40, 68],
  [66.5, 46],
  [66.5, 55],
  [66.5, 64],
  [84, 54],
  [90.5, 54],
  [97, 54],
  [84, 63],
  [97, 63],
  [112.5, 44],
  [112.5, 52],
  [112.5, 60],
  [140, 70],
  [149, 70],
  [164, 74],
];
const WINDOWS =
  WINDOW_AT.map(([x, y]) => `M${x} ${y}h3v4h-3z`).join("") + "M90 80v-8a2 2 0 0 1 4 0v8z";

/** The sun at day, the moon at night, and the lit windows' warm light. */
const SUN = "#f9e260";
const MOON = "#fbf8ee";

/** The sky dome at a place on the track (0 is the first stop). */
export function SkyDome({ stops, position }: { stops: readonly TimeStop[]; position: number }) {
  const night = nightAt(stops, position);
  const sky = skyAt(stops, position);
  const last = Math.max(1, stops.length - 1);
  const sunDeg = -DOME_HALF_ANGLE + (position / last) * 2 * DOME_HALF_ANGLE;
  const label = stops[Math.round(Math.max(0, Math.min(last, position)))]?.label ?? "";
  return (
    <svg className="glade-sky" viewBox="0 0 184 80" role="img" aria-label={`Sky at ${label}`}>
      <path d={`M0 80A${DOME_R} ${DOME_R} 0 0 1 184 80Z`} style={{ fill: sky }} />
      <path d={STARS} fill="#f5f0d1" style={{ opacity: night }} />
      <g className="glade-sky-sun" style={{ transform: `rotate(${sunDeg.toFixed(2)}deg)` }}>
        <circle cx="92" cy="0" r="22" style={{ fill: mixColor(SUN, MOON, night) }} />
        <g fill="#e4dfcf" style={{ opacity: night }}>
          <circle cx="85" cy="-6" r="4" />
          <circle cx="100" cy="5" r="2.8" />
          <circle cx="88" cy="9" r="2" />
        </g>
      </g>
      <path d={CLOUDS} fill="#ffffff" style={{ opacity: (1 - night) * 0.95 }} />
      <path d={SKYLINE} className="glade-sky-paper" />
      <path d={WINDOWS} style={{ fill: mixColor(sky, SUN, night) }} />
      <path d={`M0 80A${DOME_R} ${DOME_R} 0 0 1 184 80V-1H0Z`} className="glade-sky-paper" />
    </svg>
  );
}

export interface EnvironmentSectionProps {
  state: PlannerState;
  dispatch: (action: PlannerAction) => void;
  /** The time stops: an hour each from the map's look, a name and sky colour from the game. */
  stops: readonly TimeStop[];
  /** Whether the map's look has a winter: without one there is no Snow tick. */
  hasSnow: boolean;
}

/** The time of day and the season, for a map whose look changes with them. */
export function EnvironmentSection({ state, dispatch, stops, hasSnow }: EnvironmentSectionProps) {
  const position = positionOf(stops, state.hour);
  const setHour = (hour: number) => dispatch({ type: "hour", hour });
  return (
    <PanelSection id="glade-panel-environment" title="Environment">
      <div className="glade-environment">
        <div className="glade-environment-time">
          <SkyDome stops={stops} position={position} />
          <Slider
            label="Time of day"
            min={0}
            max={stops.length - 1}
            step={0.01}
            value={position}
            stops={stops.map((s) => s.label)}
            currentStop={stops.indexOf(nearestStop(stops, state.hour))}
            valueText={() => timeText(stops, state.hour)}
            onChange={(p) => setHour(snapHour(stops, hourAt(stops, p)))}
            onKeyDown={(e) => {
              const next = hourAfterKey(stops, state.hour, e.key);
              if (next === null) return;
              e.preventDefault();
              setHour(next);
            }}
          />
        </div>
        {hasSnow && (
          <Checkbox
            icon="snow"
            isSelected={state.snow}
            onChange={(on) => dispatch({ type: "snow", on })}
          >
            Snow
          </Checkbox>
        )}
      </div>
    </PanelSection>
  );
}
