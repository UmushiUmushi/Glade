// Starts logging for the page (docs/logging/README.md): a logger writing to the memory ring at once
// and to browser storage once it opens (the page doesn't wait for it), a session.started line with
// the device class, global catchers for errors that escape everything, and saves every 2 seconds
// and when the page is hidden.

import { toGladeError } from "@glade/errors";
import {
  appEvents,
  browserOf,
  createLogger,
  createRing,
  flushEvery,
  GLADELOG_VERSION,
  newSessionId,
  openIdbSink,
  screenBucket,
  type Clock,
  type GladelogHeader,
  type IdbSink,
  type LogLine,
  type Logger,
  type Ring,
  type Sink,
  type Timers,
} from "@glade/logging";

/** What logging needs from the page, so tests can pass fakes. */
export interface LoggingDeps {
  window: Pick<Window, "addEventListener" | "removeEventListener" | "innerWidth"> & {
    navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">;
    document: Pick<Document, "visibilityState">;
  };
  indexedDB?: IDBFactory;
  clock: Clock;
  timers: Timers;
  rng: () => number;
  glade: { version: string; commit: string };
  /** Throw on undeclared events (dev builds and tests). */
  strict: boolean;
}

export interface Logging {
  /** This tab's session id. */
  session: string;
  logger: Logger<typeof appEvents>;
  ring: Ring;
  /** Save to browser storage now. */
  flush(): Promise<void>;
  /** Remove the page listeners and timers. */
  stop(): void;
}

/** Holds lines until browser storage is open, then hands them on. Never throws. */
function laterSink(): Sink & { attach(sink: IdbSink): void } {
  let waiting: LogLine[] = [];
  let target: IdbSink | null = null;
  return {
    write(line) {
      if (target) target.write(line);
      else waiting.push(line);
    },
    attach(sink) {
      target = sink;
      for (const line of waiting) sink.write(line);
      waiting = [];
    },
  };
}

function header(deps: LoggingDeps, session: string): GladelogHeader {
  const browser = browserOf(deps.window.navigator.userAgent);
  return {
    format: "gladelog",
    version: GLADELOG_VERSION,
    glade: deps.glade,
    session,
    started: new Date(deps.clock.epoch()).toISOString(),
    device: {
      screen: screenBucket(deps.window.innerWidth),
      touch: deps.window.navigator.maxTouchPoints > 0,
      gpu: "unknown",
      browser: browser.family,
      browserVersion: browser.version,
    },
    settings: {},
  };
}

/** Errors that escape every handler: logged once, as GLD-APP-001 (docs/logging/errors.md). */
function catchStrays(deps: LoggingDeps, logger: Logging["logger"]): () => void {
  const onError = (e: Event) => logger.error(toGladeError((e as ErrorEvent).error ?? e));
  const onRejection = (e: Event) => logger.error(toGladeError((e as PromiseRejectionEvent).reason));
  deps.window.addEventListener("error", onError);
  deps.window.addEventListener("unhandledrejection", onRejection);
  return () => {
    deps.window.removeEventListener("error", onError);
    deps.window.removeEventListener("unhandledrejection", onRejection);
  };
}

export function startLogging(deps: LoggingDeps): Logging {
  const session = newSessionId(deps.rng);
  const ring = createRing();
  const later = laterSink();
  const logger = createLogger(appEvents, {
    clock: deps.clock,
    session,
    sinks: [ring, later],
    strict: deps.strict,
  });
  const head = header(deps, session);
  const { browser, browserVersion, ...device } = head.device;
  logger.log("session.started", { ...device, browser, browserVersion });

  let storage: IdbSink | null = null;
  let stopFlushing = () => {};
  const opening = deps.indexedDB
    ? openIdbSink({ indexedDB: deps.indexedDB, header: head }).then((opened) => {
        if (!opened.ok) return logger.error(opened.error);
        storage = opened.value;
        later.attach(opened.value);
        stopFlushing = flushEvery(opened.value, deps.timers);
      })
    : Promise.resolve();

  const flush = async () => {
    await opening;
    await storage?.flush();
  };
  const onHidden = () => {
    if (deps.window.document.visibilityState === "hidden") void flush();
  };
  deps.window.addEventListener("visibilitychange", onHidden);
  deps.window.addEventListener("pagehide", onHidden);
  const stopCatching = catchStrays(deps, logger);

  return {
    session,
    logger,
    ring,
    flush,
    stop() {
      stopCatching();
      stopFlushing();
      deps.window.removeEventListener("visibilitychange", onHidden);
      deps.window.removeEventListener("pagehide", onHidden);
    },
  };
}
