// Property tests (docs/edit/README.md, Testing): for any list of ops, undo gives back the map you
// started with, and the recording draft's patch is the same as a full diff of the two maps.

import { deepEqual } from "@glade/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createEditor } from "../src/editor";
import { freezeDoc } from "../src/freeze";
import { applyPatch, diffDocs, invertPatch } from "../src/patch";
import { runTransaction, type Op } from "../src/transaction";
import { game, newYard, ops, thing } from "./toy";

const ids = fc.constantFrom("a", "b", "c", "d");
const x = fc.integer({ min: 0, max: 5 });
const y = fc.integer({ min: 0, max: 3 });

/** Any op from the toy table that doesn't fail: paint a cell, put or remove a thing. */
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ op: fc.constant("setCell"), x, y, v: fc.constantFrom("g", "w", "x") }),
  fc.record({
    op: fc.constant("put"),
    thing: fc.tuple(ids, x, y).map(([i, a, b]) => thing(i, a, b)),
  }),
  fc.record({ op: fc.constant("remove"), id: ids }),
);
const opLists = fc.array(fc.array(op, { minLength: 1, maxLength: 8 }), {
  minLength: 1,
  maxLength: 6,
});

describe("editing properties", () => {
  it("any transactions, then undo them all, give back the map you started with", () => {
    fc.assert(
      fc.property(opLists, (lists) => {
        const editor = createEditor({ game, ops, doc: newYard() });
        const start = editor.doc();
        lists.forEach((list, i) => editor.transact(list, `t${i}`, "lenient"));
        while (editor.undo());
        expect(deepEqual(editor.doc(), start)).toBe(true);
      }),
    );
  });

  it("redo after undo gives back the same map", () => {
    fc.assert(
      fc.property(opLists, (lists) => {
        const editor = createEditor({ game, ops, doc: newYard() });
        lists.forEach((list, i) => editor.transact(list, `t${i}`, "lenient"));
        const end = editor.doc();
        while (editor.undo());
        while (editor.redo());
        expect(deepEqual(editor.doc(), end)).toBe(true);
      }),
    );
  });

  it("the recording draft's patch is the same as a full diff", () => {
    fc.assert(
      fc.property(fc.array(op, { minLength: 1, maxLength: 12 }), (list) => {
        const base = freezeDoc(newYard());
        const result = runTransaction(base, list, { game, ops, mode: "lenient" });
        if (!result.ok) throw new Error(result.error.code);
        const { patch, doc } = result.value;
        expect(patch).toEqual(diffDocs(base, doc));
        const back = applyPatch(doc, invertPatch(patch));
        expect(back.ok && deepEqual(back.value, base)).toBe(true);
      }),
    );
  });
});
