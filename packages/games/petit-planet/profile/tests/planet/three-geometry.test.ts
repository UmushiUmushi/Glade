// 3D geometry builders: pure functions from (map, profile, style, chunk) to typed arrays. Counts
// are asserted as differences against a flat map, so the beach edge and neighbors do not matter.

import { describe, expect, it } from "vitest";
import { gridSpec } from "../../src/maps/planet/profile";
import { catalogEntry, pathEntry } from "../../src/catalog";
import { resolveLook } from "@glade/render";
import type { Look, Style } from "../../src/maps/planet/style";
import styleJson from "../../look/planet.json" with { type: "json" };
import { buildInstances } from "../../src/maps/planet/render3d/objects";
import { buildPathChunk } from "../../src/maps/planet/render3d/paths";
import {
  allChunks,
  buildContactChunk,
  buildCushionChunk,
  buildTerrainChunk,
  chunkBlocks,
  chunkOfBlock,
  dirtyChunks,
  EDGE_FAR,
  FACE,
  geomLook,
  sampler,
} from "../../src/maps/planet/render3d/terrain";
import {
  FIELD_CELLS,
  fieldAt,
  fieldPixels,
  hashI,
  landTone,
} from "../../src/maps/planet/render3d/land";
import { buildWaterChunk, WATER_KIND } from "../../src/maps/planet/render3d/water";
import { STAMP_TEXELS, stampPixels, stampTexture } from "../../src/maps/planet/render3d/stamps";
import {
  addItems,
  addPlants,
  blankMap,
  catalog,
  fillTerrain,
  item,
  plant,
  profile,
  setPathAt,
  stamp,
} from "./helpers";

const style = styleJson as unknown as Style;
// Unit heights keep the expected numbers readable; the style's own heightScale is tested below.
const g = { ...geomLook(resolveLook(style, "midday") as Look), heightScale: 1 };
const spec = gridSpec(profile);
const chunk = { cx: 2, cy: 2 }; // blocks 32..47

/** Vertices of a mesh as [x, y, z] with their extra attributes. */
function verts(a: ReturnType<typeof buildWaterChunk>) {
  const out: { p: number[]; kind: number; shore: number; uv: number[] }[] = [];
  for (let i = 0; i < a.vertexCount; i++) {
    out.push({
      p: [a.position[3 * i], a.position[3 * i + 1], a.position[3 * i + 2]],
      kind: a.attributes.kind.array[i],
      shore: a.attributes.shore.array[i],
      uv: [a.attributes.uv.array[2 * i], a.attributes.uv.array[2 * i + 1]],
    });
  }
  return out;
}

describe("the grass border", () => {
  it("is grass at beach level on the buildable half of the beach blocks, one minor wide", () => {
    const map = blankMap();
    const west = { cx: 1, cy: 4 }; // blocks 16..31: the land starts at block 17 (world x 33)
    const lawnXs = (look: typeof g) => {
      const t = buildTerrainChunk(map, profile, look, spec, west);
      const xs: number[] = [];
      for (let i = 0; i < t.lawn.vertexCount; i++) {
        if (Math.abs(t.lawn.position[3 * i + 1]) < 1e-6) xs.push(t.lawn.position[3 * i]);
      }
      return xs;
    };
    // Tiles from x 16 are buildable (world x 32); beach terrain reaches to world x 33.
    const xs = lawnXs({ ...g, grassBorder: true });
    expect(Math.min(...xs)).toBe(32);
    expect(Math.max(...xs)).toBe(33);
    expect(lawnXs({ ...g, grassBorder: false })).toEqual([]);
  });
});

