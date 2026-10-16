// Browser log storage, against an in-memory IndexedDB: lines saved and read back, the 5-session and
// 2 MB limits, and failures that come back as GLD-STORE-001 without losing waiting lines.

import { IDBDatabase, IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GladelogHeader } from "../src/gladelog";
import { flushEvery, openIdbSink, type IdbSink } from "../src/idb-sink";
import type { LogLine } from "../src/line";

function header(session: string, started: string): GladelogHeader {
  return {
    format: "gladelog",
    version: 1,
    glade: { version: "0.0.0", commit: "test" },
    session,
    started,
    device: { screen: "desktop", touch: false, gpu: "mid", browser: "chrome", browserVersion: 141 },
    settings: {},
  };
}

function line(session: string, n: number, pad = 0): LogLine {
  return {
    ts: "2026-10-03T00:00:00.000Z",
    mono: n,
    sev: 9,
    sevText: "INFO",
    event: "a.b",
    session,
    attrs: { pad: "x".repeat(pad) },
  };
}

async function open(factory: IDBFactory, session: string, started: string, maxBytes?: number) {
  const sink = await openIdbSink({
    indexedDB: factory,
    header: header(session, started),
    maxSessionBytes: maxBytes,
  });
  if (!sink.ok) throw new Error("open failed");
  return sink.value;
}

async function stored(sink: IdbSink, session: string): Promise<number[]> {
  const read = await sink.read(session);
  return read.ok && read.value ? read.value.lines.map((l) => l.mono) : [];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saving and reading", () => {
  it("saves waiting lines on flush and reads them back in order", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z");
    [1, 2].forEach((n) => sink.write(line("s_a", n)));
    expect(await sink.flush()).toEqual({ ok: true, value: undefined });
    sink.write(line("s_a", 3));
    await sink.flush();
    expect(await stored(sink, "s_a")).toEqual([1, 2, 3]);
    const read = await sink.read("s_a");
    expect(read.ok && read.value?.header.session).toBe("s_a");
  });

  it("does nothing when no lines are waiting", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z");
    expect(await sink.flush()).toEqual({ ok: true, value: undefined });
    expect(await stored(sink, "s_a")).toEqual([]);
  });

  it("reads a session that isn't stored as null", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z");
    expect(await sink.read("s_nope")).toEqual({ ok: true, value: null });
  });
});

describe("limits", () => {
  it("keeps only the newest 5 sessions", async () => {
    const factory = new IDBFactory();
    let last: IdbSink | undefined;
    for (let day = 1; day <= 7; day++) {
      last = await open(factory, `s_${day}`, `2026-10-0${day}T00:00:00Z`);
      last.write(line(`s_${day}`, day));
      await last.flush();
    }
    const sessions = await last?.sessions();
    expect(sessions?.ok && sessions.value.map((s) => s.session)).toEqual([
      "s_7",
      "s_6",
      "s_5",
      "s_4",
      "s_3",
    ]);
    expect(last && (await stored(last, "s_1"))).toEqual([]);
  });

  it("drops a session's oldest chunks once it is over its size limit", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z", 1000);
    for (let n = 1; n <= 5; n++) {
      sink.write(line("s_a", n, 300));
      await sink.flush();
    }
    expect(await stored(sink, "s_a")).toEqual([4, 5]);
    const sessions = await sink.sessions();
    expect(sessions.ok && sessions.value[0].bytes).toBeLessThanOrEqual(1000);
  });
});

describe("failures", () => {
  it("opening without working storage gives GLD-STORE-001", async () => {
    const broken = {
      open() {
        throw new Error("blocked");
      },
    } as unknown as IDBFactory;
    const sink = await openIdbSink({ indexedDB: broken, header: header("s", "t") });
    expect(!sink.ok && sink.error.code).toBe("GLD-STORE-001");
  });

  it("a failed save gives GLD-STORE-001 and keeps the lines for the next try", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z");
    sink.write(line("s_a", 1));
    const spy = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    const failed = await sink.flush();
    expect(!failed.ok && failed.error.code).toBe("GLD-STORE-001");
    spy.mockRestore();
    sink.write(line("s_a", 2));
    await sink.flush();
    expect(await stored(sink, "s_a")).toEqual([1, 2]);
  });

  it("listing and reading give GLD-STORE-001 when storage breaks", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z");
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(() => {
      throw new Error("gone");
    });
    const listed = await sink.sessions();
    const read = await sink.read("s_a");
    expect(!listed.ok && listed.error.code).toBe("GLD-STORE-001");
    expect(!read.ok && read.error.code).toBe("GLD-STORE-001");
  });
});

describe("flushEvery", () => {
  it("flushes on a timer until stopped", async () => {
    const sink = await open(new IDBFactory(), "s_a", "2026-10-01T00:00:00Z");
    const flush = vi.spyOn(sink, "flush");
    let tick: (() => void) | undefined;
    const timers = {
      setInterval: (run: () => void, ms: number) => {
        expect(ms).toBe(2000);
        tick = run;
        return 7;
      },
      clearInterval: vi.fn(),
    };
    const stop = flushEvery(sink, timers);
    tick?.();
    tick?.();
    expect(flush).toHaveBeenCalledTimes(2);
    stop();
    expect(timers.clearInterval).toHaveBeenCalledWith(7);
  });
});
