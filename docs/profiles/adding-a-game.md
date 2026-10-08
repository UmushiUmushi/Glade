# Adding a game

A game is a folder under `packages/games/<id>/` with up to four packages. The **profile** comes
first: it says what the game is, and it is all the contract tests need. The **catalog**, **edit**
and **ui** packages make the game usable in Glade ([what each game gives Glade](../architecture.md#what-each-game-gives-glade)).

This guide walks through the profile, using the fixture game
(`packages/games/_fixture/profile/src/index.ts`: a 3 x 3 `board` seen in plan and in 3D, and a
4 x 2 `sheet` seen only in plan) as the worked example. Adding a map to an existing game is the
same work for one map: sections 3 to 7, then its samples.

When you are done, `pnpm test packages/testkit/contract` must pass for every map of your game. The
contract tests are the definition of "a map works".

## 1. The profile package

```
packages/games/<id>/profile/
  package.json    name @glade/<id>-profile, exports ./src/index.ts (its public API) and ./samples
  README.md       how the game works: its maps, grids, rules, item kinds and params
  src/
    index.ts      the game profile and its public API (browser-safe)
    kinds.ts      the kinds of things the game places
    maps/<map>/   one folder per map: its definition (index.ts), rules, layers and renderers
  look/
    <map>.json    each map's look (optional; the definition also carries defaults)
  samples/        made-up items and saved sample maps, for tests only
  tests/          game-wide tests, and tests/<map>/ with one test per rule
```

Reference screenshots go in `packages/games/<id>/references/`, next to the profile. Git ignores
that folder; never commit it.

Rules for the package:

- Import only from `@glade/core`, `@glade/render` and zod. Never from the game's catalog, edit or
  ui packages: they build on the profile, not the other way round.
- No `node:` imports anywhere reachable from `src/index.ts`. The browser and the editor worker
  bundle the profile.
- Export a public API from `src/index.ts`; other packages never import your files by path, and the
  package exports no `"./*"`.
- Keep game concepts in your package. Shared packages must stay game-free.
- Something two of your maps use moves up to the game's level (`src/`); until then it stays with
  its map.

## 2. The game profile

```ts
export const fixture = {
  id: "_fixture",
  title: "Fixture (toy)",
  kinds: [{ kind: "thing", description: "something standing on a cell" }],
  maps: { board, sheet },
  defaultMap: "board",
} satisfies GameProfile<RenderableMap>;
```

`formerIds` lists ids the game had before, so files saved under them still load. `defaultMap` is
the map that files from before maps had ids belong to.

**Kinds.** List the kinds of things your game places, with a `parent` for a kind that is a sort of
another (it then follows every rule its parent follows), and the fields each uses. Profiles ship no
items: catalogs are bound to a map. Every map carries the game's `kinds`; a map that does not take
some (an indoor map and plants) lists them in `excludes` and adds `excludesRule` to its rules.
`entryProblems(entry, catalog)` is optional and checks one entry's fields.

## 3. Space: the grids

Every grid of a map lives on one world plane with one unit. Cell (i, j) covers
`[origin + i·cell, origin + (i+1)·cell)`. Conversions go through world boxes, clipped to `bounds`.

```ts
const space: Space = {
  unit: "tile",
  bounds: { x: 0, y: 0, w: 3, h: 3 },
  grids: { cell: { cell: [1, 1], origin: [0, 0], size: [3, 3], abbr: "c" } },
  floors: { height: 1, max: 2 }, // only for maps that stack storeys
};
```

A map can have several grids over the same plane, for example a fine grid for small items and a
coarse grid for areas. `abbr` is the letter used in cell lists (`c(3,4)`).

Choose `selectionGrid` (what selections snap to) and `validation` (local rules look `margin` cells
of `grid` around the region they are asked about).

## 4. Layers and the document

A document is `{ version: 3, game, map, name, layers, meta }`. Each layer is a dense grid over one
of the map's grids, or a record of entities by id. The schema says how to make a fresh layer and
how to write it to a file:

```ts
layers: {
  ground: {
    kind: "grid",
    grid: "cell",
    description: "ground value 0..9 per cell",
    initial: () => 0,
    codec: { kind: "rle", token: (n: number) => String(n), parse: (t: string) => Number(t) },
  },
  things: { kind: "entities", description: "things standing on cells" },
},
newDoc: (name, _opts, now) => blankDoc({ game: ID, map: "board" }, space, map.layers, name, now),
```

`newDoc` is the map's base map. Codecs: `rle` for dense grids with runs (tokens must not contain
spaces or `*`), `sparse` for mostly empty grids (only cells that differ from `initial` are
written), `rows` for plain JSON. Entities are written one per line, sorted by id. A layer with
`omitWhenEmpty` is left out of files while it is empty, so adding one does not change old files.

Export typed readers and writers for your layers; nothing outside the game reads cells directly.
`migrate(raw)` turns older stored forms into the current document (throw if there are none).

## 5. Rules

A profile never changes a map, so it has no ops: editing lives in `@glade/edit` and the game's
`edit` package. A map says what is wrong with a document.

Rules check a document within a world-box scope (`scopeRange` and `inScope` help) and return
violations with cells in the map's grids. Read every number a rule uses (a limit, a range) from the
map's `params`, with your defaults there, so it can be changed with `customizeMap`. List your
params in the profile's README. Settings that editing also needs (like a terrain support style)
belong in the params too, so edits and rules read the same value. Local rules see only the region
they are asked about plus the margin; make a rule non-local when it must see the whole map.
`rulebook()` lists the rules, including informational entries.

Write rules for kinds, never for item names: read an entry's kind through the bound catalog
(`ctx.game.catalog`, with `typeIs` and `kindChain`), so sub-kinds from packs work too.

`locate(game, doc, layer, at)` returns the rects a grid cell (`at` is [x, y]) or an entity (its
footprint) covers. The editor uses it to validate only around what it changed, and to highlight it.

`rect(input)` turns rect input, which may use shorthand grids, into a rect of the map's space.

## 6. Rendering

A map lists the views it can be seen in (`views`): `plan` (from straight above, on a canvas) and
`scene` (3D). Give it at least one; the viewport offers each one it has.

**UI** (`ui`), shared by every view: name your layer toggles, the grids the viewport snaps to
(`snap`), the finest grid (`fine`: zoom limits and 3D draping) and an optional area grid. `hover`
returns the cursor text (`"off map"` outside), and `clickSelect` what a click selects. The
viewport draws grid lines, violations, highlights, selection, ruler and hover.

**Plan** (`views.plan`): `draw` gets a canvas already transformed to world units.

**Scene** (`views.scene`, 3D): no three.js in the profile. Chunks are string ids; `buildChunk`
returns mesh specs (typed arrays from `QuadBuilder`, a layer toggle, a material name) and instance
specs (a unit box, cylinder, cone or sphere, or a geometry of your own with a `key`, placed per
instance). If your catalog entries have models, `@glade/render` flattens them and builds their
triangles ([item models](models.md)); Petit Planet's item formula (`src/items/`) shows one way to
instance them. `materials(look, opts)` returns material specs: `toon` or `basic` with shader
patches, or `shader` with full sources; `opts` has the document and map being drawn, for materials
that depend on them (a room's wallpaper). Specs with the same `key` are updated in place when the
look changes. `ground(x, y)` gives the 3D height at a world point, `pick` maps a raycast hit to a
world point, and `scale` is 3D units per world unit. Set `capabilities.floors` to get a floor clip,
and `capabilities.curvature` to `false` for a map that never curves.

Keep how one item looks (the item formula, game-wide) apart from what a map does to it (the map
formula: where it stands, and effects such as snow); see [game profiles](README.md#the-render-format).

## 7. Style

A map's look (`look/<map>.json`) is the envelope `{ units, world, shared, presets: { name: {
hour?, sky, light, colors } }, defaultPreset }`, with optional `seasons`. `@glade/three` draws the
sky, light, fog, curvature and post-processing from it, and the walk camera comes from
`world.camera.walk`; you own `shared` and `colors`. Give presets an `hour` (0..24) and the planner
blends between them; colours in `colors` blend as `#rrggbb`. A look with one preset and no seasons
is fixed. `style.schema` is a zod object checked once per preset as `{ shared, colors, world }`,
and `style.defaults` is the style used when the file is missing.

