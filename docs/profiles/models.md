# Item models

A catalog entry can carry a **model**: its 3D look, as data. Planners draw it in 2D and 3D, and
any engine can draw it. The format lives in `@glade/render` and is the same for every game. This
page explains the format, how to check a model, and how to draw one yourself, for example in an
item builder.

## A first model

A lamp on a 1 x 1 tile footprint: a post, and a glowing ball on top.

```ts
const lamp = {
  parts: [
    { shape: "cylinder", at: [0.5, 0, 0.5], radius: 0.05, height: 2, color: "#4a4f57" },
    { shape: "sphere", at: [0.5, 2.1, 0.5], radius: 0.15, color: "#ffe6a0", finish: "glow" },
  ],
};
```

Every part has a **shape**, an anchor **at**, sizes, and a **color**.

## Where things go

A model is drawn at rotation 0. When an item is turned, its model turns with it.

- The origin is the footprint's **top-left corner**, on the ground.
- **x** runs across the footprint's width, in tiles (0 to w).
- **z** runs along its depth, in tiles (0 to d), top to bottom.
- **y** goes up, in blocks.

So `at: [0.5, 0, 0.5]` is the middle of a 1 x 1 footprint, on the ground.

A part's own sizes work the same way: across (x) and deep (z) in tiles, tall (y) in blocks.

## Shapes

| Shape      | `at` is            | Sizes                                                                            |
| ---------- | ------------------ | -------------------------------------------------------------------------------- |
| `box`      | center of its base | `size: [x, y, z]`; `round`: edge radius (tiles)                                  |
| `wedge`    | center of its base | `size: [x, y, z]`; full height at the back (-z), sloping to nothing at the front |
| `cylinder` | center of its base | `radius`, `height`; `top`: radius at the top; `sides`: 3 to 32 flat sides        |
| `cone`     | center of its base | `radius`, `height`; `sides`: 3 to 32 (4 makes a pyramid)                         |
| `sphere`   | its center         | `radius`; `squash`: vertical scale; `half: true` makes a dome                    |
| `torus`    | its center         | `radius` (to the middle of the tube), `tube`; it lies flat; `arc`: degrees       |
| `tube`     | its own origin     | `points` it runs through, `radius`; `smooth`, `closed`                           |
| `mesh`     | its own origin     | `vertices` (x, y, z, ...) and `faces` (three indices per triangle)               |

With `sides`, the radius reaches the corners. Mesh faces go counter-clockwise when seen from
outside.

### Rings and elbows

A torus lies flat. Turn it with `rotate: [90, 0, 0]` to stand it up, like a wheel. `arc` draws only
part of the ring: `arc: 90` is a pipe elbow. The arc starts at +x and goes counter-clockwise, seen
from above, and its ends are closed.

### Tubes

A tube is a round pipe through a list of points. One tube can be a hose, a coil, a rail or a loop.

```ts
{
  shape: "tube",
  at: [0.5, 0, 0.5],
  points: [[-0.3, 0.1, 0], [0, 0.4, -0.3], [0.3, 0.1, 0]],
  radius: 0.04,
  color: "#3f8f4f",
}
```

- Points are around `at`: x and z in tiles, y in blocks. The tube passes through every point.
- **`smooth`** (the default) curves smoothly through the points. **`smooth: false`** runs
  straight between them and bends round each corner, like a bent pipe.
- **`closed: true`** joins the last point back to the first, making a loop.
- The tube stays round however it bends, and never twists.

A coil is just points going round and up. This makes `turns` turns of radius `r`, rising `rise`
blocks a turn:

```ts
const coil = (r, turns, rise) =>
  Array.from({ length: turns * 12 + 1 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    return [r * Math.cos(a), (rise * i) / 12, -r * Math.sin(a)];
  });
```

Prefer a tube to a chain of short cylinders. A tube is one part, has no gaps at its joints, and
needs no angles worked out.

## Turning a part

`rotate: [x, y, z]` turns a part about its anchor, in degrees. It works like a three.js Euler in
order `"XYZ"`, so a builder using three.js can copy the numbers across.

- `rotate: [0, 90, 0]` turns a part counter-clockwise, seen from above.
- `rotate: [0, 0, 90]` stands a long box on its end.

Blocks and tiles are not the same size. In Petit Planet a block is 0.825 tiles tall. A turned part
keeps its true shape: a box 1 tile long, stood on end, is 1 tile tall, which is about 1.2 blocks.

## Groups

A group holds parts and moves them together. Its parts are placed relative to the group's `at`.

| Field    | Does                                                 |
| -------- | ---------------------------------------------------- |
| `at`     | where the group's origin sits (default `[0, 0, 0]`)  |
| `rotate` | turns the whole group                                |
| `scale`  | a number, or `[x, y, z]`                             |
| `mirror` | `["x"]`, `["z"]` or both: also draws mirrored copies |
| `repeat` | `{ count, step, turn }`: copies; see below           |
| `name`   | a label, shown in messages                           |

For example, four chair legs from one leg. The group sits at the middle of the footprint, and
mirroring across both axes makes the other three:

```ts
{
  shape: "group",
  name: "legs",
  at: [0.5, 0, 0.5],
  mirror: ["x", "z"],
  parts: [{ shape: "cylinder", at: [0.3, 0, 0.3], radius: 0.04, height: 0.45, color: "#9a7350" }],
}
```

