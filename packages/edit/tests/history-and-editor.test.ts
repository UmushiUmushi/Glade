// Undo history (order, the 200-step limit, redo cleared by a new step) and the editor that keeps
// one map: transact, preview, undo and redo with the patches a screen copy follows, load, rebind.

import { gridLayer } from "@glade/core";
import { describe, expect, it } from "vitest";
import { createEditor } from "../src/editor";
import { createHistory } from "../src/history";
import { applyPatch, EMPTY_PATCH } from "../src/patch";
import { game, newYard, ops } from "./toy";

const step = (label: string) => ({ patch: EMPTY_PATCH, label });

describe("history", () => {
  it("undoes newest first, and redoes in turn", () => {
    const h = createHistory();
    h.push(step("a"));
    h.push(step("b"));
    expect(h.undo()?.label).toBe("b");
    expect(h.labels()).toEqual({ undo: ["a"], redo: ["b"] });
    expect(h.redo()?.label).toBe("b");
    expect(h.canRedo()).toBe(false);
  });

  it("a new step clears redo", () => {
    const h = createHistory();
    h.push(step("a"));
    h.undo();
    h.push(step("b"));
    expect(h.labels()).toEqual({ undo: ["b"], redo: [] });
  });

  it("keeps at most the limit, dropping the oldest", () => {
    const h = createHistory(200);
    for (let i = 0; i < 205; i++) h.push(step(`s${i}`));
    expect(h.labels().undo).toHaveLength(200);
    expect(h.labels().undo[0]).toBe("s5");
  });

  it("has nothing to undo or redo when empty or cleared", () => {
    const h = createHistory();
    expect([h.undo(), h.redo(), h.canUndo()]).toEqual([undefined, undefined, false]);
    h.push(step("a"));
    h.clear();
    expect(h.canUndo()).toBe(false);
  });
});

describe("editor", () => {
  const cellOf = (doc = editor().doc()) => gridLayer<string>(doc, "ground").cells[0][0];
  const editor = () => createEditor({ game, ops, doc: newYard() });

  it("keeps committed changes as undo steps, and not rejected ones", () => {
    const e = editor();
    e.transact([{ op: "setCell", x: 0, y: 0, v: "w" }], "Paint");
    e.transact([{ op: "setCell", x: 1, y: 0, v: "x" }], "Bad");
    expect(cellOf(e.doc())).toBe("w");
    expect(e.history().labels().undo).toEqual(["Paint"]);
  });

  it("can keep a change with problems when asked to be lenient", () => {
    const e = editor();
    e.transact([{ op: "setCell", x: 1, y: 0, v: "x" }], "Allowed", "lenient");
    expect(gridLayer<string>(e.doc(), "ground").cells[0][1]).toBe("x");
  });

  it("previews without keeping anything", () => {
    const e = editor();
    const before = e.doc();
    const r = e.preview([{ op: "setCell", x: 0, y: 0, v: "w" }]);
    expect(r.ok && r.value.status).toBe("committed");
    expect(e.doc()).toBe(before);
    expect(e.history().canUndo()).toBe(false);
  });

  it("undo and redo return the patch a screen copy applies to follow along", () => {
    const e = editor();
    let mirror = e.doc();
    const done = e.transact([{ op: "setCell", x: 0, y: 0, v: "w" }], "Paint");
    if (!done.ok) throw new Error("no");
    mirror = (applyPatch(mirror, done.value.patch) as { value: typeof mirror }).value;
    const undone = e.undo();
    expect(undone?.label).toBe("Paint");
    mirror = (applyPatch(mirror, undone?.patch ?? EMPTY_PATCH) as { value: typeof mirror }).value;
    expect(cellOf(mirror)).toBe("g");
    expect(mirror).toEqual(e.doc());
    const redone = e.redo();
    mirror = (applyPatch(mirror, redone?.patch ?? EMPTY_PATCH) as { value: typeof mirror }).value;
    expect(cellOf(mirror)).toBe("w");
    expect(e.undo()).toBeDefined();
    expect(e.undo()).toBeUndefined();
    expect(e.redo()).toBeDefined();
    expect(e.redo()).toBeUndefined();
  });

  it("load starts a new map with no history; rebind keeps history", () => {
    const e = editor();
    e.transact([{ op: "setCell", x: 0, y: 0, v: "w" }], "Paint");
    e.rebind(game);
    expect(e.history().canUndo()).toBe(true);
    e.load(newYard());
    expect(e.history().canUndo()).toBe(false);
    expect(cellOf(e.doc())).toBe("g");
    expect(Object.isFrozen(e.doc())).toBe(true);
  });
});
