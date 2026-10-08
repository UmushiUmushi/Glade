// A map in three.js: give it a canvas, a map (bound to a catalog), a document and a look, and it
// runs the map's render formula. The map builds geometry per chunk (its scene view) as typed arrays
// and instanced primitives, and gives its materials as specs; this turns them into three.js
// objects, rebuilds only the chunks a change touched, and draws them on a stage with the look's
// sky, light, fog, curvature and post-processing. No UI: apps add their own overlays to
// `overlays`, and drive the cameras and input themselves.

import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";
import type { Bound, Doc } from "@glade/core";
import type {
  InstancesSpec,
  Look,
  MeshSpec,
  Primitive,
  Render3D,
  RenderableMap,
  RenderRequest,
} from "@glade/render";
import { capture, type CaptureHost } from "./capture";
import { geometryOf, unitGeometry } from "./geometry";
import { MaterialSet, shared, texturesReady } from "./materials";
import { rayPlaneY, type V3 } from "./pick";
import { Stage } from "./stage";

/** How to draw a look: flat colors or shaded, and whether the world curves. */
export interface LookOptions {
  flat: boolean;
  curvature: boolean;
}

/** For a capture: the look for a preset, season or time, and how to put the live look back. */
export interface CaptureLooks {
  lookFor(preset?: string, season?: string, time?: number): Look;
  restore(): void;
}

export class MapScene {
  readonly stage: Stage;
  /**
   * Drawn over the map and left out of captures unless asked for: the map's own overlay meshes
   * (MeshSpec.overlay) and anything an app adds (selection, hover, violations).
   */
  readonly overlays = new Group();
  /** How long the last rebuild took, and how many chunks it built. */
  lastBuild = { ms: 0, chunks: 0 };

  map: Bound<RenderableMap> | null = null;
  doc: Doc | null = null;
  look: Look | null = null;
  /** The map's ground height at a world point, in 3D units, for the current doc and look. */
  ground: ((x: number, y: number) => number) | null = null;

  private r3: Render3D | null = null;
  private readonly mats = new MaterialSet();
  private readonly primitives = new Map<Primitive, BufferGeometry>();
  /** The map's own instanced geometries by key, with how many meshes use each. */
  private readonly owned = new Map<string, { geometry: BufferGeometry; users: number }>();
  private readonly ownedKeys = new Map<Object3D, string>();
  /** One group per layer toggle ("" = always shown), and one for the map's overlay meshes. */
  private readonly layerGroups = new Map<string, Group>();
  private readonly overlayGroups = new Map<string, Group>();
  private readonly mapOverlays = new Group();
  private readonly chunks = new Map<string, Object3D[]>();
  private readonly pickables = new Set<Object3D>();
  private layers: Record<string, boolean> = {};
  private options: LookOptions = { flat: false, curvature: true };
  private floor: number | null = null;
  private geomKey = "";
  private built: Doc | null = null;
  private readonly ray = new Raycaster();
  private readonly ndc = new Vector2();

  constructor(readonly canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    this.stage.renderer.localClippingEnabled = false;
    this.overlays.add(this.mapOverlays);
    this.stage.scene.add(this.overlays);
  }

  /**
   * Shows a map. Another map starts over; the same map with another catalog rebuilds every chunk,
   * since any may draw from it (path colors, items).
   */
  setMap(map: Bound<RenderableMap>): void {
    const prev = this.map;
    this.map = map;
    if (prev && prev.game === map.game && prev.id === map.id) {
      if (map.catalog !== prev.catalog) this.built = null;
    } else {
      for (const id of [...this.chunks.keys()]) this.dropChunk(id);
      if (!map.views.scene) throw new Error(`${map.game}/${map.id} has no 3D view`);
      this.r3 = map.views.scene;
      this.built = null;
      this.geomKey = "";
      this.applyFloor();
    }
    this.rebuild();
  }

  /** Shows a document of the map, rebuilding only the chunks it changed. Returns their ids. */
  setDoc(doc: Doc): string[] {
    this.doc = doc;
    return this.rebuild();
  }

  /** Draws with a look; rebuilds every chunk when its geometry or a material program changed. */
  setLook(look: Look, options: LookOptions): void {
    this.look = look;
    this.options = options;
    const programs = this.applyLook(look, options);
    const key = this.r3?.geometryKey(look) ?? "";
    if (programs || key !== this.geomKey) {
      this.geomKey = key;
      this.built = null;
    }
    this.rebuild();
  }

  /** Shows and hides the map's layers (and their materials, which may depend on them). */
  setLayers(layers: Record<string, boolean>): void {
    this.layers = layers;
    for (const [layer, g] of this.layerGroups) g.visible = this.shown(layer);
    for (const [layer, g] of this.overlayGroups) g.visible = this.shown(layer);
    if (this.look) this.applyMaterials(this.look, this.options.flat);
  }

