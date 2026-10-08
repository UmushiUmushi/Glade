// A showroom: every plant and item of a catalog laid out in rows on the flat land of a fresh map,
// two tiles apart, so each can be looked at in a 3D view. A linking piece (a fence) gets a short
// run of three so its links show. Bridges and inclines need water or cliffs, so they are left out.
// The map is valid with the catalog (tests/samples.test.ts).

import { profile } from "../src/maps/planet/data";
import { newMap, putItem, putPlant, type MapDoc } from "../src/maps/planet/model";
import { baseKind, objectEntries, type Catalog } from "../src/catalog";

/** Where the rows start and how wide they may run (major cells): north-west of the town center. */
const START = { X: 24, Y: 24 };
const WIDTH = 50;
const GAP = 2;

/** A map with each plant and item of `catalog` (or only `types`) laid out in rows. */
export function showroomMap(catalog: Catalog, types?: string[], now?: Date): MapDoc {
  const map = newMap(profile, "showroom", now);
  let [X, Y, rowDepth, n] = [START.X, START.Y, 0, 0];
  for (const e of objectEntries(catalog)) {
    const base = baseKind(catalog, e.kind);
    if (base === "bridge" || base === "incline") continue;
    if (types && !types.includes(e.type)) continue;
    const linking = base === "item" && e.connects && e.footprint.w === 2 && e.footprint.h === 2;
    const copies = linking ? 3 : 1;
    const w = Math.ceil(e.footprint.w / 2) * copies;
    const d = Math.ceil(e.footprint.h / 2);
    if (X + w > START.X + WIDTH && X > START.X) {
      [X, Y, rowDepth] = [START.X, Y + rowDepth + GAP, 0];
    }
    for (let k = 0; k < copies; k++) {
      const id = `s${++n}`;
      if (base === "plant") putPlant(map, { id, type: e.type, X: X + k, Y });
      else putItem(map, { id, type: e.type, mx: 2 * (X + k), my: 2 * Y, rot: 0 });
    }
    X += w + GAP;
    rowDepth = Math.max(rowDepth, d);
  }
  return map;
}
