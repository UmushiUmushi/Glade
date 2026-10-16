// The event registry: every event is declared once, with exactly the fields it may carry
// (docs/logging/README.md). Field names that suggest personal or creative content are refused here,
// when the event is declared, so they can't reach a log by accident.

import type { z } from "zod";
import type { SeverityText } from "./severity";

export type Fields = Record<string, z.ZodType>;

export interface EventSpec {
  /** The usual severity. One call may log it higher or lower. */
  severity: SeverityText;
  fields: Fields;
}

export type EventSpecs = Record<string, EventSpec>;

/** The attributes a call passes: required fields, plus optional ones that may be left out. */
export type AttrsOf<F extends Fields> = {
  [K in keyof F as undefined extends z.infer<F[K]> ? never : K]: z.infer<F[K]>;
} & {
  [K in keyof F as undefined extends z.infer<F[K]> ? K : never]?: z.infer<F[K]>;
};

/** Event names: dotted, lower case, at least two parts. `planner.action.committed`. */
const EVENT_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * Words that mean content, people or places, never structure. A field whose name holds one of
 * them (as a camelCase word: `mapName`, `userId`, `x`) is refused.
 */
export const FORBIDDEN_FIELD_WORDS = new Set([
  "name",
  "names",
  "title",
  "note",
  "notes",
  "description",
  "text",
  "label",
  "email",
  "id",
  "ids",
  "url",
  "href",
  "cookie",
  "token",
  "password",
  "ip",
  "agent",
  "x",
  "y",
  "z",
  "coord",
  "coords",
  "position",
  "color",
  "colour",
  "recipe",
]);

/** The camelCase words of a field name: `mapName` → ["map", "name"]. */
export function fieldWords(field: string): string[] {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

/** Why an event can't be declared, or null when it can. */
export function eventProblem(event: string, spec: EventSpec): string | null {
  if (!EVENT_NAME.test(event)) return `"${event}" is not a dotted lower-case event name`;
  for (const field of Object.keys(spec.fields)) {
    const bad = fieldWords(field).find((w) => FORBIDDEN_FIELD_WORDS.has(w));
    if (bad) return `${event}: field "${field}" names content ("${bad}"), which is never logged`;
  }
  return null;
}

/**
 * Declare events. Throws at once on a bad name or a content field: a mistake in Glade's own code,
 * found when the module loads, never at a user's desk.
 */
export function defineEvents<const S extends EventSpecs>(specs: S): S {
  for (const [event, spec] of Object.entries(specs)) {
    const problem = eventProblem(event, spec);
    if (problem) throw new Error(`defineEvents: ${problem}`);
  }
  return specs;
}
