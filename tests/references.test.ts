// Reference screenshots (packages/games/<game>/references/) are the game makers' images and stay on the
// machine that took them. This test fails if git would ever pick them up: the ignore rule must be
// in place, and nothing under a references folder may be tracked or staged.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const RULE = "packages/games/*/references/";

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
  } catch {
    return null;
  }
}

describe("reference screenshots stay local", () => {
  it(".gitignore ignores every game's references folder", () => {
    const lines = readFileSync(join(ROOT, ".gitignore"), "utf8").split("\n");
    expect(lines).toContain(RULE);
  });

  it("git ignores a file placed in a references folder", () => {
    const out = git("check-ignore", "--no-index", "packages/games/example/references/shot.png");
    if (out === null && git("rev-parse", "--git-dir") === null) return; // not a git checkout
    expect(out?.trim()).toBe("packages/games/example/references/shot.png");
  });

  it("nothing under a references folder is tracked or staged", () => {
    const out = git("ls-files", "--cached", "--", ":(glob)packages/games/*/references/**");
    if (out === null) return; // not a git checkout
    expect(out.trim()).toBe("");
  });
});
