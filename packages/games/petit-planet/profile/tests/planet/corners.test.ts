// Cut and rounded corners (corners.ts), path seams between types, and fence links (fences.ts):
// what each vertex resolves to, and the 3D surfaces they make. Rules T5 and P3 are in
// rules.test.ts.

import { describe, expect, it } from "vitest";
import { resolveLook } from "@glade/render";
import type { MeshArrays } from "@glade/render";
import { validate } from "@glade/core";
import {
  cornerCurve,
  resolvePathCorner,
  resolveTerrainCorner,
  vertexOf,
} from "../../src/maps/planet/corners";
import { armBacks, fenceArms } from "../../src/maps/planet/fences";
import {
  setCornerAt,
  terrainGrid,
  type CornerLayer,
  type CornerShape,
  type MapDoc,
} from "../../src/maps/planet/model";
import { gridSpec } from "../../src/maps/planet/profile";
import { buildPathChunk } from "../../src/maps/planet/render3d/paths";
import {
  buildCushionChunk,
  buildTerrainChunk,
  geomLook,
} from "../../src/maps/planet/render3d/terrain";
import { buildWaterChunk, WATER_KIND } from "../../src/maps/planet/render3d/water";
import type { Look, Style } from "../../src/maps/planet/style";
import styleJson from "../../look/planet.json" with { type: "json" };
import { addItems, blankMap, catalog, item, profile, setPathAt, stamp, game } from "./helpers";

const style = styleJson as unknown as Style;
const g = { ...geomLook(resolveLook(style, "midday") as Look), heightScale: 1 };
const spec = gridSpec(profile);
const chunk = { cx: 2, cy: 2 }; // blocks 32..47

/** Area (world units) of a mesh's upward triangles, optionally only those passing a test. */
function upArea(m: MeshArrays, keep: (vertex: number) => boolean = () => true): number {
  let area = 0;
  for (let t = 0; t < m.index.length; t += 3) {
    const [a, b, c] = [m.index[t], m.index[t + 1], m.index[t + 2]];
    if (![a, b, c].every(keep)) continue;
    const P = (i: number) => [m.position[3 * i], m.position[3 * i + 1], m.position[3 * i + 2]];
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    if (pa[1] !== pb[1] || pb[1] !== pc[1]) continue;
    area += Math.abs((pb[0] - pa[0]) * (pc[2] - pa[2]) - (pc[0] - pa[0]) * (pb[2] - pa[2])) / 2;
  }
  return area;
}

/** The four corners of a cell, as directions. */
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** Shape one corner of a cell (a terrain block, or a major cell for paths). */
function shape(
  map: MapDoc,
  layer: CornerLayer,
  x: number,
  y: number,
  dir: [number, number],
  to: CornerShape,
): void {
  const v = vertexOf(layer, x, y, dir);
  setCornerAt(map, layer, v.x, v.y, to);
}

/** Shape every terrain vertex in a range that makes a corner of that kind; returns how many. */
function shapeAll(map: MapDoc, x0: number, y0: number, x1: number, y1: number, kind: string) {
  let n = 0;
  for (let vy = y0; vy <= y1; vy++)
    for (let vx = x0; vx <= x1; vx++) {
      setCornerAt(map, "terrainCorners", vx, vy, "cut");
      const r = resolveTerrainCorner(map, profile, vx, vy);
      if (r.status === "shaped" && r.corner.kind === kind) n++;
      else setCornerAt(map, "terrainCorners", vx, vy, null);
    }
  return n;
}

/** A plus of five water blocks centered on terrain 40,40 at level 1. */
const plus = () => stamp(blankMap(), 39, 39, [".1~", "1~1~1~", ".1~"]);

