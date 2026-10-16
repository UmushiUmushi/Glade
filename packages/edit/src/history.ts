// Undo and redo: two stacks of committed patches with their labels. One user action is one
// transaction is one step. A new step clears redo; past the limit, the oldest step is dropped.

import type { Patch } from "./patch";

export const HISTORY_LIMIT = 200;

export interface Step {
  patch: Patch;
  /** What the user did, for "Undo: move 3 chairs". */
  label: string;
}

export interface History {
  push(step: Step): void;
  /** The step to undo, moved to the redo stack; undefined when there is none. */
  undo(): Step | undefined;
  /** The step to redo, moved back; undefined when there is none. */
  redo(): Step | undefined;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Labels, oldest first. */
  labels(): { undo: string[]; redo: string[] };
}

export function createHistory(limit = HISTORY_LIMIT): History {
  let done: Step[] = [];
  let undone: Step[] = [];
  return {
    push(step) {
      done = [...done, step].slice(-limit);
      undone = [];
    },
    undo() {
      const step = done.at(-1);
      if (!step) return undefined;
      done = done.slice(0, -1);
      undone = [...undone, step];
      return step;
    },
    redo() {
      const step = undone.at(-1);
      if (!step) return undefined;
      undone = undone.slice(0, -1);
      done = [...done, step];
      return step;
    },
    clear() {
      done = [];
      undone = [];
    },
    canUndo: () => done.length > 0,
    canRedo: () => undone.length > 0,
    labels: () => ({ undo: done.map((s) => s.label), redo: undone.map((s) => s.label) }),
  };
}
