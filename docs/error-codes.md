# Error codes

<!-- Generated from packages/errors/src/codes.ts by its test. Don't edit by hand:
     run UPDATE_GOLDENS=1 pnpm test packages/errors after changing the registry. -->

Every error Glade can report. How errors are handled: [error handling](logging/errors.md).

## PLAN: Planning ops from an intent

| Code           | Severity | Step | What went wrong                                                 | User sees             |
| -------------- | -------- | ---- | --------------------------------------------------------------- | --------------------- |
| `GLD-PLAN-001` | error    | plan | The mode has no plan for this intent. The action was cancelled. | Something went wrong. |

## CHECK: Running and checking ops

| Code            | Severity | Step  | What went wrong                                                       | User sees             |
| --------------- | -------- | ----- | --------------------------------------------------------------------- | --------------------- |
| `GLD-CHECK-001` | error    | check | An op got input it can't use (a Glade bug). The action was cancelled. | Something went wrong. |

## WORKER: The editor worker

| Code             | Severity | Step  | What went wrong                                                            | User sees                                     |
| ---------------- | -------- | ----- | -------------------------------------------------------------------------- | --------------------------------------------- |
| `GLD-WORKER-001` | error    | check | The editor worker didn't answer in time and was restarted from the mirror. | Restarted the editor. Undo history was reset. |
| `GLD-WORKER-002` | error    | check | The editor worker crashed and was restarted from the mirror.               | Restarted the editor. Undo history was reset. |

## STAGE: Drawing the map (2D and 3D)

| Code            | Severity | Step | What went wrong                                                 | User sees       |
| --------------- | -------- | ---- | --------------------------------------------------------------- | --------------- |
| `GLD-STAGE-001` | warn     | ui   | The 3D view lost its graphics context. The view switched to 2D. | 3D view paused. |

## STORE: Browser storage

| Code            | Severity | Step    | What went wrong                                                         | User sees                                       |
| --------------- | -------- | ------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `GLD-STORE-001` | info     | storage | Browser storage is unavailable (a private window, or the disk is full). | This browser can't keep changes on this device. |

## NET: The network

| Code          | Severity | Step    | What went wrong                                                        | User sees                                    |
| ------------- | -------- | ------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `GLD-NET-001` | warn     | network | The server can't be reached. Edits wait and are retried with back-off. | Can't reach Glade's server. Changes waiting. |

## API: Glade's server API

| Code          | Severity | Step    | What went wrong                                                     | User sees                                                      |
| ------------- | -------- | ------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GLD-API-401` | warn     | network | The session ended or expired.                                       | You were logged out.                                           |
| `GLD-API-409` | warn     | network | Another device saved a newer revision first. The latest was loaded. | This map changed on another device. Loaded the latest version. |

## FILE: Map and pack files

| Code           | Severity | Step    | What went wrong                                           | User sees                                       |
| -------------- | -------- | ------- | --------------------------------------------------------- | ----------------------------------------------- |
| `GLD-FILE-001` | error    | storage | The file isn't JSON, or isn't a Glade file.               | This isn't a Glade file.                        |
| `GLD-FILE-002` | error    | storage | The file is for another game.                             | This file is for another game.                  |
| `GLD-FILE-003` | error    | storage | The file's format version is newer than this Glade knows. | This file was made by a newer version of Glade. |
| `GLD-FILE-004` | warn     | storage | A map uses items from a pack that isn't loaded.           | {count} items need the pack “{pack}”.           |

## UI: Screens and controls

| Code         | Severity | Step | What went wrong                                                        | User sees                  |
| ------------ | -------- | ---- | ---------------------------------------------------------------------- | -------------------------- |
| `GLD-UI-001` | error    | ui   | A screen region crashed while rendering. Its error boundary caught it. | This part stopped working. |

## APP: Anything else (unexpected errors)

| Code          | Severity | Step | What went wrong                               | User sees             |
| ------------- | -------- | ---- | --------------------------------------------- | --------------------- |
| `GLD-APP-001` | fatal    | ui   | An unexpected error reached a global handler. | Something went wrong. |
