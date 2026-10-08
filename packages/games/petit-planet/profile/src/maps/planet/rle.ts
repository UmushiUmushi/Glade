// Terrain rows as run-length tokens "<h>[~][*count]" (the terrain layer's file codec), and decoding
// a saved map of any size (older maps may be smaller; migrate refits them). Pure, so the browser
// can use it too.

import {
  decodeDoc,
  decodeRleRow,
  DocFormatError,
  encodeRleRow,
  type EncodedDoc,
  type GridLayerSpec,
} from "@glade/core";
import { spaceOf, type GridSpec } from "./space";
import { layerSchema, type MapDoc, type TerrainCell } from "./model";
import { gridSpec, type Profile } from "./profile";

export { DocFormatError as MapFormatError };

const terrainCodec = () => {
  const spec = layerSchema().terrain as GridLayerSpec<TerrainCell>;
  if (spec.codec.kind !== "rle") throw new Error("terrain is run-length encoded");
  return spec.codec;
};

export function encodeTerrainRow(row: TerrainCell[]): string {
  return encodeRleRow(row, terrainCodec().token);
}

export function decodeTerrainRow(row: string): TerrainCell[] {
  try {
    return decodeRleRow(row, terrainCodec().parse);
  } catch (e) {
    throw new DocFormatError((e as Error).message);
  }
}

/** Decode a saved map; without a profile, grid sizes are taken from its terrain rows. */
export function decodeMap(encoded: EncodedDoc, profile?: Profile): MapDoc {
  const spec = profile ? gridSpec(profile) : specOf(encoded);
  return decodeDoc(layerSchema(profile), spaceOf(spec), encoded);
}

/** Map dimensions implied by an encoded map's terrain layer (terrain is major + 1). */
function specOf(encoded: EncodedDoc): GridSpec {
  const t = encoded.layers?.terrain;
  if (!t || t.kind !== "grid" || t.encoding !== "rle" || !t.rows.length) {
    throw new DocFormatError("missing terrain");
  }
  const w = decodeTerrainRow(t.rows[0]).length;
  return { majorW: w - 1, majorH: t.rows.length - 1, areaSize: 16 };
}
