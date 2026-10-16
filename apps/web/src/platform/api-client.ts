// The API client: calls Glade's server and returns a Result, never throws. Offline is GLD-NET-001,
// a Problem Details answer becomes its GladeError, and an answer that isn't the shape the shared
// schema says is GLD-APP-001 (the app and server disagree: a bug).

import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";
import { API_BASE, errorOfProblem, healthSchema, problemSchema, type Health } from "@glade/formats";
import type { z } from "zod";

export interface ApiClient {
  /** GET a JSON body of a known shape. `accept` lists statuses whose body is the answer. */
  getJson<T>(path: string, schema: z.ZodType<T>, accept?: number[]): Promise<Result<T, GladeError>>;
}

export interface ApiDeps {
  fetch: typeof fetch;
  /** Where the API is: "/api/v1" in the browser. */
  base?: string;
}

/** A failed answer as a GladeError: its Problem Details code, or GLD-APP-001 with the status. */
function answerError(status: number, body: unknown): GladeError {
  const problem = problemSchema.safeParse(body);
  if (problem.success) return errorOfProblem(problem.data);
  return gladeError("GLD-APP-001", { detail: { status } });
}

export function createApiClient(deps: ApiDeps): ApiClient {
  const base = deps.base ?? API_BASE;
  return {
    async getJson(path, schema, accept = [200]) {
      let response: Response;
      try {
        response = await deps.fetch(base + path, { headers: { accept: "application/json" } });
      } catch (cause) {
        return err(gladeError("GLD-NET-001", { cause }));
      }
      const body: unknown = await response.json().catch(() => null);
      if (!accept.includes(response.status)) return err(answerError(response.status, body));
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return err(gladeError("GLD-APP-001", { detail: { reason: "unexpected answer", path } }));
      }
      return ok(parsed.data);
    },
  };
}

/** Whether the server works: its health, which a 503 also answers with. */
export function checkServer(api: ApiClient): Promise<Result<Health, GladeError>> {
  return api.getJson("/health", healthSchema, [200, 503]);
}
