# Code style

> **In short:** Code reads top to bottom, like steps in a recipe. Each step is a small named function. Data flows forward. Side effects happen only at the end. State changes go through state machines. If something should be step-by-step, it **is** step-by-step.

## Rules

| #   | Rule                                                                                                                                                                                                 | Why                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | **Steps, in order.** A process is a list of named steps called in one place, top to bottom.                                                                                                          | You can read the whole flow in one function.                       |
| 2   | **Pure core, side effects at the edge.** Planning, selection maths and builder layout are pure functions. Only the Present step, adapters (storage, network, worker) and UI touch the outside world. | Pure code is easy to test and replay.                              |
| 3   | **Results, not throws.** Return `Result<T, GladeError>`.                                                                                                                                             | Errors can't slip past a step.                                     |
| 4   | **State machines for interaction.** Every tool and every multi-step UI (drag, paste, share dialog) is an XState machine.                                                                             | Every state handles every event. Nothing falls through the cracks. |
| 5   | **One concept per file.** Name the file after the concept: `selection-mask.ts`.                                                                                                                      | Easy to find.                                                      |
| 6   | **Feature folders with a front door.** Each folder exposes its public API in `index.ts`. Nothing imports a folder's insides from outside.                                                            | Clear boundaries.                                                  |
| 7   | **Dependencies come in, not from globals.** Pass a `deps` object (clock, rng, log, worker, storage).                                                                                                 | Tests swap in fakes.                                               |
| 8   | **No magic numbers.** Limits and timings live in one `constants.ts` per feature, or in game params.                                                                                                  | One place to change them.                                          |
| 9   | **Named exports only.** No default exports.                                                                                                                                                          | Search and rename work.                                            |
| 10  | **Types are strict.** No `any`. No non-null `!` without a comment.                                                                                                                                   | Fewer runtime surprises.                                           |
| 11  | **File header comment.** Every file starts with 1–3 plain lines: what it is and how it fits.                                                                                                         | New readers get oriented fast.                                     |
| 12  | **Short functions.** Aim for under 40 lines. Split by step, not by size.                                                                                                                             | Each step does one thing.                                          |

## Example: a waterfall function

```ts
// apps/web/src/library/load-map-file.ts
// Loads a map file the user picked: check it, upgrade it, load it through its profile, find its packs.

export function loadMapFile(text: string, deps: LoadDeps): Result<LoadedMap, GladeError> {
  return pipe(
    parseJson(text), // 1. text → JSON
    andThen(checkEnvelope), // 2. is it a Glade map file, or a bare map?
    andThen(migrateEnvelope), // 3. old format → current format
    andThen((file) => loadInnerMap(file, deps)), // 4. the profile decodes and migrates the map
    andThen((map) => resolvePacks(map, deps)), // 5. find the packs it needs
  );
}
```

**Don't** do this: one function that parses, then sometimes migrates inside an `if`, then calls a helper that also loads packs and shows a toast. Steps hidden inside other steps are how things get missed.

## Naming

| Thing                | Style                            | Example                                     |
| -------------------- | -------------------------------- | ------------------------------------------- |
| Files and folders    | kebab-case                       | `selection-mask.ts`                         |
| Types and components | PascalCase                       | `SelectionMask`, `SidePanel`                |
| Functions            | camelCase, starts with a verb    | `planMove`, `resolvePacks`                  |
| Constants            | UPPER_SNAKE                      | `DRAG_DEAD_ZONE_PX`                         |
| Log events           | dotted, lower case               | `planner.action.committed`                  |
| Error codes          | `GLD-AREA-NNN`                   | `GLD-CHECK-002`                             |
| Tests                | `<file>.test.ts`, sentence names | `it("plans one move op per selected item")` |
| Stories              | `<Component>.stories.tsx`        | `ViolationPill.stories.tsx`                 |

## Lint rules that enforce this

- `no-restricted-imports`: the boundaries in 6.2.
- `no-empty` (including empty `catch`).
- `@typescript-eslint/no-explicit-any`, `no-floating-promises`.
- `import/no-default-export`.
- `max-lines-per-function: 60` (warning).
- A custom rule: only files in `pipeline/present/` and `platform/` may call stores' setters.
