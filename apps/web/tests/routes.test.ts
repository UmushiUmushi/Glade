// The app's URLs: which page each path opens, back to a path again, and the history the app is
// handed (in memory here; the browser's in the app).

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { memoryHistory, parseRoute, routePath, type Route } from "../src/app/routes";

describe("parseRoute", () => {
  it("opens the home page at /", () => {
    expect(parseRoute("/")).toEqual({ page: "home" });
    expect(parseRoute("")).toEqual({ page: "home" });
  });

  it("opens a game's planner at /<game>/planner, with or without a trailing slash", () => {
    expect(parseRoute("/some-game/planner")).toEqual({ page: "planner", game: "some-game" });
    expect(parseRoute("/some-game/planner/")).toEqual({ page: "planner", game: "some-game" });
    expect(parseRoute("/some-game/planner?map=1#x")).toEqual({
      page: "planner",
      game: "some-game",
    });
  });

  it("opens the not-found page for anything else", () => {
    for (const path of ["/some-game", "/some-game/planner/extra", "/Some Game/planner", "/x/y"]) {
      expect(parseRoute(path).page, path).toBe("not-found");
    }
    expect(parseRoute("/nothing/here/")).toEqual({ page: "not-found", path: "/nothing/here" });
  });
});

describe("routePath", () => {
  it("is the path that opens the same page", () => {
    const game = fc.stringMatching(/^[a-z0-9-]{1,20}$/);
    const route: fc.Arbitrary<Route> = fc.oneof(
      fc.constant<Route>({ page: "home" }),
      game.map((g): Route => ({ page: "planner", game: g })),
    );
    fc.assert(
      fc.property(route, (r) => {
        expect(parseRoute(routePath(r))).toEqual(r);
      }),
    );
  });
});

describe("memoryHistory", () => {
  it("starts at its path, adds entries, and tells listeners until they stop", () => {
    const history = memoryHistory("/start");
    const heard = vi.fn();
    const stop = history.listen(heard);
    history.push("/next");
    expect(history.path()).toBe("/next");
    history.push("/next");
    expect(history.entries).toEqual(["/start", "/next"]);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    history.push("/again");
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
