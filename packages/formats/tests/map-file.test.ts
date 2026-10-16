// The map file: written and read back to the same map with its packs and view, bare map files
// wrapped, older inner maps upgraded by the profile, and every bad file refused with its code.

import { serializeMap, type Doc } from "@glade/core";
import { describe, expect, it } from "vitest";
import { readMapFile, writeMapFile, type PackRef } from "../src/map-file";
import { otherGame, toy, yard } from "./toy-game";

const NOW = new Date("2026-10-03T12:00:00Z");

function sampleDoc(): Doc {
  const doc = yard.newDoc("main", {}, NOW);
  (doc.layers.ground as { cells: string[][] }).cells[1][2] = "w";
  (doc.layers.things as { items: Record<string, unknown> }).items = {
    t1: { id: "t1", type: "bench", x: 1, y: 0 },
  };
  return doc;
}

const garden: PackRef = { id: "Kp3vX8", version: 2, name: "Garden Set", hash: "sha256-abc" };

function code(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

describe("writing and reading", () => {
  it("round-trips the map, its packs and its view", () => {
    const doc = sampleDoc();
    const text = writeMapFile(doc, yard, {
      packs: [garden],
      view: { mode: "things", view: "3d", camera: "iso" },
    });
    const read = readMapFile(text, toy);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.doc).toEqual(doc);
    expect(read.value.packs).toEqual([garden]);
    expect(read.value.view).toEqual({ mode: "things", view: "3d", camera: "iso" });
    expect(read.value.bare).toBe(false);
  });

  it("keeps the profile's own map file inside, unchanged", () => {
    const doc = sampleDoc();
    const file = JSON.parse(writeMapFile(doc, yard)) as Record<string, unknown>;
    expect(file).toMatchObject({ glade: "map", format: 1, game: "toy", packs: [] });
    expect(file.map).toEqual(JSON.parse(serializeMap(doc, yard)));
    expect(file).not.toHaveProperty("view");
  });
});

describe("other files that still open", () => {
  it("wraps a bare map file", () => {
    const doc = sampleDoc();
    const read = readMapFile(serializeMap(doc, yard), toy);
    expect(read.ok && read.value.doc).toEqual(doc);
    expect(read.ok && read.value.bare).toBe(true);
  });

  it("opens a file saved under the game's former id", () => {
    const file = JSON.parse(writeMapFile(sampleDoc(), yard)) as Record<string, unknown>;
    const old = { ...file, game: "old-toy" };
    expect(readMapFile(JSON.stringify(old), toy).ok).toBe(true);
  });

  it("lets the profile upgrade an old inner map", () => {
    const old = { glade: "map", format: 1, game: "toy", packs: [] };
    const inner = { version: 1, profile: "toy", name: "first", row: "wwg" };
    const read = readMapFile(JSON.stringify({ ...old, map: inner }), toy);
    expect(read.ok && (read.value.doc.layers.ground as { cells: string[][] }).cells[0]).toEqual([
      "w",
      "w",
      "g",
    ]);
  });
});

describe("files that are refused", () => {
  it("not JSON, not an object, or not a map: GLD-FILE-001", () => {
    for (const text of ["{", "[1, 2]", "42", '{"hello": 1}', '{"glade": "pack", "format": 1}']) {
      expect(code(readMapFile(text, toy)), text).toBe("GLD-FILE-001");
    }
  });

  it("an envelope with missing or wrong fields: GLD-FILE-001", () => {
    const text = JSON.stringify({ glade: "map", format: 1, game: "toy", packs: "none", map: {} });
    const read = readMapFile(text, toy);
    expect(code(read)).toBe("GLD-FILE-001");
    expect(!read.ok && read.error.detail?.reason).toMatch(/^packs:/);
  });

  it("a broken map inside: GLD-FILE-001", () => {
    const text = JSON.stringify({ glade: "map", format: 1, game: "toy", packs: [], map: { x: 1 } });
    expect(code(readMapFile(text, toy))).toBe("GLD-FILE-001");
  });

  it("a bare map that names no game: GLD-FILE-001", () => {
    expect(code(readMapFile('{"version": 3, "layers": {}}', toy))).toBe("GLD-FILE-001");
  });

  it("another game's map: GLD-FILE-002", () => {
    const text = writeMapFile(sampleDoc(), yard);
    const read = readMapFile(text, otherGame);
    expect(code(read)).toBe("GLD-FILE-002");
    expect(!read.ok && read.error.detail).toEqual({ game: "toy" });
  });

  it("a file from a newer Glade: GLD-FILE-003", () => {
    const file = JSON.parse(writeMapFile(sampleDoc(), yard)) as Record<string, unknown>;
    expect(code(readMapFile(JSON.stringify({ ...file, format: 9 }), toy))).toBe("GLD-FILE-003");
  });
});
