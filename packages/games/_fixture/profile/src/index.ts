// A toy game for the contract tests: two small maps of cells, each with one grid layer (a ground
// value 0..9 per cell) and one entity layer (things on cells), one rule, and the smallest
// renderers that exercise every part of the contract. The board (3 x 3) has a plan view and a 3D
// view with floors; the sheet (4 x 2) can only be seen in plan. It is not a real game and is never
// listed with them. Also the worked example in docs/adding-a-game.md.

import {
  blankDoc,
  entities,
  gridLayer,
  inScope,
  scopeRange,
  type Doc,
  type Entity,
  type GameProfile,
  type MapDefinition,
  type Rect,
  type Rule,
  type Space,
} from "@glade/core";
import {
  QuadBuilder,
  type MapUI,
  type MapViews,
  type PlanView,
  type RenderableMap,
  type Render3D,
  type Style,
} from "@glade/render";
import { z } from "zod";

const ID = "_fixture";

export interface Thing extends Entity {
  id: string;
  type: string;
  x: number;
  y: number;
}

/** A w x h map of 1 x 1 cells; with floors, things stack on storeys. */
const spaceOf = (w: number, h: number, floors: boolean): Space => ({
  unit: "tile",
  bounds: { x: 0, y: 0, w, h },
  grids: { cell: { cell: [1, 1], origin: [0, 0], size: [w, h], abbr: "c" } },
  ...(floors ? { floors: { height: 1, max: 2 } } : {}),
});

const ground = (doc: Doc) => gridLayer<number>(doc, "ground").cells;
/** Whether a cell is on the doc's map. */
const onMap = (doc: Doc, x: number, y: number) => {
  const g = ground(doc);
  return x >= 0 && y >= 0 && y < g.length && x < g[0].length;
};
const things = (doc: Doc) => entities<Thing>(doc, "things");
const cellRect = (x: number, y: number): Rect => ({ grid: "cell", x, y, w: 1, h: 1 });

/** The fixture's rule parameters; apps change them with customizeMap. */
export interface FixtureParams {
  /** How many things may stand on one cell. */
  maxThingsPerCell: number;
}

const PARAMS: FixtureParams = { maxThingsPerCell: 1 };

const params = (game: MapDefinition): FixtureParams => ({ ...PARAMS, ...game.params });

const rule: Rule = {
  id: "F1",
  name: "things-per-cell",
  description: "At most maxThingsPerCell things (default 1) stand on each cell.",
  local: true,
  check(doc, ctx) {
    const max = params(ctx.game).maxThingsPerCell;
    const seen = new Map<string, Thing[]>();
    for (const t of things(doc)) {
      if (!inScope(ctx, cellRect(t.x, t.y))) continue;
      const k = `${t.x},${t.y}`;
      seen.set(k, [...(seen.get(k) ?? []), t]);
    }
    const { x0, x1 } = scopeRange(ctx, "cell");
    return [...seen.values()]
      .filter((list) => list.length > max && list[0].x >= x0 && list[0].x <= x1)
      .map((list) => ({
        ruleId: "F1",
        message: `${list.length} things on cell ${list[0].x},${list[0].y}`,
        cells: [{ grid: "cell", x: list[0].x, y: list[0].y }],
        objectIds: list.map((t) => t.id),
      }));
  },
};

const COLORS = { ground: "#8fbf6a", thing: "#b04a3a" };
const style: Style = {
  units: { heightScale: 1 },
  world: { curvature: { enabled: false, radius: 500 } },
  shared: {},
  presets: {
    day: {
      sky: { top: "#5a8fd0", horizon: "#b8d4ee", fog: { color: "#b8d4ee", near: 50, far: 200 } },
      light: {
        sun: { azimuth: 200, elevation: 50, color: "#ffffff", intensity: 1 },
        ambient: { sky: "#ffffff", ground: "#666666", intensity: 0.6 },
      },
      colors: COLORS,
    },
  },
};

const ui: MapUI = {
  layerNames: () => [
    { id: "ground", label: "Ground", default: true },
    { id: "things", label: "Things", default: true },
  ],
  grids: () => ({
    snap: [{ grid: "cell", label: "Cell", color: "20,20,20", alpha: 0.35 }],
    fine: "cell",
  }),
  hover(doc, _game, p) {
    const [x, y] = [Math.floor(p.x), Math.floor(p.y)];
    if (!onMap(doc, x, y)) return "off map";
    const on = things(doc).filter((t) => t.x === x && t.y === y);
    return `cell ${x},${y} · ground ${ground(doc)[y][x]} · things: ${on.map((t) => t.type).join(", ") || "none"}`;
  },
  clickSelect(doc, _game, p) {
    const [x, y] = [Math.floor(p.x), Math.floor(p.y)];
    if (!onMap(doc, x, y)) return null;
    return { rects: [cellRect(x, y)], cells: [{ grid: "cell", x, y }], label: "cell" };
  },
};

