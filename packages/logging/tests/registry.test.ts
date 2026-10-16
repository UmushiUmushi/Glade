// The event registry: well-formed events are accepted, and names or fields that could carry
// personal or creative content are refused when the event is declared.

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { appEvents } from "../src/events/app";
import { defineEvents, eventProblem, fieldWords } from "../src/registry";

describe("defineEvents", () => {
  it("accepts dotted lower-case events with structural fields", () => {
    const events = defineEvents({
      "tool.changed": { severity: "INFO", fields: { tool: z.enum(["pick", "lasso"]) } },
      "planner.action.committed": {
        severity: "INFO",
        fields: { cells: z.number(), ms: z.number() },
      },
    });
    expect(Object.keys(events)).toEqual(["tool.changed", "planner.action.committed"]);
  });

  it("refuses badly named events", () => {
    for (const name of ["Tool.Changed", "tool", "tool changed", ".tool", "tool."]) {
      expect(() => defineEvents({ [name]: { severity: "INFO", fields: {} } }), name).toThrow();
    }
  });

  it("refuses fields that name content, people or places", () => {
    for (const field of ["mapName", "userId", "x", "itemColor", "note", "draft_id", "shareURL"]) {
      expect(eventProblem("a.b", { severity: "INFO", fields: { [field]: z.string() } })).toMatch(
        /never logged/,
      );
    }
  });

  it("allows fields whose words are structure", () => {
    for (const field of ["cells", "ops", "mode", "rules", "ms", "screen", "browserVersion"]) {
      expect(eventProblem("a.b", { severity: "INFO", fields: { [field]: z.number() } })).toBeNull();
    }
  });

  it("the app's own events pass", () => {
    for (const [event, spec] of Object.entries(appEvents))
      expect(eventProblem(event, spec)).toBeNull();
  });
});

describe("fieldWords", () => {
  it("splits camelCase, snake_case and kebab-case", () => {
    expect(fieldWords("mapName")).toEqual(["map", "name"]);
    expect(fieldWords("draft_id")).toEqual(["draft", "id"]);
    expect(fieldWords("gpu-tier")).toEqual(["gpu", "tier"]);
    expect(fieldWords("shareURL")).toEqual(["share", "url"]);
  });
});
