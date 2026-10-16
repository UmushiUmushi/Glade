// Patches: applied forward and inverted, refused when they don't fit the map, frozen and shared
// where nothing changed, and the full diff that the property tests compare against.

import { gridLayer } from "@glade/core";
import { describe, expect, it } from "vitest";
import { freezeDoc } from "../src/freeze";
import {
  applyPatch,
  diffDocs,
  invertPatch,
  isEmptyPatch,
  EMPTY_PATCH,
  type Patch,
} from "../src/patch";
import { newYard, thing } from "./toy";

const patch: Patch = {
  changes: [
    { kind: "cell", layer: "ground", x: 1, y: 0, before: "g", after: "w" },
    { kind: "entity", layer: "things", id: "a", after: thing("a", 1, 0) },
  ],
};

describe("applyPatch", () => {
  it("applies forward, and its inverse goes back", () => {
    const base = freezeDoc(newYard());
    const next = applyPatch(base, patch);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(gridLayer<string>(next.value, "ground").cells[0][1]).toBe("w");
    expect(next.value.layers.things).toMatchObject({ items: { a: thing("a", 1, 0) } });
    const back = applyPatch(next.value, invertPatch(patch));
    expect(back.ok && back.value).toEqual(base);
  });

  it("makes a frozen map, leaving the old one as it was", () => {
    const base = freezeDoc(newYard());
    const next = applyPatch(base, patch);
    if (!next.ok) throw new Error("no");
    expect(Object.isFrozen(next.value)).toBe(true);
    expect(Object.isFrozen(gridLayer(next.value, "ground").cells[0])).toBe(true);
    expect(gridLayer<string>(base, "ground").cells[0][1]).toBe("g");
  });

  it("returns the same map for an empty patch", () => {
    const base = freezeDoc(newYard());
    const same = applyPatch(base, EMPTY_PATCH);
    expect(same.ok && same.value).toBe(base);
    expect(isEmptyPatch(EMPTY_PATCH)).toBe(true);
  });

  it("refuses a patch whose before doesn't match, or that names a missing layer", () => {
    const base = freezeDoc(newYard());
    const stale: Patch = {
      changes: [{ kind: "cell", layer: "ground", x: 1, y: 0, before: "w", after: "x" }],
    };
    const r1 = applyPatch(base, stale);
    expect(!r1.ok && r1.error).toMatchObject({
      code: "GLD-CHECK-001",
      detail: { layer: "ground", at: "1,0" },
    });
    const ghost: Patch = {
      changes: [{ kind: "entity", layer: "things", id: "zz", before: thing("zz", 0, 0) }],
    };
    const r2 = applyPatch(base, ghost);
    expect(!r2.ok && r2.error.detail).toMatchObject({ at: "zz" });
    const nowhere: Patch = {
      changes: [{ kind: "cell", layer: "sky", x: 0, y: 0, before: 1, after: 2 }],
    };
    expect(applyPatch(base, nowhere).ok).toBe(false);
  });
});

describe("invertPatch", () => {
  it("swaps before and after, leaving out a missing side", () => {
    expect(invertPatch(patch).changes).toEqual([
      { kind: "cell", layer: "ground", x: 1, y: 0, before: "w", after: "g" },
      { kind: "entity", layer: "things", id: "a", before: thing("a", 1, 0) },
    ]);
  });
});

describe("diffDocs", () => {
  it("finds every changed cell and entity, in patch order", () => {
    const base = freezeDoc(newYard());
    const next = applyPatch(base, patch);
    if (!next.ok) throw new Error("no");
    expect(diffDocs(base, next.value)).toEqual(patch);
    expect(diffDocs(base, base)).toEqual({ changes: [] });
  });
});
