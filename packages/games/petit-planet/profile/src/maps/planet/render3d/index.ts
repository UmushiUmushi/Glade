// Petit Planet in 3D. 3D units: x = minor x, z = minor y, so the scale is 2 per world tile; y =
// level * heightScale. Chunks: one per area ("t:cx,cy": terrain faces, the lawn, the cushions and
// their leaf stamps, contact shading, paths, water), "objects" (instanced plants and items, one
// material per finish: matte, glow, glass), "sea", and "landmarks" (an overlay). The host turns the
// specs into meshes and materials.

import type { Finish, MeshArrays, V3 } from "@glade/render";
import type { InstancesSpec, MeshSpec, Render3D, RenderableMap } from "@glade/render";
import { QuadBuilder } from "@glade/render";
import type { MapDoc } from "../model";
import { profile, profileOf } from "../data";
import { gridSpec, type Planet } from "../profile";
import { toMinorRect } from "../space";
import type { Look } from "../style";
import { materials } from "./materials";
import { appModel } from "../../../items";
import { instanceSpecs, type LayerInstances } from "../../../items/instances";
import { buildInstances } from "./objects";
import { buildPathChunk } from "./paths";
import type { LeafList } from "./land";
import { hitToMinor } from "./pick";
import {
  allChunks,
  buildContactChunk,
  buildCushionChunk,
  buildTerrainChunk,
  chunkKey,
  dirtyChunks,
  geomLook,
  sampler,
} from "./terrain";
import { buildWaterChunk } from "./water";

const SCALE = 2;

const asLook = (l: unknown) => l as Look;
const T = (key: string) => `t:${key}`;

/** A flat plane around the island, fine enough to bend with curvature (6000 x 6000, 150 x 150). */
/**
 * The sea: a disc around the island, centered on the map and reaching well past the beach, so that
 * on a flat world the sky shows beyond it (on a curved one it bends away first).
 */
function seaPlane(level: number, w: number, h: number): MeshArrays {
  const b = new QuadBuilder({});
  const [cx, cz] = [w / 2, h / 2];
  const radius = Math.hypot(w, h) * 0.75;
  const rings = 24;
  const segs = 96;
  const at = (r: number, k: number): V3 => {
    const a = (k / segs) * Math.PI * 2;
    return [cx + Math.cos(a) * r, level, cz + Math.sin(a) * r];
  };
  for (let i = 0; i < rings; i++) {
    const [r0, r1] = [(radius * i) / rings, (radius * (i + 1)) / rings];
    for (let k = 0; k < segs; k++) {
      b.quad([at(r0, k), at(r1, k), at(r1, k + 1), at(r0, k + 1)], [0, 1, 0], {});
    }
  }
  return b.finish();
}

/** Landmark slabs, one quad per base cell so they bend with the ground under curvature. */
function landmarkSlabs(doc: MapDoc, game: Planet, look: Look): MeshArrays {
  const spec = gridSpec(profileOf(game));
  const s = sampler(doc, profileOf(game), geomLook(look), spec);
  const b = new QuadBuilder({});
  for (const lm of profileOf(game).landmarks) {
    const y =
      (lm.lockLevel !== undefined ? s.ground(lm.x + 1, lm.y + 1) : s.ground(lm.x, lm.y)) + 0.05;
    for (let Y = lm.y; Y < lm.y + lm.h; Y++) {
      for (let X = lm.x; X < lm.x + lm.w; X++) {
        const r = toMinorRect(spec, { grid: "major", x: X, y: Y, w: 1, h: 1 });
        if (!r.w || !r.h) continue;
        const [x0, x1, z0, z1] = [r.x, r.x + r.w, r.y, r.y + r.h];
        b.quad(
          [
            [x0, y, z0],
            [x1, y, z0],
            [x1, y, z1],
            [x0, y, z1],
          ],
          [0, 1, 0],
          {},
        );
      }
    }
  }
  return b.finish();
}

/** Leaf stamps (leaves.ts): they turn to the camera in their material, so they cast no shadow. */
function leafSpec(layer: string, l: LeafList): InstancesSpec[] {
  if (!l.colors.length) return [];
  return [
    {
      kind: "instances",
      layer,
      material: "leaves",
      primitive: "quad",
      matrices: l.matrices,
      colors: l.colors,
      castShadow: false,
    },
  ];
}

/** The material each finish draws with. */
export const FINISH_MATERIAL: Record<Finish, string> = {
  matte: "objects",
  glow: "objects-glow",
  glass: "objects-glass",
};

const instances = (layer: string, inst: LayerInstances) =>
  instanceSpecs(layer, inst, (f) => FINISH_MATERIAL[f]);

