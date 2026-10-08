import { describe, expect, it } from "vitest";
import { fitToProfile } from "../../src/maps/planet/migrate";
import type { MapDoc } from "../../src/maps/planet/model";
import { validate } from "@glade/core";
import {
  addItems,
  addPlants,
  blankMap,
  catalog,
  pathsRecord,
  plantsOf,
  profile,
  setPathAt,
  T,
  terrainGrid,
  game,
} from "./helpers";

/** A map in the old 161 x 161 geometry: land at level 1 on terrain 10..150. */
function oldMap(): MapDoc {
  const m = blankMap("old");
  m.layers.terrain = {
    kind: "grid",
    grid: "terrain",
    cells: Array.from({ length: 161 }, (_, ty) =>
      Array.from({ length: 161 }, (_, tx) => ({
        h: tx >= 10 && tx <= 150 && ty >= 10 && ty <= 150 ? 1 : 0,
        water: false,
      })),
    ),
  };
  m.layers.paths = {
    kind: "grid",
    grid: "major",
    cells: Array.from({ length: 160 }, () => new Array(160).fill(null)),
  };
  return m;
}

describe("fitToProfile", () => {
  it("resizes to 161 x 145, keeps land features, and turns the new ring into beach", () => {
    const old = oldMap();
    terrainGrid(old)[40][40] = { h: 3, water: false };
    terrainGrid(old)[60][60] = { h: 1, water: true };
    addPlants(old, { id: "p1", type: "tree", X: 40, Y: 40 });
    const fit = fitToProfile(old, profile, catalog);
    expect(terrainGrid(fit.map)).toHaveLength(145);
    expect(T(fit.map, 40, 40)).toEqual({ h: 3, water: false });
    expect(T(fit.map, 60, 60)).toEqual({ h: 1, water: true });
    expect(T(fit.map, 12, 40)).toEqual({ h: 0, water: false });
    expect(plantsOf(fit.map)).toHaveLength(1);
    expect(fit.dropped).toEqual([]);
    // Old land now outside the new land (x 10..16 and 144..150, y 10..16 and 128..150).
    expect(fit.terrainReset).toBeGreaterThan(0);
  });

  it("drops objects and paths that end up on beach or off the map", () => {
    const old = oldMap();
    addPlants(
      old,
      { id: "p1", type: "tree", X: 12, Y: 40 },
      { id: "p2", type: "tree", X: 40, Y: 150 },
    );
    addItems(old, { id: "i1", type: "rock", mx: 80, my: 300, rot: 0 });
    setPathAt(old, 40, 135, "stone");
    setPathAt(old, 40, 40, "stone");
    const fit = fitToProfile(old, profile, catalog);
    expect(fit.dropped).toEqual([
      "path 40,135 (stone)",
      "plant p1 (tree) at major 12,40",
      "plant p2 (tree) at major 40,150",
      "item i1 (rock) at minor 80,300",
    ]);
    expect(pathsRecord(fit.map)).toEqual({ "40,40": "stone" });
  });

  it("an old blank map becomes a valid current blank map", () => {
    const fit = fitToProfile(oldMap(), profile, catalog);
    expect(validate(fit.map, game)).toEqual([]);
    expect(terrainGrid(fit.map)).toEqual(terrainGrid(blankMap()));
  });
});
