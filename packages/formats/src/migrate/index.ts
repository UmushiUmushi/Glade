// Format versions (docs/server/formats.md): one function per step, run in order on load. A file
// kind's current format is its number of steps plus one, so adding a step is the whole change.
// The profile's own migrate runs after these, on the inner map.

import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";
import type { JsonObject } from "../json";

export type FileKind = "map" | "pack" | "fragment";

/** Turns a file of format n into format n + 1. */
export type MigrationStep = (file: JsonObject) => JsonObject;

/** MIGRATIONS.map[0] turns a format 1 map file into format 2, and so on. None are needed yet. */
export const MIGRATIONS: Record<FileKind, readonly MigrationStep[]> = {
  map: [],
  pack: [],
  fragment: [],
};

export function currentFormat(kind: FileKind, steps = MIGRATIONS[kind]): number {
  return steps.length + 1;
}

/** Run every step from the file's format to the current one. A file from the future is refused. */
export function migrateFile(
  kind: FileKind,
  file: JsonObject,
  steps: readonly MigrationStep[] = MIGRATIONS[kind],
): Result<JsonObject, GladeError> {
  const from = file.format;
  if (typeof from !== "number" || !Number.isInteger(from) || from < 1) {
    return err(gladeError("GLD-FILE-001", { detail: { reason: "no format version" } }));
  }
  const current = currentFormat(kind, steps);
  if (from > current) return err(gladeError("GLD-FILE-003", { detail: { format: from } }));
  let out = file;
  for (let format = from; format < current; format++) {
    out = { ...steps[format - 1](out), format: format + 1 };
  }
  return ok(out);
}
