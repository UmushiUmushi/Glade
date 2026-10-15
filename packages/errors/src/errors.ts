// The error shape every Glade step returns (docs/logging/errors.md). Make one with `gladeError`;
// the registry fills in its step, severity and user text, so a code means the same thing everywhere.

import { ERROR_CODES, type ErrorCode, type ErrorStep, type Severity } from "./codes";
import { USER_TEXTS, fillSlots, type ErrorAction, type TextKey } from "./texts";

/** Facts about an error. Never personal: no names, no map content, no file paths. */
export type ErrorDetail = Record<string, string | number | boolean>;

export interface GladeError {
  code: ErrorCode;
  step: ErrorStep;
  severity: Severity;
  userText: TextKey;
  detail?: ErrorDetail;
  /** The original thrown value, kept for logs (its stack only). */
  cause?: unknown;
}

export interface ErrorExtras {
  detail?: ErrorDetail;
  cause?: unknown;
  /** Only when this case is worse or milder than the code's usual severity. */
  severity?: Severity;
}

export function gladeError(code: ErrorCode, extras: ErrorExtras = {}): GladeError {
  const info = ERROR_CODES[code];
  const error: GladeError = {
    code,
    step: info.step,
    severity: extras.severity ?? info.severity,
    userText: info.text,
  };
  if (extras.detail) error.detail = extras.detail;
  if (extras.cause !== undefined) error.cause = extras.cause;
  return error;
}

/** Whether a value is a GladeError (for code that catches at the edges). */
export function isGladeError(value: unknown): value is GladeError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    value.code in ERROR_CODES
  );
}

/** Anything thrown, as a GladeError. Unknown throws become GLD-APP-001, keeping the cause. */
export function toGladeError(thrown: unknown, code: ErrorCode = "GLD-APP-001"): GladeError {
  return isGladeError(thrown) ? thrown : gladeError(code, { cause: thrown });
}

/** What the user reads for an error, with its slots filled. */
export interface ErrorMessage {
  what: string;
  safe?: string;
  next?: string;
  actions: readonly ErrorAction[];
}

export function messageOf(error: GladeError): ErrorMessage {
  const text: { what: string; safe?: string; next?: string; actions: readonly ErrorAction[] } =
    USER_TEXTS[error.userText];
  const fill = (s: string) => fillSlots(s, error.detail ?? {});
  const message: ErrorMessage = { what: fill(text.what), actions: text.actions };
  if (text.safe) message.safe = fill(text.safe);
  if (text.next) message.next = fill(text.next);
  return message;
}
