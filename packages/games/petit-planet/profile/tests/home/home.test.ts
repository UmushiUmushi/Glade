// Homes (src/maps/home/): layouts, how wallpaper and flooring are laid, the home's rules, what each
// map takes (K1), and walls that hide while the camera is behind them.

import { bind, validate, type Doc } from "@glade/core";
import { resolveLook, type MeshSpec } from "@glade/render";
import { describe, expect, it } from "vitest";
import {
  entryProblems,
  homeMap,
  layoutProblems,
  petitPlanet,
  planet,
  putCeilingItem,
  putCovering,
  putFloorItem,
  putWallItem,
  SHEETS,
  type HomeLayout,
} from "../../src";
import type { Pattern } from "../../src/catalog";
import { drawPattern, patternTexture } from "../../src/items/pattern";
import { copyStarts } from "../../src/maps/home/coverings";
import { homeCatalog, testCatalog } from "../../samples";
import { addItems, blankMap, item } from "../planet/helpers";

const home8 = petitPlanet.maps.interior_home_1_8;
const game = bind(home8, homeCatalog);
const NOW = new Date("2026-10-07T00:00:00.000Z");
const fresh = () => home8.newDoc("t", {}, NOW);
const broken = (doc: Doc) => validate(doc, game).map((v) => v.ruleId);

describe("layouts", () => {
  it("name homes by rooms and size, and hold together", () => {
    expect(Object.keys(petitPlanet.maps).sort()).toEqual([
      "interior_home_1_10",
      "interior_home_1_8",
      "planet",
    ]);
    expect(home8.space.grids.major.size).toEqual([8, 8]);
    expect(petitPlanet.maps.interior_home_1_10.space.grids.minor.size).toEqual([20, 20]);
  });

  it("say what does not hold together", () => {
    const bad: HomeLayout = {
      id: "x",
      title: "x",
      rooms: [
        { id: "a", size: [4, 4], at: [0, 0], wallHeight: 4, doors: [{ wall: "south", at: 3 }] },
        { id: "b", size: [4, 4], at: [2, 0], wallHeight: 4, doors: [] },
      ],
    };
    expect(layoutProblems(bad)).toEqual([
      "room a: a door runs off its south wall",
      "rooms a and b overlap",
    ]);
    expect(() => homeMap(bad)).toThrow(/rooms a and b overlap/);
  });

  it("a home of two rooms is two rooms side by side", () => {
    const two = homeMap({
      id: "interior_home_2_6",
      title: "two",
      rooms: [
        { id: "a", size: [6, 6], at: [0, 0], wallHeight: 4, doors: [{ wall: "east", at: 2 }] },
        { id: "b", size: [6, 6], at: [6, 0], wallHeight: 4, doors: [{ wall: "west", at: 2 }] },
      ],
    });
    expect(two.space.grids.major.size).toEqual([12, 6]);
    const doc = two.newDoc("t", {}, NOW);
    putFloorItem(doc, { id: "c", type: "home-chair", mx: 11, my: 4, rot: 0 });
    expect(validate(doc, bind(two, homeCatalog)).map((v) => v.ruleId)).toEqual(["H1"]);
  });
});

describe("wallpaper and flooring copies", () => {
  it("are 2 tiles across with a seam on the middle", () => {
    expect(copyStarts(8)).toEqual([0, 2, 4, 6]);
    // Half a copy, 4 whole ones, half a copy: 6 pieces.
    expect(copyStarts(10)).toEqual([-1, 1, 3, 5, 7, 9]);
  });
});

describe("pattern sheets", () => {
  const dot = { color: "#000000", shapes: [{ circle: [1, 2, 0.5], color: "#ffffff" }] } as Pattern;
  const paper = (shapes: unknown[]) => ({
    type: "p",
    kind: "wallpaper",
    glyph: "p",
    pattern: { color: "#000000", shapes },
  });

  it("are in grid cells: a wallpaper is 2 across and 4 up, a flooring 2 x 2", () => {
    expect(SHEETS).toEqual({ wallpaper: { w: 2, h: 4 }, flooring: { w: 2, h: 2 } });
  });

  it("paint a wallpaper twice as tall as it is wide, and keep a circle round", () => {
    const { texture } = patternTexture(dot, SHEETS.wallpaper) as {
      texture: { width: number; height: number; data: Uint8Array };
    };
    expect([texture.width, texture.height]).toEqual([64, 128]);
    const white = (col: number, row: number) => texture.data[4 * (row * 64 + col)] === 255;
    const across = [...Array(64).keys()].filter((c) => white(c, 64)).length;
    const up = [...Array(128).keys()].filter((r) => white(32, r)).length;
    expect(across).toBe(32);
    expect(up).toBe(32);
  });

  it("draw in 2D at the sheet's scale", () => {
    const calls: number[][] = [];
    const ctx = {
      fillRect: (...a: number[]) => calls.push(a),
    } as unknown as CanvasRenderingContext2D;
    const band = {
      color: "#000000",
      shapes: [{ rect: [0, 3, 2, 1], color: "#ffffff" }],
    } as Pattern;
    drawPattern(ctx, band, SHEETS.wallpaper, { x: 0, y: 0, w: 4, h: 8 });
    expect(calls).toEqual([
      [0, 0, 4, 8],
      [0, 6, 4, 2],
    ]);
  });

  it("let shapes reach one sheet past each edge, by the sheet's own size", () => {
    expect(entryProblems(home8, paper([{ rect: [0, 3, 2, 1], color: "#ffffff" }]))).toEqual([]);
    expect(entryProblems(home8, paper([{ rect: [0, 8, 2, 1], color: "#ffffff" }]))).toEqual([]);
    expect(entryProblems(home8, paper([{ rect: [0, 9, 2, 1], color: "#ffffff" }]))).not.toEqual([]);
    const floor = { ...paper([{ rect: [0, 5, 2, 1], color: "#ffffff" }]), kind: "flooring" };
    expect(entryProblems(home8, floor)).not.toEqual([]);
  });
});

