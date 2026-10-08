// Surfaces: the tops of tables, stalls and counters, where small things can stand. An entry with
// a `surface` has a top with its own grid, and an entry that is `placeable` can stand on one, with
// a footprint in that grid; sizes are in half cells of the surface's grid, as ground footprints
// are in half tiles. The grid turns with its item, and a thing on it turns with it too (plus its
// own rotation). Nothing stacks: an entry has a surface or is placeable, never both. Every map of
// the game stores things on surfaces in an `onSurfaces` layer and checks them with these rules.

import {
  entities,
  type Entity,
  type EntityLayerSpec,
  type Doc,
  type Rule,
  type Violation,
} from "@glade/core";
import { catalogEntry, type Catalog } from "../catalog";

export type Turn = 0 | 90 | 180 | 270;

/** A thing standing on a surface: `on` is the id of the item whose surface it is. */
export interface OnSurface extends Entity {
  id: string;
  type: string;
  on: string;
  /** Top-left of its turned footprint, in half cells of the surface's grid. */
  x: number;
  y: number;
  /** Turned on the surface, clockwise from above (the surface turns with its item too). */
  rot: Turn;
}

/** A rect of half cells (of the ground, or of a surface). */
export interface Cells {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An item with a surface, as it stands on the map: its turned footprint in half tiles. */
export interface Host {
  type: string;
  rect: Cells;
  rot: Turn;
}

export const ON_SURFACES = "onSurfaces";

export const onSurfacesLayer: EntityLayerSpec = {
  kind: "entities",
  description: "placeable things standing on items with a surface (tables, stalls, counters)",
  label: "things on surfaces",
  quiet: true,
  omitWhenEmpty: true,
};

/** The things on surfaces in a document. */
export const onSurfaces = (doc: Doc): OnSurface[] =>
  doc.layers[ON_SURFACES] ? entities<OnSurface>(doc, ON_SURFACES) : [];

/** The surface of the entry named `type` (half cells of its grid), if it has one. */
export function surfaceOf(catalog: Catalog, type: string): { w: number; h: number } | undefined {
  return catalogEntry(catalog, type)?.surface;
}

/** A thing's footprint on its surface, turned by its own rotation, in the surface's half cells. */
export function onSurfaceCells(catalog: Catalog, thing: OnSurface): Cells | null {
  const p = catalogEntry(catalog, thing.type)?.placeable;
  if (!p) return null;
  const turned = thing.rot === 90 || thing.rot === 270;
  return { x: thing.x, y: thing.y, w: turned ? p.h : p.w, h: turned ? p.w : p.h };
}

/** A point in a unit square at rotation 0, turned clockwise (from above) within the square. */
function turn(nx: number, ny: number, rot: Turn): [number, number] {
  switch (rot) {
    case 0:
      return [nx, ny];
    case 90:
      return [1 - ny, nx];
    case 180:
      return [1 - nx, 1 - ny];
    case 270:
      return [ny, 1 - nx];
  }
}

/**
 * Where a thing on a surface sits on the map: the box it covers, in half tiles (not whole cells:
 * a surface's cells are smaller), and its rotation on the map. Null when its host has no surface
 * or the thing is not placeable.
 */
export function onSurfaceBox(
  catalog: Catalog,
  host: Host,
  thing: OnSurface,
): (Cells & { rot: Turn }) | null {
  const s = surfaceOf(catalog, host.type);
  const c = onSurfaceCells(catalog, thing);
  if (!s || !c) return null;
  const corners = [
    turn(c.x / s.w, c.y / s.h, host.rot),
    turn((c.x + c.w) / s.w, (c.y + c.h) / s.h, host.rot),
  ];
  const xs = corners.map(([nx]) => host.rect.x + nx * host.rect.w);
  const ys = corners.map(([, ny]) => host.rect.y + ny * host.rect.h);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rot: ((host.rot + thing.rot) % 360) as Turn };
}

