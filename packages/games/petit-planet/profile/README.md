# Petit Planet

`@glade/petit-planet-profile` describes Petit Planet: the kinds of things you can place, and its
maps. The island, `planet`, is the default map; homes (the inside of houses) are maps too, one per layout
(see Homes). For each map: its grids, what a document stores, the rules for building, and how it
looks. `petitPlanet` is the game (`petitPlanet.maps.planet` is `planet`).

```ts
import { bind, validate } from "@glade/core";
import { planet, setTerrain } from "@glade/petit-planet-profile";

const island = bind(planet, myCatalog); // your items: the profile ships kinds, not items
const doc = island.newDoc("my-island"); // the base island
setTerrain(doc, 60, 60, { h: 5, water: false }); // editing happens outside the profile
validate(doc, island); // [T3: a step of 4 between neighbors; 3 at most]
```

## The island

The island is 10 x 9 **areas** of 16 x 16 tiles: 160 x 144 tiles in all. The outer ring of areas
is beach at level 0. New maps start with flat land at level 1.

Coordinates start at the top-left, with x to the right and y down, from 0.

| Grid      | Size      | Cell                               | Used for                   |
| --------- | --------- | ---------------------------------- | -------------------------- |
| `major`   | 160 x 144 | 1 tile                             | paths, plants, selections  |
| `minor`   | 320 x 288 | half a tile                        | items (furniture)          |
| `terrain` | 161 x 145 | 1 block, centered on a tile corner | heights and water          |
| `area`    | 10 x 9    | 16 x 16 tiles                      | naming parts of the island |

Two landmarks are fixed: the town center and the entrance. Building rules keep them clear
(`T4`, and placement checks in `P1`, `L2` and `I1`).

## What a map stores

| Layer            | Grid    | Holds                                                     |
| ---------------- | ------- | --------------------------------------------------------- |
| `terrain`        | terrain | height 0..8 per block, and whether its top block is water |
| `paths`          | major   | path (floor) type per cell, or none                       |
| `terrainCorners` | major   | cut or rounded water and cliff corners                    |
| `pathCorners`    | terrain | cut or rounded path corners                               |
| `plants`         | —       | plants on major cells                                     |
| `items`          | —       | items on minor cells, with rotation 0, 90, 180 or 270     |
| `onSurfaces`     | —       | things standing on tables (see Surfaces), by their table  |

Maps are saved as plain JSON. Maps saved under the old id `petite-planet` still load.

A map may hold items or paths whose type is not in the catalog (from another app's catalog, say).
Rules O1 and P1 report them, and viewers draw a grey stub in their place.

## Item kinds

The profile ships item **kinds**, not items or paths. The rules know what a plant, a tree, an item, a
building, a bridge, an incline and a path are, so anything an app adds works with them. A sub-kind
follows every rule of its parent: a tree is a plant, a building is an item.

| Kind        | A sort of | What it is                                               | Extra fields                                  | Rules             |
| ----------- | --------- | -------------------------------------------------------- | --------------------------------------------- | ----------------- |
| `plant`     |           | bushes, flowers, crops; on whole tiles                   |                                               | O1 O2 L1–L5       |
| `tree`      | `plant`   | a plant that needs space around it                       |                                               | L6                |
| `shrub`     | `plant`   | bushes and hedges                                        |                                               |                   |
| `flower`    | `plant`   | flowers                                                  |                                               |                   |
| `item`      |           | furniture and decorations; on half tiles, rotated        | `onWater`, `connects`, `surface`, `placeable` | O1 O2 I1–I3 S1–S3 |
| `building`  | `item`    | houses and shops; the front faces south at rotation 0    |                                               | B1 L6             |
| `bridge`    |           | spans water or gaps; long axis north-south at rotation 0 | `majorSize`                                   | O1 O2 I1 I3 I4 I5 |
| `incline`   |           | ramps up a cliff; 1 or 2 tiles wide, 2 long              | —                                             | O1 O2 I1 I3 I6    |
| `path`      |           | paths on whole tiles; different paths never merge        | `allowsPlants`, `color`, `pattern`            | P1–P3 L4          |
| `wallpaper` |           | covers a room's walls (homes)                            | `pattern`                                     | H4                |
| `flooring`  |           | covers a room's floor (homes)                            | `pattern`                                     | H4                |

An item's `mount` says where it goes in a home: `"floor"` (the default; the ground on the
planet), `"wall"` or `"ceiling"`. A wall item's footprint is across and up the wall (half tiles
across, half blocks up), and its model faces south with its back on the wall. The planet takes no
wall or ceiling items, wallpaper or flooring (rule K1).

