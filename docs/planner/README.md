# The planner

> **In short:** The planner is where a map is designed. Its frame (the shell) is the same in every
> game; each game fills it with its own modes, tools, layers and theme from its `ui` package.
> Every action goes through the same pipeline, and the real map lives in the editor worker.

| Page                            | What it answers                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| [The planner screen](screen.md) | What is on screen: the side panel, rail, viewport, pills, menus, toolbox.                       |
| [How it behaves](behaviour.md)  | Camera, selecting, moving, moldable terrain, copy and paste, keys, user journeys.               |
| [Internals](internals.md)       | The action pipeline, state, the selection mask, drawing, the catalog at runtime, speed budgets. |

The planner lives in `packages/planner`. Editing (ops, transactions, undo) is in
[edit](../edit/README.md); drawing the map is in `packages/viewport`.
