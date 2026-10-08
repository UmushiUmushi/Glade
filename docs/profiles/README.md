# Game profiles

> **In short:** A **profile** is what a game is: its maps, grids, layers, rules, item kinds,
> settings and look. It describes maps and never changes them. It ships no items: a catalog is
> bound to a map, and the rules check what is placed by its kind. Every map of every profile
> passes the contract tests.

This page explains how profiles are put together and the rules that keep them that way. To add a
game or a map, see [adding a game](adding-a-game.md). Item models have [their own page](models.md),
and [Petit Planet](petit-planet.md) shows one game end to end.

## Shared packages and profiles

Profiles are built from three shared packages:

- **`@glade/core`**: documents, coordinate spaces, kinds and catalogs, the rule engine, map files.
- **`@glade/render`**: the render format (the look as data, 2D drawing, 3D geometry, item models).
- **`@glade/three`**: draws the render format with three.js (`MapScene`). No UI and no game.

Each game's profile (`packages/games/<id>/profile`, package `@glade/<id>-profile`) holds one game:
its maps, rules, item kinds and look.

Profiles build on the shared packages. Shared packages never import a game or name a game's
concepts. This is enforced: ESLint stops them from importing games, and `tests/boundaries.test.ts`
fails if a shared file uses a game word such as "bridge" or "terrain".

A profile uses only the shared parts it needs. A 2D game never loads 3D code.

**When something moves into a shared package:** only when a second game needs it. Until then it
lives in the game that uses it. This keeps shared code small and stops it from growing to fit
every game.

## Games and maps

A profile exports a `GameProfile` (`packages/core/src/game.ts`): its id, title, the `kinds` of
things it places, and its `maps`. A game can have several maps, each a world of its own, with its
own grids, rules, views and look: Petit Planet has its island (`planet`) and its homes, one map per
layout (`homeMap(layout)` makes one for any layout). `defaultMap` is the map that older saved files
are.

## The map contract

Each map is a `MapDefinition`. It is the only way shared code talks to a game. It includes:

- `game` and `id`: the game it belongs to, and its own id
- `space`: the world's coordinate system and the named grids over it
- `layers`: what a document stores (dense grids, or records of entities by id)
- `rules`: what makes a document valid
- `kinds`: the kinds of things that can be placed (never the items themselves; see below), and
  `excludes`: those this map does not take
- `params`: values the rules read, such as a height limit
- `migrate`: how older saved documents become current ones
- `newDoc`: the base map
- `locate`: where something a map holds sits, in the map's grids

Other packages extend the contract instead of adding to it. `@glade/render` defines
`RenderableMap`, which adds `style`, `ui` and `views`. The app side extends it again with its own
needs (modes, rule text), so the contract itself holds only what every planner needs.

## Kinds and catalogs

A profile ships no items. It names the **kinds** of things it places, and its rules are written
for them. A kind can have a **parent**: it is a sort of that kind and follows every rule its parent
follows. In Petit Planet a `tree` is a `plant`, so the rules for plants apply to trees, and tree
spacing applies only to trees.

The items themselves come from a **catalog**: entries (`{ type, kind, ...fields }`) and, if it
likes, kinds of its own, each under a kind the game knows. Glade's base catalog lives in each
game's `catalog` package; users add more with packs. The catalog is bound to a map, and the result
is what rules and renderers work on:

```ts
const game = bind(planet, {
  kinds: [{ kind: "oak", parent: "tree", description: "an oak" }],
  entries: [
    { type: "pack:abc:oak", kind: "oak", footprint: { w: 2, h: 2 }, shape: "cone", glyph: "O" },
  ],
});
catalogProblems(planet, game.catalog); // [] when every entry and kind is fine
```

