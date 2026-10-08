// Made-up catalog entries whose models use the whole model format (@glade/render models): rounded
// boxes, wedges, tapered and flat-sided cylinders, domes, tori and part of one, tubes (smooth, bent
// and coiled), a mesh of its own, rotation, groups that mirror, repeat and turn as they repeat, and
// the glow and glass finishes. They are for tests, docs and the showroom (samples/showroom.ts); the
// profile ships no items. Every entry passes entryProblems.

import type { Catalog, CatalogEntry } from "../../src/catalog";

const iron = "#3f434a";
const wood = "#9a7350";
const darkWood = "#6e4f36";
const white = "#f4f1ea";
const stone = "#cfc6b8";
const flame = "#ffd27a";
const pane = "#cfe8f0";

/** A street lantern: a faceted post, a glass box with a glowing flame, a pyramid cap. */
const lantern: CatalogEntry = {
  type: "sample-lantern",
  kind: "item",
  footprint: { w: 1, h: 1 },
  shape: "lamp",
  glyph: "l",
  description: "a lantern on a post",
  model: {
    parts: [
      {
        shape: "cylinder",
        name: "post",
        at: [0.25, 0, 0.25],
        radius: 0.04,
        height: 1.6,
        sides: 8,
        color: iron,
      },
      {
        shape: "group",
        name: "head",
        at: [0.25, 1.6, 0.25],
        parts: [
          {
            shape: "box",
            name: "glass",
            at: [0, 0.02, 0],
            size: [0.22, 0.3, 0.22],
            color: pane,
            finish: "glass",
          },
          {
            shape: "sphere",
            name: "flame",
            at: [0, 0.17, 0],
            radius: 0.06,
            color: flame,
            finish: "glow",
          },
          {
            shape: "group",
            name: "frame",
            mirror: ["x", "z"],
            parts: [
              { shape: "cylinder", at: [0.11, 0, 0.11], radius: 0.015, height: 0.34, color: iron },
            ],
          },
          {
            shape: "cone",
            name: "cap",
            at: [0, 0.34, 0],
            radius: 0.19,
            height: 0.18,
            sides: 4,
            color: iron,
          },
        ],
      },
    ],
  },
};

/** A chair: one tapered leg mirrored into four, a rounded seat, a back of repeated slats. */
const chair: CatalogEntry = {
  type: "sample-chair",
  kind: "item",
  footprint: { w: 2, h: 2 },
  shape: "chair",
  glyph: "c",
  description: "a wooden chair",
  model: {
    parts: [
      {
        shape: "group",
        name: "legs",
        at: [0.5, 0, 0.5],
        mirror: ["x", "z"],
        parts: [
          {
            shape: "cylinder",
            at: [0.3, 0, 0.3],
            radius: 0.04,
            top: 0.03,
            height: 0.45,
            color: wood,
          },
        ],
      },
      {
        shape: "box",
        name: "seat",
        at: [0.5, 0.45, 0.5],
        size: [0.75, 0.08, 0.75],
        round: 0.03,
        color: wood,
      },
      {
        shape: "group",
        name: "back",
        at: [0.5, 0.53, 0.82],
        rotate: [8, 0, 0],
        parts: [
          {
            shape: "group",
            name: "slats",
            at: [-0.24, 0, 0],
            repeat: { count: 4, step: [0.16, 0, 0] },
            parts: [{ shape: "box", at: [0, 0, 0], size: [0.08, 0.6, 0.05], color: darkWood }],
          },
          {
            shape: "box",
            name: "top rail",
            at: [0, 0.6, 0],
            size: [0.7, 0.08, 0.06],
            round: 0.02,
            color: wood,
          },
        ],
      },
    ],
  },
};

