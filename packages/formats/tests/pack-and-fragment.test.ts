// The pack file (shape, own prefixes, entries checked against a map) and the clipboard fragment
// (shape, game, map type).

import { describe, expect, it } from "vitest";
import { readFragment, writeFragment, type Fragment } from "../src/fragment";
import {
  packCatalog,
  packProblems,
  readPackFile,
  writePackFile,
  type PackFile,
} from "../src/pack-file";
import { otherGame, toy, yard } from "./toy-game";

const pack: PackFile = {
  glade: "pack",
  format: 1,
  id: "Kp3vX8",
  version: 2,
  game: "toy",
  name: "Garden Set",
  description: "Benches and lamps",
  kinds: [{ kind: "pack:Kp3vX8:bench", parent: "seat", description: "a bench" }],
  items: [
    {
      entry: { type: "pack:Kp3vX8:lounger", kind: "pack:Kp3vX8:bench", legs: 4 },
      meta: { name: "Lounger", category: "basic-furniture", tags: ["wood"] },
      recipe: { builder: 1, template: "item", parts: [] },
    },
  ],
};

function code(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

describe("pack file", () => {
  it("round-trips, keeping the entry's and recipe's own fields", () => {
    const read = readPackFile(writePackFile(pack), toy);
    expect(read).toEqual({ ok: true, value: pack });
  });

  it("is a catalog the profile checks: kinds lead to the game's, entries pass its rules", () => {
    expect(packCatalog(pack)).toEqual({ entries: [pack.items[0].entry], kinds: pack.kinds });
    expect(packProblems(pack, yard)).toEqual([]);
    const legless = structuredClone(pack);
    legless.items[0].entry.legs = 0;
    expect(packProblems(legless, yard)).toEqual(["pack:Kp3vX8:lounger: legs: needs at least one"]);
  });

  it("refuses types and kinds without the pack's own prefix", () => {
    const stray = structuredClone(pack);
    stray.items[0].entry.type = "lounger";
    expect(packProblems(stray, yard)).toEqual(["type lounger doesn't start with pack:Kp3vX8:"]);
    expect(code(readPackFile(writePackFile(stray), toy))).toBe("GLD-FILE-001");
  });

  it("refuses bad shapes, other files and other games", () => {
    const nameless = { ...pack, name: "" };
    expect(code(readPackFile(JSON.stringify(nameless), toy))).toBe("GLD-FILE-001");
    expect(code(readPackFile('{"glade": "map", "format": 1}', toy))).toBe("GLD-FILE-001");
    expect(code(readPackFile('{"format": 1}', toy))).toBe("GLD-FILE-001");
    expect(code(readPackFile(writePackFile(pack), otherGame))).toBe("GLD-FILE-002");
  });
});

const fragment: Fragment = {
  glade: "fragment",
  format: 1,
  game: "toy",
  map: "yard",
  mode: "things",
  origin: { grid: "cell", x: 0, y: 0 },
  size: { w: 2, h: 1 },
  content: { things: [{ type: "bench", x: 1, y: 0 }] },
};

describe("clipboard fragment", () => {
  it("round-trips", () => {
    expect(readFragment(writeFragment(fragment), toy)).toEqual({ ok: true, value: fragment });
  });

  it("refuses text from elsewhere, other games and unknown map types", () => {
    expect(code(readFragment("just some text", toy))).toBe("GLD-FILE-001");
    expect(code(readFragment(writeFragment({ ...fragment, map: "attic" }), toy))).toBe(
      "GLD-FILE-001",
    );
    expect(code(readFragment(writeFragment({ ...fragment, size: { w: 0, h: 1 } }), toy))).toBe(
      "GLD-FILE-001",
    );
    expect(code(readFragment(writeFragment(fragment), otherGame))).toBe("GLD-FILE-002");
  });
});
