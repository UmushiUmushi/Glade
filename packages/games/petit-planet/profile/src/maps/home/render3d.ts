// A home in 3D. Each room is a chunk: its floor, its walls (an inner face and a top edge, with a
// gap and a door for each doorway), and what stands, sits, hangs and is hung in it. A wall, its
// doors and the items on it hide while the camera is behind the wall, outside the room: a room
// shows like a diorama from any side, and from inside every wall shows. Floors and walls take
// their room's flooring and wallpaper (coverings.ts); plants and items come from the item
// formula. 3D units: x = 2 x world x and z = 2 x world y (half tiles), y = blocks x heightScale.

import type { Bound, Doc } from "@glade/core";
import {
  modelBounds,
  QuadBuilder,
  type Finish,
  type InstancesSpec,
  type MaterialSpec,
  type MeshSpec,
  type Render3D,
  type RenderableMap,
  type TextureValue,
  type V3,
} from "@glade/render";
import { catalogEntry, type Catalog, type Pattern } from "../../catalog";
import { appModel, itemModel, itemSize } from "../../items";
import {
  emptyInstances,
  Instancer,
  instanceSpecs,
  placement,
  type LayerInstances,
} from "../../items/instances";
import { patternKey, patternTexture } from "../../items/pattern";
import { onSurfaceBox, onSurfaces, type Turn } from "../../surfaces";
import { patternU, roomCoverings } from "./coverings";
import {
  doorsOn,
  inward,
  layoutBounds,
  roomRect,
  SIDES,
  wallLength,
  wallPoint,
  type HomeLayout,
  type Room,
  type Side,
} from "./layout";
import { ceilingItems, floorItems, homeHosts, planeRect, wallItems, wallRect } from "./model";
import type { HomeColors, HomeLook } from "./style";

const SCALE = 2;
/** Tiles a wall's top edge reaches out past its face. */
const EDGE = 0.2;
/** How far a door sits behind its wall's face, in tiles. */
const DOOR_INSET = 0.05;

type Home = Bound<RenderableMap>;

const asLook = (l: unknown) => l as HomeLook;
const ROOM = (id: string) => `room:${id}`;

/** A wall's side by the way its item faces: its model faces south at rotation 0. */
const FACING: Record<Side, Turn> = { north: 0, east: 90, south: 180, west: 270 };

/** A white 1 x 1 texture: what a floor or wall without a covering samples. */
const WHITE: TextureValue = {
  texture: { key: "pp-white", width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) },
};

/** The material a covered surface or a wall's item draws with. */
const surfaceName = (what: string, room: string, side?: Side) =>
  side ? `${what}:${room}:${side}` : `${what}:${room}`;
const OBJECT_MATERIAL: Record<Finish, string> = {
  matte: "objects",
  glow: "objects-glow",
  glass: "objects-glass",
};

// A plane a material hides behind: (normal into the room, -normal . point). The camera is in the
// room's half when normal . camera + w >= 0. (0, 0, 0, 1): never hides.
type HidePlane = [number, number, number, number];
const NEVER: HidePlane = [0, 0, 0, 1];

const HIDE_PARS = "#include <common>\nuniform vec4 uHide;";
const HIDE_TEST = "void main() {\n  if (dot(uHide.xyz, cameraPosition) + uHide.w < 0.0) discard;";

const PATTERN_VERTEX: [string, string][] = [
  ["#include <common>", "#include <common>\nattribute vec2 puv;\nvarying vec2 vPuv;"],
  ["#include <begin_vertex>", "#include <begin_vertex>\nvPuv = puv;"],
];

const PATTERN_FRAGMENT: [string, string][] = [
  ["#include <common>", `${HIDE_PARS}\nuniform sampler2D uPattern;\nvarying vec2 vPuv;`],
  ["void main() {", HIDE_TEST],
  // The sheet's texels are sRGB.
  [
    "#include <color_fragment>",
    "#include <color_fragment>\ndiffuseColor.rgb *= pow(texture2D(uPattern, vPuv).rgb, vec3(2.2));",
  ],
];

const OBJECT_FRAGMENT: [string, string][] = [
  ["#include <common>", HIDE_PARS],
  ["void main() {", HIDE_TEST],
];

