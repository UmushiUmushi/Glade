// Committed maps never change: the screen's copy, the undo history and the 3D view all hold the
// same objects. Freezing them makes an op that edits a value in place, instead of replacing it,
// fail at once instead of quietly changing the map everyone shares.

import type { Doc } from "@glade/core";

/** Freeze a value and everything inside it. Already frozen parts are skipped. */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value))
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  return value;
}

/** Freeze a whole map, once, when it is loaded or made. */
export function freezeDoc(doc: Doc): Doc {
  return deepFreeze(doc);
}
