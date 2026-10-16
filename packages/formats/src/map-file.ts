// The map file (.glade-map.json): the profile's own map file, unchanged, inside an envelope that
// adds the packs the map needs and how it was last viewed. A bare map file (the profile's own)
// is wrapped on load, so both kinds open.

import {
  loadMap,
  mapGameId,
  serializeMap,
  type Doc,
  type GameProfile,
  type MapDefinition,
} from "@glade/core";
import {
  andThen,
  err,
  gladeError,
  ok,
  pipe,
  tryCatch,
  type GladeError,
  type Result,
} from "@glade/errors";
import { z } from "zod";
import { checkGame, checkKind, shapeReason } from "./envelope";
import { parseJsonObject, type JsonObject } from "./json";
import { currentFormat, migrateFile } from "./migrate";

/** A pack version a map needs. */
export const packRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string(),
  hash: z.string(),
});

/** How the map was last viewed. Every part is optional. */
export const mapViewSchema = z
  .object({
    mode: z.string(),
    time: z.number(),
    season: z.string(),
    view: z.enum(["2d", "3d"]),
    camera: z.enum(["iso", "top", "walk"]),
  })
  .partial();

const mapFileSchema = z.object({
  glade: z.literal("map"),
  format: z.number().int(),
  game: z.string().min(1),
  packs: z.array(packRefSchema),
  view: mapViewSchema.optional(),
  map: z.record(z.string(), z.unknown()),
});

export type PackRef = z.infer<typeof packRefSchema>;
export type MapView = z.infer<typeof mapViewSchema>;
export type MapFile = z.infer<typeof mapFileSchema>;

export interface LoadedMap {
  doc: Doc;
  packs: PackRef[];
  view?: MapView;
  /** The file was a bare map, not a Glade map file. */
  bare: boolean;
}

export function mapFile(
  doc: Doc,
  map: MapDefinition,
  extras: { packs?: PackRef[]; view?: MapView } = {},
): MapFile {
  const file: MapFile = {
    glade: "map",
    format: currentFormat("map"),
    game: doc.game,
    packs: extras.packs ?? [],
    map: JSON.parse(serializeMap(doc, map)) as JsonObject,
  };
  if (extras.view) file.view = extras.view;
  return file;
}

export function writeMapFile(
  doc: Doc,
  map: MapDefinition,
  extras: { packs?: PackRef[]; view?: MapView } = {},
): string {
  return JSON.stringify(mapFile(doc, map, extras));
}

/** Step 2: a Glade map file passes; a bare map file (it has a version and layers) is wrapped. */
function toEnvelope(file: JsonObject): Result<JsonObject & { bare?: true }, GladeError> {
  if ("glade" in file) return checkKind("map")(file);
  if (typeof file.version !== "number" || typeof file.layers !== "object") {
    return err(gladeError("GLD-FILE-001", { detail: { reason: "not a map file" } }));
  }
  const game = tryCatch(
    () => mapGameId(file),
    (cause) => gladeError("GLD-FILE-001", { detail: { reason: "map names no game" }, cause }),
  );
  if (!game.ok) return game;
  return ok({
    glade: "map",
    format: currentFormat("map"),
    game: game.value,
    packs: [],
    map: file,
    bare: true,
  });
}

/** Step 4: the envelope has the right shape. */
function checkShape(file: JsonObject): Result<MapFile & { bare: boolean }, GladeError> {
  const parsed = mapFileSchema.safeParse(file);
  if (!parsed.success) {
    return err(
      gladeError("GLD-FILE-001", { detail: { reason: shapeReason(parsed.error.issues) } }),
    );
  }
  return ok({ ...parsed.data, bare: file.bare === true });
}

/** Step 6: the profile reads its own map, migrating older versions. */
function loadInner(game: GameProfile) {
  return (file: MapFile & { bare: boolean }): Result<LoadedMap, GladeError> => {
    const doc = tryCatch(
      () => loadMap(file.map, game),
      (cause) => gladeError("GLD-FILE-001", { detail: { reason: "the map inside" }, cause }),
    );
    if (!doc.ok) return doc;
    const loaded: LoadedMap = { doc: doc.value, packs: file.packs, bare: file.bare };
    if (file.view) loaded.view = file.view;
    return ok(loaded);
  };
}

/** Read a map file for a game: check it, upgrade it, and load the map through its profile. */
export function readMapFile(text: string, game: GameProfile): Result<LoadedMap, GladeError> {
  return pipe(
    parseJsonObject(text), // 1. text → JSON
    andThen(toEnvelope), // 2. a Glade map file, or a bare map to wrap?
    andThen((file) => migrateFile("map", file)), // 3. old format → current format
    andThen(checkShape), // 4. the envelope's fields
    andThen(checkGame(game)), // 5. this game's map?
    andThen(loadInner(game)), // 6. the profile decodes and migrates the map
  );
}
