# Glade

Glade is a web app for planning maps and building items for various building games. Each planner
looks like its game and works like every other planner: the same controls, the same keys, the same
behaviour.

Glade is in early development. The game profiles are in place, starting with Petit Planet (its
island and its homes); the planner, the builder and the server come next
([roadmap](docs/roadmap.md)).

## How it is built

- **Game profiles** describe each game: its maps, grids, rules, item kinds, settings and look. A
  profile never changes a map; its rules only check one.
- **Shared packages** hold everything that is the same in every game: editing, the planner, the
  builder, the viewport and the UI controls. They never name a game.
- **Apps** put it together: the browser app and a small server for sharing.

```
apps/                    the web app and the server (coming)
packages/
  core/                  @glade/core: maps, grids, kinds and catalogs, rule checks, map files
  render/                @glade/render: the look as data, 2D drawing, 3D geometry, item models
  three/                 @glade/three: draws a map in 3D with three.js (no UI)
  testkit/               the contract every game passes, and render goldens
  games/
    petit-planet/
      profile/           @glade/petit-planet-profile
      ui/theme/icons/    Petit Planet's tool icons
    _fixture/profile/    a small made-up game for the contract tests
tests/                   repo guards: import boundaries, references stay local
docs/                    architecture and component docs
```

Packages are TypeScript source with no build step, used by name within the pnpm workspace:

```ts
import { bind, validate } from "@glade/core";
import { planet } from "@glade/petit-planet-profile";

const island = bind(planet, catalog); // the items come from a catalog, bound to the map
const problems = validate(island.newDoc("my-island"), island); // [] for the base island
```

## Docs

- [Architecture](docs/architecture.md): the idea, the parts, where code lives.
- [All docs](docs/README.md), by component: profiles, editing, planner, builder, UI, server,
  logging, engineering.

## Development

Requires Node 20+ and pnpm.

```sh
pnpm install
pnpm test        # all tests
pnpm typecheck
pnpm lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## AI use

The code was written with the help of AI. All design and artwork in Glade is made by people, not
by AI.

## License

[MIT](LICENSE). Glade is a fan project and is not affiliated with the makers of any game it
supports. It contains no game assets.
