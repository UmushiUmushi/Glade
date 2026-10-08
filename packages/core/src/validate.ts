// Generic rule engine. Game rules live in each game's package; this file only knows how to
// run them and how to scope local rules to the part of the map that changed.

import type { Doc } from "./doc";
import type { Bound } from "./catalog";
import type { MapDefinition } from "./game";
import {
  boxToRect,
  boxesIntersect,
  clipBox,
  expandRect,
  rectToBox,
  type Box,
  type Cell,
  type Rect,
} from "./space";

export interface Violation {
  ruleId: string;
  message: string;
  cells: Cell[];
  hint?: string;
  /** Entities involved, when the violation is about entities. */
  objectIds?: string[];
}

export interface RuleContext {
  game: Bound;
  /**
   * World box the rule should examine. For local rules this is the changed region plus a margin;
   * for non-local rules (and whole-map validation) it is the whole map.
   */
  scope: Box;
}

export interface Rule {
  /** Short id, e.g. "T3". */
  id: string;
  /** Kebab-case name, e.g. "step-limit". */
  name: string;
  /** One line for the rulebook. */
  description: string;
  /** Local rules only look near the changed cells; non-local ones always scan the whole map. */
  local: boolean;
  check(doc: Doc, ctx: RuleContext): Violation[];
}

export interface RuleDoc {
  id: string;
  name: string;
  description: string;
  /** Informational entries (reported by views, never a violation). */
  info?: true;
}

export interface ValidateOptions {
  /** Restrict local rules to this rect (any grid) or world box, plus the game's margin. */
  region?: Rect | Box;
  /** Cells of game.validation.grid around the region (default game.validation.margin). */
  margin?: number;
  /** Only these rules (default all of the game's). */
  rules?: Rule[];
}

/** A region as a world box. */
export function regionBox(game: MapDefinition, region: Rect | Box): Box {
  return "grid" in region ? rectToBox(game.space, region) : clipBox(game.space, region);
}

export function validate(doc: Doc, game: Bound, opts: ValidateOptions = {}): Violation[] {
  const whole = game.space.bounds;
  let local = whole;
  if (opts.region) {
    const { grid, margin } = game.validation;
    const r = boxToRect(game.space, regionBox(game, opts.region), grid);
    local = rectToBox(game.space, expandRect(game.space, r, opts.margin ?? margin));
  }
  const out: Violation[] = [];
  for (const rule of opts.rules ?? game.rules) {
    out.push(...rule.check(doc, { game, scope: rule.local ? local : whole }));
  }
  return out;
}

export function rulesDoc(rules: Rule[]): RuleDoc[] {
  return rules.map(({ id, name, description }) => ({ id, name, description }));
}

// ---- helpers for rule authors ----

/** Cells of `grid` (inclusive bounds) a rule should scan. */
export function scopeRange(
  ctx: RuleContext,
  grid: string,
): { x0: number; y0: number; x1: number; y1: number } {
  const r = boxToRect(ctx.game.space, ctx.scope, grid);
  return { x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1 };
}

/** Whether a rect (any grid) touches the rule's scope. */
export function inScope(ctx: RuleContext, rect: Rect): boolean {
  return boxesIntersect(ctx.scope, rectToBox(ctx.game.space, rect));
}
