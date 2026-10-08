// Petit Planet's data files, typed, and the profile a game's code reads.

import paramsJson from "./params.json" with { type: "json" };
import worldJson from "./world.json" with { type: "json" };
import type { Planet, Params, Profile, World } from "./profile";

// JSON arrays type as number[]; tests/model.test.ts checks the ranges are well-formed.
export const world = worldJson as unknown as World;
export const params = paramsJson as Params;
/** The profile with the default params. */
export const profile: Profile = { ...world, ...params };

const cache = new WeakMap<object, Profile>();

/** The world plus this game's params (which customizeMap may have changed). */
export function profileOf(game: Pick<Planet, "params">): Profile {
  const p = game.params ?? params;
  let out = cache.get(p);
  if (!out) cache.set(p, (out = { ...world, ...params, ...p }));
  return out;
}
