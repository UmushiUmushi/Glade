// Petit Planet rules. Each rule has a fixture test in tests/rules.test.ts. Rules read their numbers
// from the profile (world.json plus the game's params), never hard-coded, so apps can change them
// with customizeMap.

import { edgeRun } from "./analysis";
import {
  resolvePathCorner,
  resolveTerrainCorner,
  vertexCells,
  type TerrainCorner,
} from "./corners";
import {
  cellsInRect,
  convertRect,
  expandRect,
  inGrid,
  rectsIntersect,
  terrainOfMinor,
  toMinorRect,
  type Cell,
  type Rect,
} from "./space";
import {
  surfaceHosts,
  compareIds,
  cornerCells,
  itemRect,
  itemsOf,
  notFlatEarth,
  pathAt,
  plantRect,
  plantsOf,
  terrainAt,
  terrainGrid,
  terrainOfMajor,
  type Item,
  type MapDoc,
} from "./model";
import {
  defaultTerrainLevel,
  isEditableTerrain,
  landmarkTerrainRect,
  placementBlocked,
} from "./profile";
import {
  baseOf,
  catalogEntry,
  isA,
  pathEntries,
  pathEntry,
  type CatalogEntry,
} from "../../catalog";
import {
  rulesDoc as describeRules,
  type Rule as CoreRule,
  type RuleContext as CoreRuleContext,
  type RuleDoc,
  type Violation,
} from "@glade/core";
import { boxToRect, excludesRule } from "@glade/core";
import { onSurfaces, surfaceRules } from "../../surfaces";
import { frontSide } from "../../items";
import { profileOf } from "./data";
import { gridSpec, type Planet, type Profile } from "./profile";
import { type Catalog } from "../../catalog";
import type { GridSpec } from "./space";

/** What a Petit Planet rule sees: the profile, the catalog, and its scope. */
interface RuleContext {
  profile: Profile;
  catalog: Catalog;
  spec: GridSpec;
  /** Minor-grid rect to examine (see core RuleContext.scope). */
  scope: Rect;
}

type Rule = Omit<CoreRule, "check"> & { check(map: MapDoc, ctx: RuleContext): Violation[] };

function ruleContext(map: MapDoc, ctx: CoreRuleContext): RuleContext {
  const game = ctx.game as Planet;
  return {
    profile: profileOf(game),
    catalog: game.catalog,
    spec: gridSpec(profileOf(game)),
    scope: boxToRect(game.space, ctx.scope, "minor") as Rect,
  };
}

/** Terrain cells (inclusive bounds) a rule should scan. */
function terrainScope(ctx: RuleContext): { x0: number; y0: number; x1: number; y1: number } {
  const r = convertRect(ctx.spec, ctx.scope, "terrain");
  return { x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1 };
}

/** Major cells (inclusive bounds) a rule should scan. */
function majorScope(ctx: RuleContext): { x0: number; y0: number; x1: number; y1: number } {
  const r = convertRect(ctx.spec, ctx.scope, "major");
  return { x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1 };
}

/** Whether a rect (any grid) touches the rule's scope. */
function inScope(ctx: RuleContext, rect: Rect): boolean {
  return rectsIntersect(ctx.scope, toMinorRect(ctx.spec, rect));
}

const T = (x: number, y: number): Cell => ({ grid: "terrain", x, y });
const M = (x: number, y: number): Cell => ({ grid: "major", x, y });

function* scanTerrain(ctx: RuleContext): Generator<[number, number]> {
  const { x0, y0, x1, y1 } = terrainScope(ctx);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) yield [tx, ty];
}

function minorCells(rect: Rect): Cell[] {
  return [...cellsInRect(rect)];
}

function aggregate(
  ruleId: string,
  cells: Cell[],
  message: (n: number) => string,
  hint?: string,
): Violation[] {
  return cells.length ? [{ ruleId, message: message(cells.length), cells, hint }] : [];
}

/** Path cells inside a major range (inclusive), in row order. */
function* pathsInScope(
  map: MapDoc,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Generator<{ X: number; Y: number; type: string }> {
  for (let Y = y0; Y <= y1; Y++) {
    for (let X = x0; X <= x1; X++) {
      const type = pathAt(map, X, Y);
      if (type) yield { X, Y, type };
    }
  }
}

/** Every terrain block in the rect is water, all at one level. */
function onOneWaterLevel(map: MapDoc, terrain: Rect): boolean {
  const levels = new Set<number>();
  for (const c of cellsInRect(terrain)) {
    const cell = terrainAt(map, c.x, c.y);
    if (!cell?.water) return false;
    levels.add(cell.h);
  }
  return levels.size === 1;
}

// ---- objects ----

type ObjKind = "plant" | "item" | "bridge";

interface Obj {
  id: string;
  type: string;
  kind: ObjKind;
  /** Minor grid */
  rect: Rect;
}

function objects(map: MapDoc, ctx: RuleContext): Obj[] {
  return [
    ...plantsOf(map).map((p): Obj => ({
      id: p.id,
      type: p.type,
      kind: "plant",
      rect: plantRect(p),
    })),
    ...itemsOf(map).map((i): Obj => ({
      id: i.id,
      type: i.type,
      kind: baseOf(ctx.catalog, i.type) === "bridge" ? "bridge" : "item",
      rect: itemRect(ctx.catalog, i),
    })),
  ];
}

/** Every pair of objects whose footprints share a minor cell, with at least one in scope. */
function overlappingPairs(map: MapDoc, ctx: RuleContext): { a: Obj; b: Obj; cells: Cell[] }[] {
  const all = objects(map, ctx);
  const width = ctx.spec.majorW * 2;
  const occ = new Map<number, Obj[]>();
  for (const o of all) {
    for (const c of cellsInRect(o.rect)) {
      const k = c.y * width + c.x;
      const list = occ.get(k);
      if (list) list.push(o);
      else occ.set(k, [o]);
    }
  }
  const pairs = new Map<string, { a: Obj; b: Obj; cells: Cell[] }>();
  for (const [k, list] of occ) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        const key = `${a.id}|${b.id}`;
        let pair = pairs.get(key);
        if (!pair) pairs.set(key, (pair = { a, b, cells: [] }));
        pair.cells.push({ grid: "minor", x: k % width, y: Math.floor(k / width) });
      }
    }
  }
  return [...pairs.values()].filter((p) => inScope(ctx, p.a.rect) || inScope(ctx, p.b.rect));
}

