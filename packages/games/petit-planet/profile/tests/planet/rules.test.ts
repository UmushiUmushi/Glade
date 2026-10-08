import { describe, expect, it } from "vitest";
import { setCornerAt, type MapDoc } from "../../src/maps/planet/model";
import type { Params } from "../../src/maps/planet/profile";
import { petitPlanet, rulesDoc } from "../../src";
import { customizeMap, validate } from "@glade/core";
import { deserializeMap, serializeMap } from "@glade/core";
import {
  addItems,
  addPlants,
  blankMap,
  fillTerrain,
  game,
  item,
  plant,
  setPathAt,
  stamp,
} from "./helpers";

/** Violations with the game's rules, optionally with some params changed (customizeMap). */
function violations(map: MapDoc, ruleId?: string, params: Partial<Params> = {}) {
  const all = validate(map, customizeMap(game, { params }));
  return ruleId ? all.filter((v) => v.ruleId === ruleId) : all;
}

const xy = (cells: { x: number; y: number }[]) => cells.map((c) => [c.x, c.y]);

describe("rulebook", () => {
  it("a fresh map is valid", () => {
    expect(violations(blankMap())).toEqual([]);
  });

  it("documents every rule once", () => {
    const ids = rulesDoc().map((r) => r.id);
    expect(ids).toEqual([
      "T1", "T2", "T3", "T4", "W1", "W2", "W4", "T5", "P1", "P2", "P3", "O1", "O2",
      "L1", "L2", "L3", "L4", "L5", "L6", "I1", "I2", "I3", "I4", "I5", "I6", "B1", "S1",
      "S2", "S3", "K1", "W3",
    ]); // prettier-ignore
    expect(
      rulesDoc()
        .filter((r) => r.info)
        .map((r) => r.id),
    ).toEqual(["W3"]);
    expect(rulesDoc().every((r) => r.description.length > 10)).toBe(true);
  });

  it("scopes local rules to the changed region plus a margin", () => {
    const map = stamp(blankMap(), 50, 50, ["5"]); // step of 4
    const far = { grid: "major" as const, x: 120, y: 120, w: 4, h: 4 };
    const near = { grid: "terrain" as const, x: 52, y: 50, w: 1, h: 1 };
    expect(validate(map, game, { region: far }).filter((v) => v.ruleId === "T3")).toEqual([]);
    expect(validate(map, game, { region: near }).filter((v) => v.ruleId === "T3")).toHaveLength(1);
  });
});

describe("T1 height-range", () => {
  it("rejects heights above 8", () => {
    const map = stamp(blankMap(), 50, 50, ["9"]);
    expect(xy(violations(map, "T1")[0].cells)).toEqual([[50, 50]]);
  });

  it("accepts 0..8", () => {
    const map = stamp(blankMap(), 50, 50, ["0", "8"]);
    expect(violations(map, "T1")).toEqual([]);
  });
});

describe("T2 border-immutable", () => {
  it("rejects changes to beach and to the locked land ring", () => {
    const map = stamp(blankMap(), 5, 80, ["1"]);
    stamp(map, 17, 80, ["2"]);
    expect(xy(violations(map, "T2")[0].cells)).toEqual([
      [5, 80],
      [17, 80],
    ]);
  });

  it("allows edits from terrain 18 inward (x 18..142, y 18..126)", () => {
    const map = stamp(blankMap(), 18, 80, ["2"]);
    stamp(map, 142, 126, ["0"]);
    expect(violations(map, "T2")).toEqual([]);
  });
});

describe("T3 step-limit", () => {
  it("rejects a step of 4", () => {
    const map = stamp(blankMap(), 50, 50, ["5"]);
    const [v] = violations(map, "T3");
    expect(v.message).toMatch(/largest step 4/);
    expect(v.cells).toContainEqual({ grid: "terrain", x: 50, y: 50 });
  });

  it("accepts a step of 3", () => {
    expect(violations(stamp(blankMap(), 50, 50, ["4"]), "T3")).toEqual([]);
  });

  it("counts corners: a 4-high peak needs a full 3x3 base", () => {
    const full = stamp(blankMap(), 50, 50, ["222", "252", "222"]);
    expect(violations(full, "T3")).toEqual([]);

    const plus = stamp(blankMap(), 50, 50, [".2.", "252", ".2."]);
    const [v] = violations(plus, "T3");
    expect(v.message).toMatch(/^4 neighbor pair/);
  });

  it("ignores diagonals with a 4-neighborhood profile", () => {
    const map = fillTerrain(blankMap(), 45, 45, 12, 12, 3);
    stamp(map, 50, 50, ["13", "35"]);
    expect(violations(map, "T3")).toHaveLength(1);
    expect(violations(map, "T3", { stepNeighborhood: "4" })).toEqual([]);
  });
});

