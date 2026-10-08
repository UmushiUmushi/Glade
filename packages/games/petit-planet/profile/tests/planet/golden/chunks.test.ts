// Geometry golden: a fingerprint of every 3D chunk (vertex and index counts, stats, and a rounded
// sum of positions) and of the plant and item instances, built from the demo island (samples/maps/demo.json) at midday. A
// diff means a geometry builder changed. Regenerate deliberately with UPDATE_GOLDENS=1 and review
// the data diff.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bind, loadMap } from "@glade/core";
import { resolveLook } from "@glade/render";
import { describe, expect, it } from "vitest";
import styleJson from "../../../look/planet.json" with { type: "json" };
import { demoCatalog, maps } from "../../../samples";
import { petitPlanet, planet } from "../../../src";
import { profile } from "../../../src/maps/planet/data";
import type { MapDoc } from "../../../src/maps/planet/model";
import { gridSpec } from "../../../src/maps/planet/profile";
import type { Look, Style } from "../../../src/maps/planet/style";
import { buildInstances } from "../../../src/maps/planet/render3d/objects";
import { buildPathChunk } from "../../../src/maps/planet/render3d/paths";
import {
  allChunks,
  buildCushionChunk,
  buildTerrainChunk,
  geomLook,
  sampler,
} from "../../../src/maps/planet/render3d/terrain";
import { buildWaterChunk } from "../../../src/maps/planet/render3d/water";

const FILE = join(__dirname, "chunks.json");
const update = process.env.UPDATE_GOLDENS === "1";

/** Sum of an array rounded to 1e-3, as a cheap fingerprint of geometry. */
function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return Math.round(s * 1000) / 1000;
}

function chunkStats(): unknown {
  const game = bind(planet, demoCatalog);
  const map = loadMap(maps.demo, petitPlanet) as MapDoc;
  const g = geomLook(resolveLook(styleJson as unknown as Style, "midday") as Look);
  const spec = gridSpec(profile);
  const out: Record<string, unknown> = {};
  for (const c of allChunks(spec)) {
    const t = buildTerrainChunk(map, profile, g, spec, c);
    const f = buildCushionChunk(map, profile, g, spec, c);
    const p = buildPathChunk(map, profile, game.catalog, g, spec, c);
    const w = buildWaterChunk(map, profile, g, spec, c);
    out[`${c.cx},${c.cy}`] = {
      terrain: { v: t.vertexCount, i: t.index.length, ...t.stats, sum: sum(t.position) },
      lawn: { v: t.lawn.vertexCount, i: t.lawn.index.length, sum: sum(t.lawn.position) },
      cushion: { v: f.vertexCount, i: f.index.length, ...f.stats, sum: sum(f.position) },
      paths: { v: p.vertexCount, i: p.index.length, ...p.stats, sum: sum(p.position) },
      water: { v: w.vertexCount, i: w.index.length, ...w.stats, sum: sum(w.position) },
    };
  }
  const inst = buildInstances(map, game.catalog, sampler(map, profile, g, spec), 1);
  const objects: Record<string, unknown> = {};
  for (const layer of ["plants", "items"] as const) {
    for (const [prim, list] of Object.entries(inst[layer])) {
      objects[`${layer}.${prim}`] = { n: list.colors.length, sum: sum(list.matrices) };
    }
  }
  out.objects = objects;
  return out;
}

describe("geometry golden", () => {
  it("the demo island's chunks and instances are unchanged", async () => {
    const text = JSON.stringify(chunkStats(), null, 1) + "\n";
    if (update || !existsSync(FILE)) {
      await writeFile(FILE, text, "utf8");
      if (!update) throw new Error("chunks.json was missing and has been written; rerun");
      return;
    }
    expect(text).toBe(await readFile(FILE, "utf8"));
  });
});
