// Documents: a map is a Doc made of named layers. A grid layer is a dense array of cells over one
// of the game's grids, indexed [y][x]; an entity layer is a record of objects by id. The core never
// looks inside a cell or an entity; the game's LayerSchema says what they are and how to write them
// to a file. Pure, so the browser viewer uses it too.

import { gridSize, type Rect, type Space } from "./space";

export interface Entity {
  id: string;
  type: string;
  [k: string]: unknown;
}

export interface GridLayer<C = unknown> {
  kind: "grid";
  grid: string;
  cells: C[][];
}

export interface EntityLayer<E extends Entity = Entity> {
  kind: "entities";
  items: Record<string, E>;
}

export type Layer = GridLayer | EntityLayer;

export interface Meta {
  created: string;
  updated: string;
  notes?: string;
}

export interface Doc {
  version: 3;
  /** The game, and which of its maps this is (a game can have several, e.g. an island and homes). */
  game: string;
  map: string;
  name: string;
  layers: Record<string, Layer>;
  meta: Meta;
}

export const DOC_VERSION = 3;

// ---- schema ----

/**
 * How a grid layer is written to a file. rle: rows of "<token>[*count]" joined by spaces, where
 * token(cell) has no spaces or '*'. sparse: {"x,y": cell} for cells that differ from the default.
 * rows: plain JSON rows.
 */
export type GridCodec<C> =
  | { kind: "rle"; token(cell: C): string; parse(token: string): C }
  | { kind: "sparse" }
  | { kind: "rows" };

interface LayerSpecBase {
  /** One line describing the layer. */
  description: string;
  /** Word used in change counts ("changed ground 3, ..."); defaults to the layer id. */
  label?: string;
  /** Leave the layer out of change counts when nothing in it changed. */
  quiet?: boolean;
  /**
   * Leave the layer out of files while it is all at its initial state (a missing layer decodes
   * to that state), so adding a layer to a game does not rewrite every map file.
   */
  omitWhenEmpty?: boolean;
}

export interface GridLayerSpec<C = unknown> extends LayerSpecBase {
  kind: "grid";
  grid: string;
  /** A fresh doc's cell at (x, y). */
  initial(x: number, y: number): C;
  codec: GridCodec<C>;
}

export interface EntityLayerSpec extends LayerSpecBase {
  kind: "entities";
}

export type LayerSpec = GridLayerSpec<never> | EntityLayerSpec;

/** Layers in order; the order is the file order and the order of change counts. */
export type LayerSchema = Record<string, GridLayerSpec<any> | EntityLayerSpec>; // eslint-disable-line @typescript-eslint/no-explicit-any

export class DocFormatError extends Error {}

/** A doc with every layer at its initial state. */
export function blankDoc(
  where: { game: string; map: string },
  space: Space,
  schema: LayerSchema,
  name: string,
  now = new Date(),
): Doc {
  const layers: Record<string, Layer> = {};
  for (const [id, spec] of Object.entries(schema)) {
    if (spec.kind === "grid") {
      const { w, h } = gridSize(space, spec.grid);
      const cells: unknown[][] = [];
      for (let y = 0; y < h; y++) {
        const row: unknown[] = [];
        for (let x = 0; x < w; x++) row.push(spec.initial(x, y));
        cells.push(row);
      }
      layers[id] = { kind: "grid", grid: spec.grid, cells };
    } else layers[id] = { kind: "entities", items: {} };
  }
  const stamp = now.toISOString();
  const { game, map } = where;
  return { version: 3, game, map, name, layers, meta: { created: stamp, updated: stamp } };
}

export function cloneDoc(doc: Doc): Doc {
  return structuredClone(doc);
}

export function gridLayer<C>(doc: Doc, id: string): GridLayer<C> {
  const l = doc.layers[id];
  if (l?.kind !== "grid") throw new Error(`doc has no grid layer ${id}`);
  return l as GridLayer<C>;
}

export function entityLayer<E extends Entity>(doc: Doc, id: string): EntityLayer<E> {
  const l = doc.layers[id];
  if (l?.kind !== "entities") throw new Error(`doc has no entity layer ${id}`);
  return l as EntityLayer<E>;
}

/** Entities of a layer in id order. */
export function entities<E extends Entity>(doc: Doc, id: string): E[] {
  return Object.values(entityLayer<E>(doc, id).items);
}

const collator = new Intl.Collator("en", { numeric: true });

/** Natural order ("i2" before "i10") so files stay stable and diffable. */
export function compareIds(a: string, b: string): number {
  return collator.compare(a, b);
}

