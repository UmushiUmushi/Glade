// Map files are plain JSON: a version-3 Doc whose layers are written by its map's codecs, one grid
// row, sparse cell or entity per line so diffs stay readable. A file names its game and which of
// the game's maps it is; a version-2 file has no map and is the game's default map. Anything older
// goes through the map's migrate().

import {
  decodeDoc,
  DOC_VERSION,
  DocFormatError,
  parseDocJson,
  serializeDoc,
  type Doc,
  type EncodedDoc,
} from "./doc";
import type { GameProfile, MapDefinition } from "./game";

export { DocFormatError as MapFormatError };

/** A game, or a way to find the game a file names (by its id or a former id). */
export type GameSource = GameProfile | ((id: string) => GameProfile);

export function serializeMap(doc: Doc, map: MapDefinition): string {
  return serializeDoc(map.layers, doc);
}

/** The game a map file is for (version 2 and later "game", version 1 "profile"). */
export function mapGameId(raw: Record<string, unknown>): string {
  const id =
    typeof raw.version === "number" && raw.version >= 2 ? raw.game : (raw.game ?? raw.profile);
  if (typeof id !== "string") throw new DocFormatError("missing game");
  return id;
}

/** Which of a game's maps a file is: its `map`, or the game's default map for older files. */
export function mapOf<M extends MapDefinition>(
  game: GameProfile<M>,
  raw: Record<string, unknown>,
): M {
  const id = raw.map ?? game.defaultMap;
  const map = typeof id === "string" ? game.maps[id] : undefined;
  if (!map) {
    throw new DocFormatError(
      `${game.id} has no map ${JSON.stringify(id)}; it has ${Object.keys(game.maps).join(", ")}`,
    );
  }
  return map;
}

/** Parse a map file for its game, migrating older formats. */
export function deserializeMap(text: string, games: GameSource): Doc {
  return loadMap(parseDocJson(text), games);
}

/** A map file that is already parsed (e.g. a JSON import) for its game, migrating older formats. */
export function loadMap(raw: Record<string, unknown>, games: GameSource): Doc {
  if (typeof raw.version !== "number" || raw.version > DOC_VERSION || raw.version < 1) {
    throw new DocFormatError(`unsupported version ${String(raw.version)}`);
  }
  const id = mapGameId(raw);
  if (typeof raw.name !== "string") throw new DocFormatError("missing name");
  const game = typeof games === "function" ? games(id) : games;
  if (game.id !== id && !game.formerIds?.includes(id)) {
    throw new DocFormatError(`map is for game ${id}, not ${game.id}`);
  }
  const map = mapOf(game, raw);
  const doc =
    raw.version >= 2
      ? // Version 2 is version 3 without a map.
        decodeDoc(map.layers, map.space, {
          ...raw,
          version: DOC_VERSION,
          map: map.id,
        } as EncodedDoc)
      : map.migrate(raw).doc;
  return { ...doc, game: game.id, map: map.id };
}
