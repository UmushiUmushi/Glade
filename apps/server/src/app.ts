// The server app: a Fastify instance with Glade's routes under /api/v1, and every error answered as
// Problem Details (RFC 9457) with Glade's error code. Built by a function, so tests run it in memory
// with `inject` and no network.

import { areaOf, isGladeError, toGladeError, type GladeError } from "@glade/errors";
import { API_BASE, PROBLEM_CONTENT_TYPE, problemOf } from "@glade/formats";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { healthRoutes, type HealthCheck } from "./routes/health";

export interface AppDeps {
  /** Glade's version, reported by /health. */
  version: string;
  /** Fastify's own logging (pino). Off in tests. */
  logger?: FastifyServerOptions["logger"];
  /** What /health checks, by name. */
  checks?: Record<string, HealthCheck>;
}

/**
 * The HTTP status for a GladeError: an API code carries its own (GLD-API-409 is 409), a file a
 * user sent is their mistake (400), and anything else is the server's (500).
 */
export function statusOf(error: GladeError): number {
  const area = areaOf(error.code);
  const number = Number(error.code.split("-")[2]);
  if (area === "API" && number >= 400 && number < 600) return number;
  if (area === "FILE") return 400;
  return 500;
}

/** The status Fastify gave an error of its own (a bad request is 400), or 500. */
function httpStatusOf(error: unknown): number {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : 500;
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500;
}

/** Any error a route throws, as a Problem Details answer. Unknown errors become GLD-APP-001. */
function handleErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const glade = isGladeError(error) ? error : toGladeError(error);
    const status = isGladeError(error) ? statusOf(error) : httpStatusOf(error);
    if (status >= 500) request.log.error({ err: error, code: glade.code }, "request failed");
    return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(problemOf(glade, status));
  });
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .type(PROBLEM_CONTENT_TYPE)
      .send({ type: "about:blank", title: "Not Found", status: 404, instance: request.url }),
  );
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });
  handleErrors(app);
  void app.register(healthRoutes(deps.version, deps.checks), { prefix: API_BASE });
  return app;
}
