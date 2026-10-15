// The GladeError shape: made from a code with the registry's defaults, recognised at the edges,
// wrapped from anything thrown, and turned into the words a user reads.

import { describe, expect, it } from "vitest";
import { gladeError, isGladeError, messageOf, toGladeError } from "../src/errors";

describe("gladeError", () => {
  it("fills step, severity and text from the registry", () => {
    expect(gladeError("GLD-WORKER-001")).toEqual({
      code: "GLD-WORKER-001",
      step: "check",
      severity: "error",
      userText: "editor-restarted",
    });
  });

  it("keeps detail and cause, and may change the severity", () => {
    const cause = new Error("timeout");
    const e = gladeError("GLD-WORKER-001", {
      detail: { waitedMs: 5000 },
      cause,
      severity: "fatal",
    });
    expect(e.detail).toEqual({ waitedMs: 5000 });
    expect(e.cause).toBe(cause);
    expect(e.severity).toBe("fatal");
  });
});

describe("isGladeError and toGladeError", () => {
  it("recognises GladeErrors and nothing else", () => {
    expect(isGladeError(gladeError("GLD-UI-001"))).toBe(true);
    expect(isGladeError(new Error("x"))).toBe(false);
    expect(isGladeError({ code: "GLD-NOPE-001" })).toBe(false);
    expect(isGladeError(null)).toBe(false);
    expect(isGladeError("GLD-UI-001")).toBe(false);
  });

  it("wraps anything thrown as an unexpected error, keeping the cause", () => {
    const thrown = new TypeError("x is undefined");
    expect(toGladeError(thrown)).toEqual({
      code: "GLD-APP-001",
      step: "ui",
      severity: "fatal",
      userText: "safe-failure",
      cause: thrown,
    });
    expect(toGladeError("a string", "GLD-UI-001").code).toBe("GLD-UI-001");
  });

  it("passes a GladeError through unchanged", () => {
    const e = gladeError("GLD-NET-001");
    expect(toGladeError(e)).toBe(e);
  });
});

describe("messageOf", () => {
  it("gives what happened, whether work is safe, and the buttons to offer", () => {
    expect(messageOf(gladeError("GLD-API-401"))).toEqual({
      what: "You were logged out.",
      safe: "Your changes wait on this device until you log in again.",
      actions: ["log-in"],
    });
  });

  it("fills slots from the detail", () => {
    const e = gladeError("GLD-FILE-004", { detail: { count: 3, pack: "Garden Set" } });
    expect(messageOf(e).what).toBe("3 items need the pack “Garden Set”.");
  });

  it("includes the next step when the text has one", () => {
    expect(messageOf(gladeError("GLD-STAGE-001")).next).toBe("Try again, or keep working in 2D.");
  });
});