/** A tent: a gable of two mirrored wedges on poles. */
const tent: CatalogEntry = {
  type: "sample-tent",
  kind: "item",
  footprint: { w: 4, h: 4 },
  shape: "tent",
  glyph: "t",
  description: "a canvas tent",
  model: {
    parts: [
      {
        shape: "group",
        name: "canvas",
        at: [1, 0, 1],
        mirror: ["z"],
        parts: [
          {
            shape: "wedge",
            at: [0, 0, -0.45],
            rotate: [0, 180, 0],
            size: [1.8, 1.4, 0.9],
            color: "#e8d7b0",
          },
        ],
      },
      {
        shape: "group",
        name: "poles",
        at: [1, 0, 1],
        mirror: ["x"],
        parts: [
          { shape: "cylinder", at: [0.85, 0, 0], radius: 0.03, height: 1.5, color: darkWood },
        ],
      },
      { shape: "box", name: "ridge", at: [1, 1.4, 1], size: [1.9, 0.06, 0.06], color: darkWood },
    ],
  },
};

/** A gazebo: an eight-sided floor and roof, mirrored posts, a ring rail, a lamp, a dome on top. */
const gazebo: CatalogEntry = {
  type: "sample-gazebo",
  kind: "item",
  footprint: { w: 6, h: 6 },
  shape: "gazebo",
  glyph: "g",
  description: "an open gazebo",
  model: {
    parts: [
      {
        shape: "cylinder",
        name: "floor",
        at: [1.5, 0, 1.5],
        radius: 1.4,
        height: 0.2,
        sides: 8,
        color: stone,
      },
      {
        shape: "group",
        name: "posts",
        at: [1.5, 0.2, 1.5],
        mirror: ["x", "z"],
        parts: [
          { shape: "cylinder", at: [0.85, 0, 0.85], radius: 0.07, height: 1.8, color: white },
        ],
      },
      { shape: "torus", name: "rail", at: [1.5, 0.9, 1.5], radius: 1.2, tube: 0.04, color: white },
      {
        shape: "sphere",
        name: "lamp",
        at: [1.5, 1.6, 1.5],
        radius: 0.12,
        color: flame,
        finish: "glow",
      },
      {
        shape: "cone",
        name: "roof",
        at: [1.5, 2, 1.5],
        radius: 1.5,
        height: 1,
        sides: 8,
        color: "#7a4b3a",
      },
      {
        shape: "sphere",
        name: "finial",
        at: [1.5, 3, 1.5],
        radius: 0.12,
        half: true,
        color: "#e0b84c",
      },
    ],
  },
};

/** An octahedron, counter-clockwise from outside: bottom, four around the middle, top. */
const octahedron = {
  vertices: [0, 0, 0, 0.3, 0.6, 0, 0, 0.6, 0.3, -0.3, 0.6, 0, 0, 0.6, -0.3, 0, 1.4, 0],
  faces: [1, 5, 2, 2, 5, 3, 3, 5, 4, 4, 5, 1, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 0],
};

/** A crystal: a glass mesh with a smaller glowing copy inside, turned, on a rounded base. */
const crystal: CatalogEntry = {
  type: "sample-crystal",
  kind: "item",
  footprint: { w: 2, h: 2 },
  shape: "crystal",
  glyph: "x",
  description: "a glowing crystal",
  model: {
    parts: [
      {
        shape: "box",
        name: "base",
        at: [0.5, 0, 0.5],
        size: [0.5, 0.12, 0.5],
        round: 0.04,
        color: stone,
      },
      {
        shape: "mesh",
        name: "shell",
        at: [0.5, 0.12, 0.5],
        ...octahedron,
        color: "#b9d8ff",
        finish: "glass",
      },
      {
        shape: "group",
        name: "core",
        at: [0.5, 0.42, 0.5],
        rotate: [0, 45, 0],
        scale: 0.5,
        parts: [{ shape: "mesh", at: [0, 0, 0], ...octahedron, color: "#8fc4ff", finish: "glow" }],
      },
    ],
  },
};

/** A fence piece whose posts are a group (a post and a pyramid cap): links like any fence. */
const picket: CatalogEntry = {
  type: "sample-picket",
  kind: "item",
  footprint: { w: 2, h: 2 },
  shape: "fence",
  glyph: "f",
  connects: true,
  description: "a white picket fence",
  model: {
    parts: [
      { shape: "box", at: [0.5, 0.25, 0.5], size: [1, 0.08, 0.05], color: white },
      { shape: "box", at: [0.5, 0.6, 0.5], size: [1, 0.08, 0.05], color: white },
      {
        shape: "group",
        name: "post",
        at: [0.5, 0, 0.5],
        parts: [
          { shape: "box", at: [0, 0, 0], size: [0.1, 0.9, 0.1], color: white },
          { shape: "cone", at: [0, 0.9, 0], radius: 0.08, height: 0.15, sides: 4, color: white },
        ],
      },
    ],
  },
};

