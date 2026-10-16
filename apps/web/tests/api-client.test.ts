// The API client with a fake fetch: a good answer, offline, a Problem Details answer, an answer of
// the wrong shape, and the server check that also accepts a 503 health answer.

import { healthSchema } from "@glade/formats";
import { describe, expect, it } from "vitest";
import { checkServer, createApiClient } from "../src/platform/api-client";

const json = (status: number, body: unknown, type = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

function client(answer: () => Promise<Response>) {
  const calls: string[] = [];
  const api = createApiClient({
    fetch: (input) => {
      calls.push(String(input));
      return answer();
    },
  });
  return { api, calls };
}

const health = { status: "ok", version: "1.0.0", checks: {} };

describe("getJson", () => {
  it("returns the body when it has the shape the schema says", async () => {
    const { api, calls } = client(async () => json(200, health));
    expect(await api.getJson("/health", healthSchema)).toEqual({ ok: true, value: health });
    expect(calls).toEqual(["/api/v1/health"]);
  });

  it("offline is GLD-NET-001", async () => {
    const { api } = client(() => Promise.reject(new TypeError("Failed to fetch")));
    const result = await api.getJson("/health", healthSchema);
    expect(!result.ok && result.error.code).toBe("GLD-NET-001");
  });

  it("a Problem Details answer becomes its GladeError", async () => {
    const problem = { type: "x", title: "Changed", status: 409, code: "GLD-API-409" };
    const { api } = client(async () => json(409, problem, "application/problem+json"));
    const result = await api.getJson("/drafts/1", healthSchema);
    expect(!result.ok && result.error.code).toBe("GLD-API-409");
  });

  it("an error that isn't Problem Details is GLD-APP-001 with its status", async () => {
    const { api } = client(async () => new Response("Bad Gateway", { status: 502 }));
    const result = await api.getJson("/health", healthSchema);
    expect(!result.ok && result.error).toMatchObject({
      code: "GLD-APP-001",
      detail: { status: 502 },
    });
  });

  it("an answer of the wrong shape is GLD-APP-001", async () => {
    const { api } = client(async () => json(200, { hello: "world" }));
    const result = await api.getJson("/health", healthSchema);
    expect(!result.ok && result.error).toMatchObject({
      code: "GLD-APP-001",
      detail: { reason: "unexpected answer", path: "/health" },
    });
  });
});

describe("checkServer", () => {
  it("reads a 503 health answer as the server's state, not an error", async () => {
    const down = { status: "down", version: "1", checks: { disk: "down" } };
    const { api } = client(async () => json(503, down));
    expect(await checkServer(api)).toEqual({ ok: true, value: down });
  });
});