  /** Clips everything above a floor (maps with floors), or nothing (null). */
  setFloor(floor: number | null): void {
    this.floor = floor;
    this.applyFloor();
  }

  /** World point under a screen point (pickable meshes only), with the hit's 3D height. */
  pick(clientX: number, clientY: number): { p: { x: number; y: number }; y: number } | null {
    if (!this.map || !this.r3) return null;
    const hit = this.castAt(clientX, clientY).intersectObjects([...this.pickables], false)[0];
    if (!hit || !hit.face) return null;
    const n = hit.face.normal;
    const w = this.r3.pick(
      { point: [hit.point.x, hit.point.y, hit.point.z], normal: [n.x, n.y, n.z] },
      this.map,
    );
    return { p: { x: w.x, y: w.y }, y: hit.point.y };
  }

  /** World point on the horizontal plane at 3D height y under a screen point, on the map. */
  pickPlane(clientX: number, clientY: number, y: number): { x: number; y: number } | null {
    if (!this.map || !this.r3) return null;
    const r = this.castAt(clientX, clientY).ray;
    const p = rayPlaneY(
      [r.origin.x, r.origin.y, r.origin.z],
      [r.direction.x, r.direction.y, r.direction.z],
      y,
    ) as V3 | null;
    if (!p) return null;
    const B = this.map.space.bounds;
    const clamp = (v: number, lo: number, len: number) =>
      Math.min(lo + len - 1e-6, Math.max(lo, v));
    return { x: clamp(p[0] / this.r3.scale, B.x, B.w), y: clamp(p[2] / this.r3.scale, B.y, B.h) };
  }

  /** 3D units per world unit. */
  get scale(): number {
    return this.r3?.scale ?? 1;
  }

  /** 3D ground height under a 3D point (x, z). */
  groundAt(x: number, z: number): number {
    return this.ground && this.r3 ? this.ground(x / this.r3.scale, z / this.r3.scale) : 0;
  }

  /** Advances animations and draws a frame. */
  render(dt: number): void {
    this.stage.tick(dt);
    this.stage.render();
  }

  /** Draws the map offscreen as a request asks (a camera, a look, a size) and returns PNG data. */
  async capture(req: RenderRequest, looks: CaptureLooks): Promise<string> {
    const { map, r3, ground } = this;
    if (!map || !r3 || !ground || !this.look) throw new Error("no map, document and look yet");
    await texturesReady();
    const host: CaptureHost = {
      stage: this.stage,
      space: map.space,
      fine: map.ui.grids().fine,
      ground,
      scale: r3.scale,
      overlays: this.overlays,
      applyLook: (l, opts) => void this.applyLook(l, opts),
      lookFor: looks.lookFor,
      restore: looks.restore,
    };
    return capture(host, req);
  }

  /** The scene's parts by name, for poking at from a browser console. */
  debug(): Record<string, unknown> {
    return {
      stage: this.stage,
      layerGroups: this.layerGroups,
      mats: this.mats,
      chunks: this.chunks,
    };
  }

  // ---- building ----

  private shown(layer: string): boolean {
    return !layer || this.layers[layer] !== false;
  }

  private unit(p: Primitive): BufferGeometry {
    let g = this.primitives.get(p);
    if (!g) this.primitives.set(p, (g = unitGeometry(p)));
    return g;
  }

  private shapeOf(spec: InstancesSpec): BufferGeometry | null {
    if (!spec.geometry) return spec.primitive ? this.unit(spec.primitive) : null;
    const { key, arrays } = spec.geometry;
    let o = this.owned.get(key);
    if (!o) {
      const geometry = geometryOf(arrays);
      geometry.computeBoundingSphere();
      this.owned.set(key, (o = { geometry, users: 0 }));
    }
    o.users++;
    return o.geometry;
  }

  private releaseShape(mesh: Object3D): void {
    const key = this.ownedKeys.get(mesh);
    if (key === undefined) return;
    this.ownedKeys.delete(mesh);
    const o = this.owned.get(key);
    if (o && --o.users <= 0) {
      o.geometry.dispose();
      this.owned.delete(key);
    }
  }

  private groupFor(layer: string, overlay: boolean): Group {
    const groups = overlay ? this.overlayGroups : this.layerGroups;
    let g = groups.get(layer);
    if (!g) {
      groups.set(layer, (g = new Group()));
      (overlay ? this.mapOverlays : this.stage.scene).add(g);
      g.visible = this.shown(layer);
    }
    return g;
  }