describe("terrain chunks", () => {
  it("one area per chunk, 10 x 9, with the last block row joining the last chunk", () => {
    expect(allChunks(spec)).toHaveLength(90);
    expect(chunkBlocks(spec, { cx: 0, cy: 0 })).toEqual({ tx0: 0, tx1: 15, ty0: 0, ty1: 15 });
    expect(chunkBlocks(spec, { cx: 9, cy: 8 })).toEqual({ tx0: 144, tx1: 160, ty0: 128, ty1: 144 });
    expect(chunkOfBlock(spec, 160, 144)).toEqual({ cx: 9, cy: 8 });
  });

  it("a 1-block plateau keeps its top in the lawn and adds 4 faces, cut and dented", () => {
    const flat = buildTerrainChunk(blankMap(), profile, g, spec, chunk);
    const map = stamp(blankMap(), 40, 40, ["2"]);
    const raised = buildTerrainChunk(map, profile, g, spec, chunk);
    expect(raised.stats.tops).toBe(flat.stats.tops);
    expect(raised.stats.sides - flat.stats.sides).toBe(4);
    // The raised block's top sits at y = 2 over minor 79..81, in the lawn mesh.
    const lawn = raised.lawn;
    let found = false;
    for (let i = 0; i < lawn.vertexCount; i++) {
      const [x, y, z] = [lawn.position[3 * i], lawn.position[3 * i + 1], lawn.position[3 * i + 2]];
      if (x === 79 && z === 79 && y === 2) found = lawn.attributes.face.array[i] === FACE.grass;
    }
    expect(found).toBe(true);
    // Each face: four rows a level; the dents move vertices only between level boundaries; the
    // corners are rounded (face.round, concentric with the cushion's corner).
    const r = Math.min(g.land.face.round, g.land.cushion.corner - g.land.cushion.overhang);
    expect(r).toBeGreaterThan(0.1);
    /** Distance from the block's outline, a square 79..81 with corners rounded by r. */
    const outline = (x: number, z: number) => {
      const [qx, qz] = [Math.abs(x - 80) - (1 - r), Math.abs(z - 80) - (1 - r)];
      return Math.abs(
        Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r,
      );
    };
    let diagonal = Infinity;
    const ys = new Set<number>();
    for (let i = 0; i < raised.vertexCount; i++) {
      if (raised.attributes.face.array[i] !== FACE.side) continue;
      const [x, y, z] = [
        raised.position[3 * i],
        raised.position[3 * i + 1],
        raised.position[3 * i + 2],
      ];
      if (x < 70 || x > 90 || z < 70 || z > 90) continue;
      ys.add(Math.round(y * 1000) / 1000);
      const onLine = outline(x, z);
      if (y === 1 || y === 2) expect(onLine).toBeLessThan(1e-5);
      else expect(onLine).toBeLessThanOrEqual(2 * g.land.face.dent + 1e-9);
      if (y === 1) diagonal = Math.min(diagonal, Math.hypot(x - 81, z - 81));
    }
    // A grass face stops 0.05 under the lawn, inside its cushion.
    expect([...ys].sort()).toEqual([1, 1.25, 1.5, 1.75, 1.95]);
    // The face's nearest point to the square corner is on the round, r (sqrt 2 - 1) away.
    expect(diagonal).toBeCloseTo(r * (Math.SQRT2 - 1), 5);
  });

  it("a corner rounds only where both its walls stand, with a floor under the round", () => {
    // Block (40,40) at 3, its east neighbor at 2, the rest at 1: the SE corner (81, 81) is a
    // corner from 2 up; below 2 the south face runs on straight into the neighbor's.
    const map = stamp(blankMap(), 40, 40, ["32"]);
    const a = buildTerrainChunk(map, profile, g, spec, chunk);
    const r = Math.min(g.land.face.round, g.land.cushion.corner - g.land.cushion.overhang);
    // At the foot (no dents at a level boundary) the face still reaches the square corner; above
    // 2 it keeps about r (sqrt 2 - 1) from it, on the round (dents move it at most dent / sqrt 2).
    let [foot, above] = [Infinity, Infinity];
    for (let i = 0; i < a.vertexCount; i++) {
      if (a.attributes.face.array[i] !== FACE.side) continue;
      const [x, y, z] = [a.position[3 * i], a.position[3 * i + 1], a.position[3 * i + 2]];
      const d = Math.hypot(x - 81, z - 81);
      if (Math.abs(y - 1) < 1e-6) foot = Math.min(foot, d);
      if (y > 2 + 1e-6) above = Math.min(above, d);
    }
    expect(foot).toBeLessThan(1e-5);
    expect(above).toBeGreaterThan(r * (Math.SQRT2 - 1) - g.land.face.dent * Math.SQRT2 - 1e-6);
    // The floor: lawn at 2 inside the block, where the round gave up the corner.
    const lawn = a.lawn;
    let floor = false;
    for (let i = 0; i < lawn.vertexCount; i++) {
      const [x, y, z] = [lawn.position[3 * i], lawn.position[3 * i + 1], lawn.position[3 * i + 2]];
      if (Math.abs(y - 2) < 1e-6 && x < 81 - 1e-3 && x > 81 - r - 1e-3 && Math.abs(z - 81) < 1e-6) {
        floor = true;
      }
    }
    expect(floor).toBe(true);
  });

  it("faces are not dented at a fall's sheet, so they never poke through it", () => {
    // A water block at 3 over level-1 ground falls on all four sides.
    const map = fillTerrain(blankMap(), 40, 40, 1, 1, 3, true);
    const a = buildTerrainChunk(map, profile, g, spec, chunk);
    let n = 0;
    for (let i = 0; i < a.vertexCount; i++) {
      if (a.attributes.face.array[i] !== FACE.side) continue;
      const [x, , z] = [a.position[3 * i], a.position[3 * i + 1], a.position[3 * i + 2]];
      if (x < 78 || x > 82 || z < 78 || z > 82) continue;
      n++;
      expect(Math.min(...[x - 79, x - 81, z - 79, z - 81].map(Math.abs))).toBeLessThan(1e-6);
    }
    expect(n).toBeGreaterThan(0);
  });

  it("an inside corner rounds out into the open", () => {
    // An L of three blocks at 2 around (41,41) at 1: the inside corner at (81, 81).
    const map = stamp(blankMap(), 40, 40, ["22", "2"]);
    const a = buildTerrainChunk(map, profile, g, spec, chunk);
    const r = Math.min(g.land.face.round, g.land.cushion.corner - g.land.cushion.overhang);
    let nearest = Infinity;
    let atCorner = false;
    for (let i = 0; i < a.vertexCount; i++) {
      if (a.attributes.face.array[i] !== FACE.side) continue;
      const [x, y, z] = [a.position[3 * i], a.position[3 * i + 1], a.position[3 * i + 2]];
      if (Math.abs(y - 1) > 1e-6) continue; // the foot: no dents at a level boundary
      const d = Math.hypot(x - 81, z - 81);
      if (d < 1e-5) atCorner = true;
      if (x > 81 + 1e-6 && z > 81 + 1e-6) nearest = Math.min(nearest, d);
    }
    expect(atCorner).toBe(false);
    // The round's middle, out on the diagonal.
    expect(nearest).toBeCloseTo(r * (Math.SQRT2 - 1), 5);
  });

  it("side faces run from the neighbor's height to the block's", () => {
    const map = stamp(blankMap(), 40, 40, ["4"]);
    const a = buildTerrainChunk(map, profile, g, spec, chunk);
    const sideYs: number[] = [];
    for (let i = 0; i < a.vertexCount; i++) {
      if (a.attributes.face.array[i] === FACE.side && a.position[3 * i] >= 79) {
        sideYs.push(a.position[3 * i + 1]);
      }
    }
    expect(Math.min(...sideYs)).toBe(1);
    expect(Math.max(...sideYs)).toBeCloseTo(4 - 0.05);
  });

  it("beach blocks are flat sand with a wet-band distance to the map edge", () => {
    const a = buildTerrainChunk(blankMap(), profile, g, spec, { cx: 0, cy: 0 });
    const sand: number[] = [];
    for (let i = 0; i < a.vertexCount; i++) {
      if (a.attributes.face.array[i] === FACE.sand) {
        expect(a.position[3 * i + 1]).toBe(0);
        sand.push(a.attributes.shore.array[i]);
      }
    }
    expect(Math.min(...sand)).toBe(0);
    expect(Math.max(...sand)).toBeGreaterThan(10);
  });

  it("the lawn knows how far in from the cushion's outline it is, and which way", () => {
    const a = buildTerrainChunk(stamp(blankMap(), 40, 40, ["2"]), profile, g, spec, chunk);
    const lawn = a.lawn;
    const at = (x: number, z: number, y: number) => {
      for (let i = 0; i < lawn.vertexCount; i++) {
        const p = [lawn.position[3 * i], lawn.position[3 * i + 1], lawn.position[3 * i + 2]];
        if (p[0] === x && p[1] === y && p[2] === z)
          return [...lawn.attributes.edge.array.slice(3 * i, 3 * i + 3)];
      }
      return null;
    };
    const o = g.land.cushion.overhang;
    // On the block's edge: the overhang in, pointing into the block.
    const e = at(80, 79, 2)!;
    expect(e[0]).toBeCloseTo(o);
    expect(e[2]).toBeCloseTo(1);
    // Its middle: one unit further in.
    expect(at(80, 80, 2)![0]).toBeCloseTo(1 + o);
    // The ground around it is not a top that drops there: far from any edge.
    expect(at(77, 77, 1)![0]).toBe(EDGE_FAR);
  });
});

