// The recording draft: a working copy of a map that ops change with ordinary writes
// (`cells[y][x] = v`, `items[id] = e`, `delete items[id]`), the same way the profile's writers do.
// It copies a row, or a layer's entity list, only when an op first writes to it, and records each
// cell's or entity's value before that first write. No full copy, no full diff.

import {
  deepEqual,
  type Doc,
  type Entity,
  type EntityLayer,
  type GridLayer,
  type Layer,
} from "@glade/core";
import { applyPatch, entityChange, orderChanges, type Change, type Patch } from "./patch";

export interface Draft {
  /** The map to give the ops. Reads see every write made so far. */
  readonly doc: Doc;
  /** What changed (writes that put a value back as it was are left out), and the new map. */
  finish(): { patch: Patch; doc: Doc };
}

/** The first value each written cell or entity had, by key. */
type Firsts = Map<string, () => Change | null>;

/** Array index from a property key, or null. */
function indexOf(prop: PropertyKey): number | null {
  if (typeof prop !== "string") return null;
  const n = Number(prop);
  return Number.isInteger(n) && n >= 0 && String(n) === prop ? n : null;
}

/** A proxy over a list whose contents live elsewhere (`current`), so frozen originals are fine. */
function listView(
  current: () => readonly unknown[],
  read: (i: number) => unknown,
  write: (i: number, value: unknown) => void,
): unknown[] {
  const view: unknown[] = new Proxy([], {
    get(_, prop, receiver) {
      if (prop === "length") return current().length;
      const i = indexOf(prop);
      return i === null ? Reflect.get(current(), prop, receiver) : read(i);
    },
    set(_, prop, value) {
      const i = indexOf(prop);
      if (i === null || i >= current().length) throw new TypeError("ops change cells, not rows");
      write(i, value);
      return true;
    },
    has: (_, prop) => prop in current(),
    ownKeys: () => [...current().keys()].map(String).concat("length"),
    getOwnPropertyDescriptor(_, prop) {
      if (prop === "length")
        return { value: current().length, writable: true, configurable: false };
      const i = indexOf(prop);
      if (i === null || i >= current().length) return undefined;
      return { value: read(i), writable: true, enumerable: true, configurable: true };
    },
    deleteProperty() {
      throw new TypeError("ops change cells, not rows");
    },
  });
  return view;
}

/** A grid layer whose rows are copied on first write. */
function draftGrid(id: string, base: GridLayer, firsts: Firsts): GridLayer {
  const copies = new Map<number, unknown[]>();
  const rowOf = (y: number) => copies.get(y) ?? base.cells[y];
  const rowViews = new Map<number, unknown[]>();
  const writeCell = (y: number) => (x: number, value: unknown) => {
    if (!copies.has(y)) copies.set(y, [...base.cells[y]]);
    const key = `${id}|${x},${y}`;
    if (!firsts.has(key)) {
      const before = base.cells[y][x];
      firsts.set(key, () => {
        const after = rowOf(y)[x];
        return deepEqual(before, after) ? null : { kind: "cell", layer: id, x, y, before, after };
      });
    }
    (copies.get(y) as unknown[])[x] = value;
  };
  const rowView = (y: number) => {
    if (!base.cells[y]) return undefined;
    let view = rowViews.get(y);
    if (!view) {
      view = listView(
        () => rowOf(y),
        (x) => rowOf(y)[x],
        writeCell(y),
      );
      rowViews.set(y, view);
    }
    return view;
  };
  const cells = listView(
    () => base.cells,
    rowView,
    () => {
      throw new TypeError("ops change cells, not rows");
    },
  );
  return Object.freeze({ ...base, cells: cells as unknown[][] });
}

/** An entity layer whose entity list is copied on first write. */
function draftEntities(id: string, base: EntityLayer, firsts: Firsts): EntityLayer {
  let copy: Record<string, Entity> | null = null;
  const current = () => copy ?? base.items;
  const remember = (key: string) => {
    copy ??= { ...base.items };
    const first = `${id}|#${key}`;
    if (firsts.has(first)) return;
    const before = base.items[key];
    firsts.set(first, () => {
      const after = current()[key];
      return deepEqual(before, after) ? null : entityChange(id, key, before, after);
    });
  };
  const items = new Proxy({} as Record<string, Entity>, {
    get: (_, key) => (typeof key === "string" ? current()[key] : undefined),
    set(_, key, value: Entity) {
      if (typeof key !== "string") return false;
      remember(key);
      (copy as Record<string, Entity>)[key] = value;
      return true;
    },
    deleteProperty(_, key) {
      if (typeof key !== "string") return false;
      remember(key);
      delete (copy as Record<string, Entity>)[key];
      return true;
    },
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== "string" || !(key in current())) return undefined;
      return { value: current()[key], writable: true, enumerable: true, configurable: true };
    },
  });
  return Object.freeze({ ...base, items });
}

export function createDraft(base: Doc): Draft {
  const firsts: Firsts = new Map();
  const layers: Record<string, Layer> = {};
  for (const [id, layer] of Object.entries(base.layers)) {
    layers[id] =
      layer.kind === "grid" ? draftGrid(id, layer, firsts) : draftEntities(id, layer, firsts);
  }
  const doc = Object.freeze({ ...base, layers: Object.freeze(layers) });
  return {
    doc,
    finish() {
      const changes = [...firsts.values()].map((change) => change()).filter((c) => c !== null);
      const patch = { changes: orderChanges(base, changes) };
      const next = applyPatch(base, patch);
      // A patch made from this map's own values always applies; if not, it is a bug in the draft.
      if (!next.ok) throw new Error("draft: its own patch didn't apply");
      return { patch, doc: next.value };
    },
  };
}
