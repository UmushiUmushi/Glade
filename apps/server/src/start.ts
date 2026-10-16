// Starting the server: settings from the environment, listen, stop cleanly on SIGTERM, and log
// anything that escapes every handler as fatal before exiting, so the container restarts it
// (docs/logging/errors.md, safety nets). The process is passed in, so tests start a real server.

import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";

export const DEFAULT_PORT = 3000;

export interface StartDeps {
  env: Record<string, string | undefined>;
  /** The parts of `process` the server uses. */
  process: {
    on(event: "uncaughtException" | "SIGTERM", listener: (error?: unknown) => void): unknown;
    exit(code: number): void;
  };
}

/** Start listening. Resolves to the running server, or exits the process when it can't start. */
export async function startServer(deps: StartDeps): Promise<FastifyInstance> {
  const { env } = deps;
  const app = buildApp({
    version: env.GLADE_VERSION ?? "0.0.0-dev",
    logger: env.LOG_LEVEL === "silent" ? false : { level: env.LOG_LEVEL ?? "info" },
  });
  deps.process.on("uncaughtException", (error) => {
    app.log.fatal({ err: error, code: "GLD-APP-001" }, "uncaught exception");
    deps.process.exit(1);
  });
  deps.process.on("SIGTERM", () => {
    void app.close().then(() => deps.process.exit(0));
  });
  try {
    await app.listen({ port: Number(env.PORT ?? DEFAULT_PORT), host: env.HOST ?? "127.0.0.1" });
  } catch (error) {
    app.log.fatal({ err: error }, "could not start");
    deps.process.exit(1);
  }
  return app;
}
