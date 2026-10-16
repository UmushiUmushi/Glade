// API errors as Problem Details (RFC 9457), with Glade's error code: the server turns a GladeError
// into one, and the web app turns one back into a GladeError (docs/server/README.md).

import { ERROR_CODES, gladeError, messageOf, type ErrorCode, type GladeError } from "@glade/errors";
import { z } from "zod";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
/** Where error types point. The domain is a placeholder until Q-2 is settled. */
export const PROBLEM_TYPE_BASE = "https://glade.app/errors/";

export const problemSchema = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.string().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type Problem = z.infer<typeof problemSchema>;

/** A GladeError as a Problem Details body. `extras` adds fields, like `latestRevision`. */
export function problemOf(
  error: GladeError,
  status: number,
  extras: { detail?: string } & Record<string, unknown> = {},
): Problem {
  return {
    ...extras,
    type: PROBLEM_TYPE_BASE + error.code,
    title: messageOf(error).what,
    status,
    code: error.code,
  };
}

function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === "string" && code in ERROR_CODES;
}

/** A Problem Details body as a GladeError. One without a known code is unexpected: GLD-APP-001. */
export function errorOfProblem(problem: Problem): GladeError {
  const code = isErrorCode(problem.code) ? problem.code : "GLD-APP-001";
  return gladeError(code, { detail: { status: problem.status } });
}
