// The error code registry: every error Glade can report, once (docs/logging/errors.md, rule 2).
// Codes read GLD-<AREA>-<NUMBER>. docs/error-codes.md is generated from this file by its test.

import type { TextKey } from "./texts";

/** Where an error comes from. The first five are the planner pipeline's steps. */
export type ErrorStep =
  "capture" | "interpret" | "plan" | "check" | "present" | "ui" | "storage" | "network" | "server";

export type Severity = "info" | "warn" | "error" | "fatal";

/** Each area, and what it covers. */
export const AREAS = {
  INT: "Interpreting input into an intent",
  PLAN: "Planning ops from an intent",
  CHECK: "Running and checking ops",
  PRES: "Presenting results on screen",
  WORKER: "The editor worker",
  STAGE: "Drawing the map (2D and 3D)",
  STORE: "Browser storage",
  NET: "The network",
  API: "Glade's server API",
  FILE: "Map and pack files",
  BUILD: "The item builder",
  UI: "Screens and controls",
  APP: "Anything else (unexpected errors)",
} as const;

export type Area = keyof typeof AREAS;

export interface ErrorCodeInfo {
  /** One line for developers: what went wrong. */
  title: string;
  step: ErrorStep;
  severity: Severity;
  /** What the user is told. */
  text: TextKey;
}

export const ERROR_CODES = {
  "GLD-CHECK-001": {
    title: "An op got input it can't use (a Glade bug). The action was cancelled.",
    step: "check",
    severity: "error",
    text: "safe-failure",
  },
  "GLD-PLAN-001": {
    title: "The mode has no plan for this intent. The action was cancelled.",
    step: "plan",
    severity: "error",
    text: "safe-failure",
  },
  "GLD-WORKER-001": {
    title: "The editor worker didn't answer in time and was restarted from the mirror.",
    step: "check",
    severity: "error",
    text: "editor-restarted",
  },
  "GLD-WORKER-002": {
    title: "The editor worker crashed and was restarted from the mirror.",
    step: "check",
    severity: "error",
    text: "editor-restarted",
  },
  "GLD-STAGE-001": {
    title: "The 3D view lost its graphics context. The view switched to 2D.",
    step: "ui",
    severity: "warn",
    text: "view-paused",
  },
  "GLD-STORE-001": {
    title: "Browser storage is unavailable (a private window, or the disk is full).",
    step: "storage",
    severity: "info",
    text: "storage-unavailable",
  },
  "GLD-NET-001": {
    title: "The server can't be reached. Edits wait and are retried with back-off.",
    step: "network",
    severity: "warn",
    text: "changes-waiting",
  },
  "GLD-API-401": {
    title: "The session ended or expired.",
    step: "network",
    severity: "warn",
    text: "logged-out",
  },
  "GLD-API-409": {
    title: "Another device saved a newer revision first. The latest was loaded.",
    step: "network",
    severity: "warn",
    text: "changed-elsewhere",
  },
  "GLD-FILE-001": {
    title: "The file isn't JSON, or isn't a Glade file.",
    step: "storage",
    severity: "error",
    text: "not-a-glade-file",
  },
  "GLD-FILE-002": {
    title: "The file is for another game.",
    step: "storage",
    severity: "error",
    text: "wrong-game",
  },
  "GLD-FILE-003": {
    title: "The file's format version is newer than this Glade knows.",
    step: "storage",
    severity: "error",
    text: "file-too-new",
  },
  "GLD-FILE-004": {
    title: "A map uses items from a pack that isn't loaded.",
    step: "storage",
    severity: "warn",
    text: "missing-pack",
  },
  "GLD-UI-001": {
    title: "A screen region crashed while rendering. Its error boundary caught it.",
    step: "ui",
    severity: "error",
    text: "part-stopped",
  },
  "GLD-APP-001": {
    title: "An unexpected error reached a global handler.",
    step: "ui",
    severity: "fatal",
    text: "safe-failure",
  },
} as const satisfies Record<string, ErrorCodeInfo>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** The area of a code: "GLD-CHECK-001" → "CHECK". */
export function areaOf(code: ErrorCode): Area {
  return code.split("-")[1] as Area;
}