describe("T4 landmark-lock", () => {
  it("locks town center terrain one minor unit past its edge (78..98 x 71..98)", () => {
    const map = stamp(blankMap(), 78, 71, ["2"]);
    stamp(map, 98, 98, ["2"]);
    stamp(map, 85, 85, ["1~"]);
    expect(xy(violations(map, "T4")[0].cells)).toEqual([
      [78, 71],
      [85, 85],
      [98, 98],
    ]);
  });

  it("does not lock terrain just outside", () => {
    const map = stamp(blankMap(), 99, 98, ["2"]);
    stamp(map, 77, 70, ["2"]);
    stamp(map, 85, 70, ["2"]);
    expect(violations(map, "T4")).toEqual([]);
  });
});

describe("W1 water-not-on-beach", () => {
  it("rejects water on beach and the land ring", () => {
    const map = stamp(blankMap(), 5, 80, ["0~"]);
    stamp(map, 17, 80, ["1~"]);
    expect(xy(violations(map, "W1")[0].cells)).toEqual([
      [5, 80],
      [17, 80],
    ]);
  });

  it("allows water on editable land", () => {
    expect(violations(stamp(blankMap(), 18, 80, ["1~"]), "W1")).toEqual([]);
  });
});

describe("W2 waterfall-position", () => {
  // A 4-wide, 3-deep plateau at level 3; its south row (ty 50) is a 4-cell edge over level 1.
  const plateau = () => fillTerrain(blankMap(), 50, 48, 4, 3, 3);

  it("xwwx: water inside the edge run is legal", () => {
    const map = stamp(plateau(), 51, 50, ["3~3~"]);
    expect(violations(map, "W2")).toEqual([]);
  });

  it("xw: water at the end of the run is illegal", () => {
    const map = stamp(plateau(), 52, 50, ["3~3~"]);
    const vs = violations(map, "W2");
    expect(vs.length).toBeGreaterThan(0);
    expect(vs.every((v) => v.cells[0].x === 53 && v.cells[0].y === 50)).toBe(true);
    expect(vs[0].message).toMatch(/end of its/);
  });

  it("xwx is legal at the default minimum run of 3, illegal at 4", () => {
    const map = fillTerrain(blankMap(), 50, 48, 3, 3, 3);
    stamp(map, 51, 50, ["3~"]);
    expect(violations(map, "W2")).toEqual([]);
    const [v] = violations(map, "W2", { waterfallMinRun: 4 });
    expect(v.message).toMatch(/only 3 cell/);
  });

  it("a river dug below its banks needs the lip beside the fall at the fall's level", () => {
    // Plateau at 3; a river dug to 2 starts inside it and reaches the south edge at (51, 50).
    const map = fillTerrain(blankMap(), 50, 46, 3, 5, 3);
    stamp(map, 51, 47, ["2~", "2~", "2~", "2~"]);
    expect(violations(map, "W2").length).toBeGreaterThan(0);
    stamp(map, 50, 50, ["2.2"]);
    expect(violations(map, "W2")).toEqual([]);
  });

  it("steps beside a fall make it sit on the edge of the cliff face", () => {
    // Plateau at 6 over ground at 3; a 3-wide river falls south at x 24..26.
    const map = fillTerrain(blankMap(), 18, 88, 11, 10, 6);
    fillTerrain(map, 18, 98, 11, 3, 3);
    stamp(map, 24, 90, [
      "6~6~6~",
      "6~6~6~",
      "6~6~6~",
      "6~6~6~",
      "6~6~6~",
      "6~6~6~",
      "6~6~6~",
      "6~6~6~",
    ]);
    // Steps at 5 then 4 directly west of the fall: the cliff there drops only one level.
    stamp(map, 21, 98, ["555", "444"]);
    const vs = violations(map, "W2");
    expect(vs.map((v) => `${v.cells[0].x},${v.cells[0].y}`)).toEqual(["24,97"]);
    expect(vs[0].message).toMatch(/at the end of its/);

    // Shift the steps one block left and the fall is back in the middle of the face.
    fillTerrain(map, 21, 98, 3, 2, 3);
    stamp(map, 20, 98, ["555", "444"]);
    expect(violations(map, "W2")).toEqual([]);
  });

  it("ground in front of the face lower than the landing also breaks it", () => {
    // Plateau at 3 over ground at 1; a 3-wide fall at x 51..53 lands on 1.
    const map = fillTerrain(blankMap(), 50, 47, 5, 4, 3);
    stamp(map, 51, 47, ["3~3~3~", "3~3~3~", "3~3~3~", "3~3~3~"]);
    expect(violations(map, "W2")).toEqual([]);
    // Dig the ground in front of the west x down to 0: deeper than where the fall lands.
    stamp(map, 50, 51, ["0"]);
    expect(violations(map, "W2").map((v) => `${v.cells[0].x},${v.cells[0].y}`)).toEqual(["51,50"]);
  });

  it("a one-block ridge xwwwx falls both ways; a block in front of either face breaks it", () => {
    // Row 50 is a ridge at 3 over ground at 1, water across its middle: falls north and south.
    const ridge = () => stamp(blankMap(), 50, 50, ["33~3~3~3"]);
    expect(violations(ridge(), "W2")).toEqual([]);

    // A block in front of the south face (south of the west x): only the south face breaks.
    const south = stamp(ridge(), 50, 51, ["3"]);
    const vs = violations(south, "W2");
    expect(vs.map((v) => v.message)).toEqual([
      expect.stringMatching(/^water at terrain 51,50 \(h=3\) falls south at the end of its/),
    ]);

    // The same block on the north side ("behind" the south face) breaks the north face instead.
    const north = stamp(ridge(), 50, 49, ["3"]);
    expect(violations(north, "W2").map((v) => v.message)).toEqual([
      expect.stringMatching(/^water at terrain 51,50 \(h=3\) falls north at the end of its/),
    ]);
  });

  it("a pond with no lower neighbor is not a waterfall", () => {
    const map = stamp(plateau(), 51, 49, ["3~3~"]);
    expect(violations(map, "W2")).toEqual([]);
  });
});

