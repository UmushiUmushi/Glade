// Contract tests: the definition of "a game works". They run against every game plus the fixture
// game, and use nothing but the game contract, so a new game passes them before it gets
// game-specific tests. Every new shared feature adds a test here.

import {
  catalogProblems,
  decodeDoc,
  deepEqual,
  deserializeMap,
  encodeDoc,
  serializeMap,
  validate,
  type Entity,
} from "@glade/core";
import { resolveLook, styleProblems, type InstancesSpec, type MeshSpec } from "@glade/render";
import { describe, expect, it } from "vitest";
import { allMaps, bound, games } from "../src/games";

/** Every map of every game (testkit/src/games.ts), bound to its sample items, with its demo. */
const MAPS = allMaps().map(({ game, map, samples }) => {
  const shown = bound(map, samples ?? { items: [], demo: () => map.newDoc("demo") });
  return { game, map: shown, samples, demo: () => samples.demo(shown) };
});

const NOW = new Date("2026-09-29T00:00:00.000Z");

describe("games", () => {
  it("have unique ids, and each map knows its game", () => {
    const ids = Object.values(games).map((g) => g.game.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { game } of Object.values(games)) {
      expect(game.maps[game.defaultMap], `${game.id} default map`).toBeDefined();
      for (const [id, map] of Object.entries(game.maps)) {
        expect([map.game, map.id], `${game.id}/${id}`).toEqual([game.id, id]);
        expect(map.kinds, `${game.id}/${id}`).toBe(game.kinds);
      }
    }
  });

  it("ship no catalog, only kinds", () => {
    for (const { game } of Object.values(games)) {
      expect(game.kinds.length, game.id).toBeGreaterThan(0);
      for (const map of Object.values(game.maps)) expect(map, map.id).not.toHaveProperty("catalog");
    }
  });

  it("every map has samples, and its sample items are a valid catalog", () => {
    for (const { game, map, samples } of MAPS) {
      expect(samples, `${game.id}/${map.id}`).toBeDefined();
      const entries = [...samples.items, ...(samples.showroom?.items ?? [])];
      expect(catalogProblems(map, { entries }), `${game.id}/${map.id}`).toEqual([]);
    }
  });
});

