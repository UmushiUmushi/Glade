// docs/error-codes.md is generated from the registry, so the list people read can't drift from the
// code. This test fails when the file is stale; UPDATE_GOLDENS=1 rewrites it.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import { AREAS, ERROR_CODES, areaOf, type Area, type ErrorCode } from "../src/codes";
import { USER_TEXTS } from "../src/texts";

const FILE = join(__dirname, "../../../docs/error-codes.md");

/** One table row: a cell per column, with pipes escaped. */
function row(cells: string[]): string {
  return `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
}

function areaSection(area: Area, codes: ErrorCode[]): string[] {
  return [
    `## ${area}: ${AREAS[area]}`,
    "",
    row(["Code", "Severity", "Step", "What went wrong", "User sees"]),
    row(["---", "---", "---", "---", "---"]),
    ...codes.map((code) => {
      const info = ERROR_CODES[code];
      return row([`\`${code}\``, info.severity, info.step, info.title, USER_TEXTS[info.text].what]);
    }),
    "",
  ];
}

function render(): string {
  const codes = Object.keys(ERROR_CODES) as ErrorCode[];
  const areas = (Object.keys(AREAS) as Area[]).filter((a) => codes.some((c) => areaOf(c) === a));
  return [
    "# Error codes",
    "",
    "<!-- Generated from packages/errors/src/codes.ts by its test. Don't edit by hand:",
    "     run UPDATE_GOLDENS=1 pnpm test packages/errors after changing the registry. -->",
    "",
    "Every error Glade can report. How errors are handled: [error handling](logging/errors.md).",
    "",
    ...areas.flatMap((a) =>
      areaSection(
        a,
        codes.filter((c) => areaOf(c) === a),
      ),
    ),
  ].join("\n");
}

describe("docs/error-codes.md", () => {
  it("matches the registry", async () => {
    const options = await resolveConfig(FILE);
    const expected = await format(render(), { ...options, filepath: FILE });
    if (process.env.UPDATE_GOLDENS === "1") writeFileSync(FILE, expected);
    expect(readFileSync(FILE, "utf8"), "run UPDATE_GOLDENS=1 pnpm test packages/errors").toBe(
      expected,
    );
  });
});