describe("W4 water-corner-bank", () => {
  // Water at 6 whose east and south banks are 6 but whose diagonal corner is 4.
  it("rejects water that touches lower ground only at a corner", () => {
    const map = fillTerrain(blankMap(), 40, 40, 8, 8, 6);
    stamp(map, 42, 42, ["6~"]);
    stamp(map, 43, 43, ["4"]);
    const vs = violations(map, "W4");
    expect(vs).toHaveLength(1);
    expect(vs[0].message).toBe(
      "water at terrain 42,42 (h=6) touches lower ground only at its corner 43,43 (h=4)",
    );
    expect(vs[0].hint).toMatch(/raise terrain 43,43 to a bank at level 6/);
  });

  it("accepts the same water once the corner has a bank", () => {
    const map = fillTerrain(blankMap(), 40, 40, 8, 8, 6);
    stamp(map, 42, 42, ["6~"]);
    expect(violations(map, "W4")).toEqual([]);
  });

  it("allows the lower diagonals below a real waterfall", () => {
    // xwwx: the cells below the fall are lower, including the fall cells' diagonals.
    const map = fillTerrain(blankMap(), 50, 48, 4, 3, 3);
    stamp(map, 51, 50, ["3~3~"]);
    expect(violations(map, "W4")).toEqual([]);
    expect(violations(map, "W2")).toEqual([]);
  });
});

