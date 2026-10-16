// The pack file (.glade-pack.json): custom items made in the builder. Each item has its catalog
// entry (read by the profile), its meta (read by Glade: name, category, tags) and its builder
// recipe. Every type and kind a pack adds starts with `pack:<pack id>:`, so packs never collide
// with the base catalog or with each other.

import { catalogProblems, type Catalog, type GameProfile, type MapDefinition } from "@glade/core";
import { andThen, err, gladeError, ok, pipe, type GladeError, type Result } from "@glade/errors";
import { z } from "zod";
import { checkGame, checkKind, shapeReason } from "./envelope";
import { parseJsonObject, type JsonObject } from "./json";
import { migrateFile } from "./migrate";

const kindSchema = z.object({
  kind: z.string().min(1),
  parent: z.string().optional(),
  description: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
  rules: z.array(z.string()).optional(),
});

/**
 * What Glade shows and searches: the drawer tile, the Save step's form. Game facts about an item
 * (where it may go) live in its entry, where the profile's rules read them.
 */
export const itemMetaSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().min(1),
  tags: z.array(z.string().min(1).max(40)).max(20),
  description: z.string().max(500).optional(),
});

const packItemSchema = z.object({
  /** The catalog entry: the profile checks every other field. */
  entry: z.looseObject({ type: z.string().min(1), kind: z.string().min(1) }),
  meta: itemMetaSchema,
  /** The builder's recipe. Items made outside the builder have none. */
  recipe: z.looseObject({ builder: z.number().int().positive() }).optional(),
});

const packFileSchema = z.object({
  glade: z.literal("pack"),
  format: z.number().int(),
  id: z.string().min(1),
  version: z.number().int().positive(),
  game: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  kinds: z.array(kindSchema),
  items: z.array(packItemSchema),
});

export type ItemMeta = z.infer<typeof itemMetaSchema>;
export type PackItem = z.infer<typeof packItemSchema>;
export type PackFile = z.infer<typeof packFileSchema>;

export function writePackFile(pack: PackFile): string {
  return JSON.stringify(pack);
}

/** Types and kinds this pack adds that don't start with its own prefix. */
export function prefixProblems(pack: PackFile): string[] {
  const prefix = `pack:${pack.id}:`;
  return [
    ...pack.kinds.filter((k) => !k.kind.startsWith(prefix)).map((k) => `kind ${k.kind}`),
    ...pack.items
      .filter((i) => !i.entry.type.startsWith(prefix))
      .map((i) => `type ${i.entry.type}`),
  ].map((what) => `${what} doesn't start with ${prefix}`);
}

/** The pack as a catalog, to bind to a map or add to the base catalog. */
export function packCatalog(pack: PackFile): Catalog {
  return { entries: pack.items.map((item) => item.entry), kinds: pack.kinds };
}

/** Everything wrong with a pack for one of the game's maps: its prefixes, its entries, its kinds. */
export function packProblems(pack: PackFile, map: MapDefinition): string[] {
  return [...prefixProblems(pack), ...catalogProblems(map, packCatalog(pack))];
}

function checkShape(file: JsonObject): Result<PackFile, GladeError> {
  const parsed = packFileSchema.safeParse(file);
  if (!parsed.success) {
    return err(
      gladeError("GLD-FILE-001", { detail: { reason: shapeReason(parsed.error.issues) } }),
    );
  }
  return ok(parsed.data);
}

function checkPrefixes(pack: PackFile): Result<PackFile, GladeError> {
  const problems = prefixProblems(pack);
  if (!problems.length) return ok(pack);
  return err(gladeError("GLD-FILE-001", { detail: { reason: problems[0].slice(0, 64) } }));
}

/** Read a pack file for a game. Its entries are checked against a map with `packProblems`. */
export function readPackFile(text: string, game: GameProfile): Result<PackFile, GladeError> {
  return pipe(
    parseJsonObject(text), // 1. text → JSON
    andThen(checkKind("pack")), // 2. a pack file?
    andThen((file) => migrateFile("pack", file)), // 3. old format → current format
    andThen(checkShape), // 4. its fields
    andThen(checkGame<PackFile>(game)), // 5. this game's pack?
    andThen(checkPrefixes), // 6. everything it adds is its own
  );
}
