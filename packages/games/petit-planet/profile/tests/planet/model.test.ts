import { describe, expect, it } from "vitest";
import { itemRect, plantRect } from "../../src/maps/planet/model";
import {
  isBeachMajor,
  isEditableTerrain,
  landmarkTerrainRect,
} from "../../src/maps/planet/profile";
import {
  blankMap,
  catalog,
  item,
  itemsOf,
  pathsRecord,
  plant,
  plantsOf,
  profile,
  T,
  terrainGrid,
} from "./helpers";

describe("newMap", () => {
  const map = blankMap();

  it("has a 161 x 145 terrain grid (10 x 9 areas) and empty layers", () => {
    expect(terrainGrid(map)).toHaveLength(145);
    expect(terrainGrid(map).every((r) => r.length === 161)).toBe(true);
    expect(pathsRecord(map)).toEqual({});
    expect(plantsOf(map)).toEqual([]);
    expect(itemsOf(map)).toEqual([]);
    expect(map.game).toBe("petit-planet");
  });

  it("is beach at level 0 outside terrain x 17..143, y 17..127 and land at level 1 inside", () => {
    expect(T(map, 0, 0)).toEqual({ h: 0, water: false });
    expect(T(map, 16, 72)).toEqual({ h: 0, water: false });
    expect(T(map, 17, 72)).toEqual({ h: 1, water: false });
    expect(T(map, 143, 127)).toEqual({ h: 1, water: false });
    expect(T(map, 72, 128)).toEqual({ h: 0, water: false });
    expect(T(map, 144, 72)).toEqual({ h: 0, water: false });
    expect(T(map, 160, 144)).toEqual({ h: 0, water: false });
  });
});

describe("profile geometry", () => {
  it("the whole outer ring of areas is beach", () => {
    expect(isBeachMajor(profile, 15, 80)).toBe(true);
    expect(isBeachMajor(profile, 16, 80)).toBe(false);
    expect(isBeachMajor(profile, 143, 80)).toBe(false);
    expect(isBeachMajor(profile, 144, 80)).toBe(true);
    expect(isBeachMajor(profile, 80, 15)).toBe(true);
    expect(isBeachMajor(profile, 80, 127)).toBe(false);
    expect(isBeachMajor(profile, 80, 128)).toBe(true);
  });

  it("the outer ring of land is not editable", () => {
    expect(isEditableTerrain(profile, 17, 72)).toBe(false);
    expect(isEditableTerrain(profile, 18, 72)).toBe(true);
    expect(isEditableTerrain(profile, 142, 126)).toBe(true);
    expect(isEditableTerrain(profile, 143, 72)).toBe(false);
    expect(isEditableTerrain(profile, 72, 127)).toBe(false);
  });

  it("land and editable ranges agree with the beach width and map size", () => {
    const b = profile.beach.width;
    const { w, h } = profile.major;
    expect(b).toBe(profile.areaSize);
    // Terrain b sits on the corner between the last beach cell and the first land cell.
    expect(profile.land.x).toEqual([b + 1, w - b - 1]);
    expect(profile.land.y).toEqual([b + 1, h - b - 1]);
    expect(profile.terrainEditable.x).toEqual([b + 2, w - b - 2]);
    expect(profile.terrainEditable.y).toEqual([b + 2, h - b - 2]);
    const entrance = profile.landmarks.find((l) => l.id === "entrance")!;
    expect(entrance.y).toBe(h - 1);
  });

  it("town center is 20 x 27 and locks terrain 78..98 x 71..98 (outside extent)", () => {
    const tc = profile.landmarks.find((l) => l.id === "town-center")!;
    expect([tc.x, tc.y, tc.w, tc.h]).toEqual([78, 71, 20, 27]);
    expect(landmarkTerrainRect(tc)).toEqual({ grid: "terrain", x: 78, y: 71, w: 21, h: 28 });
    expect(landmarkTerrainRect({ ...tc, terrainLockExtent: "inside" })).toEqual({
      grid: "terrain",
      x: 79,
      y: 72,
      w: 19,
      h: 26,
    });
  });
});

describe("footprints", () => {
  it("plants cover one major cell = 2x2 minor", () => {
    expect(plantRect(plant("tree", 20, 30))).toEqual({ grid: "minor", x: 40, y: 60, w: 2, h: 2 });
  });

  it("items rotate their footprint", () => {
    // Sizes are quoted in tiles (major cells); a 2x1 bench is 4x2 minor.
    expect(itemRect(catalog, item("bench", 41, 60))).toMatchObject({ w: 4, h: 2 });
    expect(itemRect(catalog, item("bench", 41, 60, 90))).toMatchObject({ w: 2, h: 4 });
    expect(itemRect(catalog, item("bed", 41, 60))).toMatchObject({ w: 3, h: 5 });
    expect(itemRect(catalog, item("bridge-2x6", 41, 61, 270))).toMatchObject({ w: 12, h: 4 });
  });
});
