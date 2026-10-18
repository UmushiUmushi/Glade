// Which layout a screen size gets: the table in docs/planner/screen.md (Screen sizes).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { layoutFor } from "../src/screen-size";

describe("layoutFor", () => {
  it("is desktop from 1280 px wide, tablet from 900, phone below", () => {
    expect(layoutFor(1440, 900)).toBe("desktop");
    expect(layoutFor(1280, 800)).toBe("desktop");
    expect(layoutFor(1279, 800)).toBe("tablet");
    expect(layoutFor(900, 700)).toBe("tablet");
    expect(layoutFor(899, 700)).toBe("phone");
    expect(layoutFor(390, 844)).toBe("phone");
  });

  it("is phone on any screen less than 500 px tall, like a phone held sideways", () => {
    expect(layoutFor(844, 390)).toBe("phone");
    expect(layoutFor(1920, 499)).toBe("phone");
    expect(layoutFor(1920, 500)).toBe("desktop");
  });

  it("never gets a smaller layout on a wider screen of the same height", () => {
    const rank = { phone: 0, tablet: 1, desktop: 2 };
    fc.assert(
      fc.property(fc.nat(4000), fc.nat(4000), fc.nat(3000), (w, extra, h) => {
        expect(rank[layoutFor(w + extra, h)]).toBeGreaterThanOrEqual(rank[layoutFor(w, h)]);
      }),
    );
  });
});
