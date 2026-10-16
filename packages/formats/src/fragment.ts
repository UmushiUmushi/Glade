// The clipboard fragment: what Copy puts on the clipboard. Positions inside are relative to
// `origin`, so it pastes anywhere. `content` belongs to the game's edit package, which knows what
// each part holds and what a target map takes; here it is only carried.

import type { GameProfile } from "@glade/core";
import { andThen, err, gladeError, ok, pipe, type GladeError, type Result } from "@glade/errors";
import { z } from "zod";
import { checkGame, checkKind, shapeReason } from "./envelope";
import { parseJsonObject, type JsonObject } from "./json";
import { migrateFile } from "./migrate";

const fragmentSchema = z.object({
  glade: z.literal("fragment"),
  format: z.number().int(),
  game: z.string().min(1),
  /** The map type it came from. */
  map: z.string().min(1),
  mode: z.string().min(1),
  origin: z.object({ grid: z.string().min(1), x: z.number().int(), y: z.number().int() }),
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  content: z.record(z.string(), z.unknown()),
});

export type Fragment = z.infer<typeof fragmentSchema>;

export function writeFragment(fragment: Fragment): string {
  return JSON.stringify(fragment);
}

function checkShape(file: JsonObject): Result<Fragment, GladeError> {
  const parsed = fragmentSchema.safeParse(file);
  if (!parsed.success) {
    return err(
      gladeError("GLD-FILE-001", { detail: { reason: shapeReason(parsed.error.issues) } }),
    );
  }
  return ok(parsed.data);
}

/** The map type it names is one this game has. */
function checkMapType(game: GameProfile) {
  return (fragment: Fragment): Result<Fragment, GladeError> =>
    fragment.map in game.maps
      ? ok(fragment)
      : err(gladeError("GLD-FILE-001", { detail: { reason: "unknown map type" } }));
}

/** Read clipboard text for a game. Text from anywhere else is GLD-FILE-001, and paste ignores it. */
export function readFragment(text: string, game: GameProfile): Result<Fragment, GladeError> {
  return pipe(
    parseJsonObject(text),
    andThen(checkKind("fragment")),
    andThen((file) => migrateFile("fragment", file)),
    andThen(checkShape),
    andThen(checkGame<Fragment>(game)),
    andThen(checkMapType(game)),
  );
}