const GLOW_FRAGMENT: [string, string][] = [
  ["#include <common>", `${HIDE_PARS}\nuniform vec3 uGlow;\nuniform float uFlat;`],
  ["void main() {", HIDE_TEST],
  [
    "#include <emissivemap_fragment>",
    "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow * (1.0 - uFlat);",
  ],
];

/** A home's 3D view, for its layout. */
export function homeScene(layout: HomeLayout): Render3D {
  const bounds = layoutBounds(layout);
  const room = (id: string) => layout.rooms.find((r) => r.id === id);
  /** 3D x and z of a point on the plane, in tiles. */
  const at = (x: number, y: number): [number, number] => [SCALE * x, SCALE * y];
  /** Half-tile grid indices (as items store them) to tiles on the plane. */
  const tiles = (mx: number, my: number): [number, number] => [
    bounds.x + mx / 2,
    bounds.y + my / 2,
  ];

  /** The plane a wall hides behind. */
  function hidePlane(r: Room, side: Side): HidePlane {
    const p = wallPoint(r, side, 0);
    const [nx, nz] = inward(side);
    const [px, pz] = at(p.x, p.y);
    return [nx, 0, nz, -(nx * px + nz * pz)];
  }

  /** A room's floor, with its flooring's pattern coordinates. */
  function floorMesh(r: Room): MeshSpec {
    const t = roomRect(r);
    const b = new QuadBuilder({ puv: 2 });
    const corner = (x: number, y: number): [V3, number[]] => {
      const [X, Z] = at(x, y);
      // Copies run across (u) and up the page (v: north), seams on the room's middle lines.
      return [
        [X, 0, Z],
        [patternU(x - t.x, t.w), -patternU(y - t.y, t.h)],
      ];
    };
    const c = [
      corner(t.x, t.y),
      corner(t.x + t.w, t.y),
      corner(t.x + t.w, t.y + t.h),
      corner(t.x, t.y + t.h),
    ];
    b.quad([c[0][0], c[1][0], c[2][0], c[3][0]], [0, 1, 0], { puv: c.map(([, uv]) => uv) });
    return {
      kind: "mesh",
      layer: "floor",
      material: surfaceName("floor", r.id),
      arrays: b.finish(),
      receiveShadow: true,
      pickable: true,
    };
  }

  /** A wall's inner face (with gaps for its doors), its top edge, and its doors. */
  function wallMeshes(r: Room, side: Side, heightScale: number): MeshSpec[] {
    const len = wallLength(r, side);
    const H = r.wallHeight;
    const [nx, nz] = inward(side);
    const n: V3 = [nx, 0, nz];
    const face = new QuadBuilder({ puv: 2 });
    const edge = new QuadBuilder({});
    const door = new QuadBuilder({});
    const point = (s: number, h: number, out = 0): V3 => {
      const p = wallPoint(r, side, s);
      const [X, Z] = at(p.x - nx * out, p.y - nz * out);
      return [X, h * heightScale, Z];
    };
    /** A rect of the face, across s0..s1 and up h0..h1 (blocks), with wallpaper coordinates. */
    const rect = (s0: number, s1: number, h0: number, h1: number) =>
      face.quad([point(s0, h0), point(s1, h0), point(s1, h1), point(s0, h1)], n, {
        puv: [
          [patternU(s0, len), h0 / H],
          [patternU(s1, len), h0 / H],
          [patternU(s1, len), h1 / H],
          [patternU(s0, len), h1 / H],
        ],
      });
    let s = 0;
    for (const d of [...doorsOn(r, side).sort((a, b) => a.s0 - b.s0), { s0: len, s1: len, h: 0 }]) {
      if (d.s0 > s) rect(s, d.s0, 0, H);
      if (d.s1 > d.s0) {
        rect(d.s0, d.s1, d.h, H);
        door.quad(
          [
            point(d.s0, 0, DOOR_INSET),
            point(d.s1, 0, DOOR_INSET),
            point(d.s1, d.h, DOOR_INSET),
            point(d.s0, d.h, DOOR_INSET),
          ],
          n,
          {},
        );
      }
      s = d.s1;
    }
    edge.quad([point(0, H), point(len, H), point(len, H, EDGE), point(0, H, EDGE)], [0, 1, 0], {});
    const mesh = (material: string, b: QuadBuilder): MeshSpec => ({
      kind: "mesh",
      layer: "walls",
      material,
      arrays: b.finish(),
      receiveShadow: true,
    });
    return [
      mesh(surfaceName("wall", r.id, side), face),
      mesh(surfaceName("edge", r.id, side), edge),
      mesh(surfaceName("door", r.id, side), door),
    ];
  }

  /** What stands, sits, hangs and is hung in a room, as instances. */
  function objects(doc: Doc, home: Home, r: Room, heightScale: number): InstancesSpec[] {
    const catalog = home.catalog as Catalog;
    const inst = new Instancer(heightScale / 2);
    const floor = emptyInstances();
    const ceiling = emptyInstances();
    const walls = new Map<Side, LayerInstances>(SIDES.map((s) => [s, emptyInstances()]));
    const t = roomRect(r);
    const inRoom = (x: number, y: number) => x >= t.x && y >= t.y && x < t.x + t.w && y < t.y + t.h;
    const top = (type: string) =>
      modelBounds(itemModel(catalog, type), { blockSize: heightScale / 2 })?.y1 ?? 0;

    for (const i of floorItems(doc)) {
      const p = planeRect(catalog, i);
      const [x, y] = tiles(p.x, p.y);
      if (!inRoom(x + 0.01, y + 0.01)) continue;
      const { w, d } = itemSize(catalogEntry(catalog, i.type));
      const model = itemModel(catalog, i.type, { model: appModel(home, i) });
      const [X, Z] = at(x, y);
      inst.model(floor, model, placement(X, 0, Z, i.rot, w, d));
    }
    const hosts = homeHosts(doc, catalog);
    for (const thing of onSurfaces(doc)) {
      const host = hosts.get(thing.on);
      const b = host && onSurfaceBox(catalog, host, thing);
      if (!host || !b) continue;
      const [hx, hy] = tiles(host.rect.x, host.rect.y);
      if (!inRoom(hx + 0.01, hy + 0.01)) continue;
      const { w, d } = itemSize(catalogEntry(catalog, thing.type));
      const [tw, td] = b.rot === 90 || b.rot === 270 ? [d, w] : [w, d];
      const [cx, cy] = tiles(b.x + b.w / 2, b.y + b.h / 2);
      const [X, Z] = at(cx - tw / 2, cy - td / 2);
      const model = itemModel(catalog, thing.type, { model: appModel(home, thing) });
      inst.model(floor, model, placement(X, top(host.type) * heightScale, Z, b.rot, w, d));
    }
    for (const i of ceilingItems(doc)) {
      const p = planeRect(catalog, i);
      const [x, y] = tiles(p.x, p.y);
      if (!inRoom(x + 0.01, y + 0.01)) continue;
      const { w, d } = itemSize(catalogEntry(catalog, i.type));
      const model = itemModel(catalog, i.type, { model: appModel(home, i) });
      const [X, Z] = at(x, y);
      const hang = (r.wallHeight - top(i.type)) * heightScale;
      inst.model(ceiling, model, placement(X, hang, Z, i.rot, w, d));
    }
    for (const i of wallItems(doc)) {
      if (i.room !== r.id || !SIDES.includes(i.wall)) continue;
      const rect = wallRect(catalog, i);
      const model = itemModel(catalog, i.type, { model: appModel(home, i) });
      const W = rect.w / 2;
      const D = Math.max(0.05, modelBounds(model, { blockSize: heightScale / 2 })?.z1 ?? 0.1);
      // Its back on the wall and its left (as seen from inside) at x: the turned box's corner.
      const s0 = rect.x / 2;
      const corner = {
        north: [t.x + s0, t.y],
        east: [t.x + t.w - D, t.y + s0],
        south: [t.x + t.w - s0 - W, t.y + t.h - D],
        west: [t.x, t.y + t.h - s0 - W],
      }[i.wall];
      const [X, Z] = at(corner[0], corner[1]);
      inst.model(
        walls.get(i.wall)!,
        model,
        placement(X, (rect.y / 2) * heightScale, Z, FACING[i.wall], W, D),
      );
    }
    return [
      ...instanceSpecs("items", floor, (f) => OBJECT_MATERIAL[f]),
      ...instanceSpecs("ceiling", ceiling, (f) => OBJECT_MATERIAL[f]),
      ...SIDES.flatMap((side) =>
        instanceSpecs("wallItems", walls.get(side)!, (f) =>
          surfaceName(OBJECT_MATERIAL[f], r.id, side),
        ).map((spec) => ({ ...spec, outline: false })),
      ),
    ];
  }

  /** The object materials (matte, glow, glass) hiding behind a plane, under a name suffix. */
  function objectMaterials(look: HomeLook, flat: boolean, plane: HidePlane, suffix: string) {
    const c = look.colors;
    const glass = look.objects.glass ?? 0.45;
    const base = { base: "toon" as const, color: "#ffffff", gradientSteps: look.objects.toonSteps };
    const out: Record<string, MaterialSpec> = {
      [`objects${suffix}`]: {
        ...base,
        key: "pp-home-objects",
        fragmentPatches: OBJECT_FRAGMENT,
        uniforms: { uHide: plane },
      },
      [`objects-glow${suffix}`]: {
        ...base,
        key: "pp-home-objects-glow",
        fragmentPatches: GLOW_FRAGMENT,
        uniforms: { uHide: plane, uGlow: c.glow, uFlat: flat ? 1 : 0 },
      },
      [`objects-glass${suffix}`]: {
        ...base,
        key: "pp-home-objects-glass",
        transparent: true,
        opacity: glass,
        depthWrite: false,
        fragmentPatches: OBJECT_FRAGMENT,
        uniforms: { uHide: plane },
      },
    };
    return out;
  }

  /** A covered surface's material: its pattern over white, or its plain color. */
  function surfaceMaterial(
    pattern: Pattern | undefined,
    color: string,
    plane: HidePlane,
  ): MaterialSpec {
    return {
      key: `pp-home-surface ${pattern ? patternKey(pattern) : "plain"}`,
      base: "toon",
      color: pattern ? "#ffffff" : color,
      gradientSteps: 3,
      vertexPatches: PATTERN_VERTEX,
      fragmentPatches: PATTERN_FRAGMENT,
      uniforms: { uHide: plane, uPattern: pattern ? patternTexture(pattern) : WHITE },
    };
  }

  return {
    scale: SCALE,
    capabilities: { curvature: false },
    chunks: () => layout.rooms.map((r) => ROOM(r.id)),
    chunksTouched: () => layout.rooms.map((r) => ROOM(r.id)),
    geometryKey: (look) => String(asLook(look).units.heightScale),
    buildChunk(doc, g, l, chunk) {
      const r = room(chunk.slice(ROOM("").length));
      if (!r) return [];
      const look = asLook(l);
      const hs = look.units.heightScale;
      return [
        floorMesh(r),
        ...SIDES.flatMap((side) => wallMeshes(r, side, hs)),
        ...objects(doc, g as Home, r, hs),
      ];
    },
    materials(l, { flat, doc, game }) {
      const look = asLook(l);
      const c: HomeColors = look.colors;
      const catalog = game?.catalog as Catalog | undefined;
      const out: Record<string, MaterialSpec> = { ...objectMaterials(look, flat, NEVER, "") };
      for (const r of layout.rooms) {
        const covers = doc && catalog ? roomCoverings(doc, catalog, r) : {};
        out[surfaceName("floor", r.id)] = surfaceMaterial(covers.flooring?.pattern, c.floor, NEVER);
        for (const side of SIDES) {
          const plane = hidePlane(r, side);
          out[surfaceName("wall", r.id, side)] = surfaceMaterial(
            covers.wallpaper?.pattern,
            c.wall,
            plane,
          );
          out[surfaceName("edge", r.id, side)] = surfaceMaterial(undefined, c.edge, plane);
          out[surfaceName("door", r.id, side)] = surfaceMaterial(undefined, c.door, plane);
          Object.assign(out, objectMaterials(look, flat, plane, `:${r.id}:${side}`));
        }
      }
      return out;
    },
    pick: (hit) => ({ x: hit.point[0] / SCALE, y: hit.point[2] / SCALE }),
    ground: () => () => 0,
    bounds(_doc, _g, l) {
      const hs = asLook(l).units.heightScale;
      const top = Math.max(...layout.rooms.map((r) => r.wallHeight)) * hs;
      const [x0, z0] = at(bounds.x, bounds.y);
      const [x1, z1] = at(bounds.x + bounds.w, bounds.y + bounds.h);
      return { x0, x1, y0: 0, y1: top, z0, z1 };
    },
  };
}