## 8. Register and test the profile

1. Add samples in the profile's `samples/`: made-up catalog entries for each kind, and a demo map
   for each map, saved as a map file. Export them from `samples/index.ts`. Never import them from
   `src/`.
2. Add your game to `games` in `packages/testkit/src/games.ts`, with samples for each of its maps.
3. Run `pnpm test packages/testkit/contract`. Then write a test for each rule.
4. Check each map's look with the render goldens (`GLADE_RENDER=1`), and against your reference
   screenshots.

## 9. Bring it into Glade

1. **Catalog** (`@glade/<id>-catalog`): base items with their models (original work, built from
   the model format), categories, and builder templates. Every entry passes `entryProblems`.
2. **Edit** (`@glade/<id>-edit`): the ops each map uses. Use the shared ops in `@glade/edit` and
   add only what no other game has.
3. **UI** (`@glade/<id>-ui`): theme, icons and fonts, and for each map you support: modes, layers,
   environment, rule text and screen reader text. Data only, no React.
4. Add the game to `apps/web/src/app/games.ts`.
5. Run the game contract tests until they are green.
6. Add stories for its mode toolbars and an end-to-end journey.

Removing a game is the reverse: delete its folder and its entries in
`packages/testkit/src/games.ts` and `apps/web/src/app/games.ts`. The shared packages and the
contract tests stay green, because the contract tests also run against the fixture game.
