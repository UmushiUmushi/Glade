// Property tests for Result: the chaining laws that let steps be split or joined without changing
// what a chain of steps does, checked over many made-up values.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { andThen, err, map, ok, pipe, type Result } from "../src/result";

/** Any result: a success holding an integer, or a failure holding a string. */
const result = fc.oneof(fc.integer().map(ok), fc.string().map(err)) as fc.Arbitrary<
  Result<number, string>
>;
/** A step that fails for some numbers. */
const step = fc.integer({ min: 2, max: 9 }).map(
  (m) =>
    (n: number): Result<number, string> =>
      n % m === 0 ? err(`÷${m}`) : ok(n + m),
);

describe("result laws", () => {
  it("andThen(ok) changes nothing", () => {
    fc.assert(
      fc.property(result, (r) => {
        expect(pipe(r, andThen(ok))).toEqual(r);
      }),
    );
  });

  it("andThen on a success is the step itself", () => {
    fc.assert(
      fc.property(fc.integer(), step, (n, f) => {
        expect(pipe(ok(n), andThen(f))).toEqual(f(n));
      }),
    );
  });

  it("two steps chained give the same as one step that runs both", () => {
    fc.assert(
      fc.property(result, step, step, (r, f, g) => {
        const both = (n: number) => pipe(f(n), andThen(g));
        expect(pipe(r, andThen(f), andThen(g))).toEqual(pipe(r, andThen(both)));
      }),
    );
  });

  it("an error passes every step untouched", () => {
    fc.assert(
      fc.property(fc.string(), step, (e, f) => {
        expect(
          pipe(
            err(e),
            andThen(f),
            map((n: number) => n * 2),
          ),
        ).toEqual(err(e));
      }),
    );
  });
});
