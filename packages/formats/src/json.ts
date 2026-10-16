// The first step of reading any Glade file: text to a JSON object. Anything else (not JSON, an
// array, a number) is not a Glade file.

import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";

export type JsonObject = Record<string, unknown>;

export function parseJsonObject(text: string): Result<JsonObject, GladeError> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    return err(gladeError("GLD-FILE-001", { detail: { reason: "not JSON" }, cause }));
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return err(gladeError("GLD-FILE-001", { detail: { reason: "not a JSON object" } }));
  }
  return ok(value as JsonObject);
}
