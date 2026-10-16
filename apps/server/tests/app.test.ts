// The server, in memory with Fastify's inject: /health answers in the shared shape, and errors and
// unknown routes come back as Problem Details with the right status and Glade's code.

import { gladeError } from "@glade/errors";
import { PROBLEM_CONTENT_TYPE, healthSchema, problemSchema } from "@glade/formats";
import { describe, expect, it } from "vitest";
import { buildApp, statusOf } from "../src/app";

describe("GET /api/v1/health", () => {
  it("answers 200 with the version when every check is ok", async () => {
    const app = buildApp({ version: "1.2.3", checks: { database: () => true } });
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(healthSchema.parse(res.json())).toEqual({
      status: "ok",
      version: "1.2.3",
      checks: { database: "ok" },
    });
  });

  it("answers 503 when a check fails", async () => {
    const app = buildApp({ version: "1", checks: { disk: async () => false } });
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: "down", checks: { disk: "down" } });
  });

  it("is ok with no checks yet", async () => {
    const res = await buildApp({ version: "1" }).inject({ method: "GET", url: "/api/v1/health" });
    expect(res.json()).toEqual({ status: "ok", version: "1", checks: {} });
  });
});

describe("errors", () => {
  it("an unknown route is a 404 Problem", async () => {
    const res = await buildApp({ version: "1" }).inject({ method: "GET", url: "/api/v1/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
    expect(problemSchema.parse(res.json())).toMatchObject({
      status: 404,
      instance: "/api/v1/nope",
    });
  });

  it("a thrown GladeError keeps its code, with the status its code means", async () => {
    const app = buildApp({ version: "1" });
    app.get("/conflict", () => {
      throw gladeError("GLD-API-409");
    });
    const res = await app.inject({ method: "GET", url: "/conflict" });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: "GLD-API-409", status: 409 });
  });

  it("anything else thrown is a 500 GLD-APP-001, with no details leaked", async () => {
    const app = buildApp({ version: "1" });
    app.get("/boom", () => {
      throw new Error("secret path /home/someone/db.sqlite");
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: "GLD-APP-001", status: 500 });
    expect(res.body).not.toContain("secret");
  });

  it("a request Fastify can't read (broken JSON) is a 400 Problem", async () => {
    const app = buildApp({ version: "1" });
    app.post("/echo", (request) => request.body);
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{broken",
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
  });

  it("maps codes to statuses", () => {
    expect(statusOf(gladeError("GLD-API-401"))).toBe(401);
    expect(statusOf(gladeError("GLD-FILE-002"))).toBe(400);
    expect(statusOf(gladeError("GLD-CHECK-001"))).toBe(500);
  });
});
