// Vitest for the whole repo: which files are tests, and coverage with its targets
// (docs/engineering/testing.md).

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/** Lines covered, per package. Core logic needs more; everything else needs 80%. */
const STRICT = 90;
const DEFAULT = 80;
const STRICT_PACKAGES = ["packages/errors", "packages/logging", "packages/edit"];
const STRICT_GLOBS = ["packages/games/*/edit/src/**"];

/**
 * Packages Node can't measure. `three` draws with WebGL, which only runs in a browser, so the
 * render goldens (GLADE_RENDER=1) check it instead.
 */
const BROWSER_ONLY = ["packages/three"];

/** Every workspace package folder: apps/*, packages/*, packages/games/<id>/*. */
function packageDirs(): string[] {
  const under = (dir: string) =>
    existsSync(dir)
      ? readdirSync(dir)
          .map((name) => join(dir, name))
          .filter((d) => existsSync(join(d, "package.json")))
      : [];
  const games = readdirSync("packages/games").flatMap((g) => under(join("packages/games", g)));
  return [...under("apps"), ...under("packages"), ...games];
}

/** One threshold per package, so a well-tested package can't hide a poorly tested one. */
function thresholds(): Record<string, { lines: number }> {
  const out: Record<string, { lines: number }> = {};
  for (const dir of packageDirs()) {
    if (BROWSER_ONLY.includes(dir)) continue;
    out[`${dir}/src/**`] = { lines: STRICT_PACKAGES.includes(dir) ? STRICT : DEFAULT };
  }
  for (const glob of STRICT_GLOBS) out[glob] = { lines: STRICT };
  return out;
}

/** Story tests run in a real browser (Chromium, headless): every story renders, its play steps
 * pass, and axe finds no accessibility problems. */
const storyTests = {
  extends: true,
  plugins: [storybookTest({ configDir: ".storybook" })],
  test: {
    name: "stories",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" as const }],
    },
    setupFiles: [".storybook/vitest.setup.ts"],
  },
};

/** Some correctness tests do heavy work (a whole island's 3D textures). CI machines, running both
 * projects at once with coverage on, can take a few times longer than a laptop. */
const UNIT_TIMEOUT_MS = 20_000;

const unitTests = {
  extends: true,
  test: {
    name: "unit",
    testTimeout: UNIT_TIMEOUT_MS,
    include: ["tests/**/*.test.ts", "{apps,packages}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "packages/games/*/references/**"],
  },
};

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [unitTests, storyTests],
    coverage: {
      provider: "v8",
      include: ["{apps,packages}/**/src/**"],
      exclude: [...BROWSER_ONLY.map((d) => `${d}/**`), "**/*.d.ts", "**/*.stories.tsx", "**/*.css"],
      reporter: ["text-summary", "html"],
      thresholds: thresholds(),
    },
  },
});
