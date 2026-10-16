// Redaction: stack traces without ids or home folders, user agents cut down to a browser family and
// main version, and screen widths as size buckets.

import { describe, expect, it } from "vitest";
import { browserOf, redactStack, screenBucket } from "../src/redact";

describe("redactStack", () => {
  it("takes queries and fragments out of URLs, keeping file, line and column", () => {
    const stack = [
      "Error: x",
      "    at a (https://glade.app/game/planner?draft=d_8Kq2&x=1:10:5)",
      "    at b (http://localhost:5173/src/main.ts#share=abc:3:1)",
      "    at c (blob:https://glade.app/worker.js?t=9:1:1)",
    ].join("\n");
    expect(redactStack(stack)).toBe(
      [
        "Error: x",
        "    at a (https://glade.app/game/planner:10:5)",
        "    at b (http://localhost:5173/src/main.ts:3:1)",
        "    at c (blob:https://glade.app/worker.js:1:1)",
      ].join("\n"),
    );
  });

  it("takes user names out of home folders", () => {
    expect(redactStack("at f (/Users/alex/glade/src/a.ts:1:1)")).toBe(
      "at f (/Users/~/glade/src/a.ts:1:1)",
    );
    expect(redactStack("at f (/home/alex/glade/a.js:1:1)")).toBe("at f (/home/~/glade/a.js:1:1)");
    expect(redactStack("at f (C:\\Users\\alex\\glade\\a.js:1:1)")).toBe(
      "at f (C:\\Users\\~\\glade\\a.js:1:1)",
    );
  });

  it("keeps at most 30 lines and 4000 characters", () => {
    const long = Array.from({ length: 100 }, (_, i) => `    at f${i} (a.js:1:1)`).join("\n");
    expect(redactStack(long).split("\n")).toHaveLength(30);
    expect(redactStack("x".repeat(5000))).toHaveLength(4000);
  });
});

describe("browserOf", () => {
  const cases: [string, string, number][] = [
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "chrome",
      141,
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "edge",
      141,
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:143.0) Gecko/20100101 Firefox/143.0",
      "firefox",
      143,
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "safari",
      18,
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
      "chrome",
      141,
    ],
    ["curl/8.4.0", "other", 0],
  ];
  for (const [ua, family, version] of cases) {
    it(`${family} ${version}`, () => {
      expect(browserOf(ua)).toEqual({ family, version });
    });
  }
});

describe("screenBucket", () => {
  it("buckets widths at 600, 1024 and 1920", () => {
    expect([390, 599, 600, 1023, 1024, 1919, 1920, 3840].map(screenBucket)).toEqual([
      "phone",
      "phone",
      "tablet",
      "tablet",
      "desktop",
      "desktop",
      "wide",
      "wide",
    ]);
  });
});
