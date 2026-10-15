// The error code registry and its texts: codes are well formed and unique, every code points at a
// real text, every text is used, and every text tells the user what happened and what is safe.

import { describe, expect, it } from "vitest";
import { AREAS, ERROR_CODES, areaOf, type ErrorCode } from "../src/codes";
import { USER_TEXTS, fillSlots, type TextKey } from "../src/texts";

const codes = Object.keys(ERROR_CODES) as ErrorCode[];
const texts = Object.keys(USER_TEXTS) as TextKey[];

describe("error codes", () => {
  it("read GLD-<AREA>-<three digits> with a known area", () => {
    for (const code of codes) {
      expect(code).toMatch(/^GLD-[A-Z]+-\d{3}$/);
      expect(Object.keys(AREAS)).toContain(areaOf(code));
    }
  });

  it("point at a text that exists", () => {
    for (const code of codes) expect(texts).toContain(ERROR_CODES[code].text);
  });

  it("have a one-line title for developers", () => {
    for (const code of codes) {
      expect(ERROR_CODES[code].title.length).toBeGreaterThan(10);
      expect(ERROR_CODES[code].title).not.toContain("\n");
    }
  });
});

describe("user texts", () => {
  it("are each used by some code", () => {
    const used = new Set(codes.map((c) => ERROR_CODES[c].text));
    expect(texts.filter((t) => !used.has(t))).toEqual([]);
  });

  it("say what happened, in short sentences", () => {
    for (const key of texts) {
      const { what } = USER_TEXTS[key];
      expect(what, key).toMatch(/[.!?]$/);
      expect(what.length, key).toBeLessThanOrEqual(80);
    }
  });

  it("say whether work is safe, for every error the user is warned about", () => {
    for (const code of codes) {
      const { severity, text } = ERROR_CODES[code];
      if (severity === "info") continue;
      const entry: { safe?: string } = USER_TEXTS[text];
      expect(entry.safe, code).toBeTruthy();
    }
  });
});

describe("fillSlots", () => {
  it("fills slots from the detail and leaves unknown ones as they are", () => {
    expect(fillSlots("{count} items need “{pack}”.", { count: 3, pack: "Garden" })).toBe(
      "3 items need “Garden”.",
    );
    expect(fillSlots("{count} items", {})).toBe("{count} items");
  });
});
