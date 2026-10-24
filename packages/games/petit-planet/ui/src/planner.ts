// What Petit Planet's planner shows for the island, as data: the rows of the side panel's Layers
// section, each with the map's layer toggles it hides, and the time of day's stops (a name and a
// sky colour for each preset of the look; the hours come from the look). Buildings and Furniture
// both hide all items until the profile splits houses from furniture (task T-1). Also the modes,
// and the coordinates readout in each mode's words.

import type { Doc } from "@glade/core";
import {
  gridSpec,
  profile,
  terrainAtPoint,
  terrainGrid,
  type MapDoc,
} from "@glade/petit-planet-profile";

export const islandLayers = [
  { id: "buildings", label: "Buildings", icon: "layer-buildings", layers: ["items"] },
  { id: "furniture", label: "Furniture", icon: "layer-furniture", layers: ["items"] },
  { id: "plants", label: "Plants", icon: "layer-plants", layers: ["plants"] },
  { id: "paths", label: "Paths", icon: "layer-paths", layers: ["paths"] },
  { id: "grid", label: "Grid", icon: "layer-grid", layers: [], host: "grid" },
  { id: "area", label: "Area", icon: "layer-area", layers: [], host: "area" },
] as const;

/** The slider's stops: the design's sky colours for dawn, day, dusk and night. */
export const islandTimeStops = [
  { preset: "morning", label: "Dawn", sky: "#e39aac", icon: "time-dawn" },
  { preset: "midday", label: "Day", sky: "#69d2ff", icon: "time-day" },
  { preset: "afternoon", label: "Dusk", sky: "#efc05a", icon: "time-dusk" },
  { preset: "night", label: "Night", sky: "#10283b", icon: "time-night" },
] as const;

/** The look's season that Snow turns on. */
export const islandSnowSeason = "winter";

/** The island's viewport modes, in key order (1 to 4), with their hand-drawn icons. */
export const islandModes = [
  { id: "items", label: "Items", icon: "mode-items", tip: "Items mode: place and move items" },
  { id: "paths", label: "Paths", icon: "mode-paths", tip: "Paths mode: items turn see-through" },
  {
    id: "cliffs",
    label: "Cliffs",
    icon: "mode-cliffs",
    tip: "Cliffs mode: shape the land (terrain grid)",
  },
  {
    id: "water",
    label: "Water",
    icon: "mode-water",
    tip: "Water mode: ponds and waterfalls (terrain grid)",
  },
] as const;

const spec = gridSpec(profile);

/** An area's short name: columns are letters, rows numbers, "Area C3". */
function areaName(x: number, y: number): string {
  const column = String.fromCharCode(65 + Math.floor(x / spec.areaSize));
  return `Area ${column}${Math.floor(y / spec.areaSize) + 1}`;
}

/**
 * Where a point of the island is, in the mode's words (docs/planner/screen.md, FPS and
 * coordinates): tiles in half steps for Items, whole tiles for Paths, the terrain block and its
 * level for Cliffs and Water, then the area. Off the island: null.
 */
export function islandCoords(mode: string, doc: Doc, p: { x: number; y: number }): string | null {
  if (p.x < 0 || p.y < 0 || p.x >= spec.majorW || p.y >= spec.majorH) return null;
  const area = areaName(p.x, p.y);
  if (mode === "cliffs" || mode === "water") {
    const block = terrainAtPoint({ x: p.x * 2, y: p.y * 2 });
    const cell = terrainGrid(doc as MapDoc)[block.y]?.[block.x];
    return `Block ${block.x}, ${block.y} · Level ${cell?.h ?? "?"} · ${area}`;
  }
  const step = mode === "paths" ? 1 : 0.5;
  const at = (v: number) => Math.floor(v / step) * step;
  return `Tile ${at(p.x)}, ${at(p.y)} · ${area}`;
}