describe("T5 terrain-corner-shape", () => {
  const corner = (map: MapDoc, X: number, Y: number, shape: "cut" | "round" = "cut") => {
    setCornerAt(map, "terrainCorners", X, Y, shape);
    return map;
  };

  // A raised block whose south-east corner sits where the level below is
  // missing a block. The other corners can be cut; that one cannot.
  it("rejects a cliff corner over a gap, accepts the block's other corners", () => {
    const map = stamp(blankMap(), 41, 41, ["111", "121", "110"]);
    for (const [X, Y] of [
      [41, 41],
      [42, 41],
      [41, 42],
      [42, 42],
    ])
      corner(map, X, Y);
    const vs = violations(map, "T5");
    expect(vs).toHaveLength(1);
    expect(vs[0].message).toBe(
      "cut corner where terrain 42..43, 42..43 meet: cliff corner over a gap: block 42,42 " +
        "(level 2) has levels 1, 1, 0 around it, not one level",
    );
    expect(xy(vs[0].cells)).toEqual([
      [42, 42],
      [43, 42],
      [42, 43],
      [43, 43],
    ]);
  });

  it("accepts outer and inner corners of cliffs and ponds, and ignores flat ground", () => {
    const map = stamp(blankMap(), 50, 50, ["1~1~1~", "1~1~1~", "1~1~1"]);
    corner(map, 51, 51, "round"); // inner: three water blocks and one bank
    corner(map, 50, 50, "round"); // outer water corner? no: all four water, so it does nothing
    stamp(map, 60, 60, ["3"]);
    corner(map, 60, 60); // outer cliff corner of a lone block
    corner(map, 70, 70); // flat ground
    expect(violations(map, "T5")).toEqual([]);
  });

  it("rejects water on top of a cliff corner, and corners on locked terrain", () => {
    const map = stamp(blankMap(), 50, 50, ["2~"]);
    corner(map, 50, 50);
    // The town center's south-east block (98,98) is locked: its notch cannot be filled.
    stamp(map, 98, 98, [".2", "22"]);
    corner(map, 98, 98);
    const msgs = violations(map, "T5").map((v) => v.message);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatch(/water at the top of a cliff corner/);
    expect(msgs[1]).toMatch(/the corner's block 98,98 is locked terrain/);
  });
});

describe("P3 path-corner-shape", () => {
  const corner = (map: MapDoc, tx: number, ty: number, shape: "cut" | "round" = "round") => {
    setCornerAt(map, "pathCorners", tx, ty, shape);
    return map;
  };
  const path = (map: MapDoc, cells: [number, number][], type = "dirt") => {
    for (const [X, Y] of cells) setPathAt(map, X, Y, type);
    return map;
  };

  it("accepts a rounded corner of a 2x2 path", () => {
    const map = path(blankMap(), [
      [40, 40],
      [41, 40],
      [40, 41],
      [41, 41],
    ]);
    corner(map, 42, 42); // south-east corner of the 2x2
    expect(violations(map, "P3")).toEqual([]);
  });

  it("accepts one corner on each end cell of a 1x5 path, and both top corners of a 2x5", () => {
    const map = blankMap();
    for (let Y = 40; Y < 45; Y++) path(map, [[40, Y]]);
    corner(map, 40, 40); // north-west of 40,40
    corner(map, 41, 45); // south-east of 40,44
    for (let Y = 40; Y < 45; Y++)
      path(map, [
        [50, Y],
        [51, Y],
      ]);
    corner(map, 50, 40); // north-west of 50,40
    corner(map, 52, 40, "cut"); // north-east of 51,40
    expect(violations(map, "P3")).toEqual([]);
  });

  it("rejects both top corners of a 1x5 path", () => {
    const map = blankMap();
    for (let Y = 40; Y < 45; Y++) path(map, [[40, Y]]);
    corner(map, 40, 40); // north-west of 40,40
    corner(map, 41, 40); // north-east of 40,40
    expect(violations(map, "P3")[0].message).toMatch(/^major 40,40 has 2 shaped corners/);
  });

  it("rejects the inner corner of an L (paths have outer corners only)", () => {
    const map = path(blankMap(), [
      [50, 50],
      [51, 50],
      [50, 51],
    ]);
    corner(map, 51, 51); // the notch at 51,51
    expect(violations(map, "P3")[0].message).toMatch(
      /inner path corner \(the notch at major 51,51\)/,
    );
  });

  it("rejects a corner of a lone path cell", () => {
    const map = path(blankMap(), [[40, 40]]);
    path(map, [[41, 40]], "stone"); // a different type does not join it
    corner(map, 40, 40, "cut");
    expect(violations(map, "P3")[0].message).toMatch(/major 40,40 is a lone path cell/);
  });

  it("rejects a corner between two path types", () => {
    const map = path(blankMap(), [
      [40, 40],
      [41, 40],
      [40, 41],
    ]);
    path(map, [[41, 41]], "stone");
    corner(map, 41, 41);
    expect(violations(map, "P3")[0].message).toMatch(/between two path types \(stone, dirt\)/);
  });

  it("rejects two shaped corners on one cell", () => {
    const map = path(blankMap(), [
      [40, 40],
      [41, 40],
    ]);
    corner(map, 42, 40); // north-east of 41,40
    corner(map, 42, 41); // south-east of 41,40
    const [v] = violations(map, "P3");
    expect(v.message).toMatch(/^major 41,40 has 2 shaped corners/);
  });
});

describe("P1 path-on-major-only", () => {
  it("rejects beach, landmarks, and unknown types", () => {
    const map = blankMap();
    setPathAt(map, 5, 80, "dirt");
    setPathAt(map, 80, 80, "stone");
    setPathAt(map, 40, 40, "lava");
    setPathAt(map, 41, 40, "brick");
    const msgs = violations(map, "P1").map((v) => v.message);
    expect(msgs).toEqual([
      "1 path cell(s) on beach",
      "1 path cell(s) on landmark town-center",
      '1 path cell(s) unknown path type "lava" (not in the catalog)',
    ]);
  });

  it("a path key that is not a major cell cannot load", () => {
    const file = JSON.parse(serializeMap(blankMap(), game));
    file.layers.paths.cells = { abc: "dirt" };
    expect(() => deserializeMap(JSON.stringify(file), petitPlanet)).toThrow(/bad cell key "abc"/);
  });
});

describe("P2 path-on-flat-earth", () => {
  it("allows the middle of a 2x2 raised block", () => {
    const map = stamp(blankMap(), 60, 60, ["22", "22"]);
    setPathAt(map, 60, 60, "stone");
    expect(violations(map, "P2")).toEqual([]);
  });

  it("rejects every cell on top of the smallest 4-high mountain", () => {
    const map = stamp(blankMap(), 70, 70, ["222", "252", "222"]);
    for (const [X, Y] of [
      [70, 70],
      [71, 70],
      [70, 71],
      [71, 71],
    ])
      setPathAt(map, X, Y, "dirt");
    const [v] = violations(map, "P2");
    expect(v.message).toBe("4 path cell(s) on uneven ground");
  });

  it("rejects paths on water", () => {
    const map = stamp(blankMap(), 40, 40, ["1~"]);
    setPathAt(map, 40, 40, "dirt");
    expect(violations(map, "P2")[0].message).toBe("1 path cell(s) on water");
  });
});

describe("O1 known-type", () => {
  it("rejects wrong-kind or unknown types and bad rotations", () => {
    const map = blankMap();
    addPlants(map, plant("bench", 40, 40));
    addItems(map, item("tree", 100, 100), item("spaceship", 104, 100));
    addItems(map, { ...item("rock", 108, 100), rot: 45 as 0 });
    const msgs = violations(map, "O1").map((v) => v.message);
    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toMatch(/item type "bench"/);
    expect(msgs[2]).toMatch(/unknown type "spaceship"/);
    expect(msgs[3]).toMatch(/rotation 45/);
  });
});

describe("O2 unique-id", () => {
  it("rejects duplicate ids across plants and items", () => {
    const map = blankMap();
    addPlants(map, { id: "x1", type: "tree", X: 40, Y: 40 });
    addItems(map, { id: "x1", type: "rock", mx: 100, my: 100, rot: 0 });
    expect(violations(map, "O2")[0].message).toBe("id x1 is used by 2 objects");
  });
});

describe("L1 plant-major-snap", () => {
  it("rejects a plant between major cells", () => {
    const map = blankMap();
    addPlants(map, plant("tree", 40.5, 40));
    expect(violations(map, "L1")).toHaveLength(1);
  });

  it("accepts whole major cells", () => {
    const map = blankMap();
    addPlants(map, plant("tree", 40, 40));
    expect(violations(map)).toEqual([]);
  });
});

describe("L2 plant-not-on-beach", () => {
  it("rejects plants on beach and the town center", () => {
    const map = blankMap();
    addPlants(map, plant("tree", 5, 80), plant("bush", 80, 80));
    const msgs = violations(map, "L2").map((v) => v.message);
    expect(msgs[0]).toMatch(/on beach/);
    expect(msgs[1]).toMatch(/on landmark town-center/);
  });
});

describe("L3 plant-on-flat-earth", () => {
  it("rejects uneven ground and water", () => {
    const map = stamp(blankMap(), 41, 40, ["2"]);
    stamp(map, 51, 50, ["1~"]);
    addPlants(map, plant("tree", 40, 40), plant("tree", 50, 50));
    const msgs = violations(map, "L3").map((v) => v.message);
    expect(msgs[0]).toMatch(/uneven ground \(heights 1, 2\)/);
    expect(msgs[1]).toMatch(/water at terrain 51,50/);
  });
});

describe("L4 plant-on-path-allowed", () => {
  it("rejects a plant on a stone path", () => {
    const map = blankMap();
    setPathAt(map, 40, 40, "stone");
    addPlants(map, plant("flower", 40, 40));
    expect(violations(map, "L4")[0].message).toMatch(/stone path/);
  });

  it("allows a plant on a dirt path", () => {
    const map = blankMap();
    setPathAt(map, 40, 40, "dirt");
    addPlants(map, plant("flower", 40, 40));
    expect(violations(map)).toEqual([]);
  });
});

describe("L5 plant-no-overlap", () => {
  it("rejects plants on plants and items in a plant's cell", () => {
    const map = blankMap();
    addPlants(map, plant("tree", 40, 40), plant("bush", 40, 40), plant("tree", 50, 50));
    addItems(map, item("rock", 101, 101));
    const vs = violations(map, "L5");
    expect(vs).toHaveLength(2);
    expect(vs[1].cells).toEqual([{ grid: "minor", x: 101, y: 101 }]);
  });
});

describe("I1 item-in-bounds", () => {
  it("rejects items off the map, on beach, on landmarks, or between minor cells", () => {
    const map = blankMap();
    addItems(
      map,
      item("bench", 319, 200),
      item("rock", 10, 160),
      item("rock", 170, 170),
      item("rock", 100.5, 100),
    );
    const msgs = violations(map, "I1").map((v) => v.message);
    expect(msgs).toHaveLength(4);
    expect(msgs[1]).toMatch(/on beach/);
    expect(msgs[2]).toMatch(/landmark town-center/);
  });
});

describe("I2 item-on-flat-earth", () => {
  it("rejects an item spanning two heights or on water", () => {
    const map = stamp(blankMap(), 51, 50, ["2"]);
    stamp(map, 60, 60, ["1~"]);
    addItems(map, item("bench", 100, 100), item("rock", 119, 119));
    const msgs = violations(map, "I2").map((v) => v.message);
    expect(msgs[0]).toMatch(/uneven/);
    expect(msgs[1]).toMatch(/water/);
  });

  it("boats may sit on water at one level, or on dry ground, but not across the shore", () => {
    const map = fillTerrain(blankMap(), 60, 60, 6, 3, 1, true);
    // boat is 2x1 tiles = 4x2 minor; minor 121..124 x 121..122 = terrain 61..62 x 61.
    addItems(map, item("boat", 121, 121), item("boat", 141, 121));
    expect(violations(map, "I2")).toEqual([]);
    addItems(map, item("boat", 129, 121)); // terrain 65..66: 65 water, 66 dry
    const [v] = violations(map, "I2");
    expect(v.message).toMatch(/boats need all dry ground or all water/);
  });

  it("an odd-aligned bench sits exactly on the terrain blocks it covers", () => {
    // minor x 101..104, y 101..102 = terrain blocks 51..52 x 51, raised together.
    const map = stamp(blankMap(), 51, 51, ["22"]);
    addItems(map, item("bench", 101, 101));
    expect(violations(map, "I2")).toEqual([]);
  });

  it("rejects an item standing on a cut corner of its block", () => {
    // A rock on exactly terrain block 42,42 (minor 83..84), raised alone; its south-east corner
    // (minor cell 84,84) is cut down to the ground around it.
    const map = stamp(blankMap(), 42, 42, ["2"]);
    addItems(map, item("rock", 83, 83));
    expect(violations(map, "I2")).toEqual([]);
    setCornerAt(map, "terrainCorners", 42, 42, "cut");
    expect(violations(map, "I2")[0].message).toMatch(/is on a cut cliff corner of terrain 42,42/);
  });
});

describe("I3 item-no-overlap", () => {
  it("rejects items on items, including bridge on bridge", () => {
    const map = blankMap();
    addItems(map, item("bench", 100, 100), item("rock", 101, 100));
    addItems(map, item("bridge-1x4", 121, 121), item("bridge-1x4", 121, 123));
    const vs = violations(map, "I3");
    expect(vs.map((v) => v.message)).toEqual([
      expect.stringMatching(/bench i\d+ overlaps rock/),
      expect.stringMatching(/bridge-1x4 i\d+ overlaps bridge-1x4 i\d+ on 12 minor/),
    ]);
  });
});

describe("I4 bridge-span", () => {
  // E-W river 4 blocks wide (ty 60..63) at level 1, cliffs at level 2 (ty 55..59, 64..68). A bridge
  // at minor x 100 covers terrain columns 50..51. Terrain block t covers minor 2t-1..2t, so the
  // half of cliff block 59 along the edge is minor row 118.
  const river = () => {
    const map = fillTerrain(blankMap(), 40, 55, 31, 14, 2);
    return fillTerrain(map, 40, 60, 31, 4, 1, true);
  };
  /** The river narrowed to `gap` blocks (ty 60..60+gap-1) by raising its south side. */
  const narrow = (gap: number) => fillTerrain(river(), 40, 60 + gap, 31, 4 - gap, 2);

  it("accepts a 1x5 bridge over a 4-block river, resting half a block on each cliff edge", () => {
    const map = river();
    addItems(map, item("bridge-1x5", 100, 118));
    expect(violations(map, "I4")).toEqual([]);
  });

  it("accepts a 1x4 over a 3-block gap and a 1x7 over a 6-block gap", () => {
    const three = narrow(3);
    addItems(three, item("bridge-1x4", 100, 118));
    expect(violations(three, "I4")).toEqual([]);
    const six = fillTerrain(fillTerrain(blankMap(), 40, 50, 31, 20, 2), 40, 55, 31, 6, 1, true);
    addItems(six, item("bridge-1x7", 100, 108));
    expect(violations(six, "I4")).toEqual([]);
  });

  it("accepts a 1x4 resting a whole block on each cliff over a 2-block gap", () => {
    const map = narrow(2);
    addItems(map, item("bridge-1x4", 100, 117));
    expect(violations(map, "I4")).toEqual([]);
  });

  it("rejects a longer bridge resting a whole block on each cliff", () => {
    const map = narrow(3);
    addItems(map, item("bridge-1x5", 100, 117));
    const [v] = violations(map, "I4");
    expect(v.message).toMatch(/only a 4-tile bridge can, over a 2-block gap/);
    expect(v.hint).toMatch(/shift by one minor cell \(y=116 or y=118\)/);
  });

  it("accepts a rotated bridge over a N-S river", () => {
    const map = fillTerrain(blankMap(), 55, 40, 14, 31, 2);
    fillTerrain(map, 60, 40, 4, 31, 1, true);
    addItems(map, item("bridge-2x5", 118, 100, 90));
    expect(violations(map, "I4")).toEqual([]);
  });

  it("rejects a bridge on flat earth", () => {
    const map = blankMap();
    addItems(map, item("bridge-1x4", 100, 118));
    expect(violations(map, "I4")[0].message).toMatch(/not water or lower than its cliffs \(h=1\)/);
  });

  it("rejects a bridge longer than the gap", () => {
    const map = river();
    addItems(map, item("bridge-1x6", 100, 116));
    const [v] = violations(map, "I4");
    expect(v.message).toMatch(/gap is shorter than the bridge/);
    expect(v.cells).toHaveLength(2);
  });

  it("rejects a bridge shorter than the gap", () => {
    const map = fillTerrain(river(), 40, 64, 31, 1, 1, true);
    addItems(map, item("bridge-1x5", 100, 118));
    expect(violations(map, "I4")[0].message).toMatch(/an end block is water/);
  });

  it("rejects a length beyond the params' max", () => {
    const map = river();
    addItems(map, item("bridge-1x5", 100, 118));
    const msg = violations(map, "I4", { bridge: { minLength: 4, maxLength: 4 } })[0].message;
    expect(msg).toMatch(/5 tiles long; bridges are 4..4 tiles/);
  });

  it("rejects a length below the params' min, which also moves the whole-block exception", () => {
    const map = narrow(3);
    addItems(map, item("bridge-1x4", 100, 118));
    const msg = violations(map, "I4", { bridge: { minLength: 5, maxLength: 7 } })[0].message;
    expect(msg).toMatch(/4 tiles long; bridges are 5..7 tiles/);
  });

  it("allows longer bridges when the params do", () => {
    const map = fillTerrain(fillTerrain(blankMap(), 40, 50, 31, 20, 2), 40, 55, 31, 6, 1, true);
    addItems(map, item("bridge-1x7", 100, 108));
    expect(violations(map, "I4", { bridge: { minLength: 4, maxLength: 6 } })).toHaveLength(1);
    expect(violations(map, "I4", { bridge: { minLength: 4, maxLength: 7 } })).toEqual([]);
  });
});

describe("I5 nothing-under-bridge", () => {
  it("rejects plants and items in the major cells under a bridge, allows paths", () => {
    const map = river();
    // Covers minor y 118..127: major x 50, y 59..63, ends on the cliff edges.
    addItems(map, item("bridge-1x5", 100, 118));
    setPathAt(map, 50, 59, "stone");
    // A rock on the north cliff edge, under the bridge's end.
    addItems(map, item("rock", 100, 118));
    addPlants(map, plant("bush", 51, 61), plant("bush", 50, 61));
    const vs = violations(map, "I5");
    expect(vs).toHaveLength(2);
    expect(vs.map((v) => v.message)).toEqual([
      expect.stringMatching(/^bush p\d+ is under bridge-1x5/),
      expect.stringMatching(/^rock i\d+ is under bridge-1x5/),
    ]);
    expect(violations(map, "I3")).toEqual([]);
    expect(violations(map, "L5")).toEqual([]);
  });

  function river() {
    const map = fillTerrain(blankMap(), 40, 55, 31, 14, 2);
    return fillTerrain(map, 40, 60, 31, 4, 1, true);
  }
});

// A 5x4-tile house (a building, in the test catalog); at mx 80, my 80 it covers major 40..44 x
// 40..43 and its front (south at rotation 0) is major row 44, terrain rows 44..45.
function withHouse(rot: 0 | 90 | 180 | 270 = 0) {
  const map = blankMap();
  addItems(map, { id: "h1", type: "house", mx: 80, my: 80, rot });
  return map;
}

describe("I6 incline-on-cliff-edge", () => {
  // A cliff at level 2 to the north (ty 50..59) above flat ground at level 1 (ty 60 on). Terrain
  // block 59's half along the edge is minor row 118; an incline facing north (rotation 0) at minor
  // y 118 covers 118..121: the edge row, then blocks 60 and 61 below.
  const cliffNorth = () => fillTerrain(blankMap(), 40, 50, 31, 10, 2);

  it("accepts inclines climbing one level onto a straight cliff edge, 1 and 2 tiles wide", () => {
    const map = cliffNorth();
    addItems(map, item("incline-1x2", 100, 118), item("incline-2x2", 110, 118));
    expect(violations(map, "I6")).toEqual([]);
    expect(violations(map, "I2")).toEqual([]);
  });

  it("follows rotation: south, east and west facing high ends", () => {
    const south = fillTerrain(blankMap(), 40, 60, 31, 10, 2); // cliff from ty 60
    addItems(south, item("incline-1x2", 100, 116, 180)); // high end row 119 = block 60's edge
    expect(violations(south, "I6")).toEqual([]);
    const east = fillTerrain(blankMap(), 60, 40, 10, 31, 2); // cliff from tx 60
    addItems(east, item("incline-1x2", 116, 100, 90));
    expect(violations(east, "I6")).toEqual([]);
    const west = fillTerrain(blankMap(), 50, 40, 10, 31, 2); // cliff up to tx 59
    addItems(west, item("incline-1x2", 118, 100, 270));
    expect(violations(west, "I6")).toEqual([]);
  });

  it("rejects a high end that is not on the half block along the edge, with a shift hint", () => {
    const map = cliffNorth();
    addItems(map, item("incline-1x2", 100, 117));
    const [v] = violations(map, "I6");
    expect(v.message).toMatch(/high end must sit on the half block along a cliff edge/);
    expect(v.hint).toMatch(/y=116 or y=118/);
  });

  it("rejects an incline facing away from the cliff", () => {
    const map = cliffNorth();
    addItems(map, item("incline-1x2", 100, 116, 180));
    expect(violations(map, "I6")[0].message).toMatch(/straight cliff edge exactly 1 level/);
  });

  it("rejects a cliff two levels high, unless the params allow it", () => {
    const map = fillTerrain(blankMap(), 40, 50, 31, 10, 3);
    addItems(map, item("incline-1x2", 100, 118));
    expect(violations(map, "I6")[0].message).toMatch(/exactly 1 level/);
    expect(violations(map, "I6", { inclineRise: 2 })).toEqual([]);
  });

  it("rejects a corner: the cliff must run along the incline's whole width", () => {
    const map = fillTerrain(blankMap(), 40, 50, 16, 10, 2); // cliff ends at tx 55
    addItems(map, item("incline-2x2", 108, 118)); // across tx 54..56
    const [v] = violations(map, "I6");
    expect(v.message).toMatch(/part of it is not \(a corner\?\)/);
  });

  it("rejects water or uneven ground at the foot", () => {
    const wet = fillTerrain(cliffNorth(), 50, 61, 2, 1, 1, true);
    addItems(wet, item("incline-1x2", 100, 118));
    expect(violations(wet, "I6")[0].message).toMatch(/water or off the map/);
    const uneven = fillTerrain(cliffNorth(), 50, 61, 2, 1, 0);
    addItems(uneven, item("incline-1x2", 100, 118));
    expect(violations(uneven, "I6")[0].message).toMatch(/not flat/);
  });

  it("lets a path run underneath, but not plants", () => {
    const map = cliffNorth();
    addItems(map, item("incline-1x2", 100, 118));
    setPathAt(map, 50, 60, "stone");
    addPlants(map, plant("bush", 50, 60));
    expect(violations(map, "I6")).toEqual([]);
    expect(violations(map, "P2")).toEqual([]);
    expect(violations(map, "L5").map((v) => v.message)).toEqual([
      expect.stringMatching(/bush p\d+ .*incline-1x2/),
    ]);
  });
});

describe("B1 building-front-clear", () => {
  it("accepts a house with flat, dry ground in front", () => {
    expect(violations(withHouse())).toEqual([]);
  });

  it("rejects water in front of the door (a river bank)", () => {
    const map = fillTerrain(withHouse(), 40, 45, 6, 1, 1, true);
    const [v] = violations(map, "B1");
    expect(v.message).toBe("the south front of house h1 (level 1) is blocked by water");
    expect(v.cells.map((c) => `${c.x},${c.y}`)).toEqual([
      "40,44",
      "41,44",
      "42,44",
      "43,44",
      "44,44",
    ]);
  });

  it("rejects a cliff or a drop in front", () => {
    const cliff = fillTerrain(withHouse(), 40, 45, 6, 1, 3);
    expect(violations(cliff, "B1")[0].message).toMatch(/blocked by a cliff up to level 3$/);
    const drop = fillTerrain(withHouse(), 40, 45, 6, 1, 0);
    expect(violations(drop, "B1")[0].message).toMatch(/blocked by a drop to level 0$/);
  });

  it("follows rotation: at 180 the front faces north", () => {
    const south = fillTerrain(withHouse(180), 40, 45, 6, 1, 1, true);
    expect(violations(south, "B1")).toEqual([]);
    const north = fillTerrain(withHouse(180), 40, 39, 6, 1, 1, true);
    expect(violations(north, "B1")[0].message).toMatch(/^the north front of house h1/);
  });
});

describe("L6 tree-spacing", () => {
  it("rejects trees in the 8 cells around another tree, once per pair", () => {
    const map = blankMap();
    addPlants(
      map,
      { id: "t1", type: "tree", X: 40, Y: 40 },
      { id: "t2", type: "fir-tree", X: 41, Y: 41 },
      { id: "t3", type: "plum-tree", X: 44, Y: 40 },
      { id: "b1", type: "bush", X: 45, Y: 40 },
    );
    const vs = violations(map, "L6");
    expect(vs.map((v) => v.message)).toEqual([
      "tree t1 is next to fir-tree t2; trees need a free cell between them",
    ]);
  });

  it("rejects a tree touching a building", () => {
    const map = withHouse();
    addPlants(
      map,
      { id: "t1", type: "tree", X: 45, Y: 41 },
      { id: "t2", type: "tree", X: 46, Y: 43 },
    );
    const vs = violations(map, "L6");
    expect(vs.map((v) => v.message)).toEqual([
      "tree t1 touches house h1; trees need a free cell around buildings",
    ]);
  });
});
