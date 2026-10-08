// Made-up items and paths for the tests. The profile ships kinds, not items (src/kinds.ts), so the tests
// bring their own pieces, one or more of each kind, with plain placeholder models.

import type { Catalog, CatalogEntry } from "../../src/catalog";

const wood = "#8a6a4a";
const leaf = "#4a8a4a";

const tree = (type: string, glyph: string): CatalogEntry => ({
  type,
  kind: "tree",
  footprint: { w: 2, h: 2 },
  shape: "trunk-cone",
  glyph,
  model: {
    parts: [
      { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.1, height: 1.5, color: wood },
      { shape: "sphere", at: [0.5, 2, 0.5], radius: 0.5, color: leaf },
    ],
  },
});

const bridge = (w: number, l: number): CatalogEntry => ({
  type: `bridge-${w}x${l}`,
  kind: "bridge",
  footprint: { w: 2 * w, h: 2 * l },
  majorSize: { w, l },
  shape: "slab",
  glyph: "h",
});

/** A table: four legs and a top half a block up, with a surface of `surface` half cells. */
const table = (
  type: string,
  footprint: { w: number; h: number },
  surface: { w: number; h: number },
): CatalogEntry => {
  const [w, d] = [footprint.w / 2, footprint.h / 2];
  return {
    type,
    kind: "item",
    footprint,
    shape: "table",
    glyph: "t",
    surface,
    model: {
      parts: [
        { shape: "box", at: [w / 2, 0.5, d / 2], size: [w * 0.95, 0.08, d * 0.95], color: wood },
        {
          shape: "group",
          at: [w / 2, 0, d / 2],
          mirror: ["x", "z"],
          parts: [
            {
              shape: "box",
              at: [w / 2 - 0.1, 0, d / 2 - 0.1],
              size: [0.08, 0.5, 0.08],
              color: wood,
            },
          ],
        },
      ],
    },
  };
};

export const testCatalog: Catalog = {
  entries: [
    tree("tree", "T"),
    tree("fir-tree", "^"),
    tree("plum-tree", "P"),
    { type: "bush", kind: "shrub", footprint: { w: 2, h: 2 }, shape: "blob", glyph: "B" },
    { type: "flower", kind: "flower", footprint: { w: 2, h: 2 }, shape: "dots", glyph: "F" },
    { type: "rock", kind: "item", footprint: { w: 2, h: 2 }, shape: "lump", glyph: "r" },
    {
      type: "bench",
      kind: "item",
      footprint: { w: 4, h: 2 },
      shape: "bench",
      glyph: "b",
      model: {
        parts: [
          { shape: "box", at: [1, 0.4, 0.5], size: [1.8, 0.1, 0.6], color: wood },
          { shape: "box", at: [0.2, 0, 0.5], size: [0.1, 0.4, 0.5], color: wood },
          { shape: "box", at: [1.8, 0, 0.5], size: [0.1, 0.4, 0.5], color: wood },
        ],
      },
    },
    { type: "bed", kind: "item", footprint: { w: 3, h: 5 }, shape: "bed", glyph: "e" },
    {
      type: "house",
      kind: "building",
      footprint: { w: 10, h: 8 },
      shape: "block",
      glyph: "n",
    },
    {
      type: "boat",
      kind: "item",
      footprint: { w: 4, h: 2 },
      shape: "boat",
      glyph: "V",
      onWater: true,
    },
    {
      type: "fence",
      kind: "item",
      footprint: { w: 2, h: 2 },
      shape: "rail",
      glyph: "f",
      connects: true,
      model: {
        parts: [
          { shape: "box", at: [0.1, 0, 0.5], size: [0.1, 0.7, 0.1], color: wood },
          { shape: "box", at: [0.9, 0, 0.5], size: [0.1, 0.7, 0.1], color: wood },
          { shape: "box", at: [0.5, 0.4, 0.5], size: [1, 0.08, 0.06], color: wood },
        ],
      },
    },
    bridge(1, 4),
    bridge(1, 5),
    bridge(1, 6),
    bridge(1, 7),
    bridge(2, 5),
    bridge(2, 6),
    { type: "incline-1x2", kind: "incline", footprint: { w: 2, h: 4 }, shape: "steps", glyph: "/" },
    { type: "incline-2x2", kind: "incline", footprint: { w: 4, h: 4 }, shape: "steps", glyph: "/" },
    // Tables (things can stand on their tops) and things that can stand on them.
    table("table-2x2", { w: 4, h: 4 }, { w: 12, h: 12 }),
    table("table-1x1", { w: 2, h: 2 }, { w: 6, h: 6 }),
    table("table-thin", { w: 4, h: 2 }, { w: 10, h: 4 }),
    {
      type: "tray",
      kind: "item",
      footprint: { w: 2, h: 2 },
      shape: "slab",
      glyph: "y",
      placeable: { w: 4, h: 4 },
      model: { parts: [{ shape: "box", at: [0.5, 0, 0.5], size: [0.6, 0.06, 0.6], color: wood }] },
    },
    {
      type: "cup",
      kind: "item",
      footprint: { w: 2, h: 2 },
      shape: "lamp",
      glyph: "c",
      placeable: { w: 2, h: 2 },
      model: {
        parts: [
          { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.1, height: 0.2, color: "#f4f1ea" },
        ],
      },
    },
    // Paths: the profile ships the path kind, not paths.
    {
      type: "dirt",
      kind: "path",
      glyph: ":",
      allowsPlants: true,
      color: "#a6804d",
      pattern: "plain",
    },
    {
      type: "stone",
      kind: "path",
      glyph: "=",
      allowsPlants: false,
      color: "#a8a39a",
      pattern: "cobble",
    },
    {
      type: "brick",
      kind: "path",
      glyph: "%",
      allowsPlants: false,
      color: "#b0574a",
      pattern: "cobble",
    },
    {
      type: "grass-tile",
      kind: "path",
      glyph: "*",
      allowsPlants: true,
      color: "#8fd46f",
      pattern: "cobble",
    },
    {
      type: "sand",
      kind: "path",
      glyph: ",",
      allowsPlants: true,
      color: "#e8d49a",
      pattern: "plain",
    },
    {
      type: "stone-pattern",
      kind: "path",
      glyph: "-",
      allowsPlants: false,
      color: "#9a9aa6",
      pattern: "cobble",
    },
    {
      type: "garden-stone",
      kind: "path",
      glyph: ";",
      allowsPlants: true,
      color: "#8fa38a",
      pattern: "cobble",
    },
    {
      type: "wood",
      kind: "path",
      glyph: "|",
      allowsPlants: false,
      color: "#9c6b3f",
      pattern: "plain",
    },
    {
      type: "asphalt",
      kind: "path",
      glyph: "_",
      allowsPlants: false,
      color: "#55575c",
      pattern: "plain",
    },
  ],
};
