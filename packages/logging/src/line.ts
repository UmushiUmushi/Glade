// One log line, with OpenTelemetry Logs Data Model fields under short names
// (docs/logging/README.md, "What a log line looks like"), and where lines go.

import type { SeverityText } from "./severity";

export interface LogLine {
  /** UTC time (OTel Timestamp). */
  ts: string;
  /** Milliseconds since the session started. Never jumps, so it orders lines exactly. */
  mono: number;
  /** OTel SeverityNumber, 1–24. */
  sev: number;
  /** OTel SeverityText. */
  sevText: SeverityText;
  /** OTel EventName, from the registry. */
  event: string;
  /** Random per tab session (resource attribute `session.id`). */
  session: string;
  /** The action id (OTel TraceId): every line of one action shares it. */
  trace?: string;
  /** The pipeline step (OTel SpanId). */
  span?: string;
  /** Only fields the registry declares for this event. */
  attrs: Record<string, unknown>;
}

/** Somewhere lines go: memory, browser storage, the console. Writing never throws. */
export interface Sink {
  write(line: LogLine): void;
}
