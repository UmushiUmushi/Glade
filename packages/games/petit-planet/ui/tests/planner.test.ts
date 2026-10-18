// What Petit Planet's planner shows for the island: every layer row has a drawn icon and hides
// real layer toggles of the island map, and the host's grid and area rows are there.

import { petitPlanet } from "@glade/petit-planet-profile";
import { describe, expect, it } from "vitest";
import { islandLayers, islandSnowSeason, islandTimeStops, petitPlanetIcons } from "../src";

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

  it("turns on a season the look has", () => {
    expect(Object.keys(style.seasons ?? {})).toContain(islandSnowSeason);
  });
});
