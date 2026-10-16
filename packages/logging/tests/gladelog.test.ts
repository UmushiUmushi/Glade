// The .gladelog file: written and read back unchanged, with damaged event lines skipped and
// counted, and files that aren't gladelogs (or are too new) refused with the right error code.

import { describe, expect, it } from "vitest";
import { readGladelog, writeGladelog, type GladelogHeader } from "../src/gladelog";
import type { LogLine } from "../src/line";

const header: GladelogHeader = {
  format: "gladelog",
  version: 1,
  glade: { version: "0.6.0", commit: "a1b2c3d" },
  session: "s_8Kq2abcd",
  started: "2026-10-03T14:00:00.000Z",
  device: { screen: "desktop", touch: false, gpu: "mid", browser: "chrome", browserVersion: 141 },
  settings: { theme: "dark", reduceMotion: false },
};

const lines: LogLine[] = [
  {
    ts: "2026-10-03T14:02:11.482Z",
    mono: 18233.4,
    sev: 9,
    sevText: "INFO",
    event: "planner.action.rejected",
    session: "s_8Kq2abcd",
    trace: "a_00f3",
    span: "check",
    attrs: { intent: "MoveSelection", rules: ["I3"] },
  },
];

describe("gladelog", () => {
  it("is one JSON object per line, header first", () => {
    const text = writeGladelog(header, lines);
    expect(text.split("\n")).toHaveLength(3);
    expect(JSON.parse(text.split("\n")[0])).toEqual(header);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("reads back what was written", () => {
    expect(readGladelog(writeGladelog(header, lines))).toEqual({
      ok: true,
      value: { header, lines, skipped: 0 },
    });
  });

  it("skips and counts damaged lines, and ignores blank ones", () => {
    const text = writeGladelog(header, lines) + '{"ts": 1}\n{not json\n\n';
    const read = readGladelog(text);
    expect(read.ok && read.value.lines).toEqual(lines);
    expect(read.ok && read.value.skipped).toBe(2);
  });

  it("refuses a file that isn't a gladelog", () => {
    for (const text of ["", "hello", '{"format": "something-else"}']) {
      const read = readGladelog(text);
      expect(!read.ok && read.error.code, text).toBe("GLD-FILE-001");
    }
  });

  it("refuses a gladelog from a newer Glade", () => {
    const read = readGladelog(JSON.stringify({ ...header, version: 2 }));
    expect(!read.ok && read.error.code).toBe("GLD-FILE-003");
    expect(!read.ok && read.error.detail).toEqual({ version: 2 });
  });
});
