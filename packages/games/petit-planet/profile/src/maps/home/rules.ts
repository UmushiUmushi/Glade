// A home's rules. Every rule is code with a test (tests/home/). Items go where their mount says
// (O1), ids are unique (O2), the home takes no plants, paths, bridges, inclines or buildings (K1),
// floor items stand wholly on one room's floor apart (H1), wall items hang wholly on their wall,
// clear of its doors, apart (H2), ceiling items hang wholly under one room's ceiling apart (H3),
// and each room has one wallpaper and one flooring at most (H4). Things on surfaces follow the
// game's surface rules (S1 to S3).

import { excludesRule, type Cell, type Rule, type Violation } from "@glade/core";
import { baseOf, catalogEntry, mountOf, type Catalog, type Mount } from "../../catalog";
import { onSurfaces, surfaceRules } from "../../surfaces";
import { doorsOn, roomRect, SIDES, type HomeLayout, type Room, type Side } from "./layout";
import {
  ceilingItems,
  coverings,
  floorItems,
  homeHosts,
  planeRect,
  wallGrid,
  wallItems,
  wallRect,
  type FloorItem,
  type Half,
  type WallItem,
} from "./model";

const overlaps = (a: Half, b: Half) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Half, b: Half) =>
  a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/** Where a home's things are on its plane, in half tiles (grid indices of "minor"). */
export class HomePlane {
  private readonly ox: number;
  private readonly oy: number;

  constructor(readonly layout: HomeLayout) {
    this.ox = Math.min(...layout.rooms.map((r) => r.at[0]));
    this.oy = Math.min(...layout.rooms.map((r) => r.at[1]));
  }

  room(id: string): Room | undefined {
    return this.layout.rooms.find((r) => r.id === id);
  }

  /** A room's floor in half tiles. */
  floor(r: Room): Half {
    const t = roomRect(r);
    return { x: 2 * (t.x - this.ox), y: 2 * (t.y - this.oy), w: 2 * t.w, h: 2 * t.h };
  }

  /** The room a rect of half tiles lies wholly in, if any. */
  roomOf(rect: Half): Room | undefined {
    return this.layout.rooms.find((r) => inside(rect, this.floor(r)));
  }

  /** The half tiles of floor along a wall, under the span x0..x1 (half tiles across it). */
  strip(r: Room, side: Side, x0: number, x1: number): Half {
    const f = this.floor(r);
    const [a, b] = [Math.max(0, x0), Math.max(x0 + 1, x1)];
    switch (side) {
      case "north":
        return { x: f.x + a, y: f.y, w: b - a, h: 1 };
      case "east":
        return { x: f.x + f.w - 1, y: f.y + a, w: 1, h: b - a };
      case "south":
        return { x: f.x + f.w - b, y: f.y + f.h - 1, w: b - a, h: 1 };
      case "west":
        return { x: f.x, y: f.y + f.h - b, w: 1, h: b - a };
    }
  }

  /** Where a wall item is on the plane: the floor along its wall under it (or its room's floor). */
  wallItemCells(catalog: Catalog, item: WallItem): Half | null {
    const r = this.room(item.room);
    if (!r) return null;
    if (!SIDES.includes(item.wall)) return this.floor(r);
    const w = wallRect(catalog, item);
    return this.strip(r, item.wall, w.x, w.x + w.w);
  }
}

export function cellsOf(h: Half | null): Cell[] {
  if (!h) return [];
  const out: Cell[] = [];
  for (let y = h.y; y < h.y + h.h; y++) {
    for (let x = h.x; x < h.x + h.w; x++) out.push({ grid: "minor", x, y });
  }
  return out;
}

const ROTATIONS = [0, 90, 180, 270];

