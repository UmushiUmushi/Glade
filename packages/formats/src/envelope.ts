// What every Glade file shares: `glade` says which kind of file it is, `format` its version, and
// `game` which game it is for. These checks run on each kind of file before its own.

import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";
import type { GameProfile } from "@glade/core";
import type { JsonObject } from "./json";
import type { FileKind } from "./migrate";

/** The file says it is this kind of Glade file. */
export function checkKind(kind: FileKind) {
  return (file: JsonObject): Result<JsonObject, GladeError> => {
    if (file.glade === kind) return ok(file);
    const reason =
      typeof file.glade === "string" ? `a ${file.glade} file, not a ${kind}` : "no kind";
    return err(gladeError("GLD-FILE-001", { detail: { reason: reason.slice(0, 64) } }));
  };
}

/** The file is for this game, under its id or one it had before. */
export function checkGame<F extends { game: string }>(game: GameProfile) {
  return (file: F): Result<F, GladeError> =>
    file.game === game.id || game.formerIds?.includes(file.game)
      ? ok({ ...file, game: game.id })
      : err(gladeError("GLD-FILE-002", { detail: { game: file.game.slice(0, 64) } }));
}

/** Zod issues as one short reason for an error's detail. */
export function shapeReason(issues: { path: PropertyKey[]; message: string }[]): string {
  const first = issues[0];
  const where = first?.path.map(String).join(".") || "file";
  return `${where}: ${first?.message ?? "bad shape"}`.slice(0, 64);
}
