// The editor: one map, its bound map type, its ops and its undo history. It lives in the editor
// worker (docs/edit/README.md). Every answer carries the patch, so the screen's copy of the map can
// follow with `applyPatch` instead of being sent the whole map.

import type { Bound, Doc } from "@glade/core";
import type { GladeError, Result } from "@glade/errors";
import { freezeDoc } from "./freeze";
import { createHistory, HISTORY_LIMIT, type History } from "./history";
import { applyPatch, invertPatch, type Patch } from "./patch";
import { runTransaction, type Op, type OpTable, type TxMode, type TxResult } from "./transaction";

export interface EditorOptions {
  game: Bound;
  ops: OpTable;
  doc: Doc;
  historyLimit?: number;
}

/** An undo or redo: the patch to apply to a copy of the map, and the step's label. */
export interface Stepped {
  patch: Patch;
  label: string;
}

export interface Editor {
  doc(): Doc;
  /** Run ops and keep the result if it commits. One call is one undo step. */
  transact(ops: readonly Op[], label: string, mode?: TxMode): Result<TxResult, GladeError>;
  /** Run ops and check them, keeping nothing (live checks while dragging). */
  preview(ops: readonly Op[]): Result<TxResult, GladeError>;
  undo(): Stepped | undefined;
  redo(): Stepped | undefined;
  history(): History;
  /** A new map: history starts again. */
  load(doc: Doc): void;
  /** The same map type with a new catalog (packs loaded). History is kept. */
  rebind(game: Bound): void;
}

export function createEditor(options: EditorOptions): Editor {
  let game = options.game;
  let doc = freezeDoc(options.doc);
  const history = createHistory(options.historyLimit ?? HISTORY_LIMIT);

  /** Move the map along a patch. The editor's own patches always fit its map. */
  function step(patch: Patch): void {
    const next = applyPatch(doc, patch);
    if (!next.ok) throw new Error("editor: an undo step didn't fit the map");
    doc = next.value;
  }

  return {
    doc: () => doc,
    transact(ops, label, mode = "strict") {
      const result = runTransaction(doc, ops, { game, ops: options.ops, mode });
      if (result.ok && result.value.status === "committed") {
        doc = result.value.doc;
        history.push({ patch: result.value.patch, label });
      }
      return result;
    },
    preview: (ops) => runTransaction(doc, ops, { game, ops: options.ops, mode: "strict" }),
    undo() {
      const undone = history.undo();
      if (!undone) return undefined;
      const patch = invertPatch(undone.patch);
      step(patch);
      return { patch, label: undone.label };
    },
    redo() {
      const redone = history.redo();
      if (!redone) return undefined;
      step(redone.patch);
      return { patch: redone.patch, label: redone.label };
    },
    history: () => history,
    load(next) {
      doc = freezeDoc(next);
      history.clear();
    },
    rebind(next) {
      game = next;
    },
  };
}