describe("what a corner resolves to", () => {
  it("a water plus has 8 outer corners and 4 notches; cut, its surface is a diamond", () => {
    const map = plus();
    expect(shapeAll(map, 38, 38, 42, 42, "water")).toBe(12);
    // The diamond |x| + |y| <= 1.5 tiles around the plus's center: 4.5 tiles, 18 world units.
    const w = buildWaterChunk(map, profile, g, spec, chunk);
    const kind = w.attributes.kind.array;
    expect(upArea(w, (i) => kind[i] === WATER_KIND.surface)).toBeCloseTo(18, 4);
    // Uncut, the plus is five whole blocks.
    const flat = buildWaterChunk(plus(), profile, g, spec, chunk);
    expect(upArea(flat, (i) => flat.attributes.kind.array[i] === WATER_KIND.surface)).toBe(20);
  });

  it("a cliff corner over a gap cannot be shaped, and T5 reports one that is", () => {
    const map = stamp(blankMap(), 41, 41, ["111", "121", "110"]);
    shape(map, "terrainCorners", 42, 42, [1, 1], "cut");
    const v = vertexOf("terrainCorners", 42, 42, [1, 1]);
    const r = resolveTerrainCorner(map, profile, v.x, v.y);
    expect(r.status === "invalid" && r.reason).toMatch(/cliff corner over a gap/);
    expect(validate(map, game).map((x) => x.ruleId)).toEqual(["T5"]);
  });

  it("a shape on flat ground is inert", () => {
    const map = blankMap();
    shape(map, "terrainCorners", 60, 60, [-1, -1], "cut");
    const v = vertexOf("terrainCorners", 60, 60, [-1, -1]);
    expect(resolveTerrainCorner(map, profile, v.x, v.y)).toEqual({
      status: "inert",
      reason: "flat ground, no corner here",
    });
  });

  it("a neighbor on a cut side straightens it; removing the neighbor brings the cut back", () => {
    const map = blankMap();
    for (let Y = 40; Y < 45; Y++) setPathAt(map, 40, Y, "dirt");
    shape(map, "pathCorners", 40, 40, [-1, -1], "cut");
    const v = vertexOf("pathCorners", 40, 40, [-1, -1]);
    const path = () => resolvePathCorner(map, profile, v.x, v.y).status;
    expect(path()).toBe("shaped");
    setPathAt(map, 39, 40, "dirt");
    expect(path()).toBe("inert");
    setPathAt(map, 39, 40, null);
    expect(path()).toBe("shaped");

    // The same for a cliff: a raised block's cut corner, then a raised block beside it.
    const t = terrainGrid(map);
    t[60][60] = { h: 3, water: false };
    shape(map, "terrainCorners", 60, 60, [-1, -1], "cut");
    const c = vertexOf("terrainCorners", 60, 60, [-1, -1]);
    const cliff = () => resolveTerrainCorner(map, profile, c.x, c.y).status;
    expect(cliff()).toBe("shaped");
    t[60][59] = { h: 3, water: false };
    expect(cliff()).toBe("inert");
    t[60][59] = { h: 1, water: false };
    expect(cliff()).toBe("shaped");
  });
});

describe("corner geometry", () => {
  it("a round is a quarter circle bulging toward the corner; a cut is its chord", () => {
    const round = cornerCurve([0, 0], [1, 1], 1, "round");
    expect(round[0]).toEqual([-1, 0]);
    expect(round.at(-1)).toEqual([0, -1]);
    const mid = round[3];
    expect(Math.hypot(mid[0] + 1, mid[1] + 1)).toBeCloseTo(1, 9);
    expect(cornerCurve([0, 0], [1, 1], 1, "cut")).toEqual([
      [-1, 0],
      [0, -1],
    ]);
  });

  it("a lone raised block with every corner rounded has a round top and walls on the curves", () => {
    const map = stamp(blankMap(), 44, 44, ["3"]);
    for (const d of CORNERS) shape(map, "terrainCorners", 44, 44, d, "round");
    const t = buildTerrainChunk(map, profile, g, spec, chunk);
    // The top at level 3 is a 24-gon of radius 1 world unit (half a tile).
    const lawn = t.lawn;
    expect(upArea(lawn, (i) => lawn.position[3 * i + 1] === 3)).toBeCloseTo(
      12 * Math.sin(Math.PI / 12),
      4,
    );
    // Only the curves drop: 4 corners x 6 arc steps, nothing along the (fully rounded) sides.
    expect(t.stats.sides).toBe(24);
    expect(buildCushionChunk(map, profile, g, spec, chunk).stats.edges).toBe(24);
    const r = resolveTerrainCorner(map, profile, 44, 44);
    expect(r.status === "shaped" && [r.corner.kind, r.corner.side]).toEqual(["cliff", "outer"]);
  });

  it("a rounded 2x2 path is three cells and a quarter circle", () => {
    const map = blankMap();
    for (const [X, Y] of [
      [40, 40],
      [41, 40],
      [40, 41],
      [41, 41],
    ])
      setPathAt(map, X, Y, "dirt");
    shape(map, "pathCorners", 41, 41, [1, 1], "round"); // the block's outer south-east corner
    const r = resolvePathCorner(map, profile, 42, 42);
    expect(r.status === "shaped" && [r.corner.side, r.corner.cell]).toEqual([
      "outer",
      { x: 41, y: 41 },
    ]);
    const p = buildPathChunk(map, profile, game.catalog, g, spec, chunk);
    // Each cell is 4 world units; the rounded one keeps a quarter 24-gon of radius 2.
    expect(upArea(p)).toBeCloseTo(12 + 6 * 0.5 * 4 * Math.sin(Math.PI / 12), 4);
  });
});