describe("the home's rules", () => {
  it("the sample homes keep them", () => {
    for (const id of ["interior_home_1_8", "interior_home_1_10"]) {
      const map = petitPlanet.maps[id];
      const doc = map.newDoc("t", {}, NOW);
      expect(validate(doc, bind(map, homeCatalog))).toEqual([]);
    }
  });

  it("O1: items go where their mount says", () => {
    const doc = fresh();
    putFloorItem(doc, { id: "p", type: "home-picture", mx: 2, my: 2, rot: 0 });
    putWallItem(doc, { id: "c", type: "home-chair", room: "main", wall: "north", x: 0, y: 0 });
    expect(broken(doc)).toEqual(["O1", "O1"]);
  });

  it("H1: floor items stand wholly in a room, apart", () => {
    const off = fresh();
    putFloorItem(off, { id: "b", type: "home-bed", mx: 14, my: 0, rot: 0 });
    expect(broken(off)).toEqual(["H1"]);
    const two = fresh();
    putFloorItem(two, { id: "a", type: "home-chair", mx: 2, my: 2, rot: 0 });
    putFloorItem(two, { id: "b", type: "home-chair", mx: 3, my: 3, rot: 0 });
    expect(broken(two)).toEqual(["H1"]);
  });

  it("H2: wall items hang on their wall, clear of its doors, apart", () => {
    const off = fresh();
    putWallItem(off, { id: "w", type: "home-window", room: "main", wall: "north", x: 14, y: 0 });
    expect(broken(off)).toEqual(["H2"]);
    // The entrance: 2 tiles across from 3 tiles in, 2 blocks up, on the south wall.
    const door = fresh();
    putWallItem(door, { id: "w", type: "home-picture", room: "main", wall: "south", x: 7, y: 2 });
    expect(broken(door)).toEqual(["H2"]);
    // Above the door is wall: things may hang there.
    const above = fresh();
    putWallItem(above, { id: "w", type: "home-picture", room: "main", wall: "south", x: 7, y: 4 });
    expect(broken(above)).toEqual([]);
    const two = fresh();
    putWallItem(two, { id: "a", type: "home-picture", room: "main", wall: "west", x: 2, y: 2 });
    putWallItem(two, { id: "b", type: "home-picture", room: "main", wall: "west", x: 3, y: 3 });
    expect(broken(two)).toEqual(["H2"]);
  });

  it("H3: ceiling items hang wholly under a room's ceiling, apart", () => {
    const doc = fresh();
    putCeilingItem(doc, { id: "a", type: "home-ceiling-lamp", mx: 15, my: 0, rot: 0 });
    expect(broken(doc)).toEqual(["H3"]);
  });

  it("H4: one wallpaper and one flooring a room", () => {
    const doc = fresh();
    putCovering(doc, { id: "a", type: "home-hills-wallpaper", room: "main" });
    putCovering(doc, { id: "b", type: "home-tile-flooring", room: "main" });
    expect(broken(doc)).toEqual([]);
    putCovering(doc, { id: "c", type: "home-hills-wallpaper", room: "main" });
    putCovering(doc, { id: "d", type: "home-chair", room: "main" });
    expect(broken(doc)).toEqual(["H4", "H4"]);
  });
});

describe("what each map takes (K1)", () => {
  it("homes take no plants, paths, bridges, inclines or buildings", () => {
    const doc = fresh();
    putFloorItem(doc, { id: "t", type: "tree", mx: 2, my: 2, rot: 0 });
    const both = bind(home8, { entries: [...homeCatalog.entries, ...testCatalog.entries] });
    expect(validate(doc, both).map((v) => v.ruleId)).toContain("K1");
  });

  it("the planet takes no wall or ceiling items, wallpaper or flooring", () => {
    const map = addItems(blankMap(), { ...item("home-picture", 80, 80), id: "p" });
    const both = bind(planet, { entries: [...testCatalog.entries, ...homeCatalog.entries] });
    expect(validate(map, both).map((v) => v.ruleId)).toContain("K1");
  });
});

describe("walls in 3D", () => {
  it("hide while the camera is behind them, outside the room", () => {
    const look = resolveLook(game.style.defaults);
    const specs = game.views.scene!.materials(look, { flat: false, layers: {} });
    // The south wall's plane: into the room is north (-z); it is at z = 16 (8 tiles).
    const hide = specs["wall:main:south"].uniforms!.uHide as number[];
    const shows = (x: number, z: number) => hide[0] * x + hide[2] * z + hide[3] >= 0;
    expect(shows(8, 8)).toBe(true);
    expect(shows(8, 30)).toBe(false);
  });

  it("have gaps for their doors, with a door in each", () => {
    const look = resolveLook(game.style.defaults);
    const meshes = game.views
      .scene!.buildChunk(fresh(), game, look, "room:main")
      .filter((s): s is MeshSpec => s.kind === "mesh");
    const count = (m: string) => meshes.find((s) => s.material === m)!.arrays.vertexCount / 4;
    expect(count("wall:main:north")).toBe(1);
    // Left of the door, above it, right of it.
    expect(count("wall:main:south")).toBe(3);
    expect(count("door:main:south")).toBe(1);
  });
});
