// Log severities on the OpenTelemetry scale (Logs Data Model): a text and a number from 1 to 24,
// where each text starts a band of four. Glade uses the first number of each band.

export const SEVERITY = {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
} as const;

export type SeverityText = keyof typeof SEVERITY;

/** A GladeError's severity, as a log severity. */
export function severityOfError(severity: "info" | "warn" | "error" | "fatal"): SeverityText {
  const map = { info: "INFO", warn: "WARN", error: "ERROR", fatal: "FATAL" } as const;
  return map[severity];
}
