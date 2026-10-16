// A made-up game for the format tests: one map (a 3 × 2 yard with a grid layer and a list of
// things), a former id, and kinds with one entry rule. Shared packages can't import a real game;
// the test kit checks every real game's maps through these formats.

import {
  blankDoc,
  DOC_VERSION,
  type GameProfile,
  type LayerSchema,
  type MapDefinition,
  type Space,
} from "@glade/core";

const space: Space = {
  unit: "m",
  bounds: { x: 0, y: 0, w: 3, h: 2 },
  grids: { cell: { cell: [1, 1], origin: [0, 0], size: [3, 2] } },
};

const layers: LayerSchema = {
  ground: {
    kind: "grid",
    grid: "cell",
    description: "what covers each cell",
    initial: () => "g",
    codec: { kind: "rle", token: (c: string) => c, parse: (t: string) => t },
  },
  things: { kind: "entities", description: "placed things" },
};

export const yard = {
  game: "toy",
  id: "yard",
  title: "Yard",
  space,
  layers,
  kinds: [
    { kind: "thing", description: "something placed" },
    { kind: "seat", parent: "thing", description: "something to sit on" },
  ],
  entryProblems: (entry: unknown) =>
    (entry as { legs?: number }).legs === 0 ? ["legs: needs at least one"] : [],
  newDoc: (name: string) => blankDoc({ game: "toy", map: "yard" }, space, layers, name),
  // Version 1 yards were a single row of cell letters.
  migrate: (raw: Record<string, unknown>) => {
    const doc = blankDoc({ game: "toy", map: "yard" }, space, layers, String(raw.name));
    const row = String(raw.row ?? "").split("");
    (doc.layers.ground as { cells: string[][] }).cells[0] = row;
    return { doc, notes: ["upgraded from version 1"] };
  },
} as unknown as MapDefinition;

export const toy: GameProfile = {
  id: "toy",
  formerIds: ["old-toy"],
  title: "Toy",
  kinds: yard.kinds,
  maps: { yard },
  defaultMap: "yard",
};

/** A second game, to check files are refused by games they aren't for. */
export const otherGame: GameProfile = { ...toy, id: "other", formerIds: [] };

export const DOC = DOC_VERSION;
