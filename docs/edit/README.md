# Editing

> **In short:** Profiles describe maps and never change them. **Editing** changes them: `@glade/edit`
> holds the game-free machinery (ops on a draft, patches, transactions, undo) and the ops games
> share (objects and paths). A game's own `edit` package adds what no other game has, including
> its terrain, because each game's terrain is its own model. The real map lives in a background
> **worker**; the screen keeps a read-only copy.

## Shared ops, game settings

Glade's controls are the same in every game ([the idea](../architecture.md#the-idea-consistency-in-differences)),
so the edits behind them are shared too. An op family is written once, game-free, and reads the
facts it needs from the game's profile.

| Op family           | Package                                 | Ops                                                                                                                      | Reads from the profile                                                                          |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Objects             | `@glade/edit` (`objects/`)              | place, move, rotate, copy, delete, things on surfaces                                                                    | Grids, footprints, rotation steps, what a map takes                                             |
| Paths and coverings | `@glade/edit` (`paths/`)                | paint, erase, fill, shape corners                                                                                        | Path grid, which cells take a path, corner shapes                                               |
| Terrain             | `@glade/petit-planet-edit` (`terrain/`) | one-layer brush and eraser, raise / lower land, raise / lower water, lift and drop, live terraces, corners; later sculpt | Height range, step limit (`maxStepBetweenNeighbors`), which cells can change, waterfall helpers |
| Other game-only     | `@glade/<id>-edit`                      | Petit Planet: bridges that span a gap                                                                                    | Whatever that game's rules need                                                                 |

### Terrain belongs to its game

Petit Planet's terrain is a **heightmap**: one height (0–8) per block, with an optional water block
on top. Overhangs can't exist. Another game will likely store terrain another way (Minecraft has
3D blocks with overhangs), so its terrain ops would be different code, not different settings.

| Shared by every game                                                       | Per game                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| The tools: brush, eraser, Raise / lower slider, select and drag            | The terrain ops behind them                    |
| The intents the tools send (`PaintTerrain`, `RaiseLower`, `MoveSelection`) | How each intent becomes ops (the mode planner) |
| Draft, patch, transaction, undo                                            | The terrain model and its rules (profile)      |

So the controls stay the same in every game, and each game's terrain is free to be its own model.
If a second game ever uses the same heightmap, the shared parts move to `@glade/edit`.

### Live terraces

Terrain changes happen live. There is no "settle" step after a change.

1. While you drag or slide, the mode planner runs the ops **and** the terraces they need, as a
   `preview` (at most every 100 ms).
2. The terraces show as purple temporary terrain.
3. Letting go runs the same ops and terraces as one transaction: one undo step.

