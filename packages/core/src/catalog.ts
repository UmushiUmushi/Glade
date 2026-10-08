// Catalogs. Profiles ship no items: an app brings its own catalog and binds it to a game. An entry is
// one type of thing, of one kind. A game names the kinds it knows (its rules are written for
// them); a sub-kind follows every rule its parent follows, so a rule written for a kind covers all
// of its sub-kinds. A catalog may add kinds of its own, each under a kind the game knows. Pure, so
// the browser uses it too.

import type { MapDefinition } from "./game";
import type { Rule, Violation } from "./validate";

export interface KindDef {
  kind: string;
  /** The kind this is a sort of. It follows every rule its parent follows. */
  parent?: string;
  /** One line describing the kind. */
  description: string;
  /** Fields an entry of this kind uses, beyond its parent's (name to meaning). */
  fields?: Record<string, string>;
  /** Ids of rules written for this kind (its parent's apply too). */
  rules?: string[];
}

export interface CatalogItem {
  type: string;
  kind: string;
}

export interface Catalog<E extends CatalogItem = CatalogItem> {
  entries: E[];
  /** Kinds the app adds, each under a kind the game knows (directly or through other added kinds). */
  kinds?: KindDef[];
}

/** A game with an app's catalog: what rules and renderers work on. */
export type Bound<G extends MapDefinition = MapDefinition, C extends Catalog = Catalog> = G & {
  catalog: C;
};

/**
 * Entries a map does not take, by kind (the kind and its sub-kinds) or by a field: `{ kind:
 * "vehicle" }`, `{ field: "hangs", value: true }`. Both given: both must match.
 */
export interface KindPattern {
  kind?: string;
  field?: string;
  /** The field's value; left out, any value but false and undefined matches. */
  value?: unknown;
}

/** Where kinds are looked up: a game's kinds and a catalog's (a Bound game is one). */
export interface KindSource {
  kinds: KindDef[];
  catalog: Catalog;
}

/** A game with an app's catalog. The game is not changed. */
export function bind<G extends MapDefinition, C extends Catalog>(game: G, catalog: C): Bound<G, C> {
  return { ...game, catalog };
}

interface Index {
  /** The arrays this index was built from: a catalog given new ones is indexed again. */
  from: { entries: CatalogItem[]; kinds: KindDef[] | undefined };
  entries: Map<string, CatalogItem>;
  chains: Map<string, string[]>;
}

// Per catalog, per game kind list: entries by type and each kind's chain, built once, and again
// when the catalog's entries or kinds array is replaced. (A catalog changed by editing its arrays
// in place is not noticed: give it new arrays, or make a new catalog.)
const indexes = new WeakMap<Catalog, WeakMap<KindDef[], Index>>();

function index(kinds: KindDef[], catalog: Catalog): Index {
  let byKinds = indexes.get(catalog);
  if (!byKinds) indexes.set(catalog, (byKinds = new WeakMap()));
  let out = byKinds.get(kinds);
  if (out && out.from.entries === catalog.entries && out.from.kinds === catalog.kinds) return out;
  const parents = new Map<string, string | undefined>();
  for (const k of [...kinds, ...(catalog.kinds ?? [])]) {
    if (!parents.has(k.kind)) parents.set(k.kind, k.parent);
  }
  const chains = new Map<string, string[]>();
  for (const kind of parents.keys()) {
    const chain: string[] = [];
    for (let k: string | undefined = kind; k !== undefined; k = parents.get(k)) {
      if (chain.includes(k) || !parents.has(k)) {
        chain.length = 0;
        break;
      }
      chain.push(k);
    }
    chains.set(kind, chain);
  }
  const entries = new Map<string, CatalogItem>();
  for (const e of catalog.entries) if (!entries.has(e.type)) entries.set(e.type, e);
  const from = { entries: catalog.entries, kinds: catalog.kinds };
  byKinds.set(kinds, (out = { from, entries, chains }));
  return out;
}

/** The catalog entry named `type`. */
export function entryOf<E extends CatalogItem>(
  game: KindSource & { catalog: Catalog<E> },
  type: string,
): E | undefined {
  return index(game.kinds, game.catalog).entries.get(type) as E | undefined;
}

/**
 * A kind followed by its parents, nearest first (["armchair", "chair", "seat"]). Empty when the
 * kind is not known, or its parents loop or end in a kind nobody defines.
 */
