// Result and its helpers: success and failure, chaining steps with pipe and andThen, and turning
// throws and rejections into error values.

import { describe, expect, it } from "vitest";
import {
  all,
  andThen,
  err,
  map,
  mapErr,
  ok,
  pipe,
  tryCatch,
  tryCatchAsync,
  unwrapOr,
  type Result,
} from "../src/result";

const parse = (text: string): Result<number, string> =>
  /^\d+$/.test(text) ? ok(Number(text)) : err(`not a number: ${text}`);
const positive = (n: number): Result<number, string> => (n > 0 ? ok(n) : err("not positive"));

describe("ok and err", () => {
  it("hold a value or an error", () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err("no")).toEqual({ ok: false, error: "no" });
  });
});

describe("pipe and andThen", () => {
  it("runs each step in order when they all succeed", () => {
    const seen: string[] = [];
    const step = (name: string) => (n: number) => {
      seen.push(name);
      return ok(n + 1);
    };
    expect(pipe(ok(0), andThen(step("a")), andThen(step("b")), andThen(step("c")))).toEqual(ok(3));
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("stops at the first failure and skips the later steps", () => {
    let later = false;
    const result = pipe(
      parse("0"),
      andThen(positive),
      andThen((n) => {
        later = true;
        return ok(n);
      }),
    );
    expect(result).toEqual(err("not positive"));
    expect(later).toBe(false);
  });

  it("passes a plain value through plain functions", () => {
    expect(pipe(2)).toBe(2);
    expect(
      pipe(
        2,
        (n) => n * 3,
        (n) => `${n}!`,
      ),
    ).toBe("6!");
  });

  it("takes up to eight steps", () => {
    const inc = (n: number) => n + 1;
    expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(8);
  });
});

describe("map, mapErr and unwrapOr", () => {
  it("change only the side they are for", () => {
    const double = map((n: number) => n * 2);
    const loud = mapErr((e: string) => e.toUpperCase());
    expect(double(ok(4))).toEqual(ok(8));
    expect(double(err("x"))).toEqual(err("x"));
    expect(loud(err("x"))).toEqual(err("X"));
    expect(loud(ok(4))).toEqual(ok(4));
  });

  it("unwrapOr gives the value or the fallback", () => {
    expect(unwrapOr(parse("7"), 0)).toBe(7);
    expect(unwrapOr(parse("x"), 0)).toBe(0);
  });
});

describe("all", () => {
  it("collects every value, or gives the first error", () => {
    expect(all([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(all([ok(1), err("a"), err("b")])).toEqual(err("a"));
    expect(all([])).toEqual(ok([]));
  });
});

describe("tryCatch", () => {
  it("turns a throw into an error value", () => {
    const parsed = tryCatch(
      () => JSON.parse("{") as unknown,
      () => "bad json",
    );
    expect(parsed).toEqual(err("bad json"));
    expect(
      tryCatch(
        () => JSON.parse("[1]") as unknown,
        () => "bad json",
      ),
    ).toEqual(ok([1]));
  });

  it("does the same for a rejected promise", async () => {
    const reason = await tryCatchAsync(
      () => Promise.reject(new Error("down")),
      (e) => (e instanceof Error ? e.message : "?"),
    );
    expect(reason).toEqual(err("down"));
    expect(
      await tryCatchAsync(
        () => Promise.resolve(5),
        () => "?",
      ),
    ).toEqual(ok(5));
  });
});
