import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyPoint, det3 } from "../src/matrix";
import { modelBounds, modelProblems, silhouettes } from "../src/model-checks";
import { geometryKey, modelMesh, partGeometry, partTriangles } from "../src/model-geometry";
import { modelSchema } from "../src/model-schema";
import {
  flattenModel,
  footprintTurn,
  insertPart,
  instancedShape,
  partAt,
  partTag,
  replacePart,
  solidCount,
  unitMatrix,
  type Model,
  type SolidPart,
} from "../src/models";

// A 1x1-tile toadstool: stem, squashed cap, two spots.
export const toadstool: Model = {
  parts: [
    { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.15, height: 0.45, color: "#f3ead8" },
    { shape: "sphere", at: [0.5, 0.5, 0.5], radius: 0.4, squash: 0.55, color: "#d8342c" },
    { shape: "sphere", at: [0.35, 0.68, 0.4], radius: 0.07, color: "#ffffff" },
    { shape: "sphere", at: [0.62, 0.66, 0.6], radius: 0.06, color: "#ffffff" },
  ],
};

const wood = "#8a6a4a";

// A 1x1-tile stool: one leg mirrored into four, a rounded seat, a tilted back rest.
const stool: Model = {
  parts: [
    {
      shape: "group",
      name: "legs",
      at: [0.5, 0, 0.5],
      mirror: ["x", "z"],
      parts: [{ shape: "cylinder", at: [0.3, 0, 0.3], radius: 0.05, height: 0.5, color: wood }],
    },
    {
      shape: "box",
      name: "seat",
      at: [0.5, 0.5, 0.5],
      size: [0.8, 0.1, 0.8],
      round: 0.04,
      color: wood,
    },
    {
      shape: "box",
      name: "back",
      at: [0.5, 0.6, 0.15],
      rotate: [-10, 0, 0],
      size: [0.7, 0.6, 0.06],
      color: wood,
    },
  ],
};

/** A coil: `turns` turns of radius r, rising `rise` blocks a turn, 12 points a turn. */
function coil(r: number, turns: number, rise: number): [number, number, number][] {
  return Array.from({ length: turns * 12 + 1 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    return [r * Math.cos(a), (rise * i) / 12, -r * Math.sin(a)];
  });
}

/** One solid of each shape, all fitting a 1x1 footprint. */
const solids: SolidPart[] = [
  { shape: "box", at: [0.5, 0, 0.5], size: [0.6, 0.5, 0.4], color: wood },
  { shape: "box", at: [0.5, 0, 0.5], size: [0.6, 0.5, 0.4], round: 0.1, color: wood },
  { shape: "wedge", at: [0.5, 0, 0.5], size: [0.6, 0.5, 0.4], color: wood },
  { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.3, height: 1, color: wood },
  { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.3, height: 1, top: 0.1, color: wood },
  { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.3, height: 1, sides: 6, color: wood },
  { shape: "cone", at: [0.5, 0, 0.5], radius: 0.3, height: 1, color: wood },
  { shape: "cone", at: [0.5, 0, 0.5], radius: 0.3, height: 1, sides: 4, color: wood },
  { shape: "sphere", at: [0.5, 0.5, 0.5], radius: 0.3, squash: 0.7, color: wood },
  { shape: "sphere", at: [0.5, 0, 0.5], radius: 0.3, half: true, color: wood },
  { shape: "torus", at: [0.5, 0.2, 0.5], radius: 0.3, tube: 0.08, color: wood },
  { shape: "torus", at: [0.5, 0.2, 0.5], radius: 0.3, tube: 0.08, arc: 90, color: wood },
  {
    shape: "tube",
    at: [0.5, 0.1, 0.5],
    points: [
      [-0.3, 0, -0.3],
      [0.3, 0.5, -0.2],
      [0.2, 1, 0.3],
    ],
    radius: 0.05,
    color: wood,
  },
  {
    shape: "tube",
    at: [0.5, 0.1, 0.5],
    points: [
      [-0.3, 0, 0],
      [0, 0, -0.3],
      [0.3, 0, 0],
      [0, 0, 0.3],
    ],
    radius: 0.05,
    closed: true,
    color: wood,
  },
  {
    shape: "tube",
    at: [0.5, 0.1, 0.5],
    points: [
      [-0.3, 0, 0],
      [0.3, 0, 0],
      [0.3, 1, 0],
      [0.3, 1, 0.3],
    ],
    radius: 0.05,
    smooth: false,
    color: wood,
  },
  {
    shape: "tube",
    at: [0.5, 0.1, 0.5],
    points: coil(0.25, 3, 0.4),
    radius: 0.04,
    color: wood,
  },
  {
    // A tetrahedron, counter-clockwise from outside.
    shape: "mesh",
    at: [0.5, 0, 0.5],
    vertices: [-0.3, 0, -0.3, 0.3, 0, -0.3, 0, 0, 0.3, 0, 0.6, 0],
    faces: [0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0],
    color: wood,
  },
];

