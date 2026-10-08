# Contributing

Thanks for helping. This page covers setup, the checks your change must pass, and the rules that
keep Glade consistent. Read [docs/architecture.md](docs/architecture.md) before changing anything
structural.

## Setup

Requires Node 20+ and pnpm.

```sh
git clone https://github.com/UmushiUmushi/Glade.git
cd Glade
pnpm install
```

| Command          | Does                                    |
| ---------------- | --------------------------------------- |
| `pnpm test`      | All unit, contract and repo-guard tests |
| `pnpm typecheck` | TypeScript check                        |
| `pnpm lint`      | ESLint and Prettier check               |
| `pnpm format`    | Formats everything with Prettier        |

`GLADE_RENDER=1 pnpm test packages/testkit/render` runs the render goldens (needs Chrome). More
commands (`pnpm dev`, `pnpm storybook`, `pnpm e2e`) arrive with the apps; see the
[roadmap](docs/roadmap.md).

## Before you open a pull request

These must pass:

```sh
pnpm test
pnpm typecheck
pnpm lint
```

Checklist:

- [ ] Tests added or updated (unit, and e2e for user journeys).
- [ ] Stories added for new components, with play tests.
- [ ] Keyboard and screen reader path checked.
- [ ] New log events are in the registry and contain no content
      ([what is never logged](docs/logging/README.md#what-is-logged-and-what-is-never-logged)).
- [ ] New errors have codes and user text.
- [ ] Guide updated if behaviour changed.
- [ ] Screenshots or a short video for UI changes.
- [ ] No game assets added.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
`fix:`, `docs:`, ...).

## Rules

- **Shared packages stay game-free.** Nothing in a shared package imports a game or names a game's
  concepts. Game concepts go in the game's folder (`packages/games/<id>/`).
- **Something moves into a shared package only when a second game needs it.**
- **A game's facts live in its profile, once.** Edits and rules read the same settings.
- **Profiles never change a map.** They describe maps (layers, base maps, rules, looks); editing
  lives in `packages/edit` and each game's `edit` package.
- **Profiles ship no items.** Items live in each game's catalog and in packs; made-up items for
  tests live in a profile's `samples/`.
- **Every rule is code with a test.** Nothing rule-related lives only in documentation.
- **Everything stays customizable.** Rules read their numbers from the map's `params`, never from
  constants.
- **Every game passes the contract tests** in `packages/testkit/contract/`.
- **Packages are used by name.** Never import a file inside another package by path.
- **No game assets.** Don't add textures, models, fonts, sounds or screenshots taken from a game.
  Facts about a game (sizes, rules, item kinds) and original work are welcome.
- **Reference screenshots stay local.** Keep them in `packages/games/<id>/references/`, which git
  ignores. A test fails if anything in that folder is tracked.

## Where does my change go?

See [where does it go?](docs/architecture.md#where-does-it-go) in the architecture overview.

## Adding a game

See [docs/profiles/adding-a-game.md](docs/profiles/adding-a-game.md).

## Adding base items

1. Add entries to the game's catalog package (`packages/games/<id>/catalog/`), with Glade's
   `meta` (name, category, tags) next to each entry.
2. Models must be **original work** built from the model format's shapes
   ([item models](docs/profiles/models.md)). No ripped models or textures.
3. Run `pnpm test`: every entry must pass `entryProblems`.
4. Check the thumbnails in Storybook (`Catalog/All items` story).

## Decisions

Big choices are written as short **Architecture Decision Records** in `docs/adr/NNNN-title.md`:
context, decision, consequences.
