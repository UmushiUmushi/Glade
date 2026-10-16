// Petit Planet's look: the theme passes contrast and keeps floating pieces the same in light and
// dark, every icon file is in the icon map (and the other way round) and is a safe SVG, and the
// fonts it imports exist.

import { contrastProblems } from "@glade/ui";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { petitPlanetIcons, petitPlanetTheme, title } from "../src";

const ICONS = join(__dirname, "../theme/icons");
const files = readdirSync(ICONS).filter((f) => f.endsWith(".svg"));

/** "LayerPaths.svg" → "layer-paths". */
const idOf = (file: string) =>
  file
    .replace(/\.svg$/, "")
    .replace(/(?<!^)([A-Z])/g, "-$1")
    .toLowerCase();

describe("theme", () => {
  it("passes text contrast in light and dark", () => {
    expect(contrastProblems(petitPlanetTheme)).toEqual([]);
  });

  it("keeps things that float on the map the same in light and dark", () => {
    for (const token of [
      "selected",
      "onSelected",
      "strong",
      "onStrong",
      "float",
      "onFloat",
    ] as const) {
      expect(petitPlanetTheme.dark[token], token).toBe(petitPlanetTheme.light[token]);
    }
  });

  it("uses no weight lighter than 700", () => {
    const { weightTitle, weightUi, weightStrong } = petitPlanetTheme.shape;
    for (const w of [weightTitle, weightUi, weightStrong])
      expect(Number(w)).toBeGreaterThanOrEqual(700);
  });

  it("names the game", () => {
    expect(title).toBe("Petit Planet");
    expect(petitPlanetTheme.id).toBe("petit-planet");
  });
});

describe("icons", () => {
  it("every file is in the icon map under its id, and every id has its file", () => {
    expect(Object.keys(petitPlanetIcons).sort()).toEqual(files.map(idOf).sort());
    for (const file of files) {
      expect(petitPlanetIcons[idOf(file)], file).toBe(readFileSync(join(ICONS, file), "utf8"));
    }
  });

  it("ids are kebab-case", () => {
    for (const id of Object.keys(petitPlanetIcons)) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("every drawing is a safe SVG: a viewBox, no scripts, no event handlers, no outside links", () => {
    for (const [id, svg] of Object.entries(petitPlanetIcons)) {
      expect(svg, id).toMatch(/<svg[\s>]/);
      expect(svg, id).toMatch(/viewBox="/);
      expect(svg, id).not.toMatch(/<script|<foreignObject|\son[a-z]+\s*=|href="(?!#)/i);
    }
  });
});

describe("fonts", () => {
  it("imports font files that exist", () => {
    const css = readFileSync(join(__dirname, "../src/fonts.css"), "utf8");
    const imports = [...css.matchAll(/@import "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.length).toBe(4);
    const require = createRequire(join(__dirname, "../package.json"));
    for (const spec of imports) expect(() => require.resolve(spec), spec).not.toThrow();
  });
});
