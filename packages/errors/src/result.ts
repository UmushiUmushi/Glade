// Result: a value or an error, returned instead of thrown (docs/logging/errors.md, rule 1). The
// helpers chain steps one after another: `pipe(parse(text), andThen(check), andThen(load))`.

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** The next step, run only when the last one succeeded. */
export function andThen<T, U, E>(
  step: (value: T) => Result<U, E>,
): (result: Result<T, E>) => Result<U, E> {
  return (result) => (result.ok ? step(result.value) : result);
}

/** Change the value of a success; an error passes through. */
export function map<T, U, E>(change: (value: T) => U): (result: Result<T, E>) => Result<U, E> {
  return (result) => (result.ok ? ok(change(result.value)) : result);
}

/** Change the error of a failure; a success passes through. */
export function mapErr<T, E, F>(change: (error: E) => F): (result: Result<T, E>) => Result<T, F> {
  return (result) => (result.ok ? result : err(change(result.error)));
}

/** The value, or `fallback` when it failed. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/** Every value, in order, or the first error. */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}

/** Run code that may throw (a library, `JSON.parse`) and turn a throw into an error value. */
export function tryCatch<T, E>(run: () => T, toError: (thrown: unknown) => E): Result<T, E> {
  try {
    return ok(run());
  } catch (thrown) {
    return err(toError(thrown));
  }
}

/** The same for async code: a rejection becomes an error value. */
export async function tryCatchAsync<T, E>(
  run: () => Promise<T>,
  toError: (thrown: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await run());
  } catch (thrown) {
    return err(toError(thrown));
  }
}

/**
 * Feed a value through steps, top to bottom: `pipe(a, f, g)` is `g(f(a))`. With `andThen`, each
 * step runs only if the one before it succeeded.
 */
export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D;
export function pipe<A, B, C, D, E>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
): I;
export function pipe(a: unknown, ...steps: ((x: unknown) => unknown)[]): unknown {
  return steps.reduce((value, step) => step(value), a);
}