And four back slats from one slat:

```ts
{
  shape: "group",
  at: [-0.24, 0, 0],
  repeat: { count: 4, step: [0.16, 0, 0] },
  parts: [{ shape: "box", at: [0, 0, 0], size: [0.08, 0.6, 0.05], color: "#6e4f36" }],
}
```

Each copy is the one before it, moved by `step` and then turned by `turn` (degrees, like
`rotate`; optional):

- **Only `step`**: copies in a straight row.
- **Only `turn`** (step `[0, 0, 0]`): copies round the group's origin, like a ring of stones.
- **Both**: copies walk along a curve. A step up with a turn about y makes a spiral stair.

```ts
// Ten stones in a ring
{
  shape: "group",
  at: [1, 0, 1],
  repeat: { count: 10, step: [0, 0, 0], turn: [0, 36, 0] },
  parts: [{ shape: "box", at: [0.55, 0, 0], size: [0.2, 0.18, 0.28], round: 0.05, color: "#cfc6b8" }],
}

// Twelve stair steps, each a quarter block higher and turned 30 degrees
{
  shape: "group",
  at: [1, 0, 1],
  repeat: { count: 12, step: [0, 0.25, 0], turn: [0, 30, 0] },
  parts: [{ shape: "box", at: [0.45, 0, 0], size: [0.7, 0.08, 0.3], color: "#9a7350" }],
}
```

Groups can hold groups. Any part can have a `name`.

## Finishes

`finish` sets how a part takes the light:

- **`matte`**: the default.
- **`glow`**: gives light, like a lamp. The game's look decides how strongly, for each time of day.
- **`glass`**: see-through, like a window.

## Checking a model

There are two checks:

- **`modelSchema`** (zod) checks the shape of the data: the right fields, numbers where numbers
  go. Use it when you read a model from a file or a form. `z.toJSONSchema(modelSchema)` gives a
  JSON Schema, with a description on every field.
- **`modelProblems(model, w, d, options)`** checks that the model fits: inside its w x d tile
  footprint, not below the ground, within the limits. Each problem names the part:

```ts
modelProblems(model, 1, 1, { blockSize: 0.825 });
// ['part 2 > 1 (box "leg"): reaches outside the 1x1 tile footprint']
```

The path `2 > 1` means the first part inside the second part. The limits are `maxParts` (solids,
after mirroring and repeating), `maxHeight` (blocks), `maxTriangles` and `maxDepth` (how deep
groups nest). Pass your own with `limits`.

A game wraps these with its own facts. Petit Planet's `entryProblems(game, entry)` checks a whole
catalog entry: its fields, its model against its footprint, and the game's `params.modelLimits`.

## Drawing a model yourself

`MapScene` (`@glade/three`) already draws models on a map. To draw one item the way its game does, use the game's item
formula (Petit Planet: `itemModel(catalog, type)` and `drawItem2D`), which adds what the game adds
to a model (a door on a building). To draw a model on its own, for example in an item builder's
preview, `@glade/render` has what you need. None of it uses three.js.

- **`modelMesh(model, { blockSize })`** gives plain meshes, one per finish, in tiles. Each vertex
  has a `color` and a `part`: the index of its solid in `leaves`. When a user clicks a vertex,
  `leaves[part].path` is the part they clicked.
- **`silhouettes(model, w, d, rot)`** gives each solid seen from above, for 2D, lowest first. An
  upright round part is an ellipse. Rings, tubes and meshes are their upward-facing triangles, so
  holes and inside curves show: fill them all as one path. Everything else is a polygon.
- **`modelBounds(model)`** gives the box a model fills.

To draw many copies, as a map's 3D view does:

- **`flattenModel(model)`** gives every solid with its place (a matrix) and its path.
- **`instancedShape(part)`** says whether a solid can be drawn as a scaled unit box, cylinder, cone
  or sphere. If so, **`unitMatrix(leaf)`** places that unit shape.
- Otherwise **`partGeometry(part)`** builds its triangles, and **`geometryKey(part)`** names
  them. Parts with the same key have the same triangles, so build them once.

## Building an item builder

A builder edits a model, checks it, and shows it. Here is one way to put the pieces together.

1. **Edit.** `partAt(model, path)`, `replacePart(model, path, part)` and
   `insertPart(model, path, part)` never change the model they get; they return a new one. Keep
   the old models for undo.
2. **Check** after every change with the game's entry check (Petit Planet: `entryProblems`). Show
   each problem next to the part it names.
3. **Show** the item with `modelMesh` in your own canvas, or on a map in a `MapScene`: add the
   entry with `bind` and show a map with it on. Petit Planet's `showroomMap(catalog)` (in its
   samples) lays out every item of a catalog in rows.
4. **Name** parts with `name`. Messages and `partTag(model, path)` use it.
5. **Keep your own settings.** A model stores only the finished parts. If a button makes a coil
   from a few settings (turns, radius, rise), save those settings in the builder's own recipe, so
   the coil can be edited later. The finished parts go in the catalog entry.

Sample models that use every feature are in
`packages/games/petit-planet/profile/samples/catalogs/models.ts`. Glade's builder follows these
steps ([the item builder](../builder/README.md)).
