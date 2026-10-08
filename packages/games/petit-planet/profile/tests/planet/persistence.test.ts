import { petitPlanet } from "../../src";
import { describe, expect, it } from "vitest";
import { deserializeMap, MapFormatError, serializeMap } from "@glade/core";
import { decodeTerrainRow, encodeTerrainRow } from "../../src/maps/planet/rle";
import {
  addItems,
  addPlants,
  blankMap,
  game,
  item,
  pathsRecord,
  plant,
  plantsOf,
  setPathAt,
  stamp,
  terrainGrid,
} from "./helpers";

function decorated() {
  const map = blankMap("garden");
  stamp(map, 40, 40, ["3333", "32~2~3", "3333"]);
  setPathAt(map, 41, 41, "stone");
  setPathAt(map, 12, 40, "dirt");
  addPlants(map, plant("tree", 50, 50), plant("flower", 51, 50));
  addItems(map, item("bench", 121, 100, 90), item("bridge-1x4", 101, 119));
  return map;
}

describe("RLE terrain", () => {
  it("encodes a fresh map's rows compactly", () => {
    const map = blankMap();
    expect(encodeTerrainRow(terrainGrid(map)[0])).toBe("0*161");
    expect(encodeTerrainRow(terrainGrid(map)[72])).toBe("0*17 1*127 0*17");
  });

  it("marks water with ~ and omits *1", () => {
    const row = [
      { h: 2, water: false },
      { h: 2, water: true },
      { h: 2, water: true },
      { h: 3, water: false },
    ];
    expect(encodeTerrainRow(row)).toBe("2 2~*2 3");
    expect(decodeTerrainRow("2 2~*2 3")).toEqual(row);
  });

  it("rejects malformed tokens", () => {
    expect(() => decodeTerrainRow("2 x*3")).toThrow(MapFormatError);
  });
});

describe("save / load", () => {
  it("round-trips a decorated map through the file format", () => {
    const map = decorated();
    expect(deserializeMap(serializeMap(map, game), petitPlanet)).toEqual(map);
  });

  it("writes readable, line-per-object JSON", () => {
    const text = serializeMap(decorated(), game);
    expect(text).toContain('        "0*17 1*127 0*17",');
    expect(text).toMatch(/^ {8}\{"id":"p\d+","type":"tree","X":50,"Y":50\},$/m);
    // paths sorted by row then column
    expect(text.indexOf('"12,40"')).toBeLessThan(text.indexOf('"41,41"'));
    expect(JSON.parse(text).layers.terrain.encoding).toBe("rle");
    expect(JSON.parse(text)).toMatchObject({ version: 3, game: "petit-planet", map: "planet" });
  });

  it("migrates a version-1 file, with RLE or a raw terrain array", () => {
    const map = decorated();
    const v1 = {
      version: 1,
      profile: "petite-planet",
      name: map.name,
      meta: map.meta,
      terrain: terrainGrid(map),
      paths: pathsRecord(map),
      plants: plantsOf(map),
      items: Object.values((map.layers.items as { items: object }).items),
      standIns: {},
    };
    expect(deserializeMap(JSON.stringify(v1), petitPlanet)).toEqual(map);
    const rle = {
      ...v1,
      terrain: { encoding: "rle", rows: terrainGrid(map).map(encodeTerrainRow) },
    };
    expect(deserializeMap(JSON.stringify(rle), petitPlanet)).toEqual(map);
  });

  it("rejects wrong versions and wrong dimensions", () => {
    const map = blankMap();
    const good = JSON.parse(serializeMap(map, game));
    expect(() => deserializeMap(JSON.stringify({ ...good, version: 4 }), petitPlanet)).toThrow(
      /version/,
    );
    const small = {
      ...good,
      layers: { ...good.layers, terrain: { ...good.layers.terrain, rows: ["1*5", "1*5"] } },
    };
    expect(() => deserializeMap(JSON.stringify(small), petitPlanet)).toThrow(/expects 161x145/);
    expect(() => deserializeMap("{nope", petitPlanet)).toThrow(MapFormatError);
  });
});
