// Made-up furniture, wall and ceiling items, wallpaper and flooring for the sample homes (the
// profile ships no items). Wall items face south with their back on the wall (z = 0), and their footprint
// is across and up the wall; ceiling items hang from the top of their model.

import type { Catalog, CatalogEntry, CoveringEntry } from "../../src/catalog";

const wood = "#b98552";
const darkWood = "#8a5d36";
const cream = "#f4ead8";
const green = "#7fae5a";

const entry = (e: Omit<CatalogEntry, "kind"> & { kind?: string }): CatalogEntry => ({
  kind: "item",
  ...e,
});

const bed = entry({
  type: "home-bed",
  footprint: { w: 4, h: 6 },
  shape: "bed",
  glyph: "e",
  model: {
    parts: [
      { shape: "box", at: [1, 0, 1.5], size: [1.9, 0.5, 2.9], color: wood, round: 0.05 },
      { shape: "box", at: [1, 0.5, 1.6], size: [1.8, 0.25, 2.6], color: cream, round: 0.08 },
      { shape: "box", at: [1, 0.75, 0.45], size: [1.2, 0.15, 0.45], color: "#ffffff", round: 0.07 },
      { shape: "box", at: [1, 0.75, 2.0], size: [1.85, 0.08, 1.7], color: green, round: 0.03 },
    ],
  },
});

const roundTable = entry({
  type: "home-round-table",
  footprint: { w: 4, h: 4 },
  shape: "table",
  glyph: "t",
  surface: { w: 12, h: 12 },
  model: {
    parts: [
      { shape: "cylinder", at: [1, 0, 1], radius: 0.12, height: 0.55, color: darkWood },
      {
        shape: "cylinder",
        at: [1, 0.55, 1],
        radius: 0.9,
        height: 0.08,
        color: "#d8d2c4",
        sides: 24,
      },
    ],
  },
});

const counter = entry({
  type: "home-counter",
  footprint: { w: 4, h: 2 },
  shape: "table",
  glyph: "k",
  surface: { w: 10, h: 4 },
  model: {
    parts: [
      { shape: "box", at: [1, 0, 0.5], size: [1.95, 0.7, 0.95], color: "#d9894a", round: 0.04 },
      { shape: "box", at: [1, 0.7, 0.5], size: [2, 0.06, 1], color: wood },
    ],
  },
});

const chair = entry({
  type: "home-chair",
  footprint: { w: 2, h: 2 },
  shape: "chair",
  glyph: "h",
  model: {
    parts: [
      { shape: "box", at: [0.5, 0.35, 0.5], size: [0.6, 0.08, 0.6], color: "#f2c94c", round: 0.04 },
      {
        shape: "group",
        at: [0.5, 0, 0.5],
        mirror: ["x", "z"],
        parts: [{ shape: "box", at: [0.25, 0, 0.25], size: [0.07, 0.35, 0.07], color: "#f2c94c" }],
      },
    ],
  },
});

const shelf = entry({
  type: "home-bookshelf",
  footprint: { w: 2, h: 2 },
  shape: "shelf",
  glyph: "b",
  model: {
    parts: [
      { shape: "box", at: [0.5, 0, 0.5], size: [0.9, 1.6, 0.6], color: wood },
      {
        shape: "group",
        at: [0.5, 0.2, 0.83],
        repeat: { count: 3, step: [0, 0.45, 0] },
        parts: [{ shape: "box", at: [0, 0, 0], size: [0.75, 0.32, 0.05], color: "#5f8fb8" }],
      },
    ],
  },
});

const teapot = entry({
  type: "home-teapot",
  footprint: { w: 2, h: 2 },
  shape: "pot",
  glyph: "p",
  placeable: { w: 2, h: 2 },
  model: {
    parts: [
      { shape: "sphere", at: [0.5, 0.12, 0.5], radius: 0.12, squash: 0.8, color: "#c97a3a" },
      { shape: "cylinder", at: [0.5, 0.2, 0.5], radius: 0.03, height: 0.06, color: darkWood },
    ],
  },
});

