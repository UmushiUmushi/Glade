// Items whose type is not in the catalog: a map can carry them, and viewers show a stub.

import type { SolidPart } from "@glade/render";
import { describe, expect, it } from "vitest";
import { itemModel } from "../../src/items";
import { ui } from "../../src/maps/planet/render2d";
import { addItems, blankMap, catalog, game, item } from "./helpers";

describe("items not in the catalog", () => {
  const map = blankMap();
  addItems(map, { ...item("someone-elses-kiosk", 80, 80), id: "k1" });

  it("say so in the hover text", () => {
    expect(ui.hover(map, game, { x: 40.1, y: 40.1 })).toContain(
      "someone-elses-kiosk k1 (not in the catalog)",
    );
  });

  it("render as a small grey stub, unlike a known item without a model", () => {
    const stub = itemModel(catalog, "someone-elses-kiosk");
    expect(stub.parts).toHaveLength(1);
    expect((stub.parts[0] as SolidPart).color).toBe("#9a9a9a");
    expect((itemModel(catalog, "rock").parts[0] as SolidPart).color).not.toBe("#9a9a9a");
  });
});
