# Petit Planet

Petit Planet is the first game in Glade. Its profile is `@glade/petit-planet-profile`
([its README](../../packages/games/petit-planet/profile/README.md) has the grids, layers, rules,
kinds and params). This page shows how the game's four packages fit together in Glade.

| Package                       | Holds                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `@glade/petit-planet-profile` | The island and the homes: grids, layers, rules, kinds, params, look. Exists today.     |
| `@glade/petit-planet-catalog` | Base items with original models, categories, builder templates.                        |
| `@glade/petit-planet-edit`    | Ops only Petit Planet has, such as bridges that span a gap and waterfalls that settle. |
| `@glade/petit-planet-ui`      | Theme, fonts, the Drag and Grab tool icons, modes, layers, rule text, guide pages.     |

## Per map

| Part              | The island (`planet`)                                                                                   | Homes (after 1.0)                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Modes             | Furniture (grid `minor`, lines of `major`), Paths (`major`), Cliffs (`terrain`), Water (`terrain`)      | Floor, Walls, Ceiling, Decor ([home modes](../planner/screen.md#viewport-mode-buttons-top-left)) |
| Layers            | Houses, Furniture, Plants, Paths, Grid, Area                                                            | Floor, Walls, Items, Wall items, Ceiling items, Grid                                             |
| Time points       | From the look's presets: 7:00, 12:00, 16:30, 21:00                                                      | None: a home's look is fixed (one preset, no seasons)                                            |
| Season            | Snow toggle = season `winter` (off = `spring`)                                                          | None                                                                                             |
| Terrain support   | `full`: land always stands on land below it (no overhangs)                                              | No terrain                                                                                       |
| Views             | 2D and 3D, curved planet                                                                                | 2D and 3D, flat; walls hide when the camera is behind them                                       |
| Catalog           | Base catalog + packs. Hides what the island doesn't take (wall and ceiling items, wallpaper, flooring). | Same catalog. Hides plants, paths, bridges, inclines and buildings.                              |
| Categories        | All, Houses, then game categories (Q-5)                                                                 | All, then home categories (Q-5)                                                                  |
| Builder templates | Other, Fence/hedge, House, Tree/plant, Bridge, Incline, Path tile, Lamp, Table, Small thing             | Adds Wall item, Ceiling item, Wallpaper, Flooring                                                |
| Title font        | An open font close to the game's title style (Q-9)                                                      | Same                                                                                             |

## Friendly rule text

Used by pills (title) and by expanded pills (explanation and fix tip). Lives in the game's `ui`
package, per map: `packages/games/petit-planet/ui/src/maps/<map>/rule-text.ts`. The same id can
mean different things on different map types (`O1`, `O2`, `K1`), so each map type has its own
table. A contract test checks that every rule in each map type's rulebook has an entry.

### The island (`planet`)

| Rule | Pill title                     | Explanation                                                                                    | Fix tip                                                 |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| T1   | Height out of range            | Land can go from level 0 to level 8.                                                           | Keep it between 0 and 8.                                |
| T2   | Island edge is fixed           | The beach and the ring of land next to it keep their height.                                   | Work further inside the island.                         |
| T3   | Too steep                      | Land next to each other can differ by at most 3 levels.                                        | Add a step between them, or lower the high side.        |
| T4   | Landmark ground is locked      | Ground under the town centre and the entrance can't change or hold water.                      | Move your edit away from the landmark.                  |
| T5   | Corner can't be shaped here    | A cliff or water corner can only be cut or rounded where the other three blocks are level.     | Square the corner, or level the blocks around it.       |
| W1   | No water on the beach          | Water can't go on the beach or the locked ring of land.                                        | Move the water further inland.                          |
| W2   | Waterfall needs a wider cliff  | A waterfall must sit inside a straight cliff face at least 3 blocks wide.                      | Widen the cliff face, or move the water.                |
| W4   | Water leaks at a corner        | Water can't touch lower ground only at a corner.                                               | Add land at that corner, or extend the water.           |
| P1   | Path can't go here             | Paths need a known path type, and can't go on the beach or landmarks.                          | Pick a path from the palette and move off the beach.    |
| P2   | Path needs flat ground         | Paths lie on flat, dry ground.                                                                 | Level the ground first, or remove the water.            |
| P3   | Path corner can't be shaped    | Only outer corners can be cut or rounded, and never on a single tile.                          | Choose an outer corner of a path at least 2 tiles long. |
| O1   | Unknown item                   | This item is not in the loaded catalog, or its rotation is wrong.                              | Load the pack it comes from.                            |
| O2   | Two things share an id         | This is a bug, not your mistake.                                                               | Please send a report.                                   |
| L1   | Plants go on whole tiles       | Plants snap to whole tiles, not half tiles.                                                    | Move it onto a whole tile.                              |
| L2   | No plants here                 | Plants can't go on the beach or landmarks.                                                     | Move it inland.                                         |
| L3   | Plant needs flat ground        | Plants sit on flat, dry ground.                                                                | Level the ground, or move the plant.                    |
| L4   | This path doesn't allow plants | Only some paths let plants stand on them.                                                      | Move the plant, or use a path that allows plants.       |
| L5   | Plant overlaps something       | Plants can't overlap other plants or items.                                                    | Move it to a free tile.                                 |
| L6   | Trees need space               | Trees keep one free tile from other trees and buildings.                                       | Leave a one-tile gap.                                   |
| I1   | Item can't go here             | Items must be on the map, off the beach and landmarks.                                         | Move it inland.                                         |
| I2   | Item needs flat ground         | Items sit on flat, dry ground (boats may sit on water).                                        | Level the ground, or move the item.                     |
| I3   | Items overlap                  | Two items can't share the same space.                                                          | Move one of them.                                       |
| I4   | Bridge doesn't fit             | A bridge rests on two cliffs of the same height, across a gap of 2 to 6 blocks.                | Change the gap or use a longer or shorter bridge.       |
| I5   | Something is under the bridge  | Only paths can go under a bridge.                                                              | Move the item or plant out from under it.               |
| I6   | Incline needs a cliff edge     | An incline climbs exactly one level onto a straight cliff edge.                                | Place it against a straight one-level cliff.            |
| B1   | Keep the front clear           | The row in front of a building must be flat, dry ground.                                       | Clear and level the row in front of the door.           |
| S1   | Can't go on a table            | Only small things can stand on a table top, and only on items that have a top. Nothing stacks. | Put it on the ground, or pick a smaller thing.          |
| S2   | Doesn't fit on the table       | A thing on a table must stand wholly on its top.                                               | Move it inward, or use a bigger table.                  |
| S3   | Things on the table overlap    | Two things on one table top can't share space.                                                 | Move one of them.                                       |
| K1   | Not for the island             | Wall and ceiling items, wallpaper and flooring go in homes, not on the island.                 | Use it in a home instead.                               |
| W3   | (info only)                    | Tells ponds from streams. Never shown as a pill.                                               | —                                                       |

### Homes (after 1.0)

| Rule  | Pill title                           | Explanation                                                                                                  | Fix tip                                         |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| O1    | Wrong place for this item            | Floor items go on floors, wall items on walls, ceiling items on ceilings. Floor items turn in quarter turns. | Move it to the right place.                     |
| O2    | Two things share an id               | This is a bug, not your mistake.                                                                             | Please send a report.                           |
| K1    | Not for homes                        | Plants, paths, bridges, inclines and houses go on the island, not inside.                                    | Use it on the island instead.                   |
| H1    | Item must be on one floor            | A floor item stands wholly on one room's floor, apart from other items.                                      | Move it inside one room, away from other items. |
| H2    | Item must be on the wall             | A wall item hangs wholly on its wall, clear of doors, apart from other wall items.                           | Move it along the wall, away from the door.     |
| H3    | Item must be under the ceiling       | A ceiling item hangs wholly under one room's ceiling, apart from the others.                                 | Move it inside one room.                        |
| H4    | One wallpaper and one floor per room | A room has at most one wallpaper and one flooring.                                                           | Replace the old one instead of adding another.  |
| S1–S3 | (same as the island)                 | Things on tables work the same in homes.                                                                     | —                                               |
