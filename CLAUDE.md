# Glade

A web app for planning maps and building items for cosy building games. Read
docs/architecture.md before changing anything structural. Adding a game or a map:
docs/profiles/adding-a-game.md. All docs: docs/README.md.

## Working in this repo

- pnpm workspace: `apps/*` (web, server), `packages/*` (shared, game-free) and
  `packages/games/<id>/*` (one folder per game: `profile`, later `catalog`, `edit`, `ui`).
  `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.
- Render goldens: `GLADE_RENDER=1 pnpm test packages/testkit/render` (needs Chrome).
  `UPDATE_GOLDENS=1` rewrites them, on purpose only.
- Packages are TypeScript source with no build step; `exports` points at `src/index.ts`. Import
  other packages by name, never by a path into them.
- Consistency in differences: every game looks like itself and is used the same way. One engine;
  each game gives it settings. A fact about a game lives in its profile, once.
- Where code goes: the table in docs/architecture.md ("Where does it go?"). Narrowest place first
  (map, then game, then shared). Something moves into a shared package only when a second game
  needs it.
- Shared packages never import a game or use a game word (ESLint plus tests/boundaries.test.ts).
- A profile never changes a map: rules are read-only checks. Editing lives in `packages/edit` and
  a game's `edit` package. A profile imports nothing from its game's catalog, edit or ui.
- A game's `ui` package is data and plain functions (theme, icons, words, modes), never React.
- Every rule is code with a test. Every map of every game passes packages/testkit/contract.
- Profiles ship no catalog items. Made-up items and sample maps live in each profile's `samples/`,
  used only by tests and the test kit; library code never imports them.
- This repo is public. No personal notes or names, no game assets.
- `packages/games/*/references/` (screenshots and notes about them) is local only and ignored by
  git; tests/references.test.ts fails if anything there is tracked. Never commit it, never
  force-add it.