function overlapViolations(
  ruleId: string,
  pairs: { a: Obj; b: Obj; cells: Cell[] }[],
): Violation[] {
  return pairs.map(({ a, b, cells }) => ({
    ruleId,
    message: `${a.type} ${a.id} overlaps ${b.type} ${b.id} on ${cells.length} minor cell(s)`,
    cells,
    objectIds: [a.id, b.id],
  }));
}

// ---- buildings ----

/** The minor strip one major cell deep in front of a building, by rotation. */
function buildingFront(r: Rect, rot: number): { strip: Rect; side: string } {
  const side = frontSide(rot);
  switch (side) {
    case "west":
      return { side, strip: { grid: "minor", x: r.x - 2, y: r.y, w: 2, h: r.h } };
    case "north":
      return { side, strip: { grid: "minor", x: r.x, y: r.y - 2, w: r.w, h: 2 } };
    case "east":
      return { side, strip: { grid: "minor", x: r.x + r.w, y: r.y, w: 2, h: r.h } };
    default:
      return { side, strip: { grid: "minor", x: r.x, y: r.y + r.h, w: r.w, h: 2 } };
  }
}

// ---- bridges ----
//
// A bridge rests on the two cliffs either side of a gap. Normally each end sits on the half of the
// cliff block along the edge (one minor row), so a bridge is one block longer than its gap: a 1x4
// crosses a 3-block gap, a 1x7 a 6-block gap. The shortest bridge also crosses a gap one block
// shorter by resting a whole block on each cliff (a 1x4 over a 2-block gap); longer bridges cannot.
// Terrain block t covers minor 2t-1..2t, so a bridge on the cliff edges starts at an even minor
// coordinate (on whole tiles) and one resting whole blocks starts at an odd one.

interface BridgeGeometry {
  vertical: boolean;
  /** Minor coordinate where the bridge starts along its long axis. */
  start: number;
  /** Length in tiles (major cells). */
  length: number;
  /** How the ends rest: half a block on each cliff edge, or a whole block on each cliff. */
  rest: "edge" | "block";
  /** Terrain index of the near cliff block along the long axis; the far cliff is near + gap + 1. */
  near: number;
  /** Gap length in terrain blocks. */
  gap: number;
  /** Terrain index range across the bridge's width. */
  c0: number;
  c1: number;
}

function bridgeGeometry(item: Item, entry: CatalogEntry, rect: Rect): BridgeGeometry {
  const vertical = item.rot === 0 || item.rot === 180;
  const start = vertical ? rect.y : rect.x;
  const a0 = vertical ? rect.x : rect.y;
  const a1 = a0 + (vertical ? rect.w : rect.h) - 1;
  const length = entry.majorSize?.l ?? entry.footprint.h / 2;
  const edge = start % 2 === 0;
  return {
    vertical,
    start,
    length,
    rest: edge ? "edge" : "block",
    near: terrainOfMinor(start),
    gap: edge ? length - 1 : length - 2,
    c0: terrainOfMinor(a0),
    c1: terrainOfMinor(a1),
  };
}

function checkBridge(map: MapDoc, ctx: RuleContext, item: Item, entry: CatalogEntry): Violation[] {
  const rect = itemRect(ctx.catalog, item);
  const g = bridgeGeometry(item, entry, rect);
  const axis = g.vertical ? "y" : "x";
  const base = { ruleId: "I4", objectIds: [item.id] };
  const { minLength, maxLength } = ctx.profile.bridge;
  const name = `${item.type} ${item.id}`;

  if (g.length < minLength || g.length > maxLength) {
    return [
      {
        ...base,
        message: `${name} is ${g.length} tiles long; bridges are ${minLength}..${maxLength} tiles`,
        cells: minorCells(rect),
      },
    ];
  }
  if (g.rest === "block" && g.length !== minLength) {
    return [
      {
        ...base,
        message:
          `${name} rests a whole block on each cliff; only a ${minLength}-tile bridge can, over a ` +
          `${minLength - 2}-block gap. Longer bridges rest half a block on each cliff edge`,
        cells: minorCells(rect),
        hint: `shift by one minor cell (${axis}=${g.start - 1} or ${axis}=${g.start + 1})`,
      },
    ];
  }

  const cell = (along: number, across: number) =>
    g.vertical ? T(across, along) : T(along, across);
  const at = (along: number, across: number) =>
    g.vertical ? terrainAt(map, across, along) : terrainAt(map, along, across);

  const ends: Cell[] = [];
  const endHeights = new Set<number>();
  let endWater = false;
  for (let c = g.c0; c <= g.c1; c++) {
    for (const along of [g.near, g.near + g.gap + 1]) {
      const tc = at(along, c);
      ends.push(cell(along, c));
      if (!tc || tc.water) endWater = true;
      else endHeights.add(tc.h);
    }
  }
  const restsOn = g.rest === "edge" ? "the edge of a cliff" : "a whole cliff block";
  if (endWater || endHeights.size !== 1) {
    const found = [...endHeights].sort().join(", ");
    return [
      {
        ...base,
        message:
          `${name} must rest each end on ${restsOn}, both at one height; ` +
          (endWater ? "an end block is water or off the map" : `end heights are ${found}`),
        cells: ends,
        hint:
          `a ${g.length}-tile bridge crosses a gap of exactly ${g.length - 1} blocks` +
          (g.length === minLength ? ` (or ${g.length - 2})` : "") +
          ` with equal-height cliffs on both sides`,
      },
    ];
  }
  const h = [...endHeights][0];

  const high: Cell[] = [];
  for (let along = g.near + 1; along <= g.near + g.gap; along++) {
    for (let c = g.c0; c <= g.c1; c++) {
      const tc = at(along, c);
      const lower = tc && (tc.water ? tc.h <= h : tc.h < h);
      if (!lower) high.push(cell(along, c));
    }
  }
  if (high.length) {
    return [
      {
        ...base,
        message:
          `${high.length} block(s) in ${name}'s ${g.gap}-block gap are not water or lower than ` +
          `its cliffs (h=${h}), so the gap is shorter than the bridge`,
        cells: high,
        hint: "use a shorter bridge, or move it so its ends rest on the cliffs either side of the gap",
      },
    ];
  }
  return [];
}

