// A patch: the exact before and after of every changed cell and entity. Applied forward it redoes a
// change; inverted it undoes one. Applying makes a new map object that shares every row and entity
// that didn't change, so the old map stays as it was and the 3D view can tell what to rebuild.

import { deepEqual, type Doc, type Entity, type EntityLayer, type GridLayer } from "@glade/core";
import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";
import { deepFreeze } from "./freeze";

export interface CellChange {
  kind: "cell";
  layer: string;
  x: number;
  y: number;
  before: unknown;
  after: unknown;
}

export interface EntityChange {
  kind: "entity";
  layer: string;
  id: string;
  /** Missing before: the entity was added. */
  before?: Entity;
  /** Missing after: the entity was removed. */
  after?: Entity;
}

export type Change = CellChange | EntityChange;

/** Changes in a fixed order: by layer, then row and column, or entity id. */
export interface Patch {
  readonly changes: readonly Change[];
}

export const EMPTY_PATCH: Patch = Object.freeze({ changes: Object.freeze([]) });

export function isEmptyPatch(patch: Patch): boolean {
  return patch.changes.length === 0;
}

/** The patch that undoes this one. */
export function invertPatch(patch: Patch): Patch {
  return { changes: patch.changes.map(invertChange) };
}

function invertChange(c: Change): Change {
  if (c.kind === "cell") return { ...c, before: c.after, after: c.before };
  return entityChange(c.layer, c.id, c.after, c.before);
}

/** An entity change, leaving out a missing side rather than storing `undefined`. */
export function entityChange(
  layer: string,
  id: string,
  before: Entity | undefined,
  after: Entity | undefined,
): EntityChange {
  const change: EntityChange = { kind: "entity", layer, id };
  if (before) change.before = before;
  if (after) change.after = after;
  return change;
}

/** Sort changes into the patch order. Layers keep the map's own layer order. */
export function orderChanges(doc: Doc, changes: Change[]): Change[] {
  const layerOrder = new Map(Object.keys(doc.layers).map((id, i) => [id, i]));
  const key = (c: Change): [number, number, number, string] =>
    c.kind === "cell"
      ? [layerOrder.get(c.layer) ?? 0, c.y, c.x, ""]
      : [layerOrder.get(c.layer) ?? 0, 0, 0, c.id];
  return changes.sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || ka[3].localeCompare(kb[3]);
  });
}

function mismatch(change: Change): GladeError {
  const where = change.kind === "cell" ? `${change.x},${change.y}` : change.id;
  return gladeError("GLD-CHECK-001", {
    detail: { reason: "patch doesn't match the map", layer: change.layer, at: where },
  });
}

/** A grid layer with its changed rows copied and set; untouched rows are shared. */
function patchGrid(layer: GridLayer, changes: CellChange[]): Result<GridLayer, GladeError> {
  const cells = [...layer.cells];
  const copied = new Set<number>();
  for (const c of changes) {
    if (!deepEqual(cells[c.y]?.[c.x], c.before)) return err(mismatch(c));
    if (!copied.has(c.y)) {
      cells[c.y] = [...cells[c.y]];
      copied.add(c.y);
    }
    cells[c.y][c.x] = deepFreeze(c.after);
  }
  for (const y of copied) Object.freeze(cells[y]);
  return ok(Object.freeze({ ...layer, cells: Object.freeze(cells) as unknown[][] }));
}

/** An entity layer with its changed entities set or removed; the rest are shared. */
function patchEntities(
  layer: EntityLayer,
  changes: EntityChange[],
): Result<EntityLayer, GladeError> {
  const items: Record<string, Entity> = { ...layer.items };
  for (const c of changes) {
    if (!deepEqual(items[c.id], c.before)) return err(mismatch(c));
    if (c.after) items[c.id] = deepFreeze(c.after);
    else delete items[c.id];
  }
  return ok(Object.freeze({ ...layer, items: Object.freeze(items) }));
}

/**
 * Apply a patch: a new, frozen map. Every change's `before` must match the map, so a patch meant
 * for another map (an out-of-date copy) is refused instead of half applied.
 */
export function applyPatch(doc: Doc, patch: Patch): Result<Doc, GladeError> {
  if (isEmptyPatch(patch)) return ok(doc);
  const byLayer = new Map<string, Change[]>();
  for (const c of patch.changes) byLayer.set(c.layer, [...(byLayer.get(c.layer) ?? []), c]);
  const layers = { ...doc.layers };
  for (const [id, changes] of byLayer) {
    const layer = doc.layers[id];
    if (!layer) return err(mismatch(changes[0]));
    const next =
      layer.kind === "grid"
        ? patchGrid(layer, changes as CellChange[])
        : patchEntities(layer, changes as EntityChange[]);
    if (!next.ok) return next;
    layers[id] = next.value;
  }
  return ok(Object.freeze({ ...doc, layers: Object.freeze(layers) }));
}

/** Every change between two maps of the same map type, by comparing them in full. Slow: for tests. */
export function diffDocs(a: Doc, b: Doc): Patch {
  const changes: Change[] = [];
  for (const [id, la] of Object.entries(a.layers)) {
    const lb = b.layers[id];
    if (la.kind === "grid" && lb?.kind === "grid") {
      la.cells.forEach((row, y) =>
        row.forEach((before, x) => {
          const after = lb.cells[y][x];
          if (!deepEqual(before, after))
            changes.push({ kind: "cell", layer: id, x, y, before, after });
        }),
      );
    } else if (la.kind === "entities" && lb?.kind === "entities") {
      for (const key of new Set([...Object.keys(la.items), ...Object.keys(lb.items)])) {
        const [before, after] = [la.items[key], lb.items[key]];
        if (!deepEqual(before, after)) changes.push(entityChange(id, key, before, after));
      }
    }
  }
  return { changes: orderChanges(a, changes) };
}