So the profile never imports a catalog; the catalog depends on the profile. Rule L6 ("trees keep
one cell apart") works on a pack's palm tree without any change to the profile, because the palm
tree says it is a `tree`.

`kindChain`, `kindIs` and `typeIs` answer "is this a sort of that?" for any code that needs it.

A map can say what it does not take, in `excludes`: kinds (with their sub-kinds), or entries by a
field (`{ field: "mount", value: "wall" }`). `excludesRule(id)` reports anything on the map it does
not take; a game adds it to the map's rules. Petit Planet's homes take no plants and its island no
wall items, without anyone tagging items "indoor" or "outdoor".

## Customizing

Everything a profile exports is a default. Code can change any of it without copying the game, and
the result is an ordinary game that every shared function accepts. The original is never changed.
This is how a user can turn a rule off, for example.

`customizeMap` (`@glade/core`) changes a map's rules and params:

```ts
customizeMap(planet, {
  rules: { off: ["T3"], replace: { T5: myT5 }, add: [myRule] }, // or off: "all"
  params: { maxHeight: 12 },
});
```

`customizeLook` (`@glade/render`) changes the look:

```ts
customizeLook(planet, {
  style: { presets: { day: { sky: { top: "#88aaff" } } } }, // merged into the default style
  plan: { draw: myDraw }, // replace parts of a view (or ui: { hover }, scene: { materials })
});
```

For anything else, a map is a plain object: spread it and replace what you need.

`customizeMap` never throws on an id it doesn't know, so a saved customization still loads after
a rule is renamed. `unknownIds(map, customization)` lists those ids.

**Writing customizable rules.** A rule reads its numbers from the game's `params`, not from
constants. Each profile documents its params in its README.

## Documents

A document (`Doc`) is a game id, a map id, a name, and a set of named layers. Saved documents are
plain JSON (version 3), written so that diffs stay readable. `map.newDoc(name)` is the map's base
map. `serializeMap` writes a map file; `deserializeMap` and `loadMap` read one through its game,
which picks the map the file names (older files are the game's default map) and upgrades older
versions through that map's `migrate`. Each profile exports typed readers and writers for its
layers.

A profile never changes a document. Editing is done by `@glade/edit` and each game's `edit`
package, with those readers and writers ([editing](../edit/README.md)).

## Rules

Every rule is code with a test. `validate(doc, game)` runs the rules and returns violations, each
with the rule, a message, the cells involved and often a hint. Rules are read-only.

A local rule only looks at a region plus a margin. After changing part of a map, the editor passes
that region (`validate(doc, map, { region })`), and `map.locate(map, doc, layer, at)` gives the
rects a cell or an entity covers. A rule that has to see the whole map is marked non-local and
always does.

Settings that both editing and rules need (a step limit, a support style) live in the profile,
once. The edits read them to make valid changes, and the rules read them to check.

## The render format

`@glade/render` describes a game's look as data, so any engine can draw it:

- **Style** (`look/<map>.json` in the profile, one per map): sky, light, colours, named presets for
  times of day, seasons, and the walk camera's settings. A map's look may be fixed (Petit Planet's
  homes have one preset and no seasons).
- **Views** (`views`): the ways a map can be seen. **Plan** (`PlanView`) draws it from straight
  above on a canvas, in world units. **Scene** (`Render3D`) is 3D: geometry in chunks, as typed
  arrays and instanced shapes (unit primitives or the game's own geometry), plus material specs.
  Profiles never import three.js. A game's maps can have different views, and more kinds of view
  can join these (a three-quarter 2D view, for games drawn that way).
- **UI** (`ui`), shared by every view: layer toggles, the grids a view snaps to, hover text and
  click selection.
- **Item models**: a catalog entry's look, built from parts (boxes, wedges, cylinders, spheres,
  meshes, and groups that turn, mirror and repeat). The format, its checks and its triangles are
  game-free; a game decides the footprint, the block height and the limits. See
  [item models](models.md).

Placed things are drawn by two formulas. A game's **item formula** says how one catalog entry
looks on its own, in 2D and 3D, with no map around it (in Petit Planet: its model or a stand-in, a
door on buildings, an incline's steps). Each map's **map formula** places things on that map and
adds what the map does to them (on the planet: standing on the ground, fence pieces linking up,
grass round their feet, snow in winter). Item states (an open window) give their own model for a
placed thing with `customizeLook(map, { itemModel })`; the map formula draws it, and the item
formula still adds what the game adds.

`@glade/three` draws this format with three.js: `MapScene` takes a canvas, a bound map, a document
and a look, builds the chunks and materials, and draws them with the look's sky, light, fog,
curvature and post-processing. It has no UI and knows no game; Glade's viewport puts it on screen.

## Testing

- The test kit (`packages/testkit`) holds what every profile is tested with. `src/games.ts` lists
  each game with its samples: made-up items and saved sample maps from the profile's `samples/`.
  Profiles ship no items, so samples exist only for tests and docs; library code never imports
  them (`tests/boundaries.test.ts`).
- `packages/testkit/contract/` defines "a map works". It runs against every map of every game, the
  fixture game's included, and checks each view a map has. A new shared feature adds a contract
  test.
- Every game rule has a test in its profile.
- `tests/references.test.ts` makes sure reference screenshots are never committed.
- Looks are tested in the profiles too: a game's times of day, seasons and colours
  (`packages/games/petit-planet/profile/tests/planet/look.test.ts`), a geometry golden of its demo
  map, and opt-in render goldens (`GLADE_RENDER=1 pnpm test packages/testkit/render`, needs
  Chrome). Regenerate goldens only on purpose, with `UPDATE_GOLDENS=1`, and review the diff.
