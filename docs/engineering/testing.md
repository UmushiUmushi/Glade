# Testing

> **In short:** Many fast unit tests, a contract test for every game, a Storybook story for every component, end-to-end tests for every user journey, and checks for accessibility, looks and speed. All run in CI on every pull request.

## The test layers

| Layer                | Tool                                                       | What it tests                                                                                                                                                                                                                                      | Where                             | When                                           |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------- |
| Unit                 | Vitest                                                     | Planners (intent → ops), **ops**, selection maths, terrain settle, builder layout rules, logging redaction, migrations                                                                                                                             | next to the code: `*.test.ts`     | Every PR                                       |
| Profiles             | Vitest                                                     | Every rule has a test; the look (times of day, seasons, colours); a geometry golden of each demo map                                                                                                                                               | `packages/games/*/profile/tests/` | Every PR                                       |
| Render goldens       | Vitest + headless Chrome                                   | Each demo map drawn by `@glade/three` at each time of day, compared within 1% of pixels                                                                                                                                                            | `packages/testkit/render/`        | Opt-in (`GLADE_RENDER=1`), and before releases |
| Editor               | Vitest                                                     | Patch apply and undo, transactions commit and reject, history caps                                                                                                                                                                                 | `packages/edit/`                  | Every PR                                       |
| Property             | Vitest + fast-check                                        | "After settle, rule T3 holds", "Add then Subtract the same shape = no change", "Recipe compiles to a model that passes `entryProblems`", "Any op, then undo = the map you started with", "The recording draft gives the same patch as a full diff" | `*.prop.test.ts`                  | Every PR                                       |
| Game contract        | Vitest                                                     | Every game's profile, catalog, edits and UI work with the shared code, for every map type                                                                                                                                                          | `packages/testkit/contract/`      | Every PR                                       |
| Repo guards          | Vitest                                                     | Import boundaries, game words in shared code, reference screenshots stay local                                                                                                                                                                     | `tests/`                          | Every PR                                       |
| Pipeline integration | Vitest                                                     | The editor + the profile's rules in a real worker: actions on a real-size island map                                                                                                                                                               | `apps/web/tests/pipeline/`        | Every PR                                       |
| Component            | Storybook + Vitest addon                                   | Every UI component and its states, with play functions for clicks and keys                                                                                                                                                                         | `*.stories.tsx`                   | Every PR                                       |
| Accessibility        | Storybook a11y addon (axe) + Playwright axe                | No axe violations; keyboard paths work                                                                                                                                                                                                             | stories + `e2e/a11y/`             | Every PR                                       |
| Visual               | Playwright screenshots                                     | Panels, menus, pills in each theme; viewport goldens from `MapScene.capture`                                                                                                                                                                       | `e2e/visual/`                     | Every PR (review diffs)                        |
| End-to-end           | Playwright (Chromium, Firefox, WebKit, Pixel 7, iPhone 14) | User journeys J1–J5, sharing, builder examples, bug report                                                                                                                                                                                         | `e2e/journeys/`                   | Every PR (sharded)                             |
| Performance          | Vitest bench + Playwright                                  | Budgets in 11.10                                                                                                                                                                                                                                   | `bench/`, `e2e/perf/`             | Every PR (warn), main (fail)                   |
| Server               | Vitest + Fastify `inject` + temp SQLite                    | Every route, limits, conflicts, upload checks                                                                                                                                                                                                      | `apps/server/tests/`              | Every PR                                       |
| Container            | Docker + curl                                              | Image boots, `/health` is OK, app page loads                                                                                                                                                                                                       | CI job                            | Every PR                                       |
| Manual               | Checklist                                                  | VoiceOver, NVDA, real phones, real GPU                                                                                                                                                                                                             | `docs/release-checklist.md`       | Before each release                            |

## Coverage targets

| Code                                                                                                       | Lines covered |
| ---------------------------------------------------------------------------------------------------------- | ------------- |
| `packages/edit`, `packages/logging`, `packages/errors`, the builder's parts engine, the planner's pipeline | ≥ 90%         |
| Each game's `edit` package, and selection rules                                                            | ≥ 90%         |
| Everything else                                                                                            | ≥ 80%         |

## Test data

| Fixture                                                       | Use                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A real-size island map and catalog (in `fixtures/`)           | Integration, perf and visual tests                                                |
| The `_fixture` game                                           | Shared code tested with no real game. Its `sheet` map has only a 2D view.         |
| The profile's samples (`@glade/petit-planet-profile/samples`) | Made-up items and sample maps, including homes. For tests only, never in the app. |
| Small hand-made maps (one per rule)                           | Each violation pill and fix tip                                                   |
| Old format files                                              | Each migration step                                                               |

## A test example

```ts
// packages/games/petit-planet/edit/src/maps/planet/plans/furniture.test.ts
it("plans one move op per selected item", () => {
  const ctx = fakeContext({ selection: ["chair-1", "chair-2"] });
  const plan = planFurniture({ kind: "MoveSelection", dx: 2, dy: 0 }, ctx);
  expect(plan).toEqual(
    ok({
      label: "Move 2 items",
      ops: [
        { op: "move", id: "chair-1", dx: 2, dy: 0 },
        { op: "move", id: "chair-2", dx: 2, dy: 0 },
      ],
    }),
  );
});
```

## Definition of done for a feature

- [ ] Unit tests for its logic.
- [ ] A story for each new component, with play tests.
- [ ] No axe violations; keyboard path works.
- [ ] Log events added to the registry.
- [ ] Error codes added to the registry, with user text.
- [ ] An end-to-end test if it is a user journey.
- [ ] Guide page written or updated.
