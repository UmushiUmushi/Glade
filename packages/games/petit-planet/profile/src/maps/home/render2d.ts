// A home from straight above (its plan view), and what every view of it shares (its UI). Drawn in
// half tiles, like the planet, so the item formula draws the same here: floors with their
// flooring, walls with a band of their wallpaper's color and gaps for doors, floor items and the
// things on their surfaces, wall items as bars along their wall, and ceiling items faintly on top.

import type { Bound, Doc, Entity } from "@glade/core";
import { resolveLook, type MapUI, type PlanView, type RenderableMap } from "@glade/render";
import { catalogEntry, type Catalog } from "../../catalog";
import { appModel, drawItem2D, itemSize } from "../../items";
import { drawPattern } from "../../items/pattern";
import { onSurfaceBox, onSurfaces } from "../../surfaces";
import { copyStarts, roomCoverings } from "./coverings";
import {
  doorsOn,
  roomAt,
  SIDES,
  wallLength,
  type HomeLayout,
  type Room,
  type Side,
} from "./layout";
import {
  ceilingItems,
  coverings,
  floorItems,
  homeHosts,
  planeRect,
  wallItems,
  wallRect,
  type Half,
  type WallItem,
} from "./model";
import { HomePlane } from "./rules";
import type { HomeColors } from "./style";

/** Half tiles a wall band is thick, drawn inside the room. */
const WALL = 0.5;

const LAYERS = [
  { id: "floor", label: "Floor", default: true },
  { id: "walls", label: "Walls", default: true },
  { id: "items", label: "Items", default: true },
  { id: "wallItems", label: "Wall items", default: true },
  { id: "ceiling", label: "Ceiling items", default: true },
];

type Home = Bound<RenderableMap>;