for (const { game, map, demo } of MAPS) {
  describe(`contract: ${game.id}/${map.id}`, () => {
    it("space: bounds, grids, and the grids the contract names", () => {
      expect(map.space.bounds.w).toBeGreaterThan(0);
      for (const g of Object.values(map.space.grids)) {
        expect(g.size.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
      }
      const named = [
        map.selectionGrid,
        map.validation.grid,
        map.ui.grids().fine,
        ...map.ui.grids().snap.map((s) => s.grid),
        ...Object.values(map.layers).flatMap((l) => (l.kind === "grid" ? [l.grid] : [])),
      ];
      for (const n of named) expect(map.space.grids[n], n).toBeDefined();
    });

    it("a new doc names its game and map, and round-trips through the file format", () => {
      const doc = map.newDoc("contract", {}, NOW);
      expect([doc.game, doc.map]).toEqual([game.id, map.id]);
      expect(Object.keys(doc.layers)).toEqual(Object.keys(map.layers));
      expect(deepEqual(deserializeMap(serializeMap(doc, map), game), doc)).toBe(true);
      expect(deepEqual(decodeDoc(map.layers, map.space, encodeDoc(map.layers, doc)), doc)).toBe(
        true,
      );
    });

    it("files saved under a former game id, or before maps had ids, load as this map", () => {
      const text = serializeMap(map.newDoc("old", {}, NOW), map);
      for (const old of game.formerIds ?? []) {
        const renamed = text.replace(`"game": "${game.id}"`, `"game": "${old}"`);
        expect(renamed).toContain(old);
        expect(deserializeMap(renamed, game).game).toBe(game.id);
      }
      if (map.id === game.defaultMap) {
        const v2 = text
          .replace('"version": 3', '"version": 2')
          .replace(`  "map": "${map.id}",\n`, "");
        expect(v2).not.toContain('"map"');
        expect(deserializeMap(v2, game).map).toBe(map.id);
      }
    });

    it("rules run on an empty doc and on the demo map, both valid", () => {
      expect(validate(map.newDoc("empty", {}, NOW), map)).toEqual([]);
      expect(validate(demo(), map)).toEqual([]);
      expect(map.rulebook().length).toBeGreaterThanOrEqual(map.rules.length);
    });

    it("locates what every layer holds, in the map's grids", () => {
      const doc = demo();
      for (const [layer, spec] of Object.entries(map.layers)) {
        const at: ([number, number] | Entity)[] =
          spec.kind === "grid"
            ? [[0, 0]]
            : Object.values((doc.layers[layer] as { items: Record<string, Entity> }).items);
        for (const a of at) {
          const rects = map.locate(map, doc, layer, a);
          expect(rects.length, `${layer} ${JSON.stringify(a)}`).toBeGreaterThan(0);
          for (const r of rects) expect(map.space.grids[r.grid], r.grid).toBeDefined();
          validate(doc, map, { region: rects[0] });
        }
      }
    });

    it("rect input resolves to the map's grids", () => {
      const r = map.rect({ grid: map.selectionGrid, x: 0, y: 0 });
      expect(map.space.grids[r.grid]).toBeDefined();
      expect(r).toMatchObject({ w: 1, h: 1 });
    });

    it("can be seen in at least one view", () => {
      expect(Object.values(map.views).filter(Boolean).length).toBeGreaterThan(0);
    });

    it.runIf(map.views.scene)("3D: every chunk builds, with materials for every spec", () => {
      const scene = map.views.scene!;
      const doc = demo();
      const look = resolveLook(map.style.defaults);
      const mats = scene.materials(look, { flat: false, layers: {} });
      const chunks = scene.chunks(doc, map);
      expect(chunks.length).toBeGreaterThan(0);
      let meshes = 0;
      for (const id of chunks) {
        for (const spec of scene.buildChunk(doc, map, look, id) as (MeshSpec | InstancesSpec)[]) {
          expect(mats[spec.material], `${id}: material ${spec.material}`).toBeDefined();
          if (spec.kind === "mesh") {
            const a = spec.arrays;
            expect(a.position.length).toBe(3 * a.vertexCount);
            expect(a.normal.length).toBe(3 * a.vertexCount);
            let top = -1;
            for (const i of a.index) top = Math.max(top, i);
            expect(top).toBeLessThan(a.vertexCount);
            if (a.vertexCount) meshes++;
          } else {
            expect(spec.matrices.length).toBe(16 * spec.colors.length);
            // A unit primitive or the map's own geometry, well formed.
            expect(!!spec.primitive !== !!spec.geometry, `${id}: primitive or geometry`).toBe(true);
            if (spec.geometry) {
              const a = spec.geometry.arrays;
              expect(spec.geometry.key).not.toBe("");
              expect(a.position.length).toBe(3 * a.vertexCount);
              for (const i of a.index) expect(i).toBeLessThan(a.vertexCount);
            }
          }
        }
      }
      expect(meshes).toBeGreaterThan(0);
      const b = scene.bounds(doc, map, look);
      expect(b.x1).toBeGreaterThan(b.x0);
      const g = scene.ground(doc, map, look);
      expect(Number.isFinite(g(map.space.bounds.x + 0.5, map.space.bounds.y + 0.5))).toBe(true);
      expect(scene.chunksTouched(doc, doc, map)).toBeInstanceOf(Array);
    });

    it.runIf(map.views.plan)("plan: draws the map from above", () => {
      const calls: string[] = [];
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (t, k) => (k in t ? t[k as string] : (..._: unknown[]) => void calls.push(String(k))),
        set: (t, k, v) => ((t[k as string] = v), true),
      }) as unknown as CanvasRenderingContext2D;
      const g = globalThis as Record<string, unknown>;
      // A plan view may paint offscreen first: just enough of a canvas for that.
      g.document ??= { createElement: () => ({ getContext: () => ctx }) };
      g.ImageData ??= class {
        data: Uint8ClampedArray;
        constructor(w: number, h: number) {
          this.data = new Uint8ClampedArray(w * h * 4);
        }
      };
      try {
        map.views.plan!.draw(ctx, demo(), map, {}, map.space.bounds, 8);
      } finally {
        delete g.document;
        delete g.ImageData;
      }
      expect(calls.length).toBeGreaterThan(0);
    });

    it("UI: layers, grids, hover, and click selection", () => {
      const doc = demo();
      expect(map.ui.layerNames().length).toBeGreaterThan(0);
      expect(map.ui.grids().snap.length).toBeGreaterThan(0);
      const p = { x: map.space.bounds.x + 0.5, y: map.space.bounds.y + 0.5 };
      expect(map.ui.hover(doc, map, p).length).toBeGreaterThan(0);
      expect(map.ui.hover(doc, map, { x: -100, y: -100 })).toBe("off map");
      if (map.ui.clickSelect) {
        const sel = map.ui.clickSelect(doc, map, p);
        expect(sel === null || Array.isArray(sel.rects ?? [])).toBe(true);
      }
    });

    it("the style defaults validate and resolve", () => {
      expect(styleProblems(map.style.defaults, map.style)).toEqual([]);
      expect(resolveLook(map.style.defaults).preset.length).toBeGreaterThan(0);
    });
  });
}