// ---- inclines ----
//
// An incline climbs one level (params.inclineRise) from flat ground up onto a cliff. It is always
// two tiles long: its high end sits on the half block along the cliff edge (one minor row) and
// the other 1.5 tiles on the ground below. At rotation 0 the high end faces north, turning
// clockwise with rotation (90 east, 180 south, 270 west). Terrain block t covers minor 2t-1..2t,
// so a high end facing north or west sits on an even minor row, one facing south or east on an
// odd one.

interface InclineGeometry {
  alongY: boolean;
  /** Minor coordinate of the high end's row along the incline's length. */
  edgeRow: number;
  /** Length along the incline in minor cells (4 for every incline in the game). */
  length: number;
  /** Terrain index of the cliff block the high end sits on, and of the blocks below it. */
  upper: number;
  lower: [number, number];
  /** Terrain index range across the incline's width. */
  c0: number;
  c1: number;
  /** True when the high end is on a terrain block's half along its edge. */
  onEdge: boolean;
}

export function inclineGeometry(item: Item, rect: Rect): InclineGeometry {
  const alongY = item.rot === 0 || item.rot === 180;
  const lo = alongY ? rect.y : rect.x;
  const length = alongY ? rect.h : rect.w;
  const across0 = alongY ? rect.x : rect.y;
  const across1 = across0 + (alongY ? rect.w : rect.h) - 1;
  const highFirst = item.rot === 0 || item.rot === 270;
  const edgeRow = highFirst ? lo : lo + length - 1;
  const upper = terrainOfMinor(edgeRow);
  const step = highFirst ? 1 : -1;
  return {
    alongY,
    edgeRow,
    length,
    upper,
    lower: [upper + step, upper + 2 * step],
    c0: terrainOfMinor(across0),
    c1: terrainOfMinor(across1),
    onEdge: Math.abs(edgeRow % 2) === (highFirst ? 0 : 1),
  };
}

function checkIncline(map: MapDoc, ctx: RuleContext, item: Item): Violation[] {
  const rect = itemRect(ctx.catalog, item);
  const g = inclineGeometry(item, rect);
  const axis = g.alongY ? "y" : "x";
  const base = { ruleId: "I6", objectIds: [item.id] };
  const name = `${item.type} ${item.id}`;
  const rise = ctx.profile.inclineRise;

  if (g.length !== 4) {
    return [
      {
        ...base,
        message: `${name} is ${g.length / 2} tiles long; inclines are 2`,
        cells: minorCells(rect),
      },
    ];
  }
  if (!g.onEdge) {
    const start = g.alongY ? rect.y : rect.x;
    return [
      {
        ...base,
        message: `${name}'s high end must sit on the half block along a cliff edge`,
        cells: minorCells(rect),
        hint: `shift by one minor cell (${axis}=${start - 1} or ${axis}=${start + 1})`,
      },
    ];
  }

  const cell = (along: number, across: number) => (g.alongY ? T(across, along) : T(along, across));
  const at = (along: number, across: number) =>
    g.alongY ? terrainAt(map, across, along) : terrainAt(map, along, across);
  const blocks = (rows: number[]) =>
    rows.flatMap((along) => {
      const out: { cell: Cell; t: ReturnType<typeof terrainAt> }[] = [];
      for (let c = g.c0; c <= g.c1; c++) out.push({ cell: cell(along, c), t: at(along, c) });
      return out;
    });
  const top = blocks([g.upper]);
  const bottom = blocks(g.lower);
  const heights = (list: typeof top) => new Set(list.map((b) => b.t?.h));

  const wet = bottom.filter((b) => !b.t || b.t.water);
  if (wet.length) {
    return [
      {
        ...base,
        message: `the ground under ${name} is water or off the map; inclines stand on dry ground`,
        cells: wet.map((b) => b.cell),
      },
    ];
  }
  const low = heights(bottom);
  if (low.size !== 1) {
    return [
      {
        ...base,
        message: `the ground under ${name} is not flat (levels ${[...low].sort().join(", ")})`,
        cells: bottom.map((b) => b.cell),
      },
    ];
  }
  const h = [...low][0]!;
  const wrong = top.filter((b) => !b.t || b.t.water || b.t.h !== h + rise);
  if (wrong.length) {
    return [
      {
        ...base,
        message:
          `${name}'s high end must rest on a straight cliff edge exactly ${rise} level(s) above ` +
          `its ground (level ${h + rise}); ` +
          (wrong.length < top.length ? "part of it is not (a corner?)" : "it is not"),
        cells: wrong.map((b) => b.cell),
        hint: "face the high end toward the cliff, with its whole width against a straight edge",
      },
    ];
  }
  return [];
}

// ---- corners ----

