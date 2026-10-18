// What Petit Planet's planner shows for the island, as data: the rows of the side panel's Layers
// section, each with the map's layer toggles it hides. Buildings and Furniture both hide all items
// until the profile splits houses from furniture (task T-1).

export const islandLayers = [
  { id: "buildings", label: "Buildings", icon: "layer-buildings", layers: ["items"] },
  { id: "furniture", label: "Furniture", icon: "layer-furniture", layers: ["items"] },
  { id: "plants", label: "Plants", icon: "layer-plants", layers: ["plants"] },
  { id: "paths", label: "Paths", icon: "layer-paths", layers: ["paths"] },
  { id: "grid", label: "Grid", icon: "layer-grid", layers: [], host: "grid" },
  { id: "area", label: "Area", icon: "layer-area", layers: [], host: "area" },
] as const;
