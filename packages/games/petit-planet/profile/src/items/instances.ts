// Instancing the item formula's models in 3D, for every map of the game: models are flattened
// into solids; a box, cylinder, cone or sphere becomes one instance of the host's unit primitive,
// and any other solid (a rounded box, a wedge, a dome, a torus, a mesh...) gets its own geometry,
// built once per shape and instanced wherever it appears. Groups are kept by finish and shape;
// instanceSpecs turns them into the render format's instance specs, one material per finish.

import {
  chain,
  flattenModel,
  footprintTurn,
  geometryKey,
  instancedShape,
  multiply,
  partGeometry,
  scaling,
  translation,
  unitMatrix,
  type Finish,
  type InstancesSpec,
  type Mat4,
  type MeshArrays,
  type Model,
  type ModelLeaf,
  type Primitive,
  type Turn,
} from "@glade/render";

/** The solid primitives plants and items are built from. */
export type Solid = Exclude<Primitive, "quad">;
export const PRIMITIVES: Solid[] = ["box", "cylinder", "cone", "sphere"];

export interface InstanceList {
  /** Column-major 4x4 matrices, 16 floats each. */
  matrices: number[];
  /** "#rrggbb" per instance. */
  colors: string[];
}

/** Instances of one shape in one finish: a unit primitive, or geometry of its own. */
export interface InstanceGroup extends InstanceList {
  finish: Finish;
  primitive?: Solid;
  geometry?: { key: string; arrays: MeshArrays };
}

/**
 * Instance groups by key: "box", "cylinder", "cone" and "sphere" are the matte unit primitives
 * (always there, maybe empty); other finishes are "<finish> <primitive>", and solids with their own
 * geometry "<finish> <geometry key>".
 */
export type LayerInstances = Record<string, InstanceGroup>;

/** Empty instance groups: the four matte unit primitives, each with no instances yet. */
export const emptyInstances = (): LayerInstances =>
  Object.fromEntries(
    PRIMITIVES.map((p) => [p, { finish: "matte", primitive: p, matrices: [], colors: [] }]),
  );

/**
 * World placement of a model: its footprint turned by rot, top-left at (x, z) in half tiles (the
 * 3D units of every map of the game), standing at height `ground`.
 */
export function placement(
  x: number,
  ground: number,
  z: number,
  rot: Turn,
  w: number,
  d: number,
): Mat4 {
  // Tiles are 2 world units, and true-space y is in tiles too.
  return chain(translation(x, ground, z), scaling(2, 2, 2), footprintTurn(rot, w, d));
}

const FLIP_X = scaling(-1, 1, 1);

/** Adds leaves to a layer's instance groups; geometry of a shape is built once per build. */
export class Instancer {
  private readonly shapes = new Map<string, { key: string; arrays: MeshArrays }>();

  constructor(private readonly blockSize: number) {}

  private group(out: LayerInstances, key: string, g: Omit<InstanceGroup, "matrices" | "colors">) {
    return (out[key] ??= { ...g, matrices: [], colors: [] });
  }

  /** One solid, its model placed in the world by `place`. */
  leaf(out: LayerInstances, leaf: ModelLeaf, place: Mat4): void {
    const p = leaf.part;
    const finish = p.finish ?? "matte";
    const unit = instancedShape(p);
    if (unit) {
      const key = finish === "matte" ? unit : `${finish} ${unit}`;
      const g = this.group(out, key, { finish, primitive: unit });
      g.matrices.push(...multiply(place, unitMatrix(leaf, this.blockSize)));
      g.colors.push(p.color);
      return;
    }
    const shapeKey = geometryKey(p, this.blockSize, leaf.mirrored);
    let geometry = this.shapes.get(shapeKey);
    if (!geometry) {
      const t = partGeometry(p, this.blockSize, leaf.mirrored);
      const arrays: MeshArrays = {
        position: new Float32Array(t.position),
        normal: new Float32Array(t.normal),
        index: new Uint32Array(t.index),
        attributes: {},
        vertexCount: t.position.length / 3,
      };
      this.shapes.set(shapeKey, (geometry = { key: `pp-part ${shapeKey}`, arrays }));
    }
    const g = this.group(out, `${finish} ${shapeKey}`, { finish, geometry });
    const frame = leaf.mirrored ? multiply(leaf.frame, FLIP_X) : leaf.frame;
    g.matrices.push(...multiply(place, frame));
    g.colors.push(p.color);
  }

  /** Every solid of a model. */
  model(out: LayerInstances, model: Model, place: Mat4): void {
    for (const leaf of flattenModel(model, { blockSize: this.blockSize })) {
      this.leaf(out, leaf, place);
    }
  }
}

/**
 * A layer's instance groups as instance specs, each finish drawn with the material `materialOf`
 * names. Glass shows what is behind it: no outline, and no shadow.
 */
export function instanceSpecs(
  layer: string,
  inst: LayerInstances,
  materialOf: (finish: Finish) => string,
): InstancesSpec[] {
  return Object.values(inst)
    .filter((g) => g.colors.length)
    .map((g) => ({
      kind: "instances",
      layer,
      material: materialOf(g.finish),
      ...(g.geometry ? { geometry: g.geometry } : { primitive: g.primitive }),
      matrices: g.matrices,
      colors: g.colors,
      outline: g.finish !== "glass",
      castShadow: g.finish !== "glass",
    }));
}
