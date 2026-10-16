// The logger: checks each event against the registry, keeps only declared fields, stamps the line
// with time, session, action and step, and hands it to the sinks. In strict mode (tests and dev
// builds) anything undeclared throws, so mistakes are caught before release.

import type { GladeError } from "@glade/errors";
import { appEvents } from "./events/app";
import type { LogLine, Sink } from "./line";
import { redactStack } from "./redact";
import type { AttrsOf, EventSpecs } from "./registry";
import { SEVERITY, severityOfError, type SeverityText } from "./severity";

export interface Clock {
  /** Monotonic milliseconds (performance.now). */
  now(): number;
  /** Clock time in epoch milliseconds (Date.now). */
  epoch(): number;
}

export interface LoggerDeps {
  clock: Clock;
  session: string;
  sinks: Sink[];
  /** Throw on anything the registry doesn't allow, instead of dropping it. */
  strict: boolean;
}

export interface LogContext {
  /** The action id. */
  trace?: string;
  /** The pipeline step. */
  span?: string;
  /** Only when this case is worse or milder than the event's usual severity. */
  severity?: SeverityText;
}

type AllEvents<S extends EventSpecs> = S & typeof appEvents;

export interface Logger<S extends EventSpecs> {
  log<K extends keyof AllEvents<S> & string>(
    event: K,
    attrs: AttrsOf<AllEvents<S>[K]["fields"]>,
    context?: LogContext,
  ): void;
  /** Log a GladeError once, where it is handled (docs/logging/errors.md, rule 3). */
  error(error: GladeError, context?: Omit<LogContext, "severity">): void;
}

type DropReason = "unknown-event" | "unknown-field" | "bad-value";

/** A logging mistake in Glade's own code, thrown only in strict mode. */
export class LogSchemaError extends Error {}

export function createLogger<S extends EventSpecs>(registry: S, deps: LoggerDeps): Logger<S> {
  const events: EventSpecs = { ...registry, ...appEvents };
  const started = deps.clock.now();

  function drop(reason: DropReason, message: string, event?: string): void {
    if (deps.strict) throw new LogSchemaError(message);
    emit("log.dropped", event ? { reason, event } : { reason }, {});
  }

  /** Step 2: only declared fields, each with a value its schema accepts. */
  function cleanAttrs(event: string, attrs: Record<string, unknown>): Record<string, unknown> {
    const fields = events[event].fields;
    const clean: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(attrs)) {
      if (value === undefined) continue;
      const schema = fields[field];
      if (!schema) drop("unknown-field", `${event}: field "${field}" is not declared`, event);
      else if (!schema.safeParse(value).success)
        drop("bad-value", `${event}: field "${field}" has a value its schema refuses`, event);
      else clean[field] = value;
    }
    return clean;
  }

  /** Step 3: the line itself. */
  function line(event: string, attrs: Record<string, unknown>, context: LogContext): LogLine {
    const sevText = context.severity ?? events[event].severity;
    const out: LogLine = {
      ts: new Date(deps.clock.epoch()).toISOString(),
      mono: Math.round((deps.clock.now() - started) * 10) / 10,
      sev: SEVERITY[sevText],
      sevText,
      event,
      session: deps.session,
      attrs,
    };
    if (context.trace) out.trace = context.trace;
    if (context.span) out.span = context.span;
    return out;
  }

  function emit(event: string, attrs: Record<string, unknown>, context: LogContext): void {
    const written = line(event, cleanAttrs(event, attrs), context);
    for (const sink of deps.sinks) sink.write(written);
  }

  return {
    log(event, attrs, context = {}) {
      // Step 1: the event must be declared.
      if (!(event in events)) return drop("unknown-event", `"${event}" is not a declared event`);
      emit(event, attrs as Record<string, unknown>, context);
    },
    error(error, context = {}) {
      emit("app.error", errorAttrs(error), {
        ...context,
        severity: severityOfError(error.severity),
      });
    },
  };
}

/** An error's code, step and detail, and its cause's stack with anything identifying taken out. */
function errorAttrs(error: GladeError): Record<string, unknown> {
  const attrs: Record<string, unknown> = { code: error.code, step: error.step };
  if (error.detail) attrs.detail = error.detail;
  if (error.cause instanceof Error && error.cause.stack)
    attrs.stack = redactStack(error.cause.stack);
  return attrs;
}
