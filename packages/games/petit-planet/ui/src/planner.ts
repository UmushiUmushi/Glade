// What Petit Planet's planner shows for the island, as data: the rows of the side panel's Layers
// section, each with the map's layer toggles it hides, and the time of day's stops (a name and a
// sky colour for each preset of the look; the hours come from the look). Buildings and Furniture
// both hide all items until the profile splits houses from furniture (task T-1).

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
  { preset: "morning", label: "Dawn", sky: "#e39aac" },
  { preset: "midday", label: "Day", sky: "#69d2ff" },
  { preset: "afternoon", label: "Dusk", sky: "#efc05a" },
  { preset: "night", label: "Night", sky: "#10283b" },
] as const;

/** The look's season that Snow turns on. */
export const islandSnowSeason = "winter";