describe("cushions, leaves and contact shading", () => {
  /** The core's vertices near a point (x, z) within r. */
  function core(f: ReturnType<typeof buildCushionChunk>, x: number, z: number, r: number) {
    const out: number[][] = [];
    for (let i = 0; i < f.vertexCount; i++) {
      const p = [f.position[3 * i], f.position[3 * i + 1], f.position[3 * i + 2]];
      if (Math.hypot(p[0] - x, p[2] - z) < r) out.push(p);
    }
    return out;
  }
  const C = g.land.cushion;

  it("follows every dropping edge, from its foot up to where it meets the lawn", () => {
    const flat = buildCushionChunk(blankMap(), profile, g, spec, chunk);
    const f = buildCushionChunk(stamp(blankMap(), 40, 40, ["3"]), profile, g, spec, chunk);
    expect(f.stats.edges - flat.stats.edges).toBe(4);
    const ys = core(f, 80, 80, 3).map((p) => p[1]);
    // Its crest is coreInset above the lawn, and the core sits coreInset behind its outline.
    const crest = 3 + C.coreInset;
    expect(Math.max(...ys)).toBeCloseTo(crest - C.coreInset);
    // Its backing reaches coreDrop below its foot, behind the hanging leaves.
    expect(Math.min(...ys)).toBeCloseTo(crest - C.depth - C.coreDrop + C.coreInset);
    // The outline stands `overhang` past the face (the core coreInset behind it).
    const xs = core(f, 80, 80, 3).map((p) => p[0]);
    expect(Math.max(...xs)).toBeCloseTo(81 + C.overhang - C.coreInset, 2);
  });

  it("rounds the outline's convex corners", () => {
    const f = buildCushionChunk(stamp(blankMap(), 40, 40, ["3"]), profile, g, spec, chunk);
    // The south-east corner: a sharp miter would reach x + z = 2 (81 + overhang).
    // (Leaving out the plug, the strip just off the face that shows grass where the corner pokes
    // through.)
    const swept = core(f, 81, 81, 1.5).filter(
      (p) => Math.min(Math.abs(p[0] - 81.015), Math.abs(p[2] - 81.015)) > 1e-3,
    );
    const reach = Math.max(...swept.map((p) => p[0] + p[2]));
    const s = C.overhang - C.coreInset;
    const r = C.corner - C.coreInset;
    expect(reach).toBeLessThan(2 * (81 + s) - 0.1);
    expect(reach).toBeCloseTo(2 * (81 + s - r) + r * Math.SQRT2, 1);
  });

  it("over water reaches down to just above the surface", () => {
    const f = buildCushionChunk(stamp(blankMap(), 40, 40, ["1~"]), profile, g, spec, chunk);
    const ys = core(f, 80, 80, 3).map((p) => p[1]);
    const surface = 1 - g.inset;
    expect(Math.min(...ys)).toBeCloseTo(surface + 0.04 - C.coreDrop + C.coreInset);
  });

  it("leaves: rows on every edge, agreeing across a chunk border with none twice", () => {
    // A plateau across the border of areas (2, 2) and (3, 2): blocks 47 and 48.
    const map = fillTerrain(blankMap(), 45, 40, 6, 3, 3);
    const a = buildCushionChunk(map, profile, g, spec, { cx: 2, cy: 2 });
    const b = buildCushionChunk(map, profile, g, spec, { cx: 3, cy: 2 });
    const at = (l: typeof a.leaves) => {
      const out: string[] = [];
      for (let k = 0; k < l.matrices.length; k += 16) {
        out.push(
          l.matrices
            .slice(k + 12, k + 15)
            .map((v) => v.toFixed(4))
            .join(","),
        );
      }
      return out;
    };
    const both = [...at(a.leaves), ...at(b.leaves)];
    expect(new Set(both).size).toBe(both.length);
    // Along the south face, the lowest row keeps its spacing across the border (x = 95).
    const row = (l: typeof a.leaves) => {
      const xs: number[] = [];
      for (let k = 0; k < l.matrices.length; k += 16) {
        const [x, y, z] = l.matrices.slice(k + 12, k + 15);
        if (z > 85 && y < 3 - C.depth + 0.3) xs.push(x);
      }
      return xs;
    };
    const xs = [...row(a.leaves), ...row(b.leaves)].sort((p, q) => p - q);
    const gaps = xs
      .slice(1)
      .map((x, i) => x - xs[i])
      .filter((d, i) => xs[i] > 92 && xs[i] < 98);
    expect(Math.max(...gaps)).toBeLessThan(2.5 * g.land.leaves.spacing);
  });

  it("leaves along the foot of a face with grass below, none where it drops into water", () => {
    const flat = buildCushionChunk(blankMap(), profile, g, spec, chunk);
    const one = buildCushionChunk(stamp(blankMap(), 40, 40, ["3"]), profile, g, spec, chunk);
    const pond = stamp(blankMap(), 39, 39, ["1~1~1~", "1~31~", "1~1~1~"]);
    const wet = buildCushionChunk(pond, profile, g, spec, chunk);
    // Low stamps just off the raised block's south face (z = 81).
    const foot = (f: typeof one) => {
      let n = 0;
      for (let k = 0; k < f.leaves.matrices.length; k += 16) {
        const [x, y, z] = f.leaves.matrices.slice(k + 12, k + 15);
        if (y < 1.2 && x > 79 && x < 81 && z > 81 && z < 81.4) n++;
      }
      return n;
    };
    // Two rows along its 2 units.
    expect(foot(one) - foot(flat)).toBeGreaterThan(2 * Math.floor(2 / g.land.leaves.spacing) - 4);
    expect(foot(wet)).toBe(foot(flat));
  });

  it("a contact strip lies on the lower ground at the foot of each face, not on water", () => {
    const flat = buildContactChunk(blankMap(), profile, g, spec, chunk);
    const one = buildContactChunk(stamp(blankMap(), 40, 40, ["3"]), profile, g, spec, chunk);
    expect(one.stats.strips - flat.stats.strips).toBe(4);
    const lows: number[] = [];
    for (let i = 0; i < one.vertexCount; i++) {
      const [x, y, z] = [one.position[3 * i], one.position[3 * i + 1], one.position[3 * i + 2]];
      if (x > 70 && x < 90 && z > 70 && z < 90) lows.push(y);
    }
    expect(Math.max(...lows)).toBeCloseTo(1.03);
    const wet = stamp(blankMap(), 40, 40, ["3", "1~"]);
    const w = buildContactChunk(wet, profile, g, spec, chunk);
    expect(w.stats.strips - flat.stats.strips).toBe(3);
  });
});