  private dropChunk(id: string): void {
    for (const o of this.chunks.get(id) ?? []) {
      o.parent?.remove(o);
      this.pickables.delete(o);
      this.releaseShape(o);
      if (o instanceof InstancedMesh) o.dispose();
      else if (o instanceof Mesh) o.geometry.dispose();
    }
    this.chunks.delete(id);
  }

  private addMesh(spec: MeshSpec, out: Object3D[]): void {
    const mat = this.mats.get(spec.material);
    if (!spec.arrays.vertexCount || !mat) return;
    const geometry = geometryOf(spec.arrays);
    geometry.computeBoundingSphere();
    const m = new Mesh(geometry, mat);
    m.castShadow = !!spec.castShadow;
    m.receiveShadow = !!spec.receiveShadow;
    if (spec.renderOrder !== undefined) m.renderOrder = spec.renderOrder;
    const outline = this.mats.get("outline");
    if (spec.outline && outline) m.add(new Mesh(geometry, outline));
    if (spec.pickable) this.pickables.add(m);
    this.groupFor(spec.layer, !!spec.overlay).add(m);
    out.push(m);
  }

  private addInstances(spec: InstancesSpec, out: Object3D[]): void {
    const mat = this.mats.get(spec.material);
    const count = spec.colors.length;
    if (!count || !mat || (!spec.primitive && !spec.geometry)) return;
    const mesh = new InstancedMesh(this.shapeOf(spec)!, mat, count);
    if (spec.geometry) this.ownedKeys.set(mesh, spec.geometry.key);
    const m4 = new Matrix4();
    const color = new Color();
    for (let i = 0; i < count; i++) {
      m4.fromArray(spec.matrices, i * 16);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, color.set(spec.colors[i]));
    }
    mesh.castShadow = spec.castShadow ?? true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const group = this.groupFor(spec.layer, false);
    group.add(mesh);
    out.push(mesh);
    const outline = this.mats.get("outline");
    if (spec.outline && outline) {
      const hull = new InstancedMesh(mesh.geometry, outline, count);
      hull.instanceMatrix = mesh.instanceMatrix;
      hull.frustumCulled = false;
      group.add(hull);
      out.push(hull);
    }
  }

  private buildChunk(id: string): void {
    const { map, r3, look, doc } = this;
    if (!map || !r3 || !look || !doc) return;
    this.dropChunk(id);
    const out: Object3D[] = [];
    for (const spec of r3.buildChunk(doc, map, look, id)) {
      if (spec.kind === "mesh") this.addMesh(spec, out);
      else this.addInstances(spec, out);
    }
    this.chunks.set(id, out);
  }

  /** Rebuilds what changed since the last build (everything when nothing was built). */
  private rebuild(): string[] {
    const { doc, map, r3, look } = this;
    if (!doc || !map || !r3 || !look) return [];
    const t0 = performance.now();
    this.stage.world = r3.bounds(doc, map, look);
    this.ground = r3.ground(doc, map, look);
    // Materials first: chunks name them, and a document may bring new ones (a room's wallpaper).
    const programs = this.applyMaterials(look, this.options.flat);
    const all = !this.built || programs;
    const ids = all ? r3.chunks(doc, map) : r3.chunksTouched(this.built!, doc, map);
    if (all) for (const id of [...this.chunks.keys()]) this.dropChunk(id);
    for (const id of ids) this.buildChunk(id);
    this.built = doc;
    this.setLayers(this.layers);
    this.stage.renderer.shadowMap.needsUpdate = true;
    this.lastBuild = { ms: performance.now() - t0, chunks: ids.length };
    return ids;
  }

  /** Materials for a look, the flat setting and the layer toggles; true if a program changed. */
  private applyMaterials(look: Look, flat: boolean): boolean {
    if (!this.r3) return false;
    shared.uFlat.value = flat ? 1 : 0;
    const { doc, map } = this;
    const opts = { flat, layers: this.layers, ...(doc && map ? { doc, game: map } : {}) };
    return this.mats.apply(this.r3.materials(look, opts));
  }

  private applyLook(look: Look, opts: LookOptions): boolean {
    const changed = this.applyMaterials(look, opts.flat);
    this.stage.applyLook(
      look,
      opts.curvature && this.r3?.capabilities.curvature !== false,
      opts.flat,
    );
    return changed;
  }

  private applyFloor(): void {
    const floors = this.map?.space.floors;
    if (!floors || !this.r3?.capabilities.floors || this.floor === null) {
      this.stage.renderer.clippingPlanes = [];
      return;
    }
    const y = (this.floor + 1) * floors.height * this.r3.scale;
    this.stage.renderer.clippingPlanes = [new Plane(new Vector3(0, -1, 0), y)];
  }

  private castAt(clientX: number, clientY: number): Raycaster {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
    return this.ray;
  }
}