/** The whole half tiles a box covers. */
export function coveringCells(b: Cells): Cells {
  const [x0, y0] = [Math.floor(b.x + 1e-9), Math.floor(b.y + 1e-9)];
  const [x1, y1] = [Math.ceil(b.x + b.w - 1e-9), Math.ceil(b.y + b.h - 1e-9)];
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

const overlaps = (a: Cells, b: Cells) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The surface rules for a map, given how to find the items that may have surfaces (by id) and the
 * map's half-tile grid (for the cells a violation names).
 */
export function surfaceRules(
  hosts: (doc: Doc, catalog: Catalog) => Map<string, Host>,
  grid: string,
): Rule[] {
  const cellsOf = (catalog: Catalog, host: Host | undefined, thing: OnSurface) => {
    const b = host && onSurfaceBox(catalog, host, thing);
    const r = b ? coveringCells(b) : host?.rect;
    if (!r) return [];
    const out = [];
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) out.push({ grid, x, y });
    return out;
  };
  const violation = (
    ruleId: string,
    message: string,
    catalog: Catalog,
    host: Host | undefined,
    thing: OnSurface,
  ): Violation => ({
    ruleId,
    message,
    cells: cellsOf(catalog, host, thing),
    objectIds: [thing.id],
  });
  return [
    {
      id: "S1",
      name: "on-a-surface",
      description:
        "A thing on a surface is placeable, stands on an item with a surface, and is turned 0, " +
        "90, 180 or 270. Nothing stacks: a thing with a surface of its own never stands on one.",
      local: false,
      check(doc, ctx) {
        const catalog = ctx.game.catalog as Catalog;
        const all = hosts(doc, catalog);
        const out: Violation[] = [];
        for (const t of onSurfaces(doc)) {
          const host = all.get(t.on);
          const e = catalogEntry(catalog, t.type);
          const problems: string[] = [];
          if (!e) problems.push(`unknown type "${t.type}" (not in the catalog)`);
          else if (e.surface)
            problems.push(`"${t.type}" has a surface of its own, so nothing stacks`);
          else if (!e.placeable) problems.push(`"${t.type}" is not placeable on a surface`);
          if (!host) problems.push(`it stands on ${t.on}, which is not on the map`);
          else if (!surfaceOf(catalog, host.type))
            problems.push(`${t.on} (${host.type}) has no surface`);
          if (![0, 90, 180, 270].includes(t.rot)) problems.push(`rotation ${t.rot}`);
          if (problems.length) {
            out.push(
              violation("S1", `${t.type} ${t.id}: ${problems.join("; ")}`, catalog, host, t),
            );
          }
        }
        return out;
      },
    },
    {
      id: "S2",
      name: "fits-the-surface",
      description: "A thing on a surface stands wholly on it, on its grid's half cells.",
      local: false,
      check(doc, ctx) {
        const catalog = ctx.game.catalog as Catalog;
        const all = hosts(doc, catalog);
        const out: Violation[] = [];
        for (const t of onSurfaces(doc)) {
          const host = all.get(t.on);
          const s = host && surfaceOf(catalog, host.type);
          const c = onSurfaceCells(catalog, t);
          if (!s || !c) continue;
          const whole = [c.x, c.y].every(Number.isInteger);
          if (!whole || c.x < 0 || c.y < 0 || c.x + c.w > s.w || c.y + c.h > s.h) {
            out.push(
              violation(
                "S2",
                `${t.type} ${t.id} at ${c.x},${c.y} (${c.w}x${c.h}) is off ${t.on}'s ` +
                  `${s.w}x${s.h} surface`,
                catalog,
                host,
                t,
              ),
            );
          }
        }
        return out;
      },
    },
    {
      id: "S3",
      name: "surface-overlap",
      description: "Things on the same surface do not overlap.",
      local: false,
      check(doc, ctx) {
        const catalog = ctx.game.catalog as Catalog;
        const all = hosts(doc, catalog);
        const out: Violation[] = [];
        const byHost = new Map<string, { t: OnSurface; c: Cells }[]>();
        for (const t of onSurfaces(doc)) {
          const c = onSurfaceCells(catalog, t);
          if (c) byHost.set(t.on, [...(byHost.get(t.on) ?? []), { t, c }]);
        }
        for (const [on, list] of byHost) {
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              const [a, b] = [list[i], list[j]];
              if (!overlaps(a.c, b.c)) continue;
              const v = violation(
                "S3",
                `${a.t.type} ${a.t.id} and ${b.t.type} ${b.t.id} overlap on ${on}`,
                catalog,
                all.get(on),
                a.t,
              );
              out.push({ ...v, objectIds: [a.t.id, b.t.id] });
            }
          }
        }
        return out;
      },
    },
  ];
}
