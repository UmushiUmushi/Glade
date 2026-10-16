// A transaction: run a list of ops on a draft, make the patch, check the changed area with the
// profile's rules, then commit or reject. All the ops happen, or none do. Pure: the editor decides
// what to keep.

import { validate, type Bound, type Box, type Doc, type Violation } from "@glade/core";
import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";
import { createDraft } from "./draft";
import { isEmptyPatch, type Patch } from "./patch";
import { changedRegion } from "./region";

/** One edit, by name, with its arguments: `{ op: "move", id: "chair-1", dx: 2, dy: 0 }`. */
export type Op = { readonly op: string } & Readonly<Record<string, unknown>>;

/** Changes a draft map. Returns an error for input it can't use, or nothing when it worked. */
export type OpFn = (doc: Doc, op: Op, game: Bound) => Result<void, GladeError> | void;

/** A map type's ops, by name: the shared ones it uses and its own. */
export type OpTable = Readonly<Record<string, OpFn>>;

/**
 * strict: rejected when it adds a problem. lenient: kept even so (problems are shown).
 * Problems the map already had in that area never reject a change: works in progress are fine.
 */
export type TxMode = "strict" | "lenient";

export interface TxResult {
  status: "committed" | "rejected" | "unchanged";
  /** The new map when committed; the map it started from otherwise. */
  doc: Doc;
  /** What the ops changed, whatever the status. */
  patch: Patch;
  /** Problems in the changed area after the ops. */
  violations: Violation[];
  /** The problems the ops added. */
  added: Violation[];
  /** The changed area, or null when nothing changed. */
  region: Box | null;
}

export interface TxContext {
  game: Bound;
  ops: OpTable;
  mode?: TxMode;
}

/** A problem, as a key: the same rule on the same cells and things is the same problem. */
function problemKey(v: Violation): string {
  const cells = v.cells.map((c) => `${c.grid}:${c.x},${c.y}`).sort();
  return `${v.ruleId}|${cells.join(" ")}|${[...(v.objectIds ?? [])].sort().join(" ")}`;
}

/** Step 2: every op, in order, on the draft. The first one that fails stops the rest. */
function runOps(doc: Doc, ops: readonly Op[], ctx: TxContext): Result<void, GladeError> {
  for (const op of ops) {
    const run = ctx.ops[op.op];
    const detail = { op: op.op.slice(0, 32) };
    if (!run)
      return err(gladeError("GLD-CHECK-001", { detail: { ...detail, reason: "no such op" } }));
    try {
      const result = run(doc, op, ctx.game);
      if (result && !result.ok) return result;
    } catch (cause) {
      return err(gladeError("GLD-CHECK-001", { detail: { ...detail, reason: "op threw" }, cause }));
    }
  }
  return ok(undefined);
}

export function runTransaction(
  base: Doc,
  ops: readonly Op[],
  ctx: TxContext,
): Result<TxResult, GladeError> {
  // 1. A recording draft of the map.
  const draft = createDraft(base);
  // 2. The ops change it.
  const ran = runOps(draft.doc, ops, ctx);
  if (!ran.ok) return ran;
  // 3. The patch, and the new map.
  const { patch, doc } = draft.finish();
  if (isEmptyPatch(patch)) {
    return ok({ status: "unchanged", doc: base, patch, violations: [], added: [], region: null });
  }
  // 4. Where it changed.
  const region = changedRegion(ctx.game, base, doc, patch);
  // 5. The profile's rules, around the change, before and after.
  const scope = region ? { region } : {};
  const before = new Set(validate(base, ctx.game, scope).map(problemKey));
  const violations = validate(doc, ctx.game, scope);
  const added = violations.filter((v) => !before.has(problemKey(v)));
  // 6. Commit or reject.
  const rejected = (ctx.mode ?? "strict") === "strict" && added.length > 0;
  return ok({
    status: rejected ? "rejected" : "committed",
    doc: rejected ? base : doc,
    patch,
    violations,
    added,
    region,
  });
}