/** Shaped vertices of a layer whose four cells touch the rule's scope. */
function cornersInScope(map: MapDoc, ctx: RuleContext, layer: "terrainCorners" | "pathCorners") {
  const grid = layer === "terrainCorners" ? "terrain" : "major";
  return cornerCells(map, layer).filter((v) => {
    const [a] = vertexCells(layer, v.x, v.y);
    return inScope(ctx, { grid, x: a.x, y: a.y, w: 2, h: 2 });
  });
}

/** The minor cell holding a terrain corner's region (the odd block's quarter at the vertex). */
function cornerMinorCell(c: TerrainCorner): Cell {
  const [sx, sy] = c.dir;
  return {
    grid: "minor",
    x: sx > 0 ? 2 * c.cell.x : 2 * c.cell.x - 1,
    y: sy > 0 ? 2 * c.cell.y : 2 * c.cell.y - 1,
  };
}

// ---- rules ----

const ruleList: Rule[] = [
  {
    id: "T1",
    name: "height-range",
    description: "Terrain heights are integers from 0 to maxHeight (default 8).",
    local: true,
    check(map, ctx) {
      const min = Math.min(ctx.profile.minLandLevel, ctx.profile.beach.level);
      const max = ctx.profile.maxHeight;
      const bad: Cell[] = [];
      for (const [tx, ty] of scanTerrain(ctx)) {
        const { h } = terrainGrid(map)[ty][tx];
        if (!Number.isInteger(h) || h < min || h > max) bad.push(T(tx, ty));
      }
      return aggregate("T1", bad, (n) => `${n} terrain cell(s) outside heights ${min}..${max}`);
    },
  },
  {
    id: "T2",
    name: "border-immutable",
    description:
      "Terrain outside the editable zone (beach, and the outer ring of land) keeps its default " +
      "height: beach 0, land ring 1. Water there is W1.",
    local: true,
    check(map, ctx) {
      const bad: Cell[] = [];
      for (const [tx, ty] of scanTerrain(ctx)) {
        if (isEditableTerrain(ctx.profile, tx, ty)) continue;
        const h = terrainGrid(map)[ty][tx].h;
        if (h !== defaultTerrainLevel(ctx.profile, tx, ty)) bad.push(T(tx, ty));
      }
      return aggregate(
        "T2",
        bad,
        (n) => `${n} locked border terrain cell(s) changed height`,
        `editable terrain is x ${ctx.profile.terrainEditable.x.join("..")}, ` +
          `y ${ctx.profile.terrainEditable.y.join("..")}`,
      );
    },
  },
  {
    id: "T3",
    name: "step-limit",
    description:
      "Neighboring terrain cells differ by at most maxStepBetweenNeighbors levels (default 3), " +
      'with corners counting when stepNeighborhood is "8" (the default): cliffs recede one ring ' +
      "per 3 levels.",
    local: true,
    check(map, ctx) {
      const maxStep = ctx.profile.maxStepBetweenNeighbors;
      const offsets =
        ctx.profile.stepNeighborhood === "8"
          ? [
              [1, 0],
              [0, 1],
              [1, 1],
              [-1, 1],
            ]
          : [
              [1, 0],
              [0, 1],
            ];
      const bad = new Map<string, Cell>();
      let pairs = 0;
      let worst = 0;
      for (const [tx, ty] of scanTerrain(ctx)) {
        const h = terrainGrid(map)[ty][tx].h;
        for (const [dx, dy] of offsets) {
          const n = terrainAt(map, tx + dx, ty + dy);
          if (!n) continue;
          const d = Math.abs(h - n.h);
          if (d > maxStep) {
            pairs++;
            worst = Math.max(worst, d);
            bad.set(`${tx},${ty}`, T(tx, ty));
            bad.set(`${tx + dx},${ty + dy}`, T(tx + dx, ty + dy));
          }
        }
      }
      if (!pairs) return [];
      return [
        {
          ruleId: "T3",
          message: `${pairs} neighbor pair(s) differ by more than ${maxStep} (largest step ${worst})`,
          cells: [...bad.values()],
          hint: `recede one ring per ${maxStep} levels; terrain_plateau terraces automatically`,
        },
      ];
    },
  },
  {
    id: "T4",
    name: "landmark-lock",
    description:
      "Terrain under a terrain-locked landmark keeps the landmark's level and has no water " +
      "(town center: terrain 78..98 x 71..98 at level 1).",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      const scope = convertRect(ctx.spec, ctx.scope, "terrain");
      for (const lm of ctx.profile.landmarks) {
        if (!lm.lockTerrain) continue;
        const rect = landmarkTerrainRect(lm);
        if (!rectsIntersect(rect, scope)) continue;
        const bad: Cell[] = [];
        for (const c of cellsInRect(rect)) {
          const cell = terrainAt(map, c.x, c.y);
          if (!cell) continue;
          const want = lm.lockLevel ?? defaultTerrainLevel(ctx.profile, c.x, c.y);
          if (cell.h !== want || cell.water) bad.push(c);
        }
        out.push(
          ...aggregate("T4", bad, (n) => `${n} terrain cell(s) under landmark ${lm.id} changed`),
        );
      }
      return out;
    },
  },
  {
    id: "W1",
    name: "water-not-on-beach",
    description: "No water on beach or on the locked outer ring of land.",
    local: true,
    check(map, ctx) {
      const bad: Cell[] = [];
      for (const [tx, ty] of scanTerrain(ctx)) {
        if (!isEditableTerrain(ctx.profile, tx, ty) && terrainGrid(map)[ty][tx].water) {
          bad.push(T(tx, ty));
        }
      }
      return aggregate("W1", bad, (n) => `${n} water cell(s) on beach or locked border`);
    },
  },
  {
    id: "W2",
    name: "waterfall-position",
    description:
      "Water falling off an edge (a 4-neighbor lower than it) must be strictly inside a straight " +
      "cliff face of at least waterfallMinRun blocks (default 3): blocks at its level with the ground in front of them at " +
      "exactly the fall's landing level. xwx and xwwx are legal; a fall at the end of a face, on " +
      "a corner, or beside anything in front higher or lower than the landing is not. A one-block " +
      "ridge falls both ways and each face is checked.",
    local: false,
    check(map, ctx) {
      const minRun = ctx.profile.waterfallMinRun;
      const sides: [string, number, number][] = [
        ["north", 0, -1],
        ["east", 1, 0],
        ["south", 0, 1],
        ["west", -1, 0],
      ];
      const out: Violation[] = [];
      for (const [tx, ty] of scanTerrain(ctx)) {
        const c = terrainGrid(map)[ty][tx];
        if (!c.water) continue;
        const h = c.h;
        for (const [side, dx, dy] of sides) {
          const across = terrainAt(map, tx + dx, ty + dy);
          if (!across || across.h >= h) continue;
          const { back, fwd, ex, ey } = edgeRun(map, tx, ty, dx, dy);
          const run = back + fwd + 1;
          if (back > 0 && fwd > 0 && run >= minRun) continue;
          const runCells: Cell[] = [];
          for (let k = -back; k <= fwd; k++) runCells.push(T(tx + ex * k, ty + ey * k));
          out.push({
            ruleId: "W2",
            message:
              `water at terrain ${tx},${ty} (h=${h}) falls ${side} ` +
              (run < minRun
                ? `off an edge only ${run} cell(s) long; waterfalls need a run of ${minRun}+`
                : `at the end of its ${run}-cell edge; waterfalls must be inside the run`),
            cells: [T(tx, ty), ...runCells.filter((r) => r.x !== tx || r.y !== ty)],
            hint:
              "move the water inward along the cliff, or make the ground in front of the cliff on " +
              "both sides of the fall level with where it lands",
          });
        }
      }
      return out;
    },
  },
  {
    id: "W4",
    name: "water-corner-bank",
    description:
      "Water may not touch lower ground only at a corner: if a diagonal neighbor is lower than " +
      "the water, one of the two blocks between them must be lower too (a real edge, which W2 " +
      "governs). Otherwise that corner needs a bank at the water's level or higher.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const [tx, ty] of scanTerrain(ctx)) {
        const c = terrainGrid(map)[ty][tx];
        if (!c.water) continue;
        for (const [dx, dy] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const d = terrainAt(map, tx + dx, ty + dy);
          if (!d || d.h >= c.h) continue;
          const a = terrainAt(map, tx + dx, ty);
          const b = terrainAt(map, tx, ty + dy);
          if ((a && a.h < c.h) || (b && b.h < c.h)) continue;
          out.push({
            ruleId: "W4",
            message:
              `water at terrain ${tx},${ty} (h=${c.h}) touches lower ground only at its corner ` +
              `${tx + dx},${ty + dy} (h=${d.h})`,
            cells: [T(tx, ty), T(tx + dx, ty + dy)],
            hint: `raise terrain ${tx + dx},${ty + dy} to a bank at level ${c.h} or higher, or move the water`,
          });
        }
      }
      return out;
    },
  },
  {
    id: "T5",
    name: "terrain-corner-shape",
    description:
      "A cut or rounded water or cliff corner needs one of the four blocks at its vertex to " +
      "differ from the other three, and those three at one level: a lone water block or a notch " +
      "in a pond, a raised block's corner or a notch in a cliff. A cliff corner over a gap (the " +
      "blocks around it at different levels, e.g. a missing block under it) cannot be cut or " +
      "rounded; nor can a corner on locked terrain or with water on top of the cliff. A shape on " +
      "flat ground or a straight edge does nothing and is allowed.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const v of cornersInScope(map, ctx, "terrainCorners")) {
        const r = resolveTerrainCorner(map, ctx.profile, v.x, v.y);
        if (r.status !== "invalid") continue;
        out.push({
          ruleId: "T5",
          message: `${v.shape} corner where terrain ${v.x}..${v.x + 1}, ${v.y}..${v.y + 1} meet: ${r.reason}`,
          cells: vertexCells("terrainCorners", v.x, v.y).map((c) => T(c.x, c.y)),
          hint: r.hint,
        });
      }
      return out;
    },
  },
  {
    id: "P1",
    name: "path-on-major-only",
    description:
      "Paths lie on major cells with a path type from the catalog, not on beach or a " +
      "placement-locked landmark.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      const groups = new Map<string, Cell[]>();
      const add = (reason: string, cell: Cell) => {
        const list = groups.get(reason);
        if (list) list.push(cell);
        else groups.set(reason, [cell]);
      };
      const { x0, y0, x1, y1 } = majorScope(ctx);
      const known = new Set(pathEntries(ctx.catalog).map((p) => p.type));
      for (const { X, Y, type } of pathsInScope(map, x0, y0, x1, y1)) {
        const blocked = placementBlocked(ctx.profile, X, Y);
        if (blocked) add(`on ${blocked}`, M(X, Y));
        if (!known.has(type)) add(`unknown path type "${type}" (not in the catalog)`, M(X, Y));
      }
      // Placement problems first, then unknown types, each in the order first seen.
      const ordered = [...groups].sort(
        ([a], [b]) => Number(a.startsWith("unknown")) - Number(b.startsWith("unknown")),
      );
      for (const [reason, cells] of ordered) {
        out.push({ ruleId: "P1", message: `${cells.length} path cell(s) ${reason}`, cells });
      }
      return out;
    },
  },
  {
    id: "P2",
    name: "path-on-flat-earth",
    description:
      "A path cell's four terrain corners share one height and none is water. The middle of a " +
      "2x2 raised block is flat; the top of the smallest 4-high mountain is not.",
    local: true,
    check(map, ctx) {
      const { x0, y0, x1, y1 } = majorScope(ctx);
      const water: Cell[] = [];
      const uneven: Cell[] = [];
      for (const { X, Y } of pathsInScope(map, x0, y0, x1, y1)) {
        const why = notFlatEarth(map, terrainOfMajor(X, Y));
        if (why?.startsWith("water")) water.push(M(X, Y));
        else if (why) uneven.push(M(X, Y));
      }
      return [
        ...aggregate("P2", water, (n) => `${n} path cell(s) on water`),
        ...aggregate("P2", uneven, (n) => `${n} path cell(s) on uneven ground`),
      ];
    },
  },
  {
    id: "P3",
    name: "path-corner-shape",
    description:
      "A cut or rounded path corner needs a path cell standing out at its vertex (one of the four " +
      "cells a path, the other three open ground): its corner is trimmed. Outer corners only: the " +
      "inside of an L stays square. Never on a lone path cell, never between two path types, and " +
      "at most one shaped corner per cell (a corner reaches a whole cell). A shape inside a path " +
      "or on a straight edge does nothing.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      const byCell = new Map<string, string[]>();
      for (const v of cornersInScope(map, ctx, "pathCorners")) {
        const r = resolvePathCorner(map, ctx.profile, v.x, v.y);
        const where = `${v.shape} corner at major corner ${v.x},${v.y}`;
        if (r.status === "invalid") {
          out.push({
            ruleId: "P3",
            message: `${where}: ${r.reason}`,
            cells: vertexCells("pathCorners", v.x, v.y).map((c) => M(c.x, c.y)),
            hint: r.hint,
          });
        } else if (r.status === "shaped") {
          const k = `${r.corner.cell.x},${r.corner.cell.y}`;
          byCell.set(k, [...(byCell.get(k) ?? []), `${v.x},${v.y}`]);
        }
      }
      for (const [k, vs] of byCell) {
        if (vs.length < 2) continue;
        const [X, Y] = k.split(",").map(Number);
        out.push({
          ruleId: "P3",
          message: `major ${k} has ${vs.length} shaped corners (at major corners ${vs.join(" and ")}); a path corner reaches the whole cell, so one per cell`,
          cells: [M(X, Y)],
          hint: "keep one shaped corner on this cell, or widen the path so each corner has its own cell",
        });
      }
      return out;
    },
  },
  {
    id: "O1",
    name: "known-type",
    description:
      "Plants use catalog plant types; items use catalog item, bridge or incline types with " +
      "rotation 0, 90, 180, or 270.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const p of plantsOf(map)) {
        if (!inScope(ctx, plantRect(p))) continue;
        const kind = baseOf(ctx.catalog, p.type);
        if (kind !== "plant") {
          out.push({
            ruleId: "O1",
            message: `plant ${p.id} has ${kind ? `${kind} type` : "unknown type"} "${p.type}"`,
            cells: [M(p.X, p.Y)],
            objectIds: [p.id],
          });
        }
      }
      for (const i of itemsOf(map)) {
        const rect = itemRect(ctx.catalog, i);
        if (!inScope(ctx, rect)) continue;
        const kind = baseOf(ctx.catalog, i.type);
        const problems: string[] = [];
        if (kind !== "item" && kind !== "bridge" && kind !== "incline") {
          problems.push(
            kind ? `${kind} type "${i.type}"` : `unknown type "${i.type}" (not in the catalog)`,
          );
        }
        if (![0, 90, 180, 270].includes(i.rot)) problems.push(`rotation ${i.rot}`);
        if (problems.length) {
          out.push({
            ruleId: "O1",
            message: `item ${i.id} has ${problems.join(" and ")}`,
            cells: minorCells(rect),
            objectIds: [i.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "O2",
    name: "unique-id",
    description: "Every plant and item id is unique, things on surfaces included.",
    local: false,
    check(map) {
      const seen = new Map<string, number>();
      for (const o of [...plantsOf(map), ...itemsOf(map), ...onSurfaces(map)]) {
        seen.set(o.id, (seen.get(o.id) ?? 0) + 1);
      }
      return [...seen]
        .filter(([, n]) => n > 1)
        .map(([id, n]) => ({
          ruleId: "O2",
          message: `id ${id} is used by ${n} objects`,
          cells: [],
          objectIds: [id],
        }));
    },
  },

  {
    id: "L1",
    name: "plant-major-snap",
    description: "Plants sit on whole major cells (their minor position is even).",
    local: true,
    check(map, ctx) {
      return plantsOf(map)
        .filter((p) => !inGrid(ctx.spec, "major", p.X, p.Y) && inScope(ctx, plantRect(p)))
        .map((p) => ({
          ruleId: "L1",
          message: `plant ${p.id} at X=${p.X}, Y=${p.Y} is not on a major cell`,
          cells: [],
          objectIds: [p.id],
          hint: "plants snap to the major grid: use integer X, Y (even minor coordinates)",
        }));
    },
  },
  {
    id: "L2",
    name: "plant-not-on-beach",
    description: "No plants on beach or on a placement-locked landmark.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const p of plantsOf(map)) {
        if (!inGrid(ctx.spec, "major", p.X, p.Y) || !inScope(ctx, plantRect(p))) continue;
        const blocked = placementBlocked(ctx.profile, p.X, p.Y);
        if (blocked) {
          out.push({
            ruleId: "L2",
            message: `plant ${p.id} (${p.type}) is on ${blocked}`,
            cells: [M(p.X, p.Y)],
            objectIds: [p.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "L3",
    name: "plant-on-flat-earth",
    description: "A plant's four terrain corners share one height and none is water.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const p of plantsOf(map)) {
        if (!inGrid(ctx.spec, "major", p.X, p.Y) || !inScope(ctx, plantRect(p))) continue;
        const why = notFlatEarth(map, terrainOfMajor(p.X, p.Y));
        if (why) {
          out.push({
            ruleId: "L3",
            message: `plant ${p.id} (${p.type}) is on ${why}`,
            cells: [M(p.X, p.Y)],
            objectIds: [p.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "L4",
    name: "plant-on-path-allowed",
    description: "Plants may sit on a path only if its catalog entry allows plants (allowsPlants).",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const p of plantsOf(map)) {
        if (!inGrid(ctx.spec, "major", p.X, p.Y) || !inScope(ctx, plantRect(p))) continue;
        const type = pathAt(map, p.X, p.Y);
        if (!type) continue;
        if (!pathEntry(ctx.catalog, type)?.allowsPlants) {
          out.push({
            ruleId: "L4",
            message: `plant ${p.id} (${p.type}) is on a ${type} path, which does not allow plants`,
            cells: [M(p.X, p.Y)],
            objectIds: [p.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "L5",
    name: "plant-no-overlap",
    description:
      "Plants do not overlap other plants or items (overlap with a bridge is reported as I5).",
    local: true,
    check(map, ctx) {
      const pairs = overlappingPairs(map, ctx).filter(
        ({ a, b }) =>
          (a.kind === "plant" || b.kind === "plant") && a.kind !== "bridge" && b.kind !== "bridge",
      );
      return overlapViolations("L5", pairs);
    },
  },
  {
    id: "L6",
    name: "tree-spacing",
    description:
      "None of the 8 major cells around a tree may hold another tree or any part of a building.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      const isTree = (type: string) => isA(ctx.catalog, type, "tree");
      const trees = plantsOf(map).filter(
        (p) => isTree(p.type) && inGrid(ctx.spec, "major", p.X, p.Y),
      );
      const at = new Map(trees.map((p) => [`${p.X},${p.Y}`, p]));
      const buildings = itemsOf(map)
        .filter((i) => isA(ctx.catalog, i.type, "building"))
        .map((i) => ({ i, major: convertRect(ctx.spec, itemRect(ctx.catalog, i), "major") }));
      for (const t of trees) {
        if (!inScope(ctx, expandRect(ctx.spec, plantRect(t), 2))) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const o = (dx || dy) && at.get(`${t.X + dx},${t.Y + dy}`);
            // Report each pair of trees once, from the one with the smaller id.
            if (o && compareIds(t.id, o.id) < 0) {
              out.push({
                ruleId: "L6",
                message: `${t.type} ${t.id} is next to ${o.type} ${o.id}; trees need a free cell between them`,
                cells: [M(t.X, t.Y), M(o.X, o.Y)],
                objectIds: [t.id, o.id],
              });
            }
          }
        }
        const around = { grid: "major" as const, x: t.X - 1, y: t.Y - 1, w: 3, h: 3 };
        for (const b of buildings) {
          if (!rectsIntersect(b.major, around)) continue;
          out.push({
            ruleId: "L6",
            message: `${t.type} ${t.id} touches ${b.i.type} ${b.i.id}; trees need a free cell around buildings`,
            cells: [M(t.X, t.Y)],
            objectIds: [t.id, b.i.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "I1",
    name: "item-in-bounds",
    description:
      "Items lie fully on the map at integer minor cells, not on beach or a placement-locked " +
      "landmark.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const i of itemsOf(map)) {
        const rect = itemRect(ctx.catalog, i);
        if (!inScope(ctx, rect)) continue;
        const base = { ruleId: "I1", objectIds: [i.id] };
        const lastX = rect.x + rect.w - 1;
        const lastY = rect.y + rect.h - 1;
        if (
          !inGrid(ctx.spec, "minor", rect.x, rect.y) ||
          !inGrid(ctx.spec, "minor", lastX, lastY)
        ) {
          out.push({
            ...base,
            message: `item ${i.id} (${i.type}) is off the map or not on whole minor cells`,
            cells: [],
          });
          continue;
        }
        const blocked = new Map<string, Cell[]>();
        for (const c of cellsInRect(convertRect(ctx.spec, rect, "major"))) {
          const why = placementBlocked(ctx.profile, c.x, c.y);
          if (why) blocked.set(why, [...(blocked.get(why) ?? []), c]);
        }
        for (const [why, cells] of blocked) {
          out.push({ ...base, message: `item ${i.id} (${i.type}) is on ${why}`, cells });
        }
      }
      return out;
    },
  },
  {
    id: "I2",
    name: "item-on-flat-earth",
    description:
      "Every terrain block under an item's rotated footprint shares one height and none is " +
      "water, and no part of it stands on a cut or rounded water or cliff corner. Boats may " +
      "instead sit entirely on water at one level. Bridges and inclines are exempt (see I4, I6).",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      // Minor cells holding a shaped corner's region, which is ground at another level or water.
      const shaped = new Map<string, TerrainCorner>();
      for (const v of cornersInScope(map, ctx, "terrainCorners")) {
        const r = resolveTerrainCorner(map, ctx.profile, v.x, v.y);
        if (r.status !== "shaped") continue;
        const c = cornerMinorCell(r.corner);
        shaped.set(`${c.x},${c.y}`, r.corner);
      }
      for (const i of itemsOf(map)) {
        const entry = catalogEntry(ctx.catalog, i.type);
        const base = baseOf(ctx.catalog, i.type);
        if (base === "bridge" || base === "incline") continue;
        const rect = itemRect(ctx.catalog, i);
        if (!inScope(ctx, rect)) continue;
        const terrain = convertRect(ctx.spec, rect, "terrain");
        if (entry?.onWater && onOneWaterLevel(map, terrain)) continue;
        const on = shaped.size
          ? minorCells(rect)
              .map((c) => shaped.get(`${c.x},${c.y}`))
              .find(Boolean)
          : undefined;
        const why =
          notFlatEarth(map, terrain) ??
          (on ? `a ${on.shape} ${on.kind} corner of terrain ${on.cell.x},${on.cell.y}` : null);
        if (why) {
          out.push({
            ruleId: "I2",
            message:
              `item ${i.id} (${i.type}) is on ${why}` +
              (entry?.onWater ? "; boats need all dry ground or all water at one level" : ""),
            cells: minorCells(rect),
            objectIds: [i.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "I3",
    name: "item-no-overlap",
    description:
      "Items do not overlap other items (paths are fine). Plant overlaps are L5; objects under " +
      "a bridge are I5.",
    local: true,
    check(map, ctx) {
      const pairs = overlappingPairs(map, ctx).filter(
        ({ a, b }) =>
          a.kind !== "plant" &&
          b.kind !== "plant" &&
          (a.kind === "bridge") === (b.kind === "bridge"),
      );
      return overlapViolations("I3", pairs);
    },
  },
  {
    id: "I4",
    name: "bridge-span",
    description:
      "A bridge rests on two cliffs of one height either side of a gap that is all water or " +
      "lower ground. Each end sits on the half block along a cliff edge, so a bridge is one tile " +
      "longer than its gap (a 1x4 crosses 3 blocks, a 1x7 crosses 6); only the shortest bridge " +
      "may instead rest a whole block on each cliff, over a gap two shorter (a 1x4 over 2). " +
      "Bridges are bridge.minLength..bridge.maxLength tiles long (default 4..7).",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const i of itemsOf(map)) {
        const entry = catalogEntry(ctx.catalog, i.type);
        if (!entry || baseOf(ctx.catalog, i.type) !== "bridge") continue;
        // Ends rest on the blocks just past the footprint, so look one block further.
        if (!inScope(ctx, expandRect(ctx.spec, itemRect(ctx.catalog, i), 2))) continue;
        out.push(...checkBridge(map, ctx, i, entry));
      }
      return out;
    },
  },
  {
    id: "I5",
    name: "nothing-under-bridge",
    description: "Major cells under a bridge may hold paths but no plants or other items.",
    local: true,
    check(map, ctx) {
      const all = objects(map, ctx);
      const out: Violation[] = [];
      for (const bridge of all) {
        if (bridge.kind !== "bridge" || !inScope(ctx, bridge.rect)) continue;
        const under = convertRect(ctx.spec, bridge.rect, "major");
        const underMinor = toMinorRect(ctx.spec, under);
        for (const o of all) {
          if (o.kind === "bridge" || !rectsIntersect(o.rect, underMinor)) continue;
          out.push({
            ruleId: "I5",
            message: `${o.type} ${o.id} is under ${bridge.type} ${bridge.id}`,
            cells: [...cellsInRect(convertRect(ctx.spec, o.rect, "major"))].filter((c) =>
              rectsIntersect({ ...c, w: 1, h: 1 }, under),
            ),
            objectIds: [bridge.id, o.id],
          });
        }
      }
      return out;
    },
  },
  {
    id: "I6",
    name: "incline-on-cliff-edge",
    description:
      "An incline (two tiles long) climbs exactly inclineRise levels (default 1) from flat, dry " +
      "ground up onto a straight cliff edge: its high end sits on the half block along the edge " +
      "and the other 1.5 tiles on the ground below. Not on a corner. Paths may run underneath.",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const i of itemsOf(map)) {
        if (baseOf(ctx.catalog, i.type) !== "incline") continue;
        if (!inScope(ctx, expandRect(ctx.spec, itemRect(ctx.catalog, i), 2))) continue;
        out.push(...checkIncline(map, ctx, i));
      }
      return out;
    },
  },

  {
    id: "B1",
    name: "building-front-clear",
    description:
      "The row of cells directly in front of a building, across its width, is dry, flat ground " +
      "at the building's level: no water, river bank, or cliff. Fronts face south at rotation 0 " +
      "and turn clockwise with rotation (90 west, 180 north, 270 east).",
    local: true,
    check(map, ctx) {
      const out: Violation[] = [];
      for (const i of itemsOf(map)) {
        if (!isA(ctx.catalog, i.type, "building")) continue;
        const r = itemRect(ctx.catalog, i);
        const { strip, side } = buildingFront(r, i.rot);
        if (!inScope(ctx, expandRect(ctx.spec, r, 2))) continue;
        const under = terrainAt(map, terrainOfMinor(r.x), terrainOfMinor(r.y));
        const level = under?.h ?? 0;
        const problems = new Set<string>();
        const onMap = toMinorRect(ctx.spec, strip);
        if (onMap.w !== strip.w || onMap.h !== strip.h) problems.add("the map edge");
        for (const c of cellsInRect(convertRect(ctx.spec, onMap, "terrain"))) {
          const t = terrainAt(map, c.x, c.y);
          if (!t) continue;
          if (t.water) problems.add("water");
          else if (t.h > level) problems.add(`a cliff up to level ${t.h}`);
          else if (t.h < level) problems.add(`a drop to level ${t.h}`);
        }
        if (problems.size) {
          out.push({
            ruleId: "B1",
            message:
              `the ${side} front of ${i.type} ${i.id} (level ${level}) is blocked by ` +
              [...problems].join(", "),
            cells: [...cellsInRect(convertRect(ctx.spec, onMap, "major"))],
            objectIds: [i.id],
            hint: "move or rotate the building, or make the row in front flat dry ground at its level",
          });
        }
      }
      return out;
    },
  },
];

/** Rule ids and one-line descriptions, plus informational entries that are never violations. */
/** The rules as the core runs them. */
export const rules: CoreRule[] = [
  ...ruleList.map((r) => ({
    ...r,
    check: (map: MapDoc, ctx: CoreRuleContext) => r.check(map, ruleContext(map, ctx)),
  })),
  ...surfaceRules(surfaceHosts, "minor"),
  excludesRule("K1"),
];

export function rulesDoc(): RuleDoc[] {
  return [
    ...describeRules(rules),
    {
      id: "W3",
      name: "pond",
      description:
        "Informational, never a violation: a water body where no cell has a lower 4-neighbor is " +
        "a pond; one that falls off an edge is a stream. summarize reports both.",
      info: true,
    },
  ];
}