const plan: PlanView = {
  draw(ctx, doc, _game, layers) {
    if (layers.ground !== false) {
      ground(doc).forEach((row, y) =>
        row.forEach((g, x) => {
          ctx.fillStyle = `hsl(100, 35%, ${75 - g * 5}%)`;
          ctx.fillRect(x, y, 1, 1);
        }),
      );
    }
    if (layers.things !== false) {
      ctx.fillStyle = COLORS.thing;
      for (const t of things(doc)) ctx.fillRect(t.x + 0.3, t.y + 0.3, 0.4, 0.4);
    }
  },
};

const scene: Render3D = {
  scale: 1,
  capabilities: { floors: true, curvature: false },
  chunks: () => ["all"],
  chunksTouched: () => ["all"],
  geometryKey: () => "",
  buildChunk(doc) {
    const b = new QuadBuilder({});
    ground(doc).forEach((row, y) =>
      row.forEach((g, x) => {
        const h = g * 0.25;
        b.quad(
          [
            [x, h, y],
            [x + 1, h, y],
            [x + 1, h, y + 1],
            [x, h, y + 1],
          ],
          [0, 1, 0],
          {},
        );
      }),
    );
    const list = things(doc);
    return [
      {
        kind: "mesh",
        layer: "ground",
        material: "ground",
        arrays: b.finish(),
        pickable: true,
        receiveShadow: true,
      },
      {
        kind: "instances",
        layer: "things",
        material: "things",
        primitive: "box",
        matrices: list.flatMap((t) => {
          const h = ground(doc)[t.y][t.x] * 0.25;
          return [0.4, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0.4, 0, t.x + 0.5, h, t.y + 0.5, 1];
        }),
        colors: list.map(() => COLORS.thing),
      },
    ];
  },
  materials(look) {
    const c = look.colors as typeof COLORS;
    return {
      ground: { key: "fx-ground", base: "toon", color: c.ground, gradientSteps: 3 },
      things: { key: "fx-things", base: "toon", color: "#ffffff", gradientSteps: 3 },
    };
  },
  pick: (hit) => ({ x: hit.point[0], y: hit.point[2] }),
  ground: (doc) => (x, y) => {
    const g = ground(doc);
    const [cx, cy] = [
      Math.min(g[0].length - 1, Math.max(0, Math.floor(x))),
      Math.min(g.length - 1, Math.max(0, Math.floor(y))),
    ];
    return g[cy][cx] * 0.25;
  },
  bounds: (doc) => {
    const g = ground(doc);
    return { x0: 0, x1: g[0].length, z0: 0, z1: g.length, y0: 0, y1: 9 * 0.25 };
  },
};

const KINDS = [{ kind: "thing", description: "something standing on a cell" }];

/** A toy map: w x h cells, seen in the given views. */
function toyMap(id: string, title: string, w: number, h: number, views: MapViews): RenderableMap {
  const space = spaceOf(w, h, !!views.scene);
  const map: RenderableMap = {
    game: ID,
    id,
    title,
    space,
    layers: {
      ground: {
        kind: "grid",
        grid: "cell",
        description: "ground value 0..9 per cell",
        initial: () => 0,
        codec: { kind: "rle", token: (n: number) => String(n), parse: (t: string) => Number(t) },
      },
      things: { kind: "entities", description: "things standing on cells" },
    },
    selectionGrid: "cell",
    validation: { grid: "cell", margin: 1 },
    newDoc: (name, _opts, now) => blankDoc({ game: ID, map: id }, space, map.layers, name, now),
    migrate(raw) {
      throw new Error(`fixture maps have no version ${String(raw.version)}`);
    },
    kinds: KINDS,
    rules: [rule],
    params: { ...PARAMS },
    rulebook: () => [{ id: rule.id, name: rule.name, description: rule.description }],
    locate(_game, _doc, layer, at) {
      if (Array.isArray(at)) return layer === "ground" ? [cellRect(...at)] : [];
      const t = at as Thing;
      return layer === "things" ? [cellRect(t.x, t.y)] : [];
    },
    rect: (r) => ({ grid: r.grid, x: r.x, y: r.y, w: r.w ?? 1, h: r.h ?? 1 }),
    style: {
      schema: z.object({
        shared: z.object({}).passthrough(),
        colors: z.object({ ground: z.string(), thing: z.string() }),
        world: z.unknown(),
      }),
      defaults: style,
    },
    ui,
    views,
  };
  return map;
}

/** A 3 x 3 board, in plan and in 3D, with floors. */
export const board = toyMap("board", "Board (3 x 3)", 3, 3, { plan, scene });

/** A 4 x 2 sheet that can only be seen in plan. */
export const sheet = toyMap("sheet", "Sheet (4 x 2, plan only)", 4, 2, { plan });

/** The fixture game: one kind, two maps. */
export const fixture = {
  id: ID,
  title: "Fixture (toy)",
  kinds: KINDS,
  maps: { board, sheet },
  defaultMap: "board",
} satisfies GameProfile<RenderableMap>;