export function kindChain(game: KindSource, kind: string): string[] {
  return index(game.kinds, game.catalog).chains.get(kind) ?? [];
}

/** Whether a kind is `of` or one of its sub-kinds. */
export function kindIs(game: KindSource, kind: string, of: string): boolean {
  return kindChain(game, kind).includes(of);
}

/** Whether the entry named `type` is of kind `of` (or one of its sub-kinds). */
export function typeIs(game: KindSource, type: string, of: string): boolean {
  const e = entryOf(game, type);
  return !!e && kindIs(game, e.kind, of);
}

/**
 * Problems with a catalog for a game, each naming the kind or entry, or [] when it is fine: added
 * kinds that clash with the game's or do not lead to one, entries without a type, repeated types,
 * entries of unknown kinds, and whatever the game's own entryProblems finds.
 */
export function catalogProblems(game: MapDefinition, catalog: Catalog): string[] {
  const out: string[] = [];
  const bound = bind(game, catalog);
  const own = new Set(game.kinds.map((k) => k.kind));
  const added = new Set<string>();
  for (const k of catalog.kinds ?? []) {
    if (own.has(k.kind)) out.push(`kind ${k.kind}: the game already has this kind`);
    else if (added.has(k.kind)) out.push(`kind ${k.kind}: added twice`);
    else if (!k.parent) out.push(`kind ${k.kind}: needs a parent kind the game knows`);
    else if (!kindChain(bound, k.kind).some((c) => own.has(c))) {
      out.push(`kind ${k.kind}: its parents do not lead to a kind the game knows`);
    }
    added.add(k.kind);
  }
  const types = new Set<string>();
  for (const [i, e] of catalog.entries.entries()) {
    const name = typeof e?.type === "string" && e.type ? e.type : `entry ${i}`;
    if (name !== e?.type) out.push(`${name}: needs a type`);
    else if (types.has(name)) out.push(`${name}: type used twice`);
    types.add(name);
    if (!kindChain(bound, e?.kind).length) out.push(`${name}: unknown kind ${String(e?.kind)}`);
    else for (const p of game.entryProblems?.(e, catalog) ?? []) out.push(`${name}: ${p}`);
  }
  return out;
}

/** The pattern of a map's `excludes` that keeps the entry named `type` off it, if any. */
export function excludedBy(
  map: KindSource & { excludes?: KindPattern[] },
  type: string,
): KindPattern | undefined {
  const e = entryOf(map, type) as (CatalogItem & Record<string, unknown>) | undefined;
  if (!e) return undefined;
  return map.excludes?.find(
    (p) =>
      (p.kind === undefined || kindIs(map, e.kind, p.kind)) &&
      (p.field === undefined ||
        (p.value === undefined
          ? e[p.field] !== undefined && e[p.field] !== false
          : e[p.field] === p.value)),
  );
}

/** A pattern in words: "vehicle", "lamp with hangs true". */
export function patternText(p: KindPattern): string {
  const field = p.field && (p.value === undefined ? p.field : `${p.field} ${String(p.value)}`);
  return [p.kind, field].filter(Boolean).join(" with ");
}

/**
 * A rule that reports every entity on the map whose catalog entry the map excludes (its
 * `excludes`), in any entity layer. Games add it to their maps' rules under an id of their own.
 */
export function excludesRule(id: string): Rule {
  return {
    id,
    name: "kinds-here",
    description:
      "Nothing this map does not take is on it (its excludes: kinds, or entries by a field).",
    local: false,
    check(doc, ctx) {
      const map = ctx.game as Bound & { excludes?: KindPattern[] };
      const out: Violation[] = [];
      for (const [layer, l] of Object.entries(doc.layers)) {
        if (l.kind !== "entities") continue;
        for (const e of Object.values(l.items)) {
          const p = excludedBy(map, e.type);
          if (!p) continue;
          out.push({
            ruleId: id,
            message: `${e.type} ${e.id} (${layer}) is not taken here: ${patternText(p)}`,
            cells: map
              .locate(map, doc, layer, e)
              .flatMap((r) => [{ grid: r.grid, x: r.x, y: r.y }]),
            objectIds: [e.id],
          });
        }
      }
      return out;
    },
  };
}
