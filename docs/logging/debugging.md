# Debugging

> **In short:** Every part of Glade can be seen while it runs: the pipeline, the worker, the selection, the state machines and the logs. Bugs from users come with a timeline, and with consent, a replay.

| Tool              | How to open                                  | Shows                                                                                         |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Debug overlay     | `Ctrl + Alt + D` (dev builds, or `?debug=1`) | Live pipeline steps with times, last `TxResult`, raw rule violations, worker queue, FPS graph |
| Selection view    | Debug overlay → Selection                    | The selection mask drawn as cells, per mode                                                   |
| Tool state        | Debug overlay → Tools                        | Current state of every tool machine. Also works with the XState inspector                     |
| Store view        | Redux DevTools (Zustand middleware)          | Every store change, with the action id                                                        |
| Performance marks | Browser devtools → Performance               | `performance.mark` for each pipeline step and worker call                                     |
| Error code links  | Any error in dev                             | Clicking the code opens its entry in `docs/error-codes.md`                                    |
| Storybook         | `pnpm storybook`                             | Every component and tool, alone, with fake data                                               |
| Fixture maps      | `?fixture=main` (dev)                        | Loads a real-size island map and catalog instantly                                            |
| Log CLI           | `pnpm glade-log …`                           | Read, filter, time, replay `.gladelog` files                                                  |
| VS Code           | `.vscode/launch.json`                        | Debug the server, Vitest tests, and Chrome with source maps                                   |

**Other habits that help debugging**

- Time and randomness are injected (`clock`, `rng`), so tests and replays are repeatable.
- Every log line in an action shares one id, so one search finds the whole story.
- Dev builds keep the worker unminified with source maps.