describe("land tone and field", () => {
  it("hashI is the integer hash the shaders use", () => {
    expect(hashI(0, 0, 0)).toBe(0);
    expect(hashI(3, -7, 11)).toBe(hashI(3, -7, 11));
    const vals = Array.from({ length: 200 }, (_, i) => hashI(i, i * 3, 5));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vals)).toBeLessThan(1);
    expect(new Set(vals).size).toBeGreaterThan(190);
  });

  it("the field is seeded and tiles every FIELD_CELLS cells", () => {
    expect(fieldPixels()).toBe(fieldPixels());
    for (const [x, y] of [
      [0.3, 7.1],
      [12.5, 40.2],
      [-3.7, 2.2],
    ]) {
      for (let ch = 0; ch < 4; ch++) {
        expect(fieldAt(x + FIELD_CELLS, y, ch)).toBeCloseTo(fieldAt(x, y, ch), 9);
        expect(fieldAt(x, y - FIELD_CELLS, ch)).toBeCloseTo(fieldAt(x, y, ch), 9);
      }
    }
  });

  it("grass is lighter facing up, darker on its underside and at the rim, darker on the ground", () => {
    const T = g.land.tone;
    const p: [number, number, number] = [10, 2, 10];
    const top = landTone(T, [0, 1, 0], p, 1, 9);
    expect(top).toBeGreaterThan(landTone(T, [1, 0, 0], p, 0.5, 0));
    expect(landTone(T, [1, 0, 0], p, 0.05, 0)).toBeLessThan(landTone(T, [1, 0, 0], p, 0.6, 0));
    expect(landTone(T, [0, 1, 0], p, 1, 9, 1, T.ground)).toBeLessThan(top);
    // The rim darkens a raised top's edge; the open ground (already darker) keeps groundRim of it.
    const rimDrop = (lift: number) =>
      landTone(T, [0, 1, 0], p, 1, 9, 1, lift) - landTone(T, [0, 1, 0], p, 1, 0, 1, lift);
    expect(rimDrop(0)).toBeGreaterThan(0.1);
    expect(rimDrop(T.ground)).toBeLessThan(rimDrop(0) * T.groundRim + 0.05);
  });
});