/** The same entities as a record rebuilt in id order. */
export function sortedItems<E extends Entity>(items: Record<string, E>): Record<string, E> {
  const out: Record<string, E> = {};
  for (const id of Object.keys(items).sort(compareIds)) out[id] = items[id];
  return out;
}

/** Structural equality for plain JSON values (key order does not matter). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]));
  }
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

// ---- encoding (files and the wire) ----

export type EncodedLayer =
  | { kind: "grid"; grid: string; encoding: "rle"; rows: string[] }
  | { kind: "grid"; grid: string; encoding: "sparse"; cells: Record<string, unknown> }
  | { kind: "grid"; grid: string; encoding: "rows"; rows: unknown[][] }
  | { kind: "entities"; items: Entity[] };

/** A Doc as plain JSON, the shape of a map file (version 3). */
export interface EncodedDoc {
  version: 3;
  game: string;
  map: string;
  name: string;
  meta: Meta;
  layers: Record<string, EncodedLayer>;
}

export function encodeRleRow<C>(row: C[], token: (c: C) => string): string {
  const out: string[] = [];
  let i = 0;
  while (i < row.length) {
    const t = token(row[i]);
    let n = 1;
    while (i + n < row.length && token(row[i + n]) === t) n++;
    out.push(n > 1 ? `${t}*${n}` : t);
    i += n;
  }
  return out.join(" ");
}

export function decodeRleRow<C>(row: string, parse: (t: string) => C): C[] {
  const out: C[] = [];
  for (const part of row.trim().split(/\s+/)) {
    const m = /^([^*]+)(?:\*(\d+))?$/.exec(part);
    if (!m) throw new DocFormatError(`bad row token "${part}"`);
    const n = m[2] ? Number(m[2]) : 1;
    for (let k = 0; k < n; k++) out.push(parse(m[1]));
  }
  return out;
}

export function encodeLayer(spec: LayerSchema[string], layer: Layer): EncodedLayer {
  if (layer.kind === "entities") {
    return { kind: "entities", items: Object.values(sortedItems(layer.items)) };
  }
  if (spec.kind !== "grid") throw new DocFormatError("layer kind does not match its schema");
  const codec = spec.codec;
  if (codec.kind === "rle") {
    return {
      kind: "grid",
      grid: layer.grid,
      encoding: "rle",
      rows: layer.cells.map((r) => encodeRleRow(r, codec.token)),
    };
  }
  if (codec.kind === "sparse") {
    const cells: Record<string, unknown> = {};
    layer.cells.forEach((row, y) =>
      row.forEach((c, x) => {
        if (!deepEqual(c, spec.initial(x, y))) cells[`${x},${y}`] = c;
      }),
    );
    return { kind: "grid", grid: layer.grid, encoding: "sparse", cells };
  }
  return { kind: "grid", grid: layer.grid, encoding: "rows", rows: structuredClone(layer.cells) };
}

export function decodeLayer(
  id: string,
  spec: LayerSchema[string],
  space: Space,
  enc: EncodedLayer | undefined,
): Layer {
  if (spec.kind === "entities") {
    if (enc && enc.kind !== "entities") throw new DocFormatError(`layer ${id} must be entities`);
    const items: Record<string, Entity> = {};
    for (const e of enc?.items ?? []) {
      if (typeof e?.id !== "string") throw new DocFormatError(`layer ${id}: entity without id`);
      items[e.id] = structuredClone(e);
    }
    return { kind: "entities", items: sortedItems(items) };
  }
  const { w, h } = gridSize(space, spec.grid);
  if (!enc) {
    const cells = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => spec.initial(x, y)),
    );
    return { kind: "grid", grid: spec.grid, cells };
  }
  if (enc.kind !== "grid") throw new DocFormatError(`layer ${id} must be a grid`);
  let cells: unknown[][];
  if (enc.encoding === "rle") {
    const codec = spec.codec;
    if (codec.kind !== "rle") throw new DocFormatError(`layer ${id} is not run-length encoded`);
    cells = enc.rows.map((r) => decodeRleRow(r, codec.parse));
  } else if (enc.encoding === "sparse") {
    cells = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => spec.initial(x, y)),
    );
    for (const [key, v] of Object.entries(enc.cells ?? {})) {
      const m = /^(\d+),(\d+)$/.exec(key);
      const [x, y] = m ? [Number(m[1]), Number(m[2])] : [-1, -1];
      if (!m || x >= w || y >= h) throw new DocFormatError(`layer ${id}: bad cell key "${key}"`);
      cells[y][x] = structuredClone(v);
    }
  } else cells = structuredClone(enc.rows);
  if (cells.length !== h || cells.some((r) => r.length !== w)) {
    const got = `${cells[0]?.length ?? 0}x${cells.length}`;
    throw new DocFormatError(`layer ${id} is ${got}; the game expects ${w}x${h}`);
  }
  return { kind: "grid", grid: spec.grid, cells };
}

