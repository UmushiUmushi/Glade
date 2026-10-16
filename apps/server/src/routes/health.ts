// GET /api/v1/health: whether the server works. 200 when every check is "ok", 503 otherwise. The
// deploy waits for it after starting a new version, and rolls back when it doesn't come. The
// database and disk checks join it when storage arrives (Phase 6).

import { type Health } from "@glade/formats";
import type { FastifyInstance } from "fastify";

/** Each check: a name and whether it works now. */
export type HealthCheck = () => Promise<boolean> | boolean;

export function healthRoutes(version: string, checks: Record<string, HealthCheck> = {}) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get("/health", async (_request, reply) => {
      const results: Health["checks"] = {};
      for (const [name, check] of Object.entries(checks)) {
        results[name] = (await check()) ? "ok" : "down";
      }
      const ok = Object.values(results).every((r) => r === "ok");
      const body: Health = { status: ok ? "ok" : "down", version, checks: results };
      return reply.code(ok ? 200 : 503).send(body);
    });
  };
}