describe("water", () => {
  it("a 2-level waterfall is a surface, a sheet down to the landing, and a foam mound", () => {
    // Water at level 3 falling south onto level 1.
    const map = stamp(blankMap(), 40, 39, ["3", "3~", "1"]);
    fillTerrain(map, 39, 39, 1, 2, 3);
    fillTerrain(map, 41, 39, 1, 2, 3);
    const w = buildWaterChunk(map, profile, { ...g, fallLip: 0 }, spec, chunk);
    expect(w.stats).toEqual({ surfaces: 1, falls: 1, foams: 1 });
    expect(w.vertexCount).toBe(12);
    const v = verts(w);
    const sheet = v.filter((x) => x.kind === WATER_KIND.fall);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    expect(sheet.map((x) => r3(x.p[1])).sort()).toEqual([1, 1, 3 - g.inset, 3 - g.inset]);
    expect(sheet.every((x) => Math.abs(x.p[2] - 81.02) < 1e-4)).toBe(true); // south face of block 40
    const surface = v.filter((x) => x.kind === WATER_KIND.surface);
    expect(surface.every((x) => r3(x.p[1]) === 3 - g.inset)).toBe(true);
    expect(v.filter((x) => x.kind === WATER_KIND.foam)).toHaveLength(4);
  });

  it("a fall's lip curves from the pulled-back surface down into the sheet", () => {
    const map = stamp(blankMap(), 40, 39, ["3", "3~", "1"]);
    fillTerrain(map, 39, 39, 1, 2, 3);
    fillTerrain(map, 41, 39, 1, 2, 3);
    const lip = 0.25;
    const v = verts(buildWaterChunk(map, profile, { ...g, fallLip: lip }, spec, chunk));
    const top = 3 - g.inset;
    const face = 81.02; // just off the south face of block 40
    // The surface stops short of the edge by the lip's radius (less the sheet's offset).
    const surface = v.filter((x) => x.kind === WATER_KIND.surface);
    expect(Math.max(...surface.map((x) => x.p[2]))).toBeCloseTo(face - lip);
    // The lip and sheet: every point on the quarter circle round (face - lip, top - lip), or
    // straight down from its end; the highest meets the surface, the sheet starts where it ends.
    const fall = v.filter((x) => x.kind === WATER_KIND.fall);
    for (const x of fall) {
      const [dz, dy] = [x.p[2] - (face - lip), x.p[1] - (top - lip)];
      if (dy >= -1e-6) expect(Math.hypot(dz, dy)).toBeCloseTo(lip);
      else expect(x.p[2]).toBeCloseTo(face);
    }
    expect(Math.max(...fall.map((x) => x.p[1]))).toBeCloseTo(top);
    expect(Math.min(...fall.map((x) => x.p[1]))).toBeCloseTo(1);
    // Texture rows run on down the lip into the sheet without a jump.
    const vs = fall.map((x) => x.uv[1]).sort((a, b) => a - b);
    expect(vs[0]).toBeCloseTo(0);
    expect(vs.at(-1)).toBeCloseTo((lip * Math.PI) / 2 + (top - lip - 1));
  });

  it("the shore ramp goes 0 at the edge, 0.5 one block in, 1 two blocks in", () => {
    const map = fillTerrain(blankMap(), 36, 36, 7, 7, 1, true);
    const w = buildWaterChunk(map, profile, g, spec, chunk);
    // Surface corners along the pond's middle row line z = 2*39 + 1.
    const byX = new Map<number, number>();
    for (const x of verts(w))
      if (x.kind === WATER_KIND.surface && x.p[2] === 79) byX.set(x.p[0], x.shore);
    const ramp = [...byX.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
    expect(ramp).toEqual([0, 0.5, 1, 1, 1, 1, 0.5, 0]);
  });

  it("the riverbed sits below the surface so the banks form the basin", () => {
    const map = fillTerrain(blankMap(), 40, 40, 1, 1, 1, true);
    const s = sampler(map, profile, g, spec);
    expect(s.surface(40, 40)).toBeCloseTo(1 - g.inset);
    expect(s.solid(40, 40)).toBeCloseTo(1 - g.inset - g.bed);
    const a = buildTerrainChunk(map, profile, g, spec, chunk);
    const flat = buildTerrainChunk(blankMap(), profile, g, spec, chunk);
    expect(a.stats.sides - flat.stats.sides).toBe(4); // the 4 bank faces
  });
});

describe("paths and objects", () => {
  it("a path cell is one quad at its ground level + 0.02", () => {
    const map = fillTerrain(blankMap(), 40, 40, 2, 2, 2);
    setPathAt(map, 40, 40, "stone");
    const p = buildPathChunk(map, profile, catalog, g, spec, chunk);
    expect(p.stats.cells).toBe(1);
    const ys = Array.from({ length: 4 }, (_, i) => Math.round(p.position[3 * i + 1] * 1000) / 1000);
    expect([...new Set(ys)]).toEqual([2.02]);
    // Its color and pattern are the catalog entry's (color as linear RGB): stone is cobbled.
    const stone = pathEntry(catalog, "stone")!;
    const lin = (i: number) => {
      const c = parseInt(stone.color.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const pc = Array.from(p.attributes.pcolor.array.slice(0, 3));
    pc.forEach((v, i) => expect(v).toBeCloseTo(lin(i)));
    expect(p.attributes.pattern.array[0]).toBe(1);
  });

  it("a path not in the catalog is a plain grey stub", () => {
    const map = fillTerrain(blankMap(), 40, 40, 2, 2, 2);
    setPathAt(map, 40, 40, "lava");
    const p = buildPathChunk(map, profile, catalog, g, spec, chunk);
    expect(p.stats.cells).toBe(1);
    const [r, g2, b] = Array.from(p.attributes.pcolor.array.slice(0, 3));
    expect(r).toBeCloseTo(g2);
    expect(g2).toBeCloseTo(b);
    expect(p.attributes.pattern.array[0]).toBe(0);
  });

  it("rounds a path's outer corners, where neither side has a path, and bends its grass", () => {
    // An L: 40..42 along row 40, then 40,41 below its west end.
    const map = fillTerrain(blankMap(), 38, 38, 8, 8, 1);
    for (const [X, Y] of [
      [40, 40],
      [41, 40],
      [42, 40],
      [40, 41],
    ])
      setPathAt(map, X, Y, "stone");
    const p = buildPathChunk(map, profile, catalog, g, spec, chunk);
    // Corners north-west, north-east, south-east, south-west of each cell (its first vertex).
    const corners = new Map<string, number[]>();
    for (let i = 0; i < p.vertexCount; i += 4) {
      const [x, z] = [p.position[3 * i], p.position[3 * i + 2]];
      corners.set(
        `${x / 2},${z / 2}`,
        Array.from(p.attributes.corner.array.slice(4 * i, 4 * i + 4)),
      );
    }
    expect(corners.get("40,40")).toEqual([1, 0, 0, 0]); // the L's outer bend
    expect(corners.get("41,40")).toEqual([0, 0, 0, 0]);
    expect(corners.get("42,40")).toEqual([0, 1, 1, 0]); // the east end
    expect(corners.get("40,41")).toEqual([0, 0, 1, 1]); // the south end
    // The grass rows bend round the rounded corners, so no stamp stays in the cut-off corner.
    const square = buildPathChunk(map, profile, catalog, { ...g, pathCorner: 0 }, spec, chunk);
    const nearest = (l: typeof p.leaves) => {
      let d = Infinity;
      for (let i = 0; i < l.colors.length; i++) {
        d = Math.min(d, Math.hypot(l.matrices[16 * i + 12] - 80, l.matrices[16 * i + 14] - 80));
      }
      return d;
    };
    expect(nearest(p.leaves)).toBeGreaterThan(nearest(square.leaves) + 0.1);
  });

  it("instances every model part at the ground, rotated with the item", () => {
    const map = fillTerrain(blankMap(), 40, 40, 4, 4, 2);
    addPlants(map, plant("tree", 40, 40));
    addItems(map, item("bench", 82, 84, 0), item("bench", 82, 84, 90));
    const s = sampler(map, profile, g, spec);
    const inst = buildInstances(map, catalog, s, g.heightScale);
    const tree = catalogEntry(catalog, "tree")!.model!;
    const count = (l: typeof inst.plants) =>
      Object.values(l).reduce((n, x) => n + x.colors.length, 0);
    expect(count(inst.plants)).toBe(tree.parts.length);
    // The tree trunk (a cylinder) stands on level 2 at the plant cell's center.
    const trunk = inst.plants.cylinder.matrices.slice(12, 15);
    expect(trunk).toEqual([81, 2, 81]);
    // Bench seat (box 1): at rot 0 it spans x, at rot 90 its long side runs along z.
    const seat0 = inst.items.box.matrices.slice(0, 16);
    const benchParts = catalogEntry(catalog, "bench")!.model!.parts.length;
    const boxesPerBench = inst.items.box.colors.length / 2;
    expect(boxesPerBench).toBe(benchParts);
    const seat90 = inst.items.box.matrices.slice(boxesPerBench * 16, boxesPerBench * 16 + 16);
    const xLen = (m: number[]) => Math.hypot(m[0], m[2]);
    expect(xLen(seat0)).toBeCloseTo(3.6);
    expect(Math.abs(seat90[2])).toBeCloseTo(3.6); // local x now points along world z
  });
});

describe("inclines", () => {
  it("stand on the low ground as four steps climbing to the cliff top", () => {
    // A level-2 cliff to the north of level-1 ground; the incline's high end on its edge.
    const map = fillTerrain(blankMap(), 40, 50, 31, 10, 2);
    addItems(map, item("incline-1x2", 100, 118));
    const s = sampler(map, profile, g, spec);
    const inst = buildInstances(map, catalog, s, g.heightScale);
    const boxes = inst.items.box.matrices;
    expect(inst.items.box.colors).toHaveLength(4);
    const steps = [0, 1, 2, 3].map((k) => ({
      base: boxes[k * 16 + 13],
      height: boxes[k * 16 + 5],
    }));
    for (const st of steps) expect(st.base).toBeCloseTo(1 * g.heightScale);
    expect(Math.max(...steps.map((st) => st.base + st.height))).toBeCloseTo(2 * g.heightScale);
  });
});

describe("chunk rebuilds", () => {
  it("a change marks only its chunk, or both chunks across a border", () => {
    const before = blankMap();
    const inside = stamp(blankMap(), 56, 56, ["3"]); // middle of area (3, 3)
    expect([...dirtyChunks(spec, before, inside)]).toEqual(["3,3"]);
    const edge = stamp(blankMap(), 47, 56, ["3"]);
    expect([...dirtyChunks(spec, before, edge)].sort()).toEqual(["2,3", "3,3"]);
    const path = blankMap();
    setPathAt(path, 60, 60, "dirt");
    expect([...dirtyChunks(spec, before, path)]).toEqual(["3,3"]);
    expect(dirtyChunks(spec, null, before).size).toBe(90);
    expect(dirtyChunks(spec, before, blankMap()).size).toBe(0);
  });

  it("rebuilding a one-area change takes well under 50 ms", () => {
    const before = blankMap();
    const after = fillTerrain(blankMap(), 50, 50, 10, 10, 3);
    fillTerrain(after, 53, 52, 2, 6, 3, true);
    // As in the viewer, the land was built before (the shared noise texture, warm code).
    for (const key of dirtyChunks(spec, before, after)) {
      const [cx, cy] = key.split(",").map(Number);
      buildTerrainChunk(after, profile, g, spec, { cx, cy });
      buildCushionChunk(after, profile, g, spec, { cx, cy });
    }
    // The fastest of three, so other test files running in parallel don't decide it.
    let best = Infinity;
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      for (const key of dirtyChunks(spec, before, after)) {
        const [cx, cy] = key.split(",").map(Number);
        buildTerrainChunk(after, profile, g, spec, { cx, cy });
        buildCushionChunk(after, profile, g, spec, { cx, cy });
        buildWaterChunk(after, profile, g, spec, { cx, cy });
        buildPathChunk(after, profile, catalog, g, spec, { cx, cy });
      }
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(50);
  });
});

describe("water stamps", () => {
  it("the texture is seeded, covered, and its heights leave room for the shadow cut", () => {
    const px = stampPixels();
    expect(px.length).toBe(STAMP_TEXELS * STAMP_TEXELS * 4);
    expect(stampPixels()).toEqual(px);
    let covered = 0;
    let hMin = 255;
    let hMax = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 2] > 0) covered++;
      hMin = Math.min(hMin, px[i + 1]);
      hMax = Math.max(hMax, px[i + 1]);
      expect(px[i + 3]).toBe(255);
    }
    expect(covered / (STAMP_TEXELS * STAMP_TEXELS)).toBeGreaterThan(0.98);
    // Heights stay inside 0.2..0.85 so a full shadow and full light are never cut.
    expect(hMin).toBeGreaterThanOrEqual(0.2 * 255);
    expect(hMax).toBeLessThanOrEqual(0.85 * 255);
    expect(stampTexture()).toBe(stampTexture());
  });
});
