// The kinds of things Petit Planet places. The profile ships kinds, not items: the rules know what a plant,
// a tree, an item, a building, a bridge, an incline and a path are, and apps bring their own catalog
// of actual pieces and bind it (bind, @glade/core). A sub-kind follows every rule of its parent: a
// tree is a plant, a building is an item. Apps may add kinds of their own under these (a catalog's
// `kinds`). entryProblems checks one entry, its model too, the way an item builder needs;
// upgradeCatalog turns older catalogs (tree and building flags) into kinds.

import { z } from "zod";
import { kindChain, type Catalog as CoreCatalog, type KindDef } from "@glade/core";
import { MODEL_LIMITS, modelProblems, modelSchema, type ModelLimits } from "@glade/render";
import { BLOCK_TILES } from "./items";

/** Fields every catalog entry has (paths: type, kind, glyph and description only). */
export const commonFields: Record<string, string> = {
  type: "unique id, e.g. 'oak-tree' (prefix your own, e.g. 'myapp:lantern')",
  kind: "one of the kinds below, or a kind of your own under one of them",
  footprint: "size in minor cells (half tiles) at rotation 0, { w, h }",
  shape: "a generic shape hint for renderers, e.g. 'trunk-cone' or 'slab'",
  glyph: "one character for text views",
  model:
    "optional 3D model made of parts (@glade/render models): solids, groups, rotation, finishes",
  description: "optional: what it is",
};

const PATTERN_HELP =
  "a 2D sheet: { color: '#rrggbb', image?: url (the app's own picture), shapes?: [{ rect: " +
  "[x, y, w, h], color } | { circle: [cx, cy, r], color }] } on a unit square, x right, y down";

export const kinds: KindDef[] = [
  {
    kind: "plant",
    description: "Trees, bushes, flowers and crops. Snap to whole tiles (major cells).",
    rules: ["O1", "O2", "L1", "L2", "L3", "L4", "L5"],
  },
  {
    kind: "tree",
    parent: "plant",
    description: "A plant that counts as a tree: no tree or building in the 8 cells around it.",
    rules: ["L6"],
  },
  { kind: "shrub", parent: "plant", description: "Bushes and hedges." },
  { kind: "flower", parent: "plant", description: "Flowers." },
  {
    kind: "item",
    description: "Furniture and decorations. Placed on half tiles (minor cells), rotated.",
    fields: {
      onWater: "true if it may also sit on water at one level (boats)",
      connects: "true for fences and walls: one-tile pieces link to their neighbors",
      surface:
        "a top things can stand on (tables, stalls): its grid in half cells, { w, h }; a 2x2 " +
        "table's 6x6 top is { w: 12, h: 12 }",
      placeable:
        "can stand on a surface, taking { w, h } half cells of its grid (a tray: { w: 4, h: 4 }); " +
        "never together with surface",
      mount:
        "where it goes in a home: 'floor' (the default), 'wall' (footprint across and up the " +
        "wall; the model faces south with its back on the wall) or 'ceiling'",
    },
    rules: ["O1", "O2", "I1", "I2", "I3", "S1", "S2", "S3"],
  },
  {
    kind: "building",
    parent: "item",
    description:
      "Houses and shops. The front faces south at rotation 0 and turns clockwise with rotation " +
      "(90 west, 180 north, 270 east); the row in front must stay clear, and trees keep a cell away.",
    rules: ["B1", "L6"],
  },
  {
    kind: "bridge",
    description: "Bridges over water or gaps. The long axis runs north-south at rotation 0.",
    fields: {
      majorSize: "size as the game names it, in tiles, { w, l } (width x length; l is 4..7)",
    },
    rules: ["O1", "O2", "I1", "I3", "I4", "I5"],
  },
  {
    kind: "incline",
    description:
      "Ramps up a cliff, 1 or 2 tiles wide and 2 long. The high end faces north at rotation 0 " +
      "and sits on the cliff edge; the rest stands on the ground one level below.",
    rules: ["O1", "O2", "I1", "I3", "I6"],
  },
  {
    kind: "wallpaper",
    description:
      "Covers a room's walls (homes): its pattern repeats across each wall, a copy every 2 tiles, " +
      "the full height of the wall, with a seam on the wall's middle.",
    fields: { pattern: PATTERN_HELP },
    rules: ["H4"],
  },
  {
    kind: "flooring",
    description:
      "Covers a room's floor (homes): its pattern repeats in 2 x 2 tile copies, with seams on the " +
      "room's middle lines.",
    fields: { pattern: PATTERN_HELP },
    rules: ["H4"],
  },
  {
    kind: "path",
    description:
      "Paths laid on whole tiles (major cells). A path has no footprint, shape or model: it fills " +
      "its tiles, drawn in its color and pattern. Different paths never merge.",
    fields: {
      allowsPlants: "true if plants may stand on it (L4)",
      color: "#rrggbb, the same in every time of day and season",
      pattern: "optional: 'cobble' (rounded stones, the default) or 'plain'",
    },
    rules: ["P1", "P2", "P3", "L4"],
  },
];

const size = z.object({ w: z.number().positive(), h: z.number().positive() });

const common = {
  type: z.string().min(1),
  footprint: size,
  shape: z.string(),
  glyph: z.string().length(1),
  model: modelSchema.optional(),
  description: z.string().optional(),
};