/** The rules of a home with this layout. */
export function homeRules(layout: HomeLayout): Rule[] {
  const plane = new HomePlane(layout);
  const catalogOf = (ctx: { game: { catalog: unknown } }) => ctx.game.catalog as Catalog;
  return [
    {
      id: "O1",
      name: "known-type",
      description:
        "Items use catalog types and go where their mount says: floor items on floors (turned 0, " +
        "90, 180 or 270), wall items on walls, ceiling items on ceilings.",
      local: false,
      check(doc, ctx) {
        const catalog = catalogOf(ctx);
        const out: Violation[] = [];
        const check = (
          item: { id: string; type: string; rot?: number },
          want: Mount,
          cells: Cell[],
        ) => {
          const problems: string[] = [];
          const e = catalogEntry(catalog, item.type);
          if (!e) problems.push(`unknown type "${item.type}" (not in the catalog)`);
          else if (mountOf(catalog, item.type) !== want) {
            problems.push(`"${item.type}" goes on a ${mountOf(catalog, item.type)}, not a ${want}`);
          }
          if (item.rot !== undefined && !ROTATIONS.includes(item.rot))
            problems.push(`rotation ${item.rot}`);
          if (problems.length) {
            out.push({
              ruleId: "O1",
              message: `${item.id}: ${problems.join("; ")}`,
              cells,
              objectIds: [item.id],
            });
          }
        };
        for (const i of floorItems(doc)) check(i, "floor", cellsOf(planeRect(catalog, i)));
        for (const i of wallItems(doc)) check(i, "wall", cellsOf(plane.wallItemCells(catalog, i)));
        for (const i of ceilingItems(doc)) check(i, "ceiling", cellsOf(planeRect(catalog, i)));
        return out;
      },
    },
    {
      id: "O2",
      name: "unique-id",
      description:
        "Every id is unique: items on floors, walls and ceilings, coverings, things on surfaces.",
      local: false,
      check(doc) {
        const seen = new Map<string, number>();
        const all = [
          ...floorItems(doc),
          ...wallItems(doc),
          ...ceilingItems(doc),
          ...coverings(doc),
          ...onSurfaces(doc),
        ];
        for (const o of all) seen.set(o.id, (seen.get(o.id) ?? 0) + 1);
        return [...seen]
          .filter(([, n]) => n > 1)
          .map(([id, n]) => ({
            ruleId: "O2",
            message: `id ${id} is used by ${n} things`,
            cells: [],
            objectIds: [id],
          }));
      },
    },
    excludesRule("K1"),
    {
      id: "H1",
      name: "on-the-floor",
      description: "A floor item stands wholly on one room's floor, apart from the others.",
      local: false,
      check: (doc, ctx) => planeRule("H1", "floor", floorItems(doc), catalogOf(ctx)),
    },
    {
      id: "H2",
      name: "on-the-wall",
      description:
        "A wall item hangs wholly on its room's wall, clear of the wall's doors, apart from the " +
        "others on that wall.",
      local: false,
      check(doc, ctx) {
        const catalog = catalogOf(ctx);
        const out: Violation[] = [];
        const byWall = new Map<string, { item: WallItem; rect: Half }[]>();
        for (const item of wallItems(doc)) {
          const r = plane.room(item.room);
          const cells = cellsOf(plane.wallItemCells(catalog, item));
          const say = (why: string) =>
            out.push({
              ruleId: "H2",
              message: `${item.type} ${item.id} ${why}`,
              cells,
              objectIds: [item.id],
            });
          if (!r) {
            say(`is in room ${item.room}, which this home does not have`);
            continue;
          }
          if (!SIDES.includes(item.wall)) {
            say(`is on wall "${item.wall}"; a wall is north, east, south or west`);
            continue;
          }
          const rect = wallRect(catalog, item);
          const g = wallGrid(r, item.wall);
          if (![rect.x, rect.y].every(Number.isInteger) || !inside(rect, { x: 0, y: 0, ...g })) {
            say(
              `is off the ${item.wall} wall of ${r.id} (${g.w / 2} tiles across, ${g.h / 2} blocks up)`,
            );
          }
          for (const d of doorsOn(r, item.wall)) {
            const door = { x: 2 * d.s0, y: 0, w: 2 * (d.s1 - d.s0), h: 2 * d.h };
            if (overlaps(rect, door)) say(`covers a door of the ${item.wall} wall of ${r.id}`);
          }
          const key = `${r.id}/${item.wall}`;
          byWall.set(key, [...(byWall.get(key) ?? []), { item, rect }]);
        }
        for (const list of byWall.values()) {
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              const [a, b] = [list[i], list[j]];
              if (!overlaps(a.rect, b.rect)) continue;
              out.push({
                ruleId: "H2",
                message: `${a.item.type} ${a.item.id} and ${b.item.type} ${b.item.id} overlap on their wall`,
                cells: cellsOf(plane.wallItemCells(catalog, a.item)),
                objectIds: [a.item.id, b.item.id],
              });
            }
          }
        }
        return out;
      },
    },
    {
      id: "H3",
      name: "under-the-ceiling",
      description: "A ceiling item hangs wholly under one room's ceiling, apart from the others.",
      local: false,
      check: (doc, ctx) => planeRule("H3", "ceiling", ceilingItems(doc), catalogOf(ctx)),
    },
    {
      id: "H4",
      name: "coverings",
      description: "A room has one wallpaper and one flooring at most, each of its own kind.",
      local: false,
      check(doc, ctx) {
        const catalog = catalogOf(ctx);
        const out: Violation[] = [];
        const seen = new Map<string, string>();
        for (const c of coverings(doc)) {
          const r = plane.room(c.room);
          const base = baseOf(catalog, c.type);
          const cells = r ? cellsOf(plane.floor(r)) : [];
          const say = (why: string) =>
            out.push({
              ruleId: "H4",
              message: `${c.type} ${c.id} ${why}`,
              cells,
              objectIds: [c.id],
            });
          if (!r) say(`covers room ${c.room}, which this home does not have`);
          else if (base !== "wallpaper" && base !== "flooring") say("is not wallpaper or flooring");
          else {
            const key = `${c.room}/${base}`;
            if (seen.has(key)) say(`is a second ${base} in ${c.room} (with ${seen.get(key)})`);
            seen.set(key, c.id);
          }
        }
        return out;
      },
    },
    ...surfaceRules(homeHosts, "minor"),
  ];

  /** Items on the plane (floors or ceilings): wholly in one room, apart. */
  function planeRule(id: string, where: string, items: FloorItem[], catalog: Catalog): Violation[] {
    const out: Violation[] = [];
    const rects = items.map((item) => ({ item, rect: planeRect(catalog, item) }));
    for (const { item, rect } of rects) {
      if (!plane.roomOf(rect)) {
        out.push({
          ruleId: id,
          message: `${item.type} ${item.id} is not wholly on one room's ${where}`,
          cells: cellsOf(rect),
          objectIds: [item.id],
        });
      }
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const [a, b] = [rects[i], rects[j]];
        if (!overlaps(a.rect, b.rect)) continue;
        out.push({
          ruleId: id,
          message: `${a.item.type} ${a.item.id} and ${b.item.type} ${b.item.id} overlap`,
          cells: cellsOf(a.rect),
          objectIds: [a.item.id, b.item.id],
        });
      }
    }
    return out;
  }
}
