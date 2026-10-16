// The .gladelog file: NDJSON, one JSON object per line. Line 1 is a header (format, Glade version
// and commit, session, start time, device class, non-personal settings); every other line is an
// event. A downloaded log and a bug report's log are both this format.

import { err, gladeError, ok, type GladeError, type Result } from "@glade/errors";
import { z } from "zod";
import type { LogLine } from "./line";
import { SEVERITY } from "./severity";

export const GLADELOG_VERSION = 1;

const deviceSchema = z.object({
  screen: z.enum(["phone", "tablet", "desktop", "wide"]),
  touch: z.boolean(),
  gpu: z.enum(["low", "mid", "high", "unknown"]),
  browser: z.enum(["chrome", "edge", "firefox", "safari", "other"]),
  browserVersion: z.number().int().nonnegative(),
});

const headerSchema = z.object({
  format: z.literal("gladelog"),
  version: z.number().int().positive(),
  glade: z.object({ version: z.string(), commit: z.string() }),
  session: z.string(),
  started: z.string(),
  device: deviceSchema,
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export type GladelogHeader = z.infer<typeof headerSchema>;
export type DeviceClass = z.infer<typeof deviceSchema>;

const lineSchema = z.object({
  ts: z.string(),
  mono: z.number(),
  sev: z.number().int().min(1).max(24),
  sevText: z.enum(Object.keys(SEVERITY) as [keyof typeof SEVERITY]),
  event: z.string(),
  session: z.string(),
  trace: z.string().optional(),
  span: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()),
});

export interface Gladelog {
  header: GladelogHeader;
  lines: LogLine[];
  /** Lines that weren't valid events and were skipped (a cut-off file, a hand edit). */
  skipped: number;
}

export function writeGladelog(header: GladelogHeader, lines: readonly LogLine[]): string {
  return [header, ...lines].map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}

/** The header line: it must be a gladelog this version of Glade can read. */
function readHeader(first: string | undefined): Result<GladelogHeader, GladeError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(first ?? "");
  } catch (cause) {
    return err(gladeError("GLD-FILE-001", { detail: { reason: "header is not JSON" }, cause }));
  }
  const header = headerSchema.safeParse(parsed);
  if (!header.success)
    return err(gladeError("GLD-FILE-001", { detail: { reason: "not a gladelog header" } }));
  if (header.data.version > GLADELOG_VERSION)
    return err(gladeError("GLD-FILE-003", { detail: { version: header.data.version } }));
  return ok(header.data);
}

/** The event lines; ones that aren't valid events are skipped and counted. */
function readLines(rest: string[]): { lines: LogLine[]; skipped: number } {
  const lines: LogLine[] = [];
  let skipped = 0;
  for (const text of rest) {
    if (!text.trim()) continue;
    try {
      const line = lineSchema.safeParse(JSON.parse(text));
      if (line.success) lines.push(line.data as LogLine);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { lines, skipped };
}

export function readGladelog(text: string): Result<Gladelog, GladeError> {
  const [first, ...rest] = text.split("\n");
  const header = readHeader(first);
  if (!header.ok) return header;
  return ok({ header: header.value, ...readLines(rest) });
}
