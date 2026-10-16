// Log storage in the browser (IndexedDB): the last 5 sessions, up to 2 MB each, so logs survive a
// crash and can be sent with a bug report. Lines wait in memory and are saved in chunks, every
// 2 seconds and when the page is hidden; the oldest chunks go first when a session is full.

import { gladeError, ok, tryCatchAsync, type GladeError, type Result } from "@glade/errors";
import type { GladelogHeader } from "./gladelog";
import type { LogLine, Sink } from "./line";

export const LOG_DB_NAME = "glade-logs";
export const MAX_SESSIONS = 5;
export const MAX_SESSION_BYTES = 2_000_000;
export const FLUSH_EVERY_MS = 2000;

interface SessionRecord {
  session: string;
  started: string;
  bytes: number;
  header: GladelogHeader;
}

interface ChunkRecord {
  id?: number;
  session: string;
  bytes: number;
  /** NDJSON: one line per event. */
  text: string;
}

export interface StoredSession {
  session: string;
  started: string;
  bytes: number;
}

export interface IdbSink extends Sink {
  /** Save waiting lines now. */
  flush(): Promise<Result<void, GladeError>>;
  /** Stored sessions, newest first. */
  sessions(): Promise<Result<StoredSession[], GladeError>>;
  /** One stored session's header and lines, oldest first, or null when it isn't stored. */
  read(
    session: string,
  ): Promise<Result<{ header: GladelogHeader; lines: LogLine[] } | null, GladeError>>;
}

export interface IdbSinkOptions {
  indexedDB: IDBFactory;
  header: GladelogHeader;
  dbName?: string;
  maxSessions?: number;
  maxSessionBytes?: number;
}

// ---- IndexedDB as promises ----

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  const req = factory.open(name, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore("sessions", { keyPath: "session" });
    const chunks = req.result.createObjectStore("chunks", { keyPath: "id", autoIncrement: true });
    chunks.createIndex("session", "session");
  };
  return request(req);
}

const storeError = (cause: unknown) => gladeError("GLD-STORE-001", { cause });

// ---- the steps ----

/** Delete a session and all of its chunks. */
async function dropSession(db: IDBDatabase, session: string): Promise<void> {
  const tx = db.transaction(["sessions", "chunks"], "readwrite");
  tx.objectStore("sessions").delete(session);
  const keys = await request(tx.objectStore("chunks").index("session").getAllKeys(session));
  for (const key of keys) tx.objectStore("chunks").delete(key);
  await done(tx);
}

/** Record this session, then keep only the newest `max` sessions. */
async function startSession(db: IDBDatabase, header: GladelogHeader, max: number): Promise<void> {
  const tx = db.transaction("sessions", "readwrite");
  const record: SessionRecord = {
    session: header.session,
    started: header.started,
    bytes: 0,
    header,
  };
  tx.objectStore("sessions").put(record);
  await done(tx);
  const all = await request(db.transaction("sessions").objectStore("sessions").getAll());
  const oldest = (all as SessionRecord[])
    .sort((a, b) => b.started.localeCompare(a.started))
    .slice(max);
  for (const old of oldest) await dropSession(db, old.session);
}

/** Add one chunk, then drop the session's oldest chunks until it fits its size limit. */
async function saveChunk(
  db: IDBDatabase,
  session: string,
  text: string,
  max: number,
): Promise<void> {
  const bytes = new TextEncoder().encode(text).length;
  const tx = db.transaction(["sessions", "chunks"], "readwrite");
  const sessions = tx.objectStore("sessions");
  const chunks = tx.objectStore("chunks");
  const record = (await request(sessions.get(session))) as SessionRecord;
  chunks.add({ session, bytes, text } satisfies ChunkRecord);
  let total = record.bytes + bytes;
  const stored = (await request(chunks.index("session").getAll(session))) as ChunkRecord[];
  for (const chunk of stored) {
    if (total <= max) break;
    if (chunk.id !== undefined) chunks.delete(chunk.id);
    total -= chunk.bytes;
  }
  sessions.put({ ...record, bytes: total });
  await done(tx);
}

async function readSession(db: IDBDatabase, session: string) {
  const tx = db.transaction(["sessions", "chunks"]);
  const record = (await request(tx.objectStore("sessions").get(session))) as
    SessionRecord | undefined;
  const chunks = (await request(
    tx.objectStore("chunks").index("session").getAll(session),
  )) as ChunkRecord[];
  if (!record) return null;
  const text = chunks.map((c) => c.text).join("");
  const lines = text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LogLine);
  return { header: record.header, lines };
}

// ---- the sink ----

/** Open log storage for this session. Fails with GLD-STORE-001 when the browser has none. */
export async function openIdbSink(options: IdbSinkOptions): Promise<Result<IdbSink, GladeError>> {
  const maxBytes = options.maxSessionBytes ?? MAX_SESSION_BYTES;
  const session = options.header.session;
  const opened = await tryCatchAsync(async () => {
    const db = await openDb(options.indexedDB, options.dbName ?? LOG_DB_NAME);
    await startSession(db, options.header, options.maxSessions ?? MAX_SESSIONS);
    return db;
  }, storeError);
  if (!opened.ok) return opened;
  const db = opened.value;
  let waiting: LogLine[] = [];

  return ok({
    write(line) {
      waiting.push(line);
    },
    async flush() {
      if (!waiting.length) return ok(undefined);
      const text = waiting.map((l) => JSON.stringify(l) + "\n").join("");
      const batch = waiting;
      waiting = [];
      const saved = await tryCatchAsync(() => saveChunk(db, session, text, maxBytes), storeError);
      if (!saved.ok) waiting = [...batch, ...waiting];
      return saved;
    },
    async sessions() {
      return tryCatchAsync(async () => {
        const all = (await request(
          db.transaction("sessions").objectStore("sessions").getAll(),
        )) as SessionRecord[];
        return all
          .map(({ session: s, started, bytes }) => ({ session: s, started, bytes }))
          .sort((a, b) => b.started.localeCompare(a.started));
      }, storeError);
    },
    read(id) {
      return tryCatchAsync(() => readSession(db, id), storeError);
    },
  });
}

export interface Timers {
  setInterval(run: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

/** Save every 2 seconds until stopped. The app also calls `flush` when the page is hidden. */
export function flushEvery(sink: IdbSink, timers: Timers, ms = FLUSH_EVERY_MS): () => void {
  const handle = timers.setInterval(() => void sink.flush(), ms);
  return () => timers.clearInterval(handle);
}