function isEmptyLayer(l: EncodedLayer): boolean {
  if (l.kind === "entities") return !l.items.length;
  return l.encoding === "sparse" && !Object.keys(l.cells).length;
}

export function encodeDoc(schema: LayerSchema, doc: Doc): EncodedDoc {
  const layers: Record<string, EncodedLayer> = {};
  for (const [id, spec] of Object.entries(schema)) {
    if (!doc.layers[id]) continue;
    const enc = encodeLayer(spec, doc.layers[id]);
    if (spec.omitWhenEmpty && isEmptyLayer(enc)) continue;
    layers[id] = enc;
  }
  const { game, map, name } = doc;
  return { version: 3, game, map, name, meta: { ...doc.meta }, layers };
}

export function decodeDoc(schema: LayerSchema, space: Space, enc: EncodedDoc): Doc {
  if (enc.version !== DOC_VERSION) {
    throw new DocFormatError(`unsupported version ${String(enc.version)}`);
  }
  if (typeof enc.game !== "string") throw new DocFormatError("missing game");
  if (typeof enc.map !== "string") throw new DocFormatError("missing map");
  if (typeof enc.name !== "string") throw new DocFormatError("missing name");
  const layers: Record<string, Layer> = {};
  for (const [id, spec] of Object.entries(schema)) {
    layers[id] = decodeLayer(id, spec, space, enc.layers?.[id]);
  }
  const meta = (enc.meta ?? {}) as Partial<Meta>;
  return {
    version: 3,
    game: enc.game,
    map: enc.map,
    name: enc.name,
    layers,
    meta: {
      created: meta.created ?? "",
      updated: meta.updated ?? "",
      ...(meta.notes !== undefined ? { notes: meta.notes } : {}),
    },
  };
}

/**
 * A map file: the encoded doc with one grid row, sparse cell, or entity per line so diffs stay
 * readable.
 */
export function serializeDoc(schema: LayerSchema, doc: Doc): string {
  const enc = encodeDoc(schema, doc);
  const j = (v: unknown) => JSON.stringify(v);
  const list = (lines: string[], open: string, close: string, indent: string) =>
    lines.length
      ? `${open}\n${lines.map((l) => `${indent}${l}`).join(",\n")}\n${indent.slice(2)}${close}`
      : open + close;
  const layer = (l: EncodedLayer): string => {
    const head =
      l.kind === "grid"
        ? `"kind": "grid", "grid": ${j(l.grid)}, "encoding": ${j(l.encoding)}`
        : `"kind": "entities"`;
    let body: string;
    if (l.kind === "entities") body = `"items": ${list(l.items.map(j), "[", "]", "        ")}`;
    else if (l.encoding === "sparse")
      body = `"cells": ${list(
        sparseKeys(l.cells).map((k) => `${j(k)}: ${j(l.cells[k])}`),
        "{",
        "}",
        "        ",
      )}`;
    else body = `"rows": ${list(l.rows.map(j), "[", "]", "        ")}`;
    return `{\n      ${head},\n      ${body}\n    }`;
  };
  const layers = Object.entries(enc.layers)
    .map(([id, l]) => `    ${j(id)}: ${layer(l)}`)
    .join(",\n");
  return [
    "{",
    `  "version": ${enc.version},`,
    `  "game": ${j(enc.game)},`,
    `  "map": ${j(enc.map)},`,
    `  "name": ${j(enc.name)},`,
    `  "meta": ${j(enc.meta)},`,
    `  "layers": {\n${layers}\n  }`,
    "}",
    "",
  ].join("\n");
}

/** Sparse keys in row order (y, then x). */
function sparseKeys(cells: Record<string, unknown>): string[] {
  const xy = (k: string) => k.split(",").map(Number);
  return Object.keys(cells).sort((a, b) => {
    const [ax, ay] = xy(a);
    const [bx, by] = xy(b);
    return ay - by || ax - bx;
  });
}

export function parseDocJson(text: string): Record<string, unknown> {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
    return raw;
  } catch (e) {
    throw new DocFormatError(`not JSON: ${(e as Error).message}`);
  }
}

/** Cell rect of one grid-layer cell. */
export function cellRect(grid: string, x: number, y: number): Rect {
  return { grid, x, y, w: 1, h: 1 };
}
