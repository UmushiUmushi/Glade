// The import rules in docs/architecture.md that eslint cannot see. Shared packages know nothing
// about any particular game, so this greps them for game words (eslint keeps them from importing
// games). Profiles ship no items: made-up catalogs and sample maps live in each profile's samples/
// and the test kit, and no library code may import them. Packages are used by name, never by a path
// into another package.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

/** Words that name one game's concepts. Matched whole-word, any case, with plurals. */
export const FORBIDDEN =
  /\b(petit|petite|palworld|stardew|minecraft|beach(es)?|waterfalls?|cliffs?|plants?|terrains?|walls?|roofs?|foundations?|water|rivers?|bridges?|landmarks?|grass|strata|foam|sand|sea|stand-?ins?|major|minor|pals?|palbox)\b/gi;

function files(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  let out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === "node_modules") continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out = out.concat(files(rel));
    else if (/\.(ts|tsx|html|css|json|md)$/.test(name) && name !== "package.json") out.push(rel);
  }
  return out;
}

/** Folders one level under `dir` that hold a package.json. */
function packagesIn(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir))
    .map((name) => join(dir, name))
    .filter((d) => existsSync(join(ROOT, d, "package.json")));
}

/** Shared packages: everything in packages/ but the games and the test kit. */
const shared = packagesIn("packages").filter((p) => !p.endsWith(`${sep}testkit`));
/** Each game's packages: its profile, and later its catalog, edit and ui. */
const gamePackages = readdirSync(join(ROOT, "packages/games")).flatMap((g) =>
  packagesIn(join("packages/games", g)),
);
const profiles = gamePackages.filter((p) => p.endsWith(`${sep}profile`));
const allPackages = [...packagesIn("apps"), ...shared, ...gamePackages, "packages/testkit"];

describe("shared packages are game-free", () => {
  const checked = shared.flatMap((p) => files(p));

  it("checks some files", () => {
    expect(checked.length).toBeGreaterThan(0);
  });

  for (const file of checked) {
    it(file, () => {
      const hits: string[] = [];
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const m of line.matchAll(FORBIDDEN)) hits.push(`${i + 1}: ${m[0]}`);
        });
      expect(hits, `${file} names game concepts`).toEqual([]);
    });
  }
});

/** Imports of a profile's samples or of the test kit. */
const SAMPLE_IMPORT =
  /from\s+["'](?:[^"']*\/samples(?:\/[^"']*)?|@glade\/[\w-]+\/samples|@glade\/testkit[^"']*|[^"']*\/testkit\/[^"']*)["']/g;

describe("library code never imports samples or the test kit", () => {
  const checked = [...shared, ...gamePackages].flatMap((p) => files(join(p, "src")));

  it("checks every profile", () => {
    expect(profiles.length).toBeGreaterThan(1);
  });

  for (const file of checked) {
    it(file, () => {
      const hits = [...readFileSync(join(ROOT, file), "utf8").matchAll(SAMPLE_IMPORT)].map(
        (m) => m[0],
      );
      expect(hits, `${file} imports samples or the test kit`).toEqual([]);
    });
  }
});

/** Relative imports and re-exports: `from "./x"`, `from "../y"`. */
const RELATIVE = /from\s+["'](\.{1,2}\/[^"']*)["']/g;

describe("packages are used by name, never by a path into them", () => {
  for (const pkg of allPackages) {
    for (const file of files(join(pkg, "src"))) {
      it(file, () => {
        const outside = [...readFileSync(join(ROOT, file), "utf8").matchAll(RELATIVE)]
          .map((m) => m[1])
          .filter((spec) =>
            relative(join(ROOT, pkg), resolve(ROOT, dirname(file), spec)).startsWith(".."),
          );
        expect(outside, `${file} reaches outside ${pkg}`).toEqual([]);
      });
    }
  }
});

describe("game packages export a public API, not their files", () => {
  for (const pkg of gamePackages) {
    it(pkg, () => {
      const file = join(ROOT, pkg, "package.json");
      const exports = Object.keys(JSON.parse(readFileSync(file, "utf8")).exports ?? {});
      expect(exports).toContain(".");
      expect(exports.filter((k) => k.includes("*"))).toEqual([]);
    });
  }
});