/** A cottage (a building, so it gets a door): rounded walls, a mirrored gable, glass windows. */
const cottage: CatalogEntry = {
  type: "sample-cottage",
  kind: "building",
  footprint: { w: 6, h: 4 },
  shape: "house",
  glyph: "h",
  description: "a small cottage",
  model: {
    parts: [
      {
        shape: "box",
        name: "walls",
        at: [1.5, 0, 1],
        size: [2.6, 1.6, 1.6],
        round: 0.05,
        color: "#f2e6d0",
      },
      {
        shape: "group",
        name: "roof",
        at: [1.5, 1.6, 1],
        mirror: ["z"],
        parts: [
          {
            shape: "wedge",
            at: [0, 0, -0.475],
            rotate: [0, 180, 0],
            size: [2.9, 1, 0.95],
            color: "#b5523b",
          },
        ],
      },
      {
        shape: "group",
        name: "windows",
        at: [1.5, 0.6, 1.81],
        mirror: ["x"],
        parts: [
          { shape: "box", at: [0.7, 0, 0], size: [0.4, 0.45, 0.04], color: pane, finish: "glass" },
        ],
      },
      {
        shape: "cylinder",
        name: "chimney",
        at: [2.3, 1.6, 0.6],
        radius: 0.12,
        height: 1.1,
        sides: 4,
        color: "#8c5a48",
      },
    ],
  },
};

/** A tree: a tapered trunk and a crown of five spheres, four of them one mirrored sphere. */
const roundTree: CatalogEntry = {
  type: "sample-round-tree",
  kind: "tree",
  footprint: { w: 2, h: 2 },
  shape: "trunk-ball",
  glyph: "R",
  description: "a round tree",
  model: {
    parts: [
      {
        shape: "cylinder",
        name: "trunk",
        at: [0.5, 0, 0.5],
        radius: 0.09,
        top: 0.06,
        height: 1.2,
        color: "#7a5a3c",
      },
      {
        shape: "group",
        name: "crown",
        at: [0.5, 1.5, 0.5],
        parts: [
          { shape: "sphere", at: [0, 0, 0], radius: 0.42, squash: 0.9, color: "#5d9a48" },
          {
            shape: "group",
            mirror: ["x", "z"],
            parts: [{ shape: "sphere", at: [0.18, -0.1, 0.18], radius: 0.25, color: "#6aa952" }],
          },
        ],
      },
    ],
  },
};

/**
 * Points of a coil around the y axis, as a builder's "coil" button might make them: `turns` turns
 * of radius r from height y0, rising `rise` blocks a turn, 12 points a turn.
 */
export function coilPoints(
  r: number,
  turns: number,
  rise: number,
  y0 = 0,
): [number, number, number][] {
  return Array.from({ length: Math.round(turns * 12) + 1 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    return [r * Math.cos(a), y0 + (rise * i) / 12, -r * Math.sin(a)];
  });
}

const hoseGreen = "#3f8f4f";
const coil = coilPoints(0.27, 4, 0.1, 0.13);
const last = coil[coil.length - 1];

/** A hose reel: a drum between two discs, a hose coiled round it, its end trailing to the ground. */
const hoseReel: CatalogEntry = {
  type: "sample-hose-reel",
  kind: "item",
  footprint: { w: 2, h: 2 },
  shape: "reel",
  glyph: "o",
  description: "a garden hose on a reel",
  model: {
    parts: [
      {
        shape: "cylinder",
        name: "base",
        at: [0.5, 0, 0.5],
        radius: 0.38,
        height: 0.08,
        color: iron,
      },
      {
        shape: "cylinder",
        name: "drum",
        at: [0.5, 0.08, 0.5],
        radius: 0.2,
        height: 0.5,
        color: "#c9a227",
      },
      {
        shape: "cylinder",
        name: "top",
        at: [0.5, 0.58, 0.5],
        radius: 0.38,
        height: 0.05,
        color: iron,
      },
      {
        shape: "tube",
        name: "coil",
        at: [0.5, 0, 0.5],
        points: coil,
        radius: 0.04,
        color: hoseGreen,
      },
      {
        shape: "tube",
        name: "end",
        at: [0.5, 0, 0.5],
        points: [last, [0.36, 0.3, -0.2], [0.4, 0.06, 0.15], [0.2, 0.06, 0.38]],
        radius: 0.04,
        color: hoseGreen,
      },
    ],
  },
};

