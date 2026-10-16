// Events every Glade app logs, whatever the screen: a session starting, an error, and the logger
// dropping something the registry doesn't allow. Feature events live in their own files here.

import { ERROR_CODES, type ErrorCode } from "@glade/errors";
import { z } from "zod";
import { defineEvents } from "../registry";

const ERROR_CODE_LIST = Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

const STEPS = [
  "capture",
  "interpret",
  "plan",
  "check",
  "present",
  "ui",
  "storage",
  "network",
  "server",
] as const;

/** A fact about an error: short, and never free text (docs/logging/errors.md). */
const detailValue = z.union([z.string().max(64), z.number(), z.boolean()]);

export const appEvents = defineEvents({
  "session.started": {
    severity: "INFO",
    fields: {
      screen: z.enum(["phone", "tablet", "desktop", "wide"]),
      touch: z.boolean(),
      gpu: z.enum(["low", "mid", "high", "unknown"]),
      browser: z.enum(["chrome", "edge", "firefox", "safari", "other"]),
      browserVersion: z.number().int().nonnegative(),
    },
  },
  "app.error": {
    severity: "ERROR",
    fields: {
      code: z.enum(ERROR_CODE_LIST),
      step: z.enum(STEPS),
      detail: z.record(z.string().max(32), detailValue).optional(),
      /** Already redacted by `logError`. */
      stack: z.string().max(4000).optional(),
    },
  },
  "log.dropped": {
    severity: "WARN",
    fields: {
      reason: z.enum(["unknown-event", "unknown-field", "bad-value"]),
      /** The event, when it is a registered one. */
      event: z.string().max(80).optional(),
    },
  },
});
