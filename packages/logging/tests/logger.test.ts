// The logger: the line it builds, what it drops (and counts) outside strict mode, what it refuses
// in strict mode, and how it logs a GladeError with a redacted stack.

import { gladeError } from "@glade/errors";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { LogLine } from "../src/line";
import { createLogger, LogSchemaError, type Clock } from "../src/logger";
import { defineEvents } from "../src/registry";

const events = defineEvents({
  "tool.changed": {
    severity: "INFO",
    fields: { tool: z.enum(["pick", "lasso"]), count: z.number().optional() },
  },
});

/** A clock that starts at mono 100 ms and clock time 2026-10-03 14:02:11.482 UTC, and moves on demand. */
function fakeClock(): Clock & { advance(ms: number): void } {
  let mono = 100;
  let epoch = Date.UTC(2026, 9, 3, 14, 2, 11, 482);
  return {
    now: () => mono,
    epoch: () => epoch,
    advance(ms) {
      mono += ms;
      epoch += ms;
    },
  };
}

function setup(strict: boolean) {
  const lines: LogLine[] = [];
  const clock = fakeClock();
  const logger = createLogger(events, {
    clock,
    session: "s_test",
    sinks: [{ write: (l) => lines.push(l) }],
    strict,
  });
  return { lines, clock, logger };
}

/** Call log with an event or fields the types don't allow, as a bug in Glade might. */
type LooseLog = (event: string, attrs: Record<string, unknown>) => void;

describe("a log line", () => {
  it("has OpenTelemetry fields, the session, and the action and step when given", () => {
    const { lines, clock, logger } = setup(true);
    clock.advance(18233.44);
    logger.log("tool.changed", { tool: "lasso" }, { trace: "a_0003", span: "interpret" });
    expect(lines).toEqual([
      {
        ts: "2026-10-03T14:02:29.715Z",
        mono: 18233.4,
        sev: 9,
        sevText: "INFO",
        event: "tool.changed",
        session: "s_test",
        trace: "a_0003",
        span: "interpret",
        attrs: { tool: "lasso" },
      },
    ]);
  });

  it("leaves out an optional field that isn't given, and the action and step when not given", () => {
    const { lines, logger } = setup(true);
    logger.log("tool.changed", { tool: "pick", count: undefined });
    expect(lines[0].attrs).toEqual({ tool: "pick" });
    expect(lines[0]).not.toHaveProperty("trace");
    expect(lines[0]).not.toHaveProperty("span");
  });

  it("can be logged higher or lower than the event's usual severity", () => {
    const { lines, logger } = setup(true);
    logger.log("tool.changed", { tool: "pick" }, { severity: "WARN" });
    expect(lines[0]).toMatchObject({ sev: 13, sevText: "WARN" });
  });
});

describe("outside strict mode", () => {
  it("drops an undeclared field, keeps the rest, and logs the drop", () => {
    const { lines, logger } = setup(false);
    (logger.log as LooseLog)("tool.changed", { tool: "pick", mapName: "Secret Garden" });
    expect(lines.map((l) => l.event)).toEqual(["log.dropped", "tool.changed"]);
    expect(lines[0].attrs).toEqual({ reason: "unknown-field", event: "tool.changed" });
    expect(lines[1].attrs).toEqual({ tool: "pick" });
    expect(JSON.stringify(lines)).not.toContain("Secret Garden");
  });

  it("drops a value its schema refuses", () => {
    const { lines, logger } = setup(false);
    (logger.log as LooseLog)("tool.changed", { tool: "hammer" });
    expect(lines[0].attrs).toEqual({ reason: "bad-value", event: "tool.changed" });
    expect(lines[1].attrs).toEqual({});
  });

  it("drops an undeclared event without naming it", () => {
    const { lines, logger } = setup(false);
    (logger.log as LooseLog)("my.garden.saved", { tool: "pick" });
    expect(lines).toHaveLength(1);
    expect(lines[0].attrs).toEqual({ reason: "unknown-event" });
  });
});

describe("in strict mode", () => {
  it("throws on an undeclared event, field or bad value", () => {
    const { lines, logger } = setup(true);
    const log = logger.log as LooseLog;
    expect(() => log("nope.event", {})).toThrow(LogSchemaError);
    expect(() => log("tool.changed", { tool: "pick", extra: 1 })).toThrow(/not declared/);
    expect(() => log("tool.changed", { tool: "hammer" })).toThrow(/refuses/);
    expect(lines).toEqual([]);
  });
});

describe("logger.error", () => {
  it("logs the code, step and detail at the error's severity", () => {
    const { lines, logger } = setup(true);
    logger.error(gladeError("GLD-WORKER-001", { detail: { waitedMs: 5000 } }), { trace: "a_0004" });
    expect(lines[0]).toMatchObject({
      event: "app.error",
      sevText: "ERROR",
      trace: "a_0004",
      attrs: { code: "GLD-WORKER-001", step: "check", detail: { waitedMs: 5000 } },
    });
  });

  it("adds the cause's stack with ids and home folders taken out", () => {
    const { lines, logger } = setup(true);
    const cause = new Error("boom");
    cause.stack = "Error: boom\n    at run (https://glade.app/main.js?draft=d_123:1:2)";
    logger.error(gladeError("GLD-APP-001", { cause }));
    expect(lines[0].sevText).toBe("FATAL");
    expect(lines[0].attrs.stack).toBe("Error: boom\n    at run (https://glade.app/main.js:1:2)");
  });

  it("leaves out a stack when the cause isn't an Error", () => {
    const { lines, logger } = setup(true);
    logger.error(gladeError("GLD-NET-001", { cause: "offline" }));
    expect(lines[0].attrs).toEqual({ code: "GLD-NET-001", step: "network" });
    expect(lines[0].sevText).toBe("WARN");
  });
});