/** Pipework: a pipe bent up, across and down, a valve wheel, and an outlet with a 90 degree elbow. */
const pipework: CatalogEntry = {
  type: "sample-pipework",
  kind: "item",
  footprint: { w: 4, h: 4 },
  shape: "pipes",
  glyph: "p",
  description: "pipes with a valve",
  model: {
    parts: [
      {
        shape: "tube",
        name: "main",
        at: [0, 0, 0],
        points: [
          [1.6, 0, 0.6],
          [1.6, 1.4, 0.6],
          [0.7, 1.4, 0.6],
          [0.7, 1.4, 1.5],
          [0.7, 0, 1.5],
        ],
        radius: 0.08,
        smooth: false,
        color: "#8a9199",
      },
      {
        shape: "torus",
        name: "valve",
        at: [1.15, 1.4, 0.76],
        rotate: [90, 0, 0],
        radius: 0.12,
        tube: 0.02,
        color: "#c0392b",
      },
      {
        shape: "cylinder",
        name: "outlet",
        at: [0.4, 0, 1.5],
        radius: 0.06,
        height: 0.6,
        color: "#8a9199",
      },
      {
        shape: "torus",
        name: "elbow",
        at: [0.15, 0.6, 1.5],
        rotate: [90, 0, 0],
        radius: 0.25,
        tube: 0.06,
        arc: 90,
        color: "#8a9199",
      },
    ],
  },
};

/** A fire pit: a ring of ten stones from one, three crossed logs from one, a glowing flame. */
const firePit: CatalogEntry = {
  type: "sample-fire-pit",
  kind: "item",
  footprint: { w: 4, h: 4 },
  shape: "fire",
  glyph: "*",
  description: "a stone fire pit",
  model: {
    parts: [
      {
        shape: "group",
        name: "stones",
        at: [1, 0, 1],
        repeat: { count: 10, step: [0, 0, 0], turn: [0, 36, 0] },
        parts: [
          { shape: "box", at: [0.55, 0, 0], size: [0.2, 0.18, 0.28], round: 0.05, color: stone },
        ],
      },
      {
        shape: "group",
        name: "logs",
        at: [1, 0.06, 1],
        repeat: { count: 3, step: [0, 0, 0], turn: [0, 60, 0] },
        parts: [
          {
            shape: "cylinder",
            at: [0.3, 0, 0],
            rotate: [0, 0, 90],
            radius: 0.05,
            height: 0.73,
            color: darkWood,
          },
        ],
      },
      {
        shape: "cone",
        name: "flame",
        at: [1, 0.1, 1],
        radius: 0.18,
        height: 0.5,
        sides: 5,
        color: "#ff9a3c",
        finish: "glow",
      },
    ],
  },
};

/** A spiral stair: one step repeated twelve times, each a little higher and turned. */
const spiralStair: CatalogEntry = {
  type: "sample-spiral-stair",
  kind: "item",
  footprint: { w: 4, h: 4 },
  shape: "stair",
  glyph: "s",
  description: "a spiral stair",
  model: {
    parts: [
      { shape: "cylinder", name: "pole", at: [1, 0, 1], radius: 0.08, height: 3.2, color: iron },
      {
        shape: "group",
        name: "steps",
        at: [1, 0, 1],
        repeat: { count: 12, step: [0, 0.25, 0], turn: [0, 30, 0] },
        parts: [{ shape: "box", at: [0.45, 0, 0], size: [0.7, 0.08, 0.3], color: wood }],
      },
    ],
  },
};

/** The sample entries, one per feature of the model format. */
export const modelsCatalog: Catalog = {
  entries: [
    lantern,
    chair,
    tent,
    gazebo,
    crystal,
    picket,
    cottage,
    roundTree,
    hoseReel,
    pipework,
    firePit,
    spiralStair,
  ],
};
