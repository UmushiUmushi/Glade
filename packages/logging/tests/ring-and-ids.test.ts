// The memory ring (newest lines, oldest first) and log ids (repeatable session ids from a given
// random source, action ids that count up).

import { describe, expect, it } from "vitest";
import { actionIds, newSessionId } from "../src/ids";
import type { LogLine } from "../src/line";
import { createRing } from "../src/ring";

const line = (n: number): LogLine => ({
  ts: "2026-10-03T00:00:00.000Z",
  mono: n,
  sev: 9,
  sevText: "INFO",
  event: "a.b",
  session: "s",
  attrs: {},
});

describe("ring", () => {
  it("keeps every line until full", () => {
    const ring = createRing(3);
    [1, 2].forEach((n) => ring.write(line(n)));
    expect(ring.lines().map((l) => l.mono)).toEqual([1, 2]);
  });

  it("drops the oldest when full, and stays oldest first", () => {
    const ring = createRing(3);
    [1, 2, 3, 4, 5].forEach((n) => ring.write(line(n)));
    expect(ring.lines().map((l) => l.mono)).toEqual([3, 4, 5]);
  });

  it("clears", () => {
    const ring = createRing(3);
    [1, 2, 3, 4].forEach((n) => ring.write(line(n)));
    ring.clear();
    expect(ring.lines()).toEqual([]);
    ring.write(line(9));
    expect(ring.lines().map((l) => l.mono)).toEqual([9]);
  });
});

describe("ids", () => {
  it("makes the same session id from the same random numbers", () => {
    const seq = (values: number[]) => {
      let i = 0;
      return () => values[i++ % values.length];
    };
    const id = newSessionId(seq([0, 0.5, 0.99]));
    expect(id).toMatch(/^s_[0-9A-Za-z]{8}$/);
    expect(newSessionId(seq([0, 0.5, 0.99]))).toBe(id);
    expect(newSessionId(seq([0.1]))).not.toBe(id);
  });

  it("counts action ids up from a_0001", () => {
    const next = actionIds();
    expect([next(), next(), next()]).toEqual(["a_0001", "a_0002", "a_0003"]);
  });
});