const flowers = entry({
  type: "home-flowers",
  footprint: { w: 2, h: 2 },
  shape: "vase",
  glyph: "f",
  placeable: { w: 2, h: 2 },
  model: {
    parts: [
      {
        shape: "cylinder",
        at: [0.5, 0, 0.5],
        radius: 0.08,
        height: 0.2,
        color: "#ffffff",
        top: 0.06,
      },
      { shape: "sphere", at: [0.45, 0.28, 0.5], radius: 0.07, color: "#f06292" },
      { shape: "sphere", at: [0.56, 0.3, 0.46], radius: 0.06, color: "#ffd54f" },
    ],
  },
});

const picture = entry({
  type: "home-picture",
  footprint: { w: 2, h: 2 },
  shape: "frame",
  glyph: "q",
  mount: "wall",
  model: {
    parts: [
      { shape: "box", at: [0.5, 0.1, 0.03], size: [0.8, 0.8, 0.06], color: "#4a3a2a" },
      { shape: "box", at: [0.5, 0.18, 0.065], size: [0.62, 0.64, 0.01], color: "#e8dcc0" },
      { shape: "sphere", at: [0.5, 0.5, 0.12], radius: 0.1, squash: 0.2, color: green },
    ],
  },
});

const window = entry({
  type: "home-window",
  footprint: { w: 4, h: 4 },
  shape: "window",
  glyph: "w",
  mount: "wall",
  model: {
    parts: [
      { shape: "box", at: [1, 0.15, 0.05], size: [1.6, 1.7, 0.1], color: cream },
      {
        shape: "box",
        at: [1, 0.3, 0.11],
        size: [1.3, 1.4, 0.02],
        color: "#bfe3f0",
        finish: "glass",
      },
      { shape: "box", at: [1, 0.3, 0.13], size: [0.06, 1.4, 0.03], color: cream },
    ],
  },
});

const lamp = entry({
  type: "home-ceiling-lamp",
  footprint: { w: 2, h: 2 },
  shape: "lamp",
  glyph: "l",
  mount: "ceiling",
  model: {
    parts: [
      { shape: "cylinder", at: [0.5, 0.5, 0.5], radius: 0.015, height: 0.5, color: "#3a3a3a" },
      { shape: "cone", at: [0.5, 0.3, 0.5], radius: 0.3, height: 0.25, color: cream },
      { shape: "sphere", at: [0.5, 0.28, 0.5], radius: 0.1, color: "#ffe6a0", finish: "glow" },
    ],
  },
});

const hills: CoveringEntry = {
  type: "home-hills-wallpaper",
  kind: "wallpaper",
  glyph: "~",
  description: "a pale sky over round green hills",
  pattern: {
    color: "#bfe6dc",
    shapes: [
      { circle: [0.2, 0.95, 0.3], color: "#7fae5a" },
      { circle: [0.65, 1, 0.35], color: "#6a9c48" },
      { circle: [1.05, 0.95, 0.28], color: "#7fae5a" },
      { circle: [0.5, 0.3, 0.05], color: "#ffffff" },
    ],
  },
};

const tiles: CoveringEntry = {
  type: "home-tile-flooring",
  kind: "flooring",
  glyph: "#",
  description: "warm tiles, four to a copy",
  pattern: {
    color: "#c9a77d",
    shapes: [
      { rect: [0.02, 0.02, 0.46, 0.46], color: "#ecd2ad" },
      { rect: [0.52, 0.02, 0.46, 0.46], color: "#e8cca5" },
      { rect: [0.02, 0.52, 0.46, 0.46], color: "#e8cca5" },
      { rect: [0.52, 0.52, 0.46, 0.46], color: "#ecd2ad" },
    ],
  },
};

/** Everything the sample homes use. */
export const homeCatalog: Catalog = {
  entries: [
    bed,
    roundTable,
    counter,
    chair,
    shelf,
    teapot,
    flowers,
    picture,
    window,
    lamp,
    hills,
    tiles,
  ],
};