How terraces are found: [lift and drop](../planner/behaviour.md#lift-and-drop). The brush and
eraser never terrace: blocks they can't change get red stripes instead
([brush and eraser](../planner/behaviour.md#brush-and-eraser-one-layer)).

## The editor

`@glade/edit` is game-free. It has these parts:

| Part          | Does                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ops`         | An op table per map type: name → function that changes a draft with the profile's layer accessors (`putItem`, `setTerrain`, ...).                         |
| `draft`       | A working copy that copies a layer row or an entity only when an op first writes it, and records before and after as it goes. No full copy, no full diff. |
| `patch`       | Before and after of every changed cell or entity. Apply forward (redo) or backward (undo).                                                                |
| `transaction` | Run ops on a draft → patch → `map.locate` gives the changed area → `validate(draft, map, { region })` → commit or reject.                                 |
| `history`     | Undo and redo stacks of patches (200 steps).                                                                                                              |

The recording draft matters for speed. Copying the whole island and diffing it after each change
takes about 20 ms on a fast laptop, too slow to run while dragging. Recording changes as they
happen and checking only the changed area (`validate` with a `region` takes about 3.4 ms) keeps a
transaction under 10 ms.

## Intents and ops (the island)

The planner turns input into an **intent**; the game's mode planner turns the intent into ops
([planner internals](../planner/internals.md)).

| Intent                                      | Made by                     | Ops (the island)                                                                 | Profile accessors the ops use                                |
| ------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Place { type, cell, rot }`                 | Drawer drag, click-to-place | `placeItem` or `placePlant`                                                      | `putItem`, `putPlant`                                        |
| `PlaceOnSurface { type, table, x, y, rot }` | Drop on a table             | `placeOnSurface`                                                                 | `onSurfaces` (read); a writer is still to come (roadmap T-3) |
| `MoveSelection { dx, dy }`                  | Pick drag, keyboard move    | `move` per item (things on tables come along); `transplant` for terrain          | `putItem`, `setTerrain`, `setPathAt`, `setCornerAt`          |
| `Rotate { ids, dir }`                       | `[` `]`, quick actions      | `rotate`                                                                         | `putItem`                                                    |
| `Delete { scope }`                          | `Delete` key, menu          | `remove`, `clearPath`, `smoothTo`, `setWater off`                                | `removeObjects`, `setPathAt`, `setTerrain`                   |
| `PaintPath { cells, type }`                 | Brush stroke                | `setPath`                                                                        | `setPathAt`                                                  |
| `ErasePath { cells }`                       | Eraser stroke               | `clearPath`                                                                      | `setPathAt`                                                  |
| `Fill { cells, type }`                      | Fill tool                   | `setPath`                                                                        | `setPathAt`                                                  |
| `ShapeCorner { cell, corner, shape }`       | Cut tool                    | `setCorner`                                                                      | `setCornerAt`, `resolvePathCorner`, `resolveTerrainCorner`   |
| `RaiseLower { cells, delta }`               | Actions menu slider         | `raise` / `lower` (Cliffs) or `raiseWater` / `lowerWater` (Water), with terraces | `setTerrain`, `isEditableTerrain`, `maxStepBetweenNeighbors` |
| `PaintTerrain { cells, level, dir }`        | Cliffs brush and eraser     | `brushLayer`: only cells at `level` change, by `dir` (+1 or −1); no terraces     | `setTerrain`, `isEditableTerrain`                            |
| `PaintWater { cells, level, on }`           | Water brush and eraser      | `setWater` on cells at `level`                                                   | `setTerrain`                                                 |
| `Paste { fragment, at }`                    | Paste                       | the ops that recreate the fragment                                               | —                                                            |
| `Select { shape, mode }`                    | Select tools                | none (selection is not a map edit; the planner updates its selection store)      | `floodRegion`, `cellsInRect`                                 |

The terrain helpers the terrain ops need (`edgeRun` and `fallSides` for waterfalls,
`isEditableTerrain`) are read-only facts in the profile. How the terrain moves is described in
[how the planner behaves](../planner/behaviour.md#shaping-terrain).

## The editor worker

The worker owns the real map, the bound map type (`bind(map, catalog)`) and the editor with its
undo history.

| Message                      | From → to   | Does                                                                                                                      |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `load(file, packs)`          | UI → worker | Loads a map (`loadMap`), binds the catalog, returns the map                                                               |
| `transact(ops, label)`       | UI → worker | Runs a strict transaction. Returns status, violations, patch, changed box                                                 |
| `preview(ops, token)`        | UI → worker | Dry run: check only, no commit. Newer tokens cancel older ones                                                            |
| `undo()` / `redo()`          | UI → worker | Returns the patch to apply                                                                                                |
| `validateAll()`              | UI → worker | All violations in the map (on load)                                                                                       |
| `export()`                   | UI → worker | Map file text (`serializeMap`)                                                                                            |
| `setCatalog(entries, kinds)` | UI → worker | New packs loaded; binds again with **new arrays** (a catalog's lookup index is rebuilt only when its arrays are replaced) |

**Mirror:** the worker sends back **patches**, not whole maps. The UI applies each patch to its
mirror with the editor's `applyPatch`. This is cheap.

**The mirror never changes in place.** `MapScene.setDoc(next)` compares the new map with the last
one it drew to find the 3D chunks to rebuild. So applying a patch makes a **new** map object that
shares every row and entity that did not change. The old object stays as it was.

**If the worker crashes:**

1. The UI notices (error event, or no reply in 5 s).
2. It starts a new worker and loads the **mirror** into it (the mirror always equals the last
   committed map).
3. Undo history is lost for that session. A pill says so. Nothing in the map is lost.
4. A `GLD-WORKER-001` error is logged.

## Live checks while dragging

1. On every pointer move, the tool updates the **ghost** (the see-through copy) at once. No
   waiting.
2. Cheap checks run right away on the main thread: on the map? off the beach? overlapping another
   item's footprint?
3. Full checks go to the worker as `preview`, at most every 100 ms. Only the newest request
   matters ("latest wins").
4. The ghost turns red or normal when the answer comes back.
5. On drop, a real `transact` runs.

## Undo and redo

- The editor's `history` (in the worker) stores patches. It keeps up to 200 steps.
- The planner keeps a matching list with a **label** ("Move 3 chairs"), the **mode**, and the
  **selection before and after**.
- One user action = one transaction = one undo step. A whole drag is one step. A whole brush
  stroke is one step.
- Undo restores the map **and** the selection, and switches back to the mode it happened in.
- Selection changes alone are not undo steps.
- Loading or creating a map clears the history.

## Testing

- Every op has unit tests.
- Property tests: "any op, then undo, gives back the map you started with", and "the recording
  draft gives the same patch as a full diff".
- After any terrain op, the profile's rules hold in the changed area (for Petit Planet: rule T3,
  the step limit).
