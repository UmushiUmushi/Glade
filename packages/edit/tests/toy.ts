// A made-up map type for the editing tests: a 6 × 4 yard of lettered cells and a list of things,
// two local rules, and an op table. Shared packages can't import a real game.

import {
  bind,
  blankDoc,
  boxesIntersect,
  entityLayer,
  gridLayer,
  rectToBox,
  type Bound,
  type Doc,
  type Entity,
  type LayerSchema,
  type MapDefinition,
  type Rule,
  type Space,
  type Violation,
} from "@glade/core";
import { err, gladeError } from "@glade/errors";
import type { OpTable } from "../src/transaction";

export interface Thing extends Entity {
  type: string;
  x: number;
  y: number;
}

const space: Space = {
  unit: "m",
  bounds: { x: 0, y: 0, w: 6, h: 4 },
  grids: { cell: { cell: [1, 1], origin: [0, 0], size: [6, 4] } },
};

const layers: LayerSchema = {
  ground: {
    kind: "grid",
    grid: "cell",
    description: "a letter per cell",
    initial: () => "g",
    codec: { kind: "rle", token: (c: string) => c, parse: (t: string) => t },
  },
  things: { kind: "entities", description: "placed things" },
};

const cellRect = (x: number, y: number) => ({ grid: "cell", x, y, w: 1, h: 1 });

/** No cell may be "x". */
const noX: Rule = {
  id: "R1",
  name: "no-x",
  description: "a cell can't be x",
  local: true,
  check(doc, { scope }) {
    const out: Violation[] = [];
    gridLayer<string>(doc, "ground").cells.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v === "x" && boxesIntersect(rectToBox(space, cellRect(x, y)), scope))
          out.push({ ruleId: "R1", message: "x", cells: [{ grid: "cell", x, y }] });
      }),
    );
    return out;
  },
};

/** At most one thing per cell. */
const oneEach: Rule = {
  id: "R2",
  name: "one-each",
  description: "one thing per cell",
  local: true,
  check(doc, { scope }) {
    const byCell = new Map<string, Thing[]>();
    for (const t of Object.values(entityLayer<Thing>(doc, "things").items)) {
      byCell.set(`${t.x},${t.y}`, [...(byCell.get(`${t.x},${t.y}`) ?? []), t]);
    }
    return [...byCell.values()]
      .filter(
        (ts) =>
          ts.length > 1 && boxesIntersect(rectToBox(space, cellRect(ts[0].x, ts[0].y)), scope),
      )
      .map((ts) => ({
        ruleId: "R2",
        message: "crowded",
        cells: [{ grid: "cell", x: ts[0].x, y: ts[0].y }],
        objectIds: ts.map((t) => t.id),
      }));
  },
};

const yard = {
  game: "toy",
  id: "yard",
  title: "Yard",
  space,
  layers,
  selectionGrid: "cell",
  validation: { grid: "cell", margin: 0 },
  kinds: [{ kind: "thing", description: "something placed" }],
  rules: [noX, oneEach],
  newDoc: (name: string) =>
    blankDoc({ game: "toy", map: "yard" }, space, layers, name, new Date("2026-10-03T00:00:00Z")),
  locate: (_game: Bound, _doc: Doc, _layer: string, at: [number, number] | Entity) =>
    Array.isArray(at) ? [cellRect(at[0], at[1])] : [cellRect((at as Thing).x, (at as Thing).y)],
} as unknown as MapDefinition;

export const game: Bound = bind(yard, { entries: [{ type: "bench", kind: "thing" }] });

export const newYard = (): Doc => yard.newDoc("main");

export const ops: OpTable = {
  setCell(doc, op) {
    gridLayer<string>(doc, "ground").cells[op.y as number][op.x as number] = op.v as string;
  },
  put(doc, op) {
    const thing = op.thing as Thing;
    entityLayer<Thing>(doc, "things").items[thing.id] = thing;
  },
  remove(doc, op) {
    delete entityLayer<Thing>(doc, "things").items[op.id as string];
  },
  /** Edits a thing in place: a bug the frozen map catches. */
  nudgeInPlace(doc, op) {
    entityLayer<Thing>(doc, "things").items[op.id as string].x += 1;
  },
  refuse: () => err(gladeError("GLD-CHECK-001", { detail: { reason: "refused" } })),
  explode() {
    throw new Error("boom");
  },
};

export const thing = (id: string, x: number, y: number): Thing => ({ id, type: "bench", x, y });
