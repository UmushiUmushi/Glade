// Logging for the page, with a fake page and an in-memory IndexedDB: the first line says the
// session started (with the device class and nothing personal), lines reach storage once it opens,
// stray errors are caught, hiding the page saves, and stop removes every listener.

import { IDBFactory } from "fake-indexeddb";
import { openIdbSink, type GladelogHeader } from "@glade/logging";
import { describe, expect, it, vi } from "vitest";
import { startLogging, type LoggingDeps } from "../src/platform/logging";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const HEADER: GladelogHeader = {
  format: "gladelog",
  version: 1,
  glade: { version: "x", commit: "x" },
  session: "s",
  started: "2026-10-04T00:00:00.000Z",
  device: { screen: "desktop", touch: false, gpu: "unknown", browser: "chrome", browserVersion: 1 },
  settings: {},
};

function fakePage(hidden = false) {
  const target = new EventTarget();
  return Object.assign(target, {
    innerWidth: 1440,
    navigator: { userAgent: UA, maxTouchPoints: 0 },
    document: { visibilityState: hidden ? "hidden" : "visible" },
  }) as unknown as LoggingDeps["window"] & EventTarget;
}

function deps(over: Partial<LoggingDeps> = {}): LoggingDeps {
  return {
    window: fakePage(),
    indexedDB: new IDBFactory(),
    clock: { now: () => 0, epoch: () => Date.UTC(2026, 9, 3) },
    timers: { setInterval: () => 1, clearInterval: () => {} },
    rng: () => 0.5,
    glade: { version: "0.1.0", commit: "abc" },
    strict: true,
    ...over,
  };
}

describe("startLogging", () => {
  it("logs that the session started, with the device class only", () => {
    const logging = startLogging(deps());
    const [first] = logging.ring.lines();
    expect(first.event).toBe("session.started");
    expect(first.attrs).toEqual({
      screen: "desktop",
      touch: false,
      gpu: "unknown",
      browser: "chrome",
      browserVersion: 141,
    });
    expect(JSON.stringify(first)).not.toContain("Macintosh");
    logging.stop();
  });

  it("saves lines to browser storage once it opens, including the ones before", async () => {
    const indexedDB = new IDBFactory();
    const logging = startLogging(deps({ indexedDB }));
    logging.logger.log("log.dropped", { reason: "bad-value" });
    await logging.flush();
    logging.stop();
    const reader = await openIdbSink({ indexedDB, header: { ...HEADER, session: "s_reader" } });
    if (!reader.ok) throw new Error("no storage");
    const saved = await reader.value.read(logging.session);
    expect(saved.ok && saved.value?.lines.map((l) => l.event)).toEqual([
      "session.started",
      "log.dropped",
    ]);
  });

  it("logs errors that escape every handler as GLD-APP-001", () => {
    const page = fakePage();
    const logging = startLogging(deps({ window: page, indexedDB: undefined }));
    page.dispatchEvent(Object.assign(new Event("error"), { error: new Error("boom") }));
    page.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: "nope" }));
    const errors = logging.ring.lines().filter((l) => l.event === "app.error");
    expect(errors.map((l) => l.attrs.code)).toEqual(["GLD-APP-001", "GLD-APP-001"]);
    logging.stop();
  });

  it("saves when the page is hidden, and stop removes the listeners", async () => {
    const page = fakePage(true);
    const logging = startLogging(deps({ window: page }));
    const flush = vi.spyOn(logging, "flush");
    await logging.flush();
    page.dispatchEvent(new Event("pagehide"));
    logging.stop();
    page.dispatchEvent(new Event("error"));
    expect(logging.ring.lines().filter((l) => l.event === "app.error")).toEqual([]);
    expect(flush).toHaveBeenCalled();
  });

  it("keeps logging to memory when browser storage can't open", async () => {
    const broken = {
      open() {
        throw new Error("blocked");
      },
    } as unknown as IDBFactory;
    const logging = startLogging(deps({ indexedDB: broken }));
    await logging.flush();
    const codes = logging.ring.lines().map((l) => l.attrs.code);
    expect(codes).toContain("GLD-STORE-001");
    logging.stop();
  });
});