/** A home's UI and plan view, for its layout. */
export function homeViews2D(layout: HomeLayout): { ui: MapUI; plan: PlanView } {
  const plane = new HomePlane(layout);
  const [ox, oy] = [
    Math.min(...layout.rooms.map((r) => r.at[0])),
    Math.min(...layout.rooms.map((r) => r.at[1])),
  ];
  /** A world point (tiles) in half tiles of the plane. */
  const toHalf = (p: { x: number; y: number }) => ({ x: (p.x - ox) * 2, y: (p.y - oy) * 2 });
  /** The home's colors: its look is fixed, the same at any time. */
  const colors = (game: Home) => resolveLook(game.style.defaults).colors as HomeColors;

  /** The band of a wall inside its room, in half tiles, over the span s0..s1 (tiles across). */
  function band(r: Room, side: Side, s0: number, s1: number): Half {
    const s = plane.strip(r, side, 2 * s0, 2 * s1);
    const thin = (n: number) => Math.min(n, WALL);
    return side === "north" || side === "south"
      ? { ...s, y: side === "south" ? s.y + 1 - WALL : s.y, h: thin(s.h) }
      : { ...s, x: side === "east" ? s.x + 1 - WALL : s.x, w: thin(s.w) };
  }

  function drawFloor(ctx: CanvasRenderingContext2D, doc: Doc, catalog: Catalog, c: HomeColors) {
    for (const r of layout.rooms) {
      const f = plane.floor(r);
      const pattern = roomCoverings(doc, catalog, r).flooring?.pattern;
      ctx.save();
      ctx.beginPath();
      ctx.rect(f.x, f.y, f.w, f.h);
      ctx.clip();
      if (!pattern) {
        ctx.fillStyle = c.floor;
        ctx.fillRect(f.x, f.y, f.w, f.h);
      } else {
        for (const sy of copyStarts(r.size[1])) {
          for (const sx of copyStarts(r.size[0])) {
            drawPattern(ctx, pattern, { x: f.x + 2 * sx, y: f.y + 2 * sy, w: 4, h: 4 });
          }
        }
      }
      ctx.restore();
    }
  }

  function drawWalls(ctx: CanvasRenderingContext2D, doc: Doc, catalog: Catalog, c: HomeColors) {
    for (const r of layout.rooms) {
      const paper = roomCoverings(doc, catalog, r).wallpaper?.pattern.color ?? c.wall;
      for (const side of SIDES) {
        const len = wallLength(r, side);
        const doors = doorsOn(r, side).sort((a, b) => a.s0 - b.s0);
        let s = 0;
        for (const d of [...doors, { s0: len, s1: len, h: 0 }]) {
          if (d.s0 > s) {
            const b = band(r, side, s, d.s0);
            ctx.fillStyle = paper;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = c.edge;
            ctx.lineWidth = 0.08;
            ctx.strokeRect(b.x, b.y, b.w, b.h);
          }
          if (d.s1 > d.s0) {
            const b = band(r, side, d.s0, d.s1);
            ctx.fillStyle = c.door;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.globalAlpha = 1;
          }
          s = d.s1;
        }
      }
    }
  }

  /** The bar a wall item draws as, inside its wall's band. */
  function wallBar(catalog: Catalog, item: WallItem): Half | null {
    const r = plane.room(item.room);
    if (!r || !SIDES.includes(item.wall)) return null;
    const w = wallRect(catalog, item);
    const s = plane.strip(r, item.wall, w.x, w.x + w.w);
    const deep = 0.7;
    switch (item.wall) {
      case "north":
        return { ...s, h: deep };
      case "south":
        return { ...s, y: s.y + 1 - deep, h: deep };
      case "east":
        return { ...s, x: s.x + 1 - deep, w: deep };
      case "west":
        return { ...s, w: deep };
    }
  }

  const ui: MapUI = {
    layerNames: () => LAYERS,
    grids: () => ({
      snap: [
        { grid: "major", label: "Tile", color: "20,20,20", alpha: 0.35 },
        { grid: "minor", label: "Half", color: "20,20,20", alpha: 0.2 },
      ],
      fine: "minor",
    }),
    hover(doc, g, world) {
      const game = g as Home;
      const catalog = game.catalog as Catalog;
      const room = roomAt(layout, world.x, world.y);
      if (!room) {
        const b = game.space.bounds;
        const off = world.x < b.x || world.y < b.y || world.x >= b.x + b.w || world.y >= b.y + b.h;
        return off ? "off map" : "between rooms";
      }
      const p = toHalf(world);
      const [mx, my] = [Math.floor(p.x), Math.floor(p.y)];
      const has = (h: Half) => p.x >= h.x && p.y >= h.y && p.x < h.x + h.w && p.y < h.y + h.h;
      const things = [
        ...floorItems(doc)
          .filter((i) => has(planeRect(catalog, i)))
          .map(
            (i) =>
              `${i.type} ${i.id}${catalogEntry(catalog, i.type) ? "" : " (not in the catalog)"}`,
          ),
        ...wallItems(doc)
          .filter((i) => {
            const bar = wallBar(catalog, i);
            return bar && has(bar);
          })
          .map((i) => `${i.type} ${i.id} on the ${i.wall} wall`),
        ...ceilingItems(doc)
          .filter((i) => has(planeRect(catalog, i)))
          .map((i) => `${i.type} ${i.id} on the ceiling`),
      ];
      const hosts = homeHosts(doc, catalog);
      for (const t of onSurfaces(doc)) {
        const host = hosts.get(t.on);
        const b = host && onSurfaceBox(catalog, host, t);
        if (b && has(b)) things.push(`${t.type} ${t.id} on ${t.on}`);
      }
      const cover = coverings(doc)
        .filter((c) => c.room === room.id)
        .map((c) => c.type);
      return [
        `${room.id} · tile ${Math.floor(world.x)},${Math.floor(world.y)} · half ${mx},${my}`,
        `coverings: ${cover.join(", ") || "none"}`,
        `items: ${things.join(", ") || "none"}`,
      ].join("\n");
    },
    clickSelect(_doc, _game, world) {
      const room = roomAt(layout, world.x, world.y);
      if (!room) return null;
      return { rects: [{ grid: "minor", ...plane.floor(room) }], label: `room ${room.id}` };
    },
  };

  const plan: PlanView = {
    draw(ctx, doc, g, layers, visible, pxPerUnit) {
      const game = g as Home;
      const catalog = game.catalog as Catalog;
      const c = colors(game);
      const px = 2 / pxPerUnit;
      ctx.fillStyle = c.outside;
      ctx.fillRect(visible.x, visible.y, visible.w, visible.h);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(0.5, 0.5);
      if (layers.floor !== false) drawFloor(ctx, doc, catalog, c);
      const modelOf = (t: Entity) => appModel(game, t);
      if (layers.items !== false) {
        for (const i of floorItems(doc)) {
          const r = planeRect(catalog, i);
          drawItem2D(ctx, catalog, i.type, r, i.rot, px, { as: "item", model: modelOf(i) });
        }
        const hosts = homeHosts(doc, catalog);
        for (const t of onSurfaces(doc)) {
          const host = hosts.get(t.on);
          const b = host && onSurfaceBox(catalog, host, t);
          if (!b) continue;
          const { w, d } = itemSize(catalogEntry(catalog, t.type));
          const [tw, td] = b.rot === 90 || b.rot === 270 ? [d, w] : [w, d];
          const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
          const r = { x: cx - tw, y: cy - td, w: 2 * tw, h: 2 * td };
          drawItem2D(ctx, catalog, t.type, r, b.rot, px, { as: "item", model: modelOf(t) });
        }
      }
      if (layers.walls !== false) drawWalls(ctx, doc, catalog, c);
      if (layers.wallItems !== false) {
        for (const i of wallItems(doc)) {
          const bar = wallBar(catalog, i);
          if (!bar) continue;
          const part = catalogEntry(catalog, i.type)?.model?.parts[0];
          ctx.fillStyle = part && "color" in part ? part.color : "#8a8a8a";
          ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = px;
          ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
        }
      }
      if (layers.ceiling !== false) {
        ctx.globalAlpha = 0.35;
        for (const i of ceilingItems(doc)) {
          const r = planeRect(catalog, i);
          drawItem2D(ctx, catalog, i.type, r, i.rot, px, { as: "item", model: modelOf(i) });
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
  };

  return { ui, plan };
}
