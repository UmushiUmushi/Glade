// The FPS meter (a reading once a second), which views a map has, and the look for a moment.

import { describe, expect, it } from "vitest";
import { createFpsMeter } from "../src/fps";
import { lookAt, seasons, startEnvironment, timeStops } from "../src/environment";
import { startView, viewsOf } from "../src/views";
import { fakeMap } from "./fakes";

describe("FPS meter", () => {
  it("reports frames per second once each second", () => {
    const meter = createFpsMeter();
    const readings: (number | null)[] = [];
    for (let i = 0; i <= 120; i++) readings.push(meter.frame(i * (1000 / 60)));
    const reported = readings.filter((r) => r !== null);
    expect(reported).toEqual([60, 60]);
  });

  it("reports a slow frame rate as it is", () => {
    const meter = createFpsMeter();
    meter.frame(0);
    let fps: number | null = null;
    for (let t = 100; t <= 1000; t += 100) fps = meter.frame(t) ?? fps;
    expect(fps).toBe(10);
  });
});

describe("views", () => {
  it("lists the views a map has, and opens in 3D when it has one", () => {
    expect(viewsOf(fakeMap({ plan: true, scene: true }))).toEqual(["2d", "3d"]);
    expect(viewsOf(fakeMap({ plan: true, scene: false }))).toEqual(["2d"]);
    expect(startView(fakeMap({ plan: true, scene: true }))).toBe("3d");
    expect(startView(fakeMap({ plan: true, scene: false }))).toBe("2d");
  });
});

describe("environment", () => {
  it("starts at the style's default time and season, and lists its stops", () => {
    const map = fakeMap({ plan: true, scene: true });
    expect(timeStops(map).map((s) => s.name)).toEqual(["morning", "midday", "night"]);
    expect(seasons(map)).toEqual(["spring", "winter"]);
    expect(startEnvironment(map)).toEqual({ hour: 12, season: "spring" });
  });

  it("asks the map's style for the look at a moment", () => {
    const look = lookAt(fakeMap({ plan: true, scene: true }), { hour: 21, season: "winter" });
    expect(look.preset).toBe("night");
    expect(look.season).toBe("winter");
  });
});
