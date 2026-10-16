// The API's shapes: Problem Details to and from GladeErrors (the server doc's 409 example), and the
// route bodies accepting what the docs describe and refusing what they don't.

import { gladeError } from "@glade/errors";
import { describe, expect, it } from "vitest";
import { errorOfProblem, problemOf, problemSchema } from "../src/api/problem";
import {
  draftSchema,
  draftSummarySchema,
  healthSchema,
  newDraftSchema,
  sharePatchSchema,
  shareSchema,
  shareVersionsSchema,
} from "../src/api/routes";

describe("Problem Details", () => {
  it("turns a GladeError into the server doc's example", () => {
    const problem = problemOf(gladeError("GLD-API-409"), 409, {
      detail: "You started from revision 12. The latest is revision 13.",
      latestRevision: 13,
    });
    expect(problem).toEqual({
      type: "https://glade.app/errors/GLD-API-409",
      title: "This map changed on another device. Loaded the latest version.",
      status: 409,
      code: "GLD-API-409",
      detail: "You started from revision 12. The latest is revision 13.",
      latestRevision: 13,
    });
    expect(problemSchema.safeParse(problem).success).toBe(true);
  });

  it("turns one back into a GladeError, or GLD-APP-001 when it has no known code", () => {
    expect(errorOfProblem(problemOf(gladeError("GLD-API-401"), 401)).code).toBe("GLD-API-401");
    const unknown = errorOfProblem({ type: "about:blank", title: "Bad Gateway", status: 502 });
    expect(unknown).toMatchObject({ code: "GLD-APP-001", detail: { status: 502 } });
  });

  it("refuses a status that isn't an error", () => {
    expect(problemSchema.safeParse({ type: "x", title: "y", status: 200 }).success).toBe(false);
  });
});

describe("route bodies", () => {
  it("accept the shapes the docs describe", () => {
    const file = { glade: "map", format: 1 };
    const accepted = [
      [healthSchema, { status: "ok", version: "0.1.0", checks: { database: "ok", disk: "ok" } }],
      [
        draftSummarySchema,
        { id: "d1", kind: "map", game: "toy", name: "Main", revision: 3, updatedAt: "2026" },
      ],
      [newDraftSchema, { kind: "map", game: "toy", mapType: "yard", name: "Main" }],
      [draftSchema, { id: "d1", revision: 3, file }],
      [shareSchema, { id: "s1", kind: "map", version: 4, sharedAt: "2026", file, packs: [] }],
      [shareVersionsSchema, [{ version: 1, sharedAt: "2026", bytes: 1200 }]],
      [sharePatchSchema, { public: false }],
    ] as const;
    for (const [schema, body] of accepted) {
      expect(schema.safeParse(body).success, JSON.stringify(body)).toBe(true);
    }
  });

  it("refuse what they don't", () => {
    expect(newDraftSchema.safeParse({ kind: "doc", game: "toy", name: "x" }).success).toBe(false);
    expect(newDraftSchema.safeParse({ kind: "map", game: "toy", name: "" }).success).toBe(false);
    expect(draftSchema.safeParse({ id: "d1", revision: 0, file: {} }).success).toBe(false);
    expect(healthSchema.safeParse({ status: "fine", version: "1", checks: {} }).success).toBe(
      false,
    );
  });
});