const kind = z.string().min(1);
const cells = z.object({ w: z.number().int().positive(), h: z.number().int().positive() });
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Shapes are on a copy's unit square, but may reach past it (a hill that runs off its edge).
const shapeAt = z.number().min(-1).max(2);
const shapeSize = z.number().positive().max(3);
const covering = z.object({
  type: z.string().min(1),
  kind,
  glyph: z.string().length(1),
  pattern: z.object({
    color: hex,
    image: z.string().min(1).optional(),
    shapes: z
      .array(
        z.union([
          z.object({ rect: z.tuple([shapeAt, shapeAt, shapeSize, shapeSize]), color: hex }),
          z.object({ circle: z.tuple([shapeAt, shapeAt, shapeSize]), color: hex }),
        ]),
      )
      .optional(),
  }),
  description: z.string().optional(),
});

/** The fields of an entry, by the base kind its kind is a sort of. */
export const entrySchemas = {
  plant: z.object({ ...common, kind }),
  item: z.object({
    ...common,
    kind,
    onWater: z.boolean().optional(),
    connects: z.boolean().optional(),
    surface: cells.optional(),
    placeable: cells.optional(),
    mount: z.enum(["floor", "wall", "ceiling"]).optional(),
  }),
  bridge: z.object({
    ...common,
    kind,
    majorSize: z.object({ w: z.number().int().positive(), l: z.number().int().positive() }),
  }),
  incline: z.object({ ...common, kind }),
  wallpaper: covering,
  flooring: covering,
  path: z.object({
    type: z.string().min(1),
    kind,
    glyph: z.string().length(1),
    allowsPlants: z.boolean(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    pattern: z.enum(["cobble", "plain"]).optional(),
    description: z.string().optional(),
  }),
};

type BaseKind = keyof typeof entrySchemas;

/** The base kind (plant, item, bridge, incline, path) a kind is a sort of, given an app's kinds. */
function baseOfKind(k: unknown, catalog?: CoreCatalog): BaseKind | undefined {
  if (typeof k !== "string") return undefined;
  const chain = kindChain({ kinds, catalog: catalog ?? { entries: [] } }, k);
  const base = chain[chain.length - 1];
  return base && base in entrySchemas ? (base as BaseKind) : undefined;
}

/**
 * Problems with one catalog entry, each naming the field or model part, or [] when it is fine:
 * its kind, its fields (entrySchemas, by base kind), then its model against its footprint and
 * the map's params.modelLimits, linking pieces one tile, and bridges sized as they are named.
 * Pass the app's catalog when its kinds include its own. Apps that draw blocks at another height
 * pass their own blockSize (tiles per block).
 */
export function entryProblems(
  map: { params?: object },
  entry: unknown,
  opts: { blockSize?: number; catalog?: CoreCatalog } = {},
): string[] {
  const k = (entry as { kind?: unknown } | null)?.kind;
  const base = baseOfKind(k, opts.catalog);
  if (!base) return [`kind: unknown kind ${JSON.stringify(k)}`];
  const parsed = entrySchemas[base].safeParse(entry);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.join(".") || "entry"}: ${i.message}`);
  }
  if (base === "path" || base === "wallpaper" || base === "flooring") return [];
  const e = parsed.data as z.infer<(typeof entrySchemas)["item" | "bridge"]> & {
    majorSize?: { w: number; l: number };
    connects?: boolean;
  };
  const out: string[] = [];
  const [w, d] = [e.footprint.w / 2, e.footprint.h / 2];
  if (base === "item" && e.connects && (e.footprint.w !== 2 || e.footprint.h !== 2)) {
    out.push("footprint: a linking piece (connects) is one tile, { w: 2, h: 2 }");
  }
  const item = e as { surface?: unknown; placeable?: unknown };
  if (item.surface && item.placeable) {
    out.push("surface and placeable: nothing stacks, so an entry has one or the other");
  }
  if (
    base === "bridge" &&
    e.majorSize &&
    (e.footprint.w !== 2 * e.majorSize.w || e.footprint.h !== 2 * e.majorSize.l)
  ) {
    out.push(
      `footprint: a ${e.majorSize.w}x${e.majorSize.l} bridge is { w: ${2 * e.majorSize.w}, h: ${2 * e.majorSize.l} }`,
    );
  }
  if (e.model) {
    const own = (map.params as { modelLimits?: Partial<ModelLimits> } | undefined)?.modelLimits;
    const limits = { ...MODEL_LIMITS, ...own };
    const blockSize = opts.blockSize ?? BLOCK_TILES;
    // A wall item's footprint is across and up the wall: it may be a tile deep, and as tall as
    // its footprint.
    const wall = (e as { mount?: string }).mount === "wall";
    const fit = wall
      ? modelProblems(e.model, w, 1, { blockSize, limits: { ...limits, maxHeight: d } })
      : modelProblems(e.model, w, d, { blockSize, limits });
    for (const m of fit) out.push(`model: ${m}`);
  }
  return out;
}

/**
 * An older catalog in today's kinds: plants with `tree: true` become trees and items with
 * `building: true` become buildings (the flags go). notes say what changed.
 */
export function upgradeCatalog<C extends { entries: unknown[] }>(
  catalog: C,
): { catalog: C; notes: string[] } {
  const notes: string[] = [];
  const entries = catalog.entries.map((raw) => {
    const e = raw as Record<string, unknown>;
    if (!e || typeof e !== "object" || !("tree" in e || "building" in e)) return raw;
    const { tree, building, ...rest } = e;
    let kind = rest.kind;
    if (kind === "plant" && tree === true) kind = "tree";
    if (kind === "item" && building === true) kind = "building";
    if (kind !== rest.kind)
      notes.push(`${String(rest.type)}: kind ${String(rest.kind)} -> ${kind}`);
    return { ...rest, kind };
  });
  return { catalog: { ...catalog, entries }, notes };
}
