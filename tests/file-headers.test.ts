// Code style rule 11 (docs/engineering/code-style.md): every code file opens with a short comment
// that says what it is and how it fits, so a new reader gets oriented fast.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const CODE = /\.(ts|tsx|js|mjs)$/;
const SKIP = new Set(["node_modules", "dist", "coverage", "references", ".vite"]);

/** Code files under `dir`, relative to the repo root. */
function codeFiles(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) return codeFiles(rel);
    return CODE.test(name) && !name.endsWith(".d.ts") ? [rel] : [];
  });
}

/** Code files at the repo root (config files), then every code folder. */
const files = [
  ...readdirSync(ROOT).filter((name) => CODE.test(name)),
  ...["apps", "packages", "tests", "e2e", ".storybook"].flatMap(codeFiles),
];

/** The first line that is not a #! line. */
function firstLine(text: string): string {
  const lines = text.split("\n");
  return lines[0].startsWith("#!") ? (lines[1] ?? "") : lines[0];
}

describe("every code file starts with a header comment", () => {
  it("checks some files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const file of files) {
    it(file, () => {
      const first = firstLine(readFileSync(join(ROOT, file), "utf8"));
      expect(first, `${file} should start with a // comment`).toMatch(/^\/\/ \S/);
    });
  }
});
