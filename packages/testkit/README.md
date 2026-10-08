# @glade/testkit

What every game profile is tested with. Nothing here is used by Glade at run time.

| Folder      | Holds                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| `src/`      | `games.ts`: every profile with its samples (made-up items and saved sample maps) |
| `contract/` | the contract tests: what "a game works" means, run against every profile         |
| `three/`    | @glade/three checked against real games: picking and post-processing             |
| `render/`   | opt-in render goldens: each demo map drawn by @glade/three in headless Chrome    |

Profiles ship no catalog items. A profile's samples live in its `samples/` folder (catalogs and
saved maps) and are only reached from here and from the profile's own tests; library code never
imports them (`tests/boundaries.test.ts`).

## Adding a game or a map

Add samples to the profile's `samples/` folder, then add the game to `games` in `src/games.ts`,
with samples for each of its maps (a new map needs its own). The contract tests and the goldens
pick it up from there.

## Running

```sh
pnpm test packages/testkit                                   # contract and 3D tests
GLADE_RENDER=1 pnpm test packages/testkit/render             # render goldens (needs Chrome)
UPDATE_GOLDENS=1 GLADE_RENDER=1 pnpm test packages/testkit/render   # rewrite them, on purpose only
```

`GLADE_CHROME` points the goldens at another Chrome. A golden that differs by more than 1% of its
pixels writes `<name>.actual.png` next to it for a look.