export const render3d: Render3D = {
  scale: SCALE,
  capabilities: { curvature: true },

  chunks(_doc, g) {
    const spec = gridSpec(profileOf(g as Planet));
    return [...allChunks(spec).map((c) => T(chunkKey(c.cx, c.cy))), "objects", "sea", "landmarks"];
  },

  chunksTouched(prev, next, g) {
    if (!prev) return this.chunks(next, g);
    const spec = gridSpec(profileOf(g as Planet));
    return [...dirtyChunks(spec, prev as MapDoc, next as MapDoc)].map(T).concat("objects");
  },

  geometryKey(look) {
    const l = asLook(look);
    return JSON.stringify([geomLook(l), l.world.sea ?? null, l.units.heightScale]);
  },

  buildChunk(doc, g, look, chunk) {
    const game = g as Planet;
    const map = doc as MapDoc;
    const l = asLook(look);
    const spec = gridSpec(profileOf(game));
    const geom = geomLook(l);
    if (chunk === "objects") {
      const catalog = game.catalog;
      const inst = buildInstances(
        map,
        catalog,
        sampler(map, profileOf(game), geom, spec),
        geom.heightScale,
        {
          land: geom.land,
          heightScale: geom.heightScale,
          baseLevel: profileOf(game).land.defaultLevel,
        },
        (thing) => appModel(game as Planet & RenderableMap, thing),
      );
      return [
        ...instances("plants", inst.plants),
        ...instances("items", inst.items),
        ...leafSpec("plants", inst.plantLeaves),
        ...leafSpec("items", inst.itemLeaves),
      ];
    }
    if (chunk === "sea") {
      const sea = l.world.sea;
      if (!sea?.enabled) return [];
      const arrays = seaPlane(
        (sea.level ?? -0.35) * l.units.heightScale,
        spec.majorW * 2,
        spec.majorH * 2,
      );
      return [{ kind: "mesh", layer: "", material: "sea", arrays, receiveShadow: true }];
    }
    if (chunk === "landmarks") {
      const arrays = landmarkSlabs(map, game, l);
      return [
        {
          kind: "mesh",
          layer: "landmarks",
          material: "landmark",
          arrays,
          overlay: true,
          renderOrder: 4,
        },
      ];
    }
    const [cx, cy] = chunk.slice(2).split(",").map(Number);
    const c = { cx, cy };
    const mesh = (m: Omit<MeshSpec, "kind">): MeshSpec => ({ kind: "mesh", ...m });
    const cushion = buildCushionChunk(map, profileOf(game), geom, spec, c);
    const paths = buildPathChunk(map, profileOf(game), game.catalog, geom, spec, c);
    const terrain = buildTerrainChunk(map, profileOf(game), geom, spec, c);
    return [
      mesh({
        layer: "",
        material: "terrain",
        arrays: terrain,
        castShadow: true,
        receiveShadow: true,
        outline: true,
        pickable: true,
      }),
      mesh({
        layer: "",
        material: "lawn",
        arrays: terrain.lawn,
        castShadow: true,
        receiveShadow: true,
        pickable: true,
      }),
      mesh({ layer: "", material: "fringe", arrays: cushion, receiveShadow: true }),
      ...leafSpec("", cushion.leaves),
      ...leafSpec("paths", paths.leaves),
      mesh({
        layer: "",
        material: "contact",
        arrays: buildContactChunk(map, profileOf(game), geom, spec, c),
        renderOrder: 1,
      }),
      mesh({
        layer: "paths",
        material: "paths",
        arrays: paths,
        receiveShadow: true,
      }),
      mesh({
        layer: "water",
        material: "water",
        arrays: buildWaterChunk(map, profileOf(game), geom, spec, c),
        receiveShadow: true,
        renderOrder: 2,
      }),
    ];
  },

  materials(look, opts) {
    return materials(asLook(look), opts, profile.land.defaultLevel);
  },

  pick(hit, g) {
    const p = hitToMinor(hit.point as V3, hit.normal as V3, gridSpec(profileOf(g as Planet)));
    return { x: p.x / SCALE, y: p.y / SCALE };
  },

  ground(doc, g, look) {
    const game = g as Planet;
    const s = sampler(
      doc as MapDoc,
      profileOf(game),
      geomLook(asLook(look)),
      gridSpec(profileOf(game)),
    );
    // The terrain block under a world point: block t covers world t - 0.5 .. t + 0.5.
    return (x, y) => s.ground(Math.floor(x + 0.5), Math.floor(y + 0.5));
  },

  bounds(_doc, g) {
    const p = profileOf(g as Planet);
    return { x0: 0, x1: p.major.w * SCALE, z0: 0, z1: p.major.h * SCALE, y0: 0, y1: p.maxHeight };
  },
};
