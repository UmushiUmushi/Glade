// Starting a real server on a free port: it answers /health over the network, SIGTERM closes it,
// an escaped error is logged and exits with 1, and a port it can't use exits with 1.

import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startServer, type StartDeps } from "../src/start";

type Listener = (error?: unknown) => void;

function fakeProcess() {
  const listeners: Record<string, Listener> = {};
  const exits: number[] = [];
  const proc: StartDeps["process"] = {
    on(event, listener) {
      listeners[event] = listener;
      return proc;
    },
    exit(code) {
      exits.push(code);
    },
  };
  return { proc, listeners, exits };
}

let running: FastifyInstance | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

const env = { PORT: "0", LOG_LEVEL: "silent", GLADE_VERSION: "9.9.9" };

describe("startServer", () => {
  it("answers /health over the network", async () => {
    const { proc } = fakeProcess();
    running = await startServer({ env, process: proc });
    const address = running.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "9.9.9" });
  });

  it("closes and exits with 0 on SIGTERM", async () => {
    const { proc, listeners, exits } = fakeProcess();
    const app = await startServer({ env, process: proc });
    listeners.SIGTERM();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(exits).toEqual([0]);
    expect(app.server.listening).toBe(false);
  });

  it("logs an escaped error as fatal and exits with 1", async () => {
    const { proc, listeners, exits } = fakeProcess();
    running = await startServer({ env, process: proc });
    listeners.uncaughtException(new Error("escaped"));
    expect(exits).toEqual([1]);
  });

  it("exits with 1 when it can't listen", async () => {
    const { proc, exits } = fakeProcess();
    running = await startServer({ env: { ...env, PORT: "-1" }, process: proc });
    expect(exits).toEqual([1]);
  });
});