describe("path seams", () => {
  it("different path types stop short of each other; one type runs through", () => {
    const map = blankMap();
    setPathAt(map, 40, 40, "dirt");
    setPathAt(map, 41, 40, "stone");
    setPathAt(map, 42, 40, "stone");
    const p = buildPathChunk(map, profile, game.catalog, g, spec, chunk);
    const xs = Array.from({ length: p.vertexCount }, (_, i) => p.position[3 * i]);
    const gap = g.pathGap;
    expect(gap).toBeGreaterThan(0);
    // Dirt ends gap short of x = 82, stone starts gap past it; stone meets stone at x = 84.
    // (Positions are float32.)
    const near = (v: number) => xs.filter((x) => Math.abs(x - v) < 1e-4).length;
    expect(xs.filter((x) => x > 82 - gap + 1e-4 && x < 82 + gap - 1e-4)).toEqual([]);
    expect([near(82 - gap), near(82 + gap), near(84)]).toEqual([2, 2, 4]);
  });
});

describe("fence links", () => {
  const piece = (id: string, mx: number, my: number, rot: 0 | 90 = 0, type = "fence") => ({
    ...item(type, mx, my, rot),
    id,
  });
  const arms = (map: MapDoc, cat = catalog) =>
    Object.fromEntries([...fenceArms(map, cat)].map(([id, a]) => [id, a]));

  it("a straight piece then diagonal ones bend at the tile center", () => {
    const map = blankMap();
    addItems(map, piece("a", 80, 80), piece("b", 82, 80), piece("c", 84, 82), piece("d", 86, 84));
    expect(arms(map)).toEqual({
      a: [
        [1, 0],
        [-1, 0],
      ],
      b: [
        [-1, 0],
        [1, 1],
      ],
      c: [
        [1, 1],
        [-1, -1],
      ],
      d: [
        [-1, -1],
        [1, 1],
      ],
    });
  });

  it("an L turns through its corner piece; side-by-side pieces link whatever their rotation", () => {
    const map = blankMap();
    // An east-west run, then a north-south run down from its east end.
    addItems(map, piece("w", 80, 80), piece("corner", 82, 80), piece("s", 82, 82, 90));
    // A column of pieces all at rotation 0 is a north-south fence.
    addItems(map, piece("top", 172, 228), piece("mid", 172, 230), piece("end", 172, 232));
    // Two parallel rows one tile apart close into a loop; no diagonal across it.
    addItems(map, piece("r1a", 100, 100), piece("r1b", 102, 100));
    addItems(map, piece("r2a", 100, 102), piece("r2b", 102, 102));
    const a = arms(map);
    expect(a.corner).toEqual([
      [0, 1],
      [-1, 0],
    ]);
    expect([a.top, a.mid, a.end]).toEqual([
      [
        [0, 1],
        [0, -1],
      ],
      [
        [0, 1],
        [0, -1],
      ],
      [
        [0, -1],
        [0, 1],
      ],
    ]);
    expect(a.r1a).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it("different types and different levels do not link", () => {
    const iron = { ...catalog.entries.find((e) => e.type === "fence")!, type: "iron-fence" };
    const cat = { entries: [...catalog.entries, iron] };
    // North-south pieces side by side: linked they run east-west, alone north-south.
    // p and q sit on terrain blocks 41 and 42 (odd minor positions); q's block is raised.
    const map = stamp(blankMap(), 42, 41, ["2"]);
    addItems(map, piece("p", 81, 81, 90), piece("q", 83, 81, 90));
    addItems(map, piece("m", 100, 100, 90), piece("n", 102, 100, 90, "iron-fence"));
    const alone = [
      [0, 1],
      [0, -1],
    ];
    const a = arms(map, cat);
    for (const id of ["p", "q", "m", "n"]) expect(a[id]).toEqual(alone);
    stamp(map, 42, 41, ["1"]);
    expect(arms(map, cat).p).toEqual([
      [1, 0],
      [-1, 0],
    ]);
  });

  it("rails meet in a miter: square at a right angle, short where a run turns diagonal", () => {
    const backs = (arms: [number, number][]) =>
      armBacks(arms).map((k) => Math.round(k * 1000) / 1000);
    expect(
      backs([
        [1, 0],
        [-1, 0],
      ]),
    ).toEqual([0, 0]); // straight
    expect(
      backs([
        [1, 0],
        [0, 1],
      ]),
    ).toEqual([1, 1]); // L
    expect(
      backs([
        [0, -1],
        [1, 1],
      ]),
    ).toEqual([0.414, 0.414]);
    expect(
      backs([
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([1, 1]); // sharp: capped
    expect(
      backs([
        [1, 0],
        [-1, 0],
        [0, 1],
      ]),
    ).toEqual([1, 1, 1]); // T
  });

  it("any item that connects links like a fence", () => {
    const map = blankMap();
    const wall = {
      type: "low-wall",
      kind: "item" as const,
      footprint: { w: 2, h: 2 },
      shape: "rail",
      glyph: "w",
      connects: true,
    };
    addItems(map, piece("w1", 134, 208, 0, "low-wall"), piece("w2", 132, 210, 0, "low-wall"));
    expect(arms(map, { entries: [...catalog.entries, wall] }).w1).toEqual([
      [-1, 1],
      [1, -1],
    ]);
  });
});
