// What Petit Planet's planner shows for the island: every layer row has a drawn icon and hides
// real layer toggles of the island map, and the host's grid and area rows are there.

import { petitPlanet } from "@glade/petit-planet-profile";
import { describe, expect, it } from "vitest";
import {
  islandCoords,
  islandLayers,
  islandModes,
  islandSnowSeason,
  islandTimeStops,
  petitPlanetIcons,
} from "../src";

describe("the island's layer rows", () => {
  const toggles = petitPlanet.maps.planet.ui.layerNames().map((l) => l.id);

  it("each have a hand-drawn icon", () => {
    for (const row of islandLayers) expect(petitPlanetIcons, row.id).toHaveProperty(row.icon);
  });

  it("hide only layer toggles the island map has", () => {
    for (const row of islandLayers) {
      for (const layer of row.layers) expect(toggles, row.id).toContain(layer);
    }
  });

  it("end with the host's grid and area rows, which hide no map layer", () => {
    const hosts = islandLayers.filter((r) => "host" in r);
    expect(hosts.map((r) => r.id)).toEqual(["grid", "area"]);
    for (const r of hosts) expect(r.layers).toEqual([]);
    expect(new Set(islandLayers.map((r) => r.id)).size).toBe(islandLayers.length);
  });
});

describe("the island's time of day", () => {
  const style = petitPlanet.maps.planet.style.defaults;

  it("names every preset of the island's look, earliest first", () => {
    const presets = Object.entries(style.presets)
      .sort(([, a], [, b]) => (a as { hour: number }).hour - (b as { hour: number }).hour)
      .map(([name]) => name);
    expect(islandTimeStops.map((s) => s.preset)).toEqual(presets);
  });

  it("draws an icon for every stop", () => {
    for (const stop of islandTimeStops) expect(petitPlanetIcons).toHaveProperty(stop.icon);
  });

  it("turns on a season the look has", () => {
    expect(Object.keys(style.seasons ?? {})).toContain(islandSnowSeason);
  });
});

describe("the island's modes", () => {
  it("are Items, Paths, Cliffs and Water, each with a hand-drawn icon", () => {
    expect(islandModes.map((m) => m.label)).toEqual(["Items", "Paths", "Cliffs", "Water"]);
    for (const m of islandModes) expect(petitPlanetIcons).toHaveProperty(m.icon);
  });
});

describe("the coordinates readout", () => {
  const doc = petitPlanet.maps.planet.newDoc("test");

  it("gives tiles in half steps for Items and whole tiles for Paths, with the area", () => {
    expect(islandCoords("items", doc, { x: 34.7, y: 40.2 })).toBe("Tile 34.5, 40 · Area C3");
    expect(islandCoords("paths", doc, { x: 34.7, y: 40.2 })).toBe("Tile 34, 40 · Area C3");
  });

  it("gives the terrain block and its level for Cliffs and Water", () => {
    expect(islandCoords("cliffs", doc, { x: 34.7, y: 40.2 })).toMatch(
      /^Block 35, 40 · Level \d · Area C3$/,
    );
  });

  it("gives nothing off the island", () => {
    expect(islandCoords("items", doc, { x: -1, y: 5 })).toBeNull();
    expect(islandCoords("items", doc, { x: 5, y: 1e6 })).toBeNull();
  });
});