/** Signed volume of closed triangles: positive when they face outward. */
function volume(g: { position: ArrayLike<number>; index: ArrayLike<number> }): number {
  const P = g.position;
  let v = 0;
  for (let t = 0; t < g.index.length; t += 3) {
    const [a, b, c] = [g.index[t], g.index[t + 1], g.index[t + 2]].map((i) => [
      P[3 * i],
      P[3 * i + 1],
      P[3 * i + 2],
    ]);
    v +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

/** Edges (by position) that are not matched by the same edge the other way: 0 when closed. */
function openEdges(g: { position: ArrayLike<number>; index: ArrayLike<number> }): number {
  const P = g.position;
  const key = (i: number) => [0, 1, 2].map((k) => Math.round(P[3 * i + k] * 1e5)).join(",");
  const edges = new Map<string, number>();
  for (let t = 0; t < g.index.length; t += 3) {
    const tri = [g.index[t], g.index[t + 1], g.index[t + 2]].map(key);
    if (new Set(tri).size < 3) continue; // a collapsed triangle at a pole
    for (let e = 0; e < 3; e++) {
      const [a, b] = [tri[e], tri[(e + 1) % 3]];
      const back = `${b}>${a}`;
      if (edges.get(back)) edges.set(back, edges.get(back)! - 1);
      else edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1);
    }
  }
  return [...edges.values()].reduce((n, c) => n + Math.abs(c), 0);
}

describe("model format", () => {
  it("accepts a model inside its footprint", () => {
    expect(modelProblems(toadstool, 1, 1)).toEqual([]);
    expect(modelProblems(stool, 1, 1)).toEqual([]);
  });

  it("measures models", () => {
    const b = modelBounds({ parts: [toadstool.parts[1]] })!;
    expect(b.x0).toBeCloseTo(0.1);
    expect(b.x1).toBeCloseTo(0.9);
    expect(b.y0).toBeCloseTo(0.28);
    expect(b.y1).toBeCloseTo(0.72);
    expect(
      modelBounds({
        parts: [{ shape: "box", at: [1, 0.5, 0.5], size: [2, 1, 1], color: "#000000" }],
      }),
    ).toEqual({ x0: 0, x1: 2, y0: 0.5, y1: 1.5, z0: 0, z1: 1 });
    expect(modelBounds({ parts: [] })).toBeNull();
  });

  it("reports bad fields first, by part, and nothing else until they are fixed", () => {
    const bad: Model = {
      parts: [
        { shape: "box", at: [0.5, 0, 0.5], size: [1.5, 1, 1], color: "#8a633f" },
        { shape: "cone", at: [0.5, 0, 0.5], radius: 0.2, height: 1, color: "red" },
        {
          shape: "group",
          parts: [{ shape: "box", name: "lid", at: [0.5, 0, 0.5], size: [0, 1, 1], color: wood }],
        },
        { shape: "torus", at: [0.5, 0, 0.5], radius: 0.1, tube: 0.2, color: wood },
        { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.1, height: 1, sides: 2, color: wood },
      ],
    };
    expect(modelProblems(bad, 1, 1)).toEqual([
      "part 2 (cone): color must be #rrggbb",
      'part 3 > 1 (box "lid"): sizes must be positive',
      "part 4 (torus): tube must not be wider than the radius",
      "part 5 (cylinder): sides must be a whole number from 3 to 32",
    ]);
    expect(modelProblems({ parts: [] }, 1, 1)).toEqual(["a model needs at least one part"]);
  });

  it("reports parts outside the footprint, underground, or too tall", () => {
    const bad: Model = {
      parts: [
        { shape: "box", at: [0.5, 0, 0.5], size: [1.5, 1, 1], color: "#8a633f" },
        { shape: "sphere", at: [0.5, 0.1, 0.5], radius: 0.3, color: "#ffffff" },
        { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.1, height: 7, color: "#ffffff" },
        {
          shape: "group",
          at: [0.5, 0, 0.5],
          repeat: { count: 3, step: [0.4, 0, 0] },
          parts: [{ shape: "box", at: [0, 0, 0], size: [0.2, 0.2, 0.2], color: wood }],
        },
      ],
    };
    expect(modelProblems(bad, 1, 1)).toEqual([
      "part 1 (box): reaches outside the 1x1 tile footprint",
      "part 2 (sphere): goes below the ground",
      "part 3 (cylinder): taller than 6 blocks",
      // The third copy, at x = 1.3, is the one outside; each part is named once.
      "part 4 > 1 (box): reaches outside the 1x1 tile footprint",
    ]);
  });

  it("enforces the limits, which callers can change", () => {
    const many: Model = {
      parts: [
        {
          shape: "group",
          at: [0.05, 0, 0.5],
          repeat: { count: 300, step: [0.003, 0, 0] },
          parts: [{ shape: "box", at: [0, 0, 0], size: [0.01, 0.1, 0.1], color: wood }],
        },
      ],
    };
    expect(solidCount(many.parts[0])).toBe(300);
    expect(modelProblems(many, 1, 1)).toEqual([
      "more than 256 parts once groups are mirrored and repeated",
    ]);
    expect(modelProblems(many, 1, 1, { limits: { maxParts: 300 } })).toEqual([]);
    expect(modelProblems(toadstool, 1, 1, { limits: { maxTriangles: 1000 } })).toEqual([
      "1112 triangles; the limit is 1000",
    ]);
    expect(modelProblems(toadstool, 1, 1, { limits: { maxHeight: 0.5 } })).toEqual([
      "part 2 (sphere): taller than 0.5 blocks",
      "part 3 (sphere): taller than 0.5 blocks",
      "part 4 (sphere): taller than 0.5 blocks",
    ]);
    let deep: Model = toadstool;
    for (let i = 0; i < 3; i++) deep = { parts: [{ shape: "group", parts: deep.parts }] };
    expect(modelProblems(deep, 1, 1, { limits: { maxDepth: 2 } })).toEqual([
      "part 1 > 1 > 1 (group): groups nest deeper than 2",
    ]);
  });

  it("turns parts in true proportions, however tall a block is", () => {
    // A rod one tile long, stood on end by turning it about z: one tile tall is two blocks
    // when a block is half a tile.
    const rod: Model = {
      parts: [
        {
          shape: "box",
          at: [0.5, 1, 0.5],
          rotate: [0, 0, 90],
          size: [1, 0.2, 0.2],
          color: wood,
        },
      ],
    };
    const b = modelBounds(rod, { blockSize: 0.5 })!;
    expect(b.y0).toBeCloseTo(0);
    expect(b.y1).toBeCloseTo(2);
    expect(b.x0).toBeCloseTo(0.4);
    expect(b.x1).toBeCloseTo(0.5);
    // rotate [0, 90, 0] turns counter-clockwise seen from above: +x points north (-z).
    const [leaf] = flattenModel({
      parts: [{ shape: "box", at: [0, 0, 0], rotate: [0, 90, 0], size: [1, 1, 1], color: wood }],
    });
    const east = applyPoint(leaf.frame, [1, 0, 0]);
    expect(east[0]).toBeCloseTo(0);
    expect(east[2]).toBeCloseTo(-1);
  });

  it("mirrors and repeats groups", () => {
    const legs = flattenModel(stool).filter((l) => l.path[0] === 0);
    expect(legs.map((l) => l.copy)).toEqual([0, 1, 2, 3]);
    const feet = legs.map((l) => applyPoint(l.frame, [0, 0, 0]).map((v) => +v.toFixed(3)));
    expect(feet).toEqual([
      [0.8, 0, 0.8],
      [0.8, 0, 0.2],
      [0.2, 0, 0.8],
      [0.2, 0, 0.2],
    ]);
    // Mirrored once (x or z) mirrors; mirrored twice does not.
    expect(legs.map((l) => l.mirrored)).toEqual([false, true, true, false]);
    // A mirrored unit primitive is drawn without mirroring: same place, faces still out.
    for (const l of legs) expect(det3(unitMatrix(l))).toBeGreaterThan(0);

    const row = flattenModel({
      parts: [
        {
          shape: "group",
          at: [0.1, 0, 0.5],
          scale: 0.5,
          repeat: { count: 3, step: [0.4, 0, 0] },
          parts: [{ shape: "sphere", at: [0, 0.2, 0], radius: 0.1, color: wood }],
        },
      ],
    });
    expect(row.map((l) => +applyPoint(l.frame, [0, 0, 0])[0].toFixed(6))).toEqual([0.1, 0.3, 0.5]);
  });

  it("turns repeated copies: a ring round the origin, or a walk along an arc", () => {
    const at = (m: Model) =>
      flattenModel(m).map((l) => applyPoint(l.frame, [0, 0, 0]).map((v) => +v.toFixed(4)));
    const ring = at({
      parts: [
        {
          shape: "group",
          at: [0.5, 0, 0.5],
          repeat: { count: 4, step: [0, 0, 0], turn: [0, 90, 0] },
          parts: [{ shape: "box", at: [0.3, 0, 0], size: [0.1, 0.1, 0.1], color: wood }],
        },
      ],
    });
    // Counter-clockwise seen from above: east, north, west, south.
    expect(ring).toEqual([
      [0.8, 0, 0.5],
      [0.5, 0, 0.2],
      [0.2, 0, 0.5],
      [0.5, 0, 0.8],
    ]);
    // Step then turn, each copy from the one before: the copies walk round a square here.
    const walk = at({
      parts: [
        {
          shape: "group",
          at: [0.2, 0, 0.8],
          repeat: { count: 4, step: [0.6, 0, 0], turn: [0, 90, 0] },
          parts: [{ shape: "box", at: [0, 0, 0], size: [0.1, 0.1, 0.1], color: wood }],
        },
      ],
    });
    expect(walk).toEqual([
      [0.2, 0, 0.8],
      [0.8, 0, 0.8],
      [0.8, 0, 0.2],
      [0.2, 0, 0.2],
    ]);
  });

  it("runs a tube through its points and ends it flat on the first and last", () => {
    const straight: Model = {
      parts: [
        {
          shape: "tube",
          at: [0, 0.5, 0.5],
          points: [
            [0.1, 0, 0],
            [0.9, 0, 0],
          ],
          radius: 0.05,
          color: wood,
        },
      ],
    };
    const b = modelBounds(straight)!;
    expect(b.x0).toBeCloseTo(0.1);
    expect(b.x1).toBeCloseTo(0.9);
    expect(b.y0).toBeCloseTo(0.45);
    expect(b.z1).toBeCloseTo(0.55);
    // A smooth tube passes through every point it is given.
    const g = partGeometry(solids[12], 1);
    const near = (q: number[]) => {
      let d = Infinity;
      for (let i = 0; i < g.position.length; i += 3) {
        d = Math.min(
          d,
          Math.hypot(g.position[i] - q[0], g.position[i + 1] - q[1], g.position[i + 2] - q[2]),
        );
      }
      return d;
    };
    expect(near([0.3, 0.5, -0.2])).toBeCloseTo(0.05, 2);
    expect(modelProblems({ parts: [solids[15]] }, 1, 1)).toEqual([]);
  });

  it("checks tubes and arcs", () => {
    const bad: Model = {
      parts: [
        { shape: "tube", at: [0, 0, 0], points: [[0, 0, 0]], radius: 0.1, color: wood },
        {
          shape: "tube",
          at: [0, 0, 0],
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
          radius: 0.1,
          closed: true,
          color: wood,
        },
        { shape: "torus", at: [0.5, 0, 0.5], radius: 0.3, tube: 0.1, arc: 400, color: wood },
      ],
    };
    expect(modelProblems(bad, 1, 1)).toEqual([
      "part 1 (tube): points must be 2 to 1024 [x, y, z] points",
      "part 2 (tube): points must be 3 to 1024 [x, y, z] points",
      "part 3 (torus): arc must be more than 0 and at most 360 degrees",
    ]);
  });

  it("outlines rings and tubes from above with their holes", () => {
    const ring: Model = {
      parts: [{ shape: "torus", at: [0.5, 0.2, 0.5], radius: 0.3, tube: 0.08, color: wood }],
    };
    const [s] = silhouettes(ring, 1, 1, 0);
    expect(s.outline.kind).toBe("triangles");
    const q = s.outline.kind === "triangles" ? s.outline.points : [];
    const inside = (x: number, z: number) => {
      for (let i = 0; i < q.length; i += 6) {
        const c = (a: number, b: number) =>
          (q[i + b] - q[i + a]) * (z - q[i + a + 1]) -
          (q[i + b + 1] - q[i + a + 1]) * (x - q[i + a]);
        if (c(0, 2) >= 0 && c(2, 4) >= 0 && c(4, 0) >= 0) return true;
      }
      return false;
    };
    expect(inside(0.8, 0.5)).toBe(true); // on the ring
    expect(inside(0.5, 0.5)).toBe(false); // the hole
    expect(inside(0.95, 0.5)).toBe(false); // outside
  });

  it("knows which solids an engine can draw as scaled unit primitives", () => {
    expect(solids.map((p) => instancedShape(p))).toEqual([
      "box",
      null,
      null,
      "cylinder",
      null,
      null,
      "cone",
      null,
      "sphere",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("builds closed, outward-facing triangles for every solid, mirrored too", () => {
    for (const p of solids) {
      for (const mirrored of [false, true]) {
        const g = partGeometry(p, 0.8, mirrored);
        const label = `${JSON.stringify(p)} mirrored ${mirrored}`;
        expect(g.index.length, label).toBeGreaterThan(0);
        expect(openEdges(g), label).toBe(0);
        expect(volume(g), label).toBeGreaterThan(0);
      }
      expect(partTriangles(p)).toBeGreaterThan(0);
    }
    // A cube 1 tile wide, 1 block tall at a block of 0.8 tiles: volume 0.8.
    const cube = partGeometry({ shape: "box", at: [0, 0, 0], size: [1, 1, 1], color: wood }, 0.8);
    expect(volume(cube)).toBeCloseTo(0.8);
  });

  it("names geometry by shape only, so parts share it", () => {
    const a = solids[1];
    expect(geometryKey(a)).toBe(geometryKey({ ...a, at: [0.2, 1, 0.2], color: "#ffffff" }));
    expect(geometryKey(a)).not.toBe(geometryKey({ ...a, round: 0.05 } as SolidPart));
    expect(geometryKey(a, 1, true)).not.toBe(geometryKey(a));
  });

  it("makes a model into plain meshes by finish, with each vertex's part", () => {
    const lamp: Model = {
      parts: [
        ...stool.parts,
        { shape: "sphere", at: [0.5, 1.4, 0.5], radius: 0.1, color: "#ffe6a0", finish: "glow" },
      ],
    };
    const { meshes, leaves } = modelMesh(lamp, { blockSize: 0.8 });
    expect(Object.keys(meshes)).toEqual(["matte", "glow"]);
    const glow = meshes.glow!;
    expect(new Set(glow.attributes.part.array)).toEqual(new Set([leaves.length - 1]));
    expect([...glow.attributes.color.array.slice(0, 3)].map((v) => +v.toFixed(3))).toEqual([
      1, 0.902, 0.627,
    ]);
    const matte = meshes.matte!;
    expect(matte.position.length).toBe(3 * matte.vertexCount);
    expect(volume(matte)).toBeGreaterThan(0);
    // Every part is in a mesh: the legs (four copies), the seat and the back.
    expect(new Set(matte.attributes.part.array).size).toBe(6);
    expect(leaves[1].path).toEqual([0, 0]);
  });

  it("turns the footprint clockwise with the item", () => {
    // A marker near the west end of a 2x1 footprint.
    const marker: Model = {
      parts: [{ shape: "box", at: [0.25, 0, 0.5], size: [0.5, 1, 1], color: "#000000" }],
    };
    const corners = (rot: 0 | 90 | 180 | 270) => {
      const [s] = silhouettes(marker, 2, 1, rot);
      return s.outline.kind === "polygon" ? s.outline.points : [];
    };
    expect(corners(0)).toEqual([
      [0, 0],
      [0.5, 0],
      [0.5, 1],
      [0, 1],
    ]);
    // At 90 the footprint is 1 wide and 2 deep; the west end becomes the north end.
    expect(corners(90)).toEqual([
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ]);
    expect(corners(180)[0]).toEqual([1.5, 0]);
    expect(corners(270)[0]).toEqual([0, 1.5]);
    expect(applyPoint(footprintTurn(90, 2, 1), [2, 0, 0])).toEqual([1, 0, 2]);
  });

  it("outlines upright round parts as ellipses and the rest as polygons, lowest first", () => {
    const s = silhouettes(stool, 1, 1, 0);
    expect(s.map((x) => x.leaf.path[0])).toEqual([0, 0, 0, 0, 1, 2]);
    expect(s[0].outline).toMatchObject({ kind: "ellipse", rx: 0.05, rz: 0.05 });
    const back = s[5];
    expect(back.outline.kind).toBe("polygon");
    expect(back.top).toBeGreaterThan(1.1);
  });

  it("finds, replaces and inserts parts by path without changing the model", () => {
    expect(partAt(stool, [0, 0])?.shape).toBe("cylinder");
    expect(partAt(stool, [0, 5])).toBeUndefined();
    expect(partTag(stool, [1])).toBe('part 2 (box "seat")');
    const before = JSON.stringify(stool);
    const thicker = replacePart(stool, [0, 0], {
      shape: "cylinder",
      at: [0.3, 0, 0.3],
      radius: 0.08,
      height: 0.5,
      color: wood,
    });
    expect((partAt(thicker, [0, 0]) as { radius: number }).radius).toBe(0.08);
    expect(replacePart(stool, [2], null).parts).toHaveLength(2);
    const more = insertPart(stool, [0, 1], toadstool.parts[0]);
    expect(partAt(more, [0, 1])).toBe(toadstool.parts[0]);
    expect(JSON.stringify(stool)).toBe(before);
    expect(() => replacePart(stool, [9], null)).toThrow();
  });

  it("has a schema that reads models and converts to JSON Schema", () => {
    expect(modelSchema.safeParse(stool).success).toBe(true);
    expect(modelSchema.safeParse({ parts: solids }).success).toBe(true);
    expect(modelSchema.safeParse({ parts: [{ shape: "blob", at: [0, 0, 0] }] }).success).toBe(
      false,
    );
    expect(
      modelSchema.safeParse({ parts: [{ shape: "group", parts: [{ shape: "box" }] }] }).success,
    ).toBe(false);
    const json = JSON.stringify(z.toJSONSchema(modelSchema));
    expect(json).toContain("wedge");
    expect(json).toContain("mirror");
    expect(json).toContain("tube");
  });
});
