// Transactions: committed, rejected or unchanged; all ops happen or none do; problems the map
// already had never block a change; and ops that are missing, refuse or throw are GLD-CHECK-001.

import { gridLayer } from "@glade/core";
import { describe, expect, it } from "vitest";
import { freezeDoc } from "../src/freeze";
import { runTransaction, type Op } from "../src/transaction";
import { game, newYard, ops, thing } from "./toy";

const ctx = { game, ops };
const start = () => freezeDoc(newYard());

function tx(base = start(), list: Op[], mode: "strict" | "lenient" = "strict") {
  const result = runTransaction(base, list, { ...ctx, mode });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe("runTransaction", () => {
  it("commits a change that breaks no rule, with its patch and changed area", () => {
    const r = tx(start(), [
      { op: "setCell", x: 1, y: 1, v: "w" },
      { op: "put", thing: thing("a", 4, 2) },
    ]);
    expect(r.status).toBe("committed");
    expect(r.patch.changes).toHaveLength(2);
    expect(r.region).toEqual({ x: 1, y: 1, w: 4, h: 2 });
    expect(gridLayer<string>(r.doc, "ground").cells[1][1]).toBe("w");
    expect(r.violations).toEqual([]);
  });

  it("is unchanged when the ops change nothing", () => {
    const base = start();
    const r = tx(base, [{ op: "setCell", x: 0, y: 0, v: "g" }]);
    expect(r).toMatchObject({ status: "unchanged", doc: base, region: null });
  });

  it("strict: rejects a change that adds a problem, keeping the map as it was", () => {
    const base = start();
    const r = tx(base, [{ op: "setCell", x: 2, y: 2, v: "x" }]);
    expect(r.status).toBe("rejected");
    expect(r.doc).toBe(base);
    expect(r.added.map((v) => v.ruleId)).toEqual(["R1"]);
    expect(r.patch.changes).toHaveLength(1);
  });

  it("lenient: keeps a change that adds a problem, and reports it", () => {
    const r = tx(start(), [{ op: "setCell", x: 2, y: 2, v: "x" }], "lenient");
    expect(r.status).toBe("committed");
    expect(r.added).toHaveLength(1);
  });

  it("a problem the map already had doesn't block a change next to it", () => {
    const messy = tx(start(), [{ op: "setCell", x: 2, y: 2, v: "x" }], "lenient").doc;
    const r = tx(messy, [{ op: "put", thing: thing("a", 2, 2) }]);
    expect(r.status).toBe("committed");
    expect(r.violations.map((v) => v.ruleId)).toEqual(["R1"]);
    expect(r.added).toEqual([]);
  });

  it("all ops or none: a later op failing undoes nothing because nothing was kept", () => {
    const base = start();
    const result = runTransaction(
      base,
      [{ op: "setCell", x: 0, y: 0, v: "w" }, { op: "refuse" }],
      ctx,
    );
    expect(!result.ok && result.error.detail).toEqual({ reason: "refused" });
    expect(gridLayer<string>(base, "ground").cells[0][0]).toBe("g");
  });

  it("an unknown op, a throwing op, or an op editing in place is GLD-CHECK-001", () => {
    const seeded = tx(start(), [{ op: "put", thing: thing("a", 0, 0) }]).doc;
    const cases: [Op, string][] = [
      [{ op: "teleport" }, "no such op"],
      [{ op: "explode" }, "op threw"],
      [{ op: "nudgeInPlace", id: "a" }, "op threw"],
    ];
    for (const [op, reason] of cases) {
      const result = runTransaction(seeded, [op], ctx);
      expect(!result.ok && result.error, op.op).toMatchObject({
        code: "GLD-CHECK-001",
        detail: { op: op.op, reason },
      });
    }
  });
});
