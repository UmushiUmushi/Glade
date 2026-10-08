// Customization: apps can turn rules off, replace or add rules, change rule parameters, and patch
// the look, without changing the game they started from. (Items are the app's own catalog.)

import {
  bind,
  customizeMap,
  entityLayer,
  unknownIds,
  validate,
  type Doc,
  type Rule,
} from "@glade/core";
import { board, type Thing } from "@glade/fixture-profile";
import { things as ITEMS } from "@glade/fixture-profile/samples";
import { customizeLook, resolveLook } from "@glade/render";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-09-29T00:00:00.000Z");

/** A board map with things on cells, given as [type, x, y]. */
function withThings(...placed: [string, number, number][]): Doc {
  const doc = board.newDoc("t", {}, NOW);
  const items = entityLayer<Thing>(doc, "things").items;
  placed.forEach(([type, x, y], i) => (items[`t${i}`] = { id: `t${i}`, type, x, y }));
  return doc;
}

/** Ids of the rules a map breaks in a game. */
const broken = (game: typeof board, doc: Doc) =>
  validate(doc, bind(game, ITEMS)).map((v) => v.ruleId);

const TWO_ON_ONE = withThings(["lamp", 0, 0], ["bench", 0, 0]);
const THREE_ON_ONE = withThings(["lamp", 0, 0], ["bench", 0, 0], ["lamp", 0, 0]);

describe("customizeMap", () => {
  it("the game's own rules apply by default", () => {
    expect(broken(board, TWO_ON_ONE)).toEqual(["F1"]);
  });

  it("a rule can be turned off by id", () => {
    const game = customizeMap(board, { rules: { off: ["F1"] } });
    expect(broken(game, TWO_ON_ONE)).toEqual([]);
    expect(game.rulebook().map((d) => d.id)).not.toContain("F1");
  });

  it("every rule can be turned off at once", () => {
    const game = customizeMap(board, { rules: { off: "all" } });
    expect(game.rules).toEqual([]);
    expect(broken(game, TWO_ON_ONE)).toEqual([]);
  });

  it("a rule parameter can be changed", () => {
    const game = customizeMap(board, { params: { maxThingsPerCell: 2 } });
    expect(broken(game, TWO_ON_ONE)).toEqual([]);
    expect(broken(game, THREE_ON_ONE)).toEqual(["F1"]);
  });

  it("rules can be added and replaced, and the rulebook follows", () => {
    const noThings: Rule = {
      id: "X1",
      name: "no-things",
      description: "Nothing may be placed.",
      local: false,
      check: (doc) =>
        Object.keys(doc.layers.things.kind === "entities" ? doc.layers.things.items : {}).length
          ? [{ ruleId: "X1", message: "something was placed", cells: [] }]
          : [],
    };
    const game = customizeMap(board, { rules: { add: [noThings] } });
    expect(broken(game, withThings(["lamp", 1, 1]))).toEqual(["X1"]);
    expect(game.rulebook().map((d) => d.id)).toEqual(["F1", "X1"]);

    const relaxed = { ...board.rules[0], description: "Anything goes.", check: () => [] };
    const replaced = customizeMap(board, { rules: { replace: { F1: relaxed } } });
    expect(broken(replaced, TWO_ON_ONE)).toEqual([]);
    expect(replaced.rulebook()[0].description).toBe("Anything goes.");
  });

  it("the original game is unchanged", () => {
    customizeMap(board, { rules: { off: "all" }, params: { maxThingsPerCell: 5 } });
    expect(board.rules.map((r) => r.id)).toEqual(["F1"]);
    expect(board.params).toEqual({ maxThingsPerCell: 1 });
  });

  it("unknown ids are reported, not thrown", () => {
    const c = { rules: { off: ["F1", "F9"] } };
    expect(() => customizeMap(board, c)).not.toThrow();
    expect(unknownIds(board, c)).toEqual(["rule F9"]);
  });
});

describe("customizeLook", () => {
  it("patches the style without touching the rest", () => {
    const game = customizeLook(board, {
      style: { presets: { day: { colors: { thing: "#000000" } } } },
    });
    const look = resolveLook(game.style.defaults);
    expect((look.colors as { thing: string }).thing).toBe("#000000");
    expect((look.colors as { ground: string }).ground).toBe("#8fbf6a");
    expect(game.rules).toBe(board.rules);
    expect((resolveLook(board.style.defaults).colors as { thing: string }).thing).toBe("#b04a3a");
  });

  it("replaces parts of the renderers", () => {
    const game = customizeLook(board, { ui: { hover: () => "mine" } });
    const shown = bind(game, ITEMS);
    expect(game.ui.hover(game.newDoc("t"), shown, { x: 0.5, y: 0.5 })).toBe("mine");
    expect(game.ui.layerNames()).toEqual(board.ui.layerNames());
  });
});
