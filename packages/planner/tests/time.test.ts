// The time of day's maths: stops evenly spaced on the track with hours blended between them,
// snapping near a stop, the keys, what screen readers hear, and the sky dome's colour.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  clockText,
  hourAfterKey,
  hourAt,
  mixColor,
  nearestStop,
  nightAt,
  positionOf,
  skyAt,
  snapHour,
  timeStopsFor,
  timeText,
  type TimeStop,
} from "../src/time";

const STOPS: TimeStop[] = [
  { label: "Early", hour: 7, sky: "#000000" },
  { label: "Noon", hour: 12, sky: "#ffffff" },
  { label: "Late", hour: 16.5, sky: "#ff0000" },
  { label: "Dark", hour: 21, sky: "#0000ff" },
];

describe("the track", () => {
  it("puts the stops evenly along it, and blends the hours between them", () => {
    expect(hourAt(STOPS, 0)).toBe(7);
    expect(hourAt(STOPS, 1)).toBe(12);
    expect(hourAt(STOPS, 1.5)).toBe(14.25);
    expect(hourAt(STOPS, 3)).toBe(21);
    expect(hourAt(STOPS, -1)).toBe(7);
    expect(hourAt(STOPS, 9)).toBe(21);
  });

  it("finds an hour's place again", () => {
    expect(positionOf(STOPS, 14.25)).toBeCloseTo(1.5);
    expect(positionOf(STOPS, 5)).toBe(0);
    expect(positionOf(STOPS, 23)).toBe(3);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 3, noNaN: true }), (p) => {
        expect(positionOf(STOPS, hourAt(STOPS, p))).toBeCloseTo(p, 9);
      }),
    );
  });
});

describe("snapping", () => {
  it("pulls an hour within 0.75 hours of a stop onto it, and leaves others alone", () => {
    expect(snapHour(STOPS, 12.7)).toBe(12);
    expect(snapHour(STOPS, 15.8)).toBe(16.5);
    expect(snapHour(STOPS, 14)).toBe(14);
    expect(nearestStop(STOPS, 18).label).toBe("Late");
  });
});

describe("keys", () => {
  it("move 15 minutes with the arrows, staying between the ends", () => {
    expect(hourAfterKey(STOPS, 12, "ArrowRight")).toBe(12.25);
    expect(hourAfterKey(STOPS, 12, "ArrowDown")).toBe(11.75);
    expect(hourAfterKey(STOPS, 21, "ArrowUp")).toBe(21);
    expect(hourAfterKey(STOPS, 7, "ArrowLeft")).toBe(7);
  });

  it("jump to the next or previous stop with Page Up and Page Down, and to the ends", () => {
    expect(hourAfterKey(STOPS, 12, "PageUp")).toBe(16.5);
    expect(hourAfterKey(STOPS, 13, "PageDown")).toBe(12);
    expect(hourAfterKey(STOPS, 12, "PageDown")).toBe(7);
    expect(hourAfterKey(STOPS, 21, "PageUp")).toBe(21);
    expect(hourAfterKey(STOPS, 7, "PageDown")).toBe(7);
    expect(hourAfterKey(STOPS, 12, "Home")).toBe(7);
    expect(hourAfterKey(STOPS, 12, "End")).toBe(21);
    expect(hourAfterKey(STOPS, 12, "a")).toBeNull();
  });
});

describe("what screen readers hear", () => {
  it("is the nearest stop's name and a 12-hour clock", () => {
    expect(timeText(STOPS, 16.5)).toBe("Late, 4:30 PM");
    expect(clockText(7)).toBe("7:00 AM");
    expect(clockText(12)).toBe("12:00 PM");
    expect(clockText(0)).toBe("12:00 AM");
    expect(clockText(21.25)).toBe("9:15 PM");
  });
});

describe("the sky", () => {
  it("is each stop's colour at the stop, blended between", () => {
    expect(skyAt(STOPS, 0)).toBe("#000000");
    expect(skyAt(STOPS, 0.5)).toBe("#808080");
    expect(skyAt(STOPS, 3)).toBe("#0000ff");
    expect(mixColor("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("turns to night only between the last two stops", () => {
    expect(nightAt(STOPS, 1.9)).toBe(0);
    expect(nightAt(STOPS, 2.5)).toBe(0.5);
    expect(nightAt(STOPS, 3)).toBe(1);
  });
});

describe("timeStopsFor", () => {
  it("joins the look's hours with the game's names, in the look's order", () => {
    const look = [
      { name: "first", hour: 6 },
      { name: "second", hour: 13 },
      { name: "unnamed", hour: 18 },
    ];
    const names = [
      { preset: "second", label: "Noon", sky: "#ffffff" },
      { preset: "first", label: "Early", sky: "#000000" },
      { preset: "missing", label: "Gone", sky: "#123456" },
    ];
    expect(timeStopsFor(look, names)).toEqual([
      { label: "Early", hour: 6, sky: "#000000" },
      { label: "Noon", hour: 13, sky: "#ffffff" },
    ]);
  });
});
