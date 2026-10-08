// A home's layout: its rooms on one plane (in tiles, x right and y down), each with its size, its
// walls' height (in blocks) and its doors. A layout is data; homeMap(layout) makes a map of it, so
// one home map serves any number of rooms: a home of two rooms is two rooms side by side, with a
// door between them.
//
// A wall is measured as you see it from inside the room: across from your left to your right (in
// tiles), and up from the floor (in blocks). Each wall has a grid of 1 tile by 1 block cells, with
// half cells, like the floor.

export type Side = "north" | "east" | "south" | "west";
export const SIDES: Side[] = ["north", "east", "south", "west"];

export interface Door {
  wall: Side;
  /** Where it starts across the wall, in tiles from the left as seen from inside. */
  at: number;
  /** Tiles across (default 2). */
  width?: number;
  /** Blocks up (default 2). */
  height?: number;
  /** The way in from outside. */
  entrance?: boolean;
}

export interface Room {
  id: string;
  /** Tiles, [w, h]. */
  size: [number, number];
  /** Its top-left corner on the home's plane, in tiles. */
  at: [number, number];
  /** Blocks. */
  wallHeight: number;
  doors: Door[];
}

export interface HomeLayout {
  /** The map's id, e.g. "interior_home_1_10" (homes are named by rooms and size). */
  id: string;
  title: string;
  rooms: Room[];
}

/** A rect in tiles on the home's plane. */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const roomRect = (r: Room): TileRect => ({
  x: r.at[0],
  y: r.at[1],
  w: r.size[0],
  h: r.size[1],
});

/** How long a wall is, in tiles. */
export const wallLength = (r: Room, side: Side): number =>
  side === "north" || side === "south" ? r.size[0] : r.size[1];

/**
 * A point on a wall (s tiles across from the left, seen from inside) on the home's plane: the
 * wall's line, and the way into the room from it.
 */
export function wallPoint(r: Room, side: Side, s: number): { x: number; y: number } {
  const { x, y, w, h } = roomRect(r);
  switch (side) {
    case "north":
      return { x: x + s, y };
    case "east":
      return { x: x + w, y: y + s };
    case "south":
      return { x: x + w - s, y: y + h };
    case "west":
      return { x, y: y + h - s };
  }
}

/** The unit vector pointing into the room from a wall. */
export function inward(side: Side): [number, number] {
  return side === "north"
    ? [0, 1]
    : side === "east"
      ? [-1, 0]
      : side === "south"
        ? [0, -1]
        : [1, 0];
}

/** A wall's doors, as spans across it and up it (tiles and blocks). */
export function doorsOn(r: Room, side: Side): { s0: number; s1: number; h: number }[] {
  return r.doors
    .filter((d) => d.wall === side)
    .map((d) => ({ s0: d.at, s1: d.at + (d.width ?? 2), h: d.height ?? 2 }));
}

/** The home's plane: the box around its rooms, in tiles. */
export function layoutBounds(layout: HomeLayout): TileRect {
  const rects = layout.rooms.map(roomRect);
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The room whose floor holds a point on the plane (tiles), if any. */
export function roomAt(layout: HomeLayout, x: number, y: number): Room | undefined {
  return layout.rooms.find((r) => {
    const b = roomRect(r);
    return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
  });
}

/** Problems with a layout, or []: rooms that overlap, and doors off their wall. */
export function layoutProblems(layout: HomeLayout): string[] {
  const out: string[] = [];
  if (!layout.rooms.length) out.push("a home has at least one room");
  const ids = new Set<string>();
  for (const r of layout.rooms) {
    if (ids.has(r.id)) out.push(`room ${r.id}: id used twice`);
    ids.add(r.id);
    if (r.size.some((n) => !Number.isInteger(n) || n <= 0)) out.push(`room ${r.id}: bad size`);
    if (!Number.isInteger(r.wallHeight) || r.wallHeight <= 0) {
      out.push(`room ${r.id}: bad wall height`);
    }
    for (const d of r.doors) {
      const len = wallLength(r, d.wall);
      const [w, h] = [d.width ?? 2, d.height ?? 2];
      if (d.at < 0 || d.at + w > len) out.push(`room ${r.id}: a door runs off its ${d.wall} wall`);
      if (h > r.wallHeight) out.push(`room ${r.id}: a door is taller than its ${d.wall} wall`);
    }
  }
  const rects = layout.rooms.map((r) => [r.id, roomRect(r)] as const);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [[a, p], [b, q]] = [rects[i], rects[j]];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) {
        out.push(`rooms ${a} and ${b} overlap`);
      }
    }
  }
  return out;
}
