// Customizing a game. Everything a profile exports is a default: an app can turn rules off, replace or
// add rules, and change rule parameters, without copying the game. The result is an ordinary
// MapDefinition, so every shared function accepts it. (Items are the app's own: it binds its
// catalog with bind, catalog.ts.)
//
// customizeMap never throws on ids it does not know (a rule may be renamed between
// versions, and a saved customization should still load); unknownIds lists them for apps that
// want to warn.

import type { MapDefinition } from "./game";
import type { Rule, RuleDoc } from "./validate";

export interface Customization {
  rules?: {
    /** Rule ids to turn off, or "all" for every rule (informational entries stay). */
    off?: string[] | "all";
    /** Replace a rule by id with your own version. */
    replace?: Record<string, Rule>;
    /** Your own rules. One with the id of an existing rule replaces it. */
    add?: Rule[];
  };
  /**
   * Rule parameters, merged over the game's own key by key (nested objects merge too, arrays and
   * other values replace). The game documents which it reads.
   */
  params?: Record<string, unknown>;
}

const ruleDoc = (r: Rule): RuleDoc => ({ id: r.id, name: r.name, description: r.description });

/** The game with a customization applied. The game itself is not changed. */
export function customizeMap<G extends MapDefinition>(game: G, c: Customization): G {
  const rules = customizeRules(game, c.rules);
  const kept = new Set(rules.map((r) => r.id));
  const own = new Set(game.rules.map((r) => r.id));
  const rulebook = (): RuleDoc[] => {
    const base = game
      .rulebook()
      .filter((d) => d.info || !own.has(d.id) || kept.has(d.id))
      .map((d) => {
        const r = rules.find((x) => x.id === d.id);
        return r && !d.info ? ruleDoc(r) : d;
      });
    const listed = new Set(base.map((d) => d.id));
    return [...base, ...rules.filter((r) => !listed.has(r.id)).map(ruleDoc)];
  };

  return {
    ...game,
    rules,
    rulebook,
    params: c.params ? mergeParams(game.params ?? {}, c.params) : game.params,
  };
}

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function mergeParams(base: object, patch: Record<string, unknown>): object {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlain(v) && isPlain(out[k]) ? mergeParams(out[k] as object, v) : v;
  }
  return out;
}

function customizeRules(game: MapDefinition, c: Customization["rules"]): Rule[] {
  if (!c) return game.rules;
  const off = c.off === "all" ? null : new Set(c.off ?? []);
  const out = game.rules
    .filter((r) => off !== null && !off.has(r.id))
    .map((r) => c.replace?.[r.id] ?? r);
  for (const r of c.add ?? []) {
    const i = out.findIndex((x) => x.id === r.id);
    if (i >= 0) out[i] = r;
    else out.push(r);
  }
  return out;
}

/** Ids a customization names that the game does not have, as "rule X". */
export function unknownIds(game: MapDefinition, c: Customization): string[] {
  const rules = new Set(game.rules.map((r) => r.id));
  const out: string[] = [];
  const off = c.rules?.off === "all" ? [] : (c.rules?.off ?? []);
  for (const id of [...off, ...Object.keys(c.rules?.replace ?? {})]) {
    if (!rules.has(id)) out.push(`rule ${id}`);
  }
  return out;
}