An app may add kinds of its own under these, in its catalog's `kinds`: an `oak` under `tree`
keeps tree spacing. Catalogs made before sub-kinds (with `tree: true` or `building: true`) load
through `upgradeCatalog`.

Every entry also has `type` (a unique id), `kind`, `glyph`, and optionally `description`. Plants,
items, bridges and inclines also have `footprint` (in half tiles, at rotation 0), `shape`, and
optionally `model`. A path fills its tiles, so it has no footprint or model: it is drawn in its
`color` (#rrggbb) and `pattern` (`cobble`, the default, or `plain`). `kinds` describes each kind.

`entryProblems` checks a whole entry and names each problem. It checks the fields
(`entrySchemas`, by the base kind), the model against the footprint and `params.modelLimits`, that a linking
piece is one tile, and that a bridge's footprint matches its size:

```ts
import { entryProblems, planet } from "@glade/petit-planet-profile";
import { bind } from "@glade/core";

const lantern = {
  type: "myapp:lantern",
  kind: "item",
  footprint: { w: 1, h: 1 },
  shape: "post",
  glyph: "l",
  model: {
    parts: [
      { shape: "cylinder", at: [0.25, 0, 0.25], radius: 0.04, height: 1.6, color: "#3f434a" },
      { shape: "sphere", at: [0.25, 1.7, 0.25], radius: 0.1, color: "#ffd27a", finish: "glow" },
    ],
  },
};
entryProblems(planet, lantern); // [] when it is fine
const island = bind(planet, { entries: [lantern] });
```

Prefix your own item types (`myapp:`) so they never clash with another app's.

### Models

A model is built from parts: boxes (with rounded edges), wedges, cylinders (tapered or
flat-sided), cones, spheres and domes, tori and elbows, tubes along curves, meshes of their own,
and groups that turn, scale, mirror and repeat parts (in rows, rings, arcs or spirals). Parts can be matte, glowing or glass. The format is described in
[docs/profiles/models.md](../../../../docs/profiles/models.md).

In Petit Planet a model's footprint is the entry's footprint in tiles (half its `footprint`), and
a block is 0.825 tiles tall (`BLOCK_TILES`).

**The item formula** (`src/items/`) is how one entry looks on its own, on any map:
`itemModel(catalog, type)` in 3D and `drawItem2D(ctx, catalog, type, ...)` from above. A few kinds
read their model in a special way:

- **Buildings** get a door on the front of their lowest wall (in 2D, a door bar and an arrow).
- **Inclines** without a model are drawn as four steps.
- **Entries without a model** are a plain block of their size, and a type the catalog lacks is a
  small grey stub.

**The planet's map formula** places them on the island and adds what the island does:

- Things stand on the ground under them; an incline climbs from the low ground to the cliff top.
- **Linking pieces** (`connects`): plain boxes at least 0.9 tiles wide are rails, laid along each
  link. Every other part is a post, set at each link's end. A post that is a plain, unturned box,
  cylinder, cone or sphere stands right on the end; any other part keeps its place relative to the
  tile's center.
- Parts standing on grass get a ring of grass leaves round their foot. Rings, tubes and meshes
  don't, since their outline from above isn't one edge to follow.
- In winter, snow covers the tops of plants and items (`shared.objects.snow`).

An app can draw a placed thing its own way, for example by a state of its own:

```ts
const mine = customizeLook(planet, {
  itemModel: (thing, entry) => (thing.open ? openWindowModel : undefined), // undefined: the entry's
});
```

`samples/catalogs/models.ts` has a sample of each feature (a lantern, a chair, a tent, a gazebo, a crystal,
a fence, a cottage, a tree, a hose reel, pipework, a fire pit and a spiral stair), and `samples/showroom.ts` lays out a catalog in rows.

## Surfaces

Some items have a top that small things can stand on: tables, stalls, counters. Such an entry has
a `surface`, its top's own grid; an entry that can stand on one is `placeable`, with its
footprint in that grid. Both are in half cells, like ground footprints, and the size is the
entry's own, since it depends on the top's shape: a 2x2 table's 6 x 6 top is `{ w: 12, h: 12 }`,
a 1x1 table's 3 x 3 is `{ w: 6, h: 6 }`, and a thin 2x1 table's 5 x 2 is `{ w: 10, h: 4 }`. A
tray that is one tile on the ground may take `{ w: 4, h: 4 }` of a table's grid, and a small cup
`{ w: 2, h: 2 }`. Nothing stacks: an entry has a surface or is placeable, never both.

A thing on a surface is stored in the `onSurfaces` layer as `{ id, type, on, x, y, rot }`: `on`
is the table's id, and `x`, `y` are half cells of the table's grid. The grid turns with the table,
and the thing turns with it, plus its own `rot`. It is drawn at its own size, centered on its
place, on the top of the table's model. Rules S1 to S3 check it, and every map of the game shares
all of this (`src/surfaces/`).

## Homes

A home is the inside of a house: rooms on one plane, each with walls (a block-high cell for every
tile across), doors and a ceiling. A layout is data, and `homeMap(layout)` makes a map of any
layout; the game lists its homes by layout id, named by rooms and size:

| Map                  | Rooms | Size    | Entrance                      |
| -------------------- | ----- | ------- | ----------------------------- |
| `interior_home_1_10` | 1     | 10 x 10 | 2 tiles wide, south, centered |
| `interior_home_1_8`  | 1     | 8 x 8   | 2 tiles wide, south, centered |

```ts
const layout = {
  id: "interior_home_2_6",
  title: "Two rooms",
  rooms: [
    { id: "a", size: [6, 6], at: [0, 0], wallHeight: 4, doors: [{ wall: "east", at: 2 }] },
    { id: "b", size: [6, 6], at: [6, 0], wallHeight: 4, doors: [{ wall: "west", at: 2 }] },
  ],
};
const twoRooms = homeMap(layout); // a map like any other
```

A wall is measured as you see it from inside the room: across from your left to your right, and
up from the floor. Doors are 2 x 2 unless a layout says otherwise; things may hang above a door.

| Layer          | Holds                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| `items`        | floor items, on half tiles, turned 0, 90, 180 or 270                     |
| `wallItems`    | wall items: `{ room, wall, x, y }`, in half cells across and up the wall |
| `ceilingItems` | ceiling items, on half tiles like the floor                              |
| `coverings`    | each room's wallpaper and flooring: `{ room, type }`                     |
| `onSurfaces`   | things on surfaces, as on the planet                                     |

**Wallpaper and flooring** look like a 2D sheet: `pattern: { color, image?, shapes? }`. `image` is
the app's own picture (a URL or a data: URL; the profile never stores it), and `shapes` are rects and
circles on a unit square. The sheet repeats in copies 2 tiles across, a wall's full height on a
wall and 2 tiles deep on a floor, with a seam on the middle line: an 8-tile wall takes 4 whole
copies, a 10-tile wall half a copy, 4 whole ones and half a copy.

**The look** is fixed (`look/home.json`): no times of day or seasons, warm and soft, dark outside.
Homes are seen in plan and in 3D, flat (no curvature). In 3D a wall, its doors and its items hide
while the camera is behind the wall, so a room shows like a diorama from any side.

**Rules**: O1 (items go where their mount says), O2 (unique ids), K1 (no plants, paths, bridges,
inclines or buildings), H1 (floor items wholly on one room's floor, apart), H2 (wall items on their
wall, clear of its doors, apart), H3 (ceiling items under one room's ceiling, apart), H4 (one
wallpaper and one flooring a room) and S1 to S3 (surfaces).

## Rules

| Id  | Name                  | Checks                                                                             |
| --- | --------------------- | ---------------------------------------------------------------------------------- |
| T1  | height-range          | heights are whole numbers from 0 to `maxHeight`                                    |
| T2  | border-immutable      | the beach and the outer ring of land keep their height                             |
| T3  | step-limit            | neighbors differ by at most `maxStepBetweenNeighbors` levels                       |
| T4  | landmark-lock         | terrain under a landmark keeps its level and has no water                          |
| T5  | terrain-corner-shape  | cut or rounded water and cliff corners are possible there                          |
| W1  | water-not-on-beach    | no water on the beach or the locked ring of land                                   |
| W2  | waterfall-position    | a waterfall sits inside a straight cliff face of at least `waterfallMinRun` blocks |
| W4  | water-corner-bank     | water never touches lower ground only at a corner                                  |
| P1  | path-on-major-only    | paths use a known type, off the beach and landmarks                                |
| P2  | path-on-flat-earth    | paths lie on flat, dry ground                                                      |
| P3  | path-corner-shape     | cut or rounded path corners are possible there                                     |
| O1  | known-type            | plants and items use catalog types and a valid rotation                            |
| O2  | unique-id             | every plant and item id is unique                                                  |
| L1  | plant-major-snap      | plants sit on whole tiles                                                          |
| L2  | plant-not-on-beach    | no plants on the beach or landmarks                                                |
| L3  | plant-on-flat-earth   | plants sit on flat, dry ground                                                     |
| L4  | plant-on-path-allowed | plants sit only on paths that allow them                                           |
| L5  | plant-no-overlap      | plants don't overlap plants or items                                               |
| L6  | tree-spacing          | trees keep one free tile from other trees and buildings                            |
| I1  | item-in-bounds        | items are on the map, off the beach and landmarks                                  |
| I2  | item-on-flat-earth    | items sit on flat, dry ground (boats may sit on water)                             |
| I3  | item-no-overlap       | items don't overlap                                                                |
| I4  | bridge-span           | bridges rest on cliffs either side of a gap (see Bridges)                          |
| I5  | nothing-under-bridge  | nothing but paths under a bridge                                                   |
| I6  | incline-on-cliff-edge | inclines climb one level onto a straight cliff edge (see Inclines)                 |
| B1  | building-front-clear  | the row in front of a building is flat, dry ground                                 |
| S1  | on-a-surface          | things on surfaces are placeable, on an item with a surface, and never stack       |
| S2  | fits-the-surface      | a thing on a surface stands wholly on it, on its half cells                        |
| S3  | surface-overlap       | things on one surface do not overlap                                               |
| K1  | kinds-here            | no wall or ceiling items, wallpaper or flooring on the planet                      |
| W3  | pond                  | informational: tells ponds from streams                                            |

`rulesDoc()` returns the full description of each rule.

### Bridges

A bridge rests on two cliffs of the same height, either side of a gap of water or lower ground.

- Normally each end sits on the **half block along the cliff edge**, so a bridge is **one tile
  longer than its gap**: a 1x4 crosses 3 blocks, a 1x5 crosses 4, up to a 1x7 across 6.
- The **shortest bridge** (1x4) can also rest a **whole block on each cliff**, over a 2-block gap.
  Longer bridges can't.

```
3-block gap, 1x4:     cliff ▓▓▓B | ~~ ~~ ~~ | B▓▓▓ cliff     (half a block on each edge)
2-block gap, 1x4:     cliff ▓▓BB | ~~ ~~ | BB▓▓ cliff        (a whole block on each cliff)
```

So gaps of 2 to 6 blocks can be bridged. The lengths come from `bridge.minLength` and
`bridge.maxLength`.

### Inclines

An incline is a ramp up a cliff, 1x2 or 2x2 tiles. It climbs **exactly one level**
(`inclineRise`) from flat, dry ground onto a **straight** cliff edge.

- Its **high end** sits on the half block along the cliff edge, like a bridge's end.
- The other **1.5 tiles** stand on the ground below, which must be flat and dry.
- It can't sit on a corner: the cliff must run along its whole width.
- Paths can run underneath. Plants and items can't overlap it.
- At rotation 0 the high end faces north, turning clockwise (90 east, 180 south, 270 west).

```
                ▓▓▓▓▓▓  cliff top
             ╱  ▓▓▓▓▓▓
  ground   ╱    ▓▓▓▓▓▓
 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
      └ 1.5 ┘└½┘
```

Viewers draw an incline as steps unless its catalog entry has its own model.

## Params

The rules read these numbers from the game's `params`, so apps can change them.

| Param                     | Default                          | Meaning                                              |
| ------------------------- | -------------------------------- | ---------------------------------------------------- |
| `maxHeight`               | 8                                | highest terrain level                                |
| `minLandLevel`            | 0                                | lowest level land can be dug to                      |
| `maxStepBetweenNeighbors` | 3                                | largest height difference between neighbors          |
| `stepNeighborhood`        | `"8"`                            | `"8"`: corners count as neighbors; `"4"`: only sides |
| `waterfallMinRun`         | 3                                | shortest cliff face a waterfall can sit in           |
| `bridge`                  | `{ minLength: 4, maxLength: 7 }` | shortest and longest bridge, in tiles                |
| `inclineRise`             | 1                                | how many levels an incline climbs                    |
| `modelLimits`             | see below                        | limits on catalog entries' models (`entryProblems`)  |

`modelLimits` is `{ maxParts: 256, maxHeight: 6, maxTriangles: 10000, maxDepth: 6 }`: solids
once groups are mirrored and repeated, height in blocks, triangles drawn, and how deep groups nest.

The island's shape (size, beach, land, landmarks) is fixed. It lives in `src/maps/planet/world.json`.

## Customizing

```ts
import { customizeMap } from "@glade/core";
import { customizeLook } from "@glade/render";

customizeMap(planet, { rules: { off: "all" } }); // build freely
customizeMap(planet, { rules: { off: ["T3", "L6"] } }); // no step limit or tree spacing
customizeMap(planet, { params: { maxHeight: 12, bridge: { maxLength: 9 } } });
customizeLook(planet, { style: { defaultPreset: "night", defaultSeason: "winter" } });
```

## Reading and writing maps

The profile never changes a map: it has no ops, transactions or undo. Editing is done outside it,
with the typed accessors for each layer (`terrainAt` and `setTerrain`, `pathAt` and `setPathAt`,
`cornerAt` and `setCornerAt`, `plantsOf` and `putPlant`, `itemsOf` and `putItem`,
`removeObjects`), and ask `validate` what is wrong. `planet.locate` gives the cells a block,
path, corner, plant or item covers, so a change can be checked with `validate(map, game, { region })`.
`resolveTerrainCorner` and `resolvePathCorner` say what a corner shape does where it is.

## Look

`look/planet.json` describes the look: four times of day (morning, midday, afternoon, night) in
two seasons (spring, winter), and the game's walk camera. The planet is seen in plan and in 3D:
its UI and plan view are in `src/maps/planet/render2d.ts`, its 3D view in
`src/maps/planet/render3d/`.

Model finishes take their look from the style too: each time of day's `colors.glow` is the light
glowing parts give (black for none, white for full: faint by day, full at night), and
`shared.objects.glass` is how solid glass parts look (0..1).

The demo island is `samples/maps/demo.json`, with the made-up items in
`samples/catalogs/demo.ts`; the render goldens (`packages/testkit/render`) draw it at each time of
day. Contributors can keep reference screenshots of the game in `../references/` to compare
with. That folder is ignored by git.

## Open questions

These details come from screenshots and haven't been fully confirmed in the game:

- Path corners: a cut or rounded corner spans a whole tile. Confirmed in the game: one shaped
  corner per tile, outer corners only (the inside of an L stays square), none on a one-tile path,
  and a cut that a new neighbor straightens comes back when the neighbor is removed.
- Terrain corners: water and cliff cuts span half a block. A terrain corner is shaped only when
  the other three blocks share one level. A cliff corner above a straight lower step might be
  allowed in the game.
- Fences: diagonal neighbors link unless a piece sits beside both, and a piece with one link runs
  straight through. Different fence types, and fences on different levels, don't link.

Homes, from one photo of the 8 x 8 room and the game's numbers so far:

- Doors between rooms of a home are taken to be 2 x 2, like the entrance.
- Ceiling items turn like floor items, and wall items don't turn.
- A pattern's copy is stretched to its 2-tile span and the wall's full height, so a square sheet
  shows taller than wide on a wall.
- Homes that can't be decorated (the first starting home) aren't described.
