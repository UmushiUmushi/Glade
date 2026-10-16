// Format migrations: steps run in order from a file's format to the current one, a file with no
// format is refused, and a file from a newer Glade is refused rather than guessed at.

import { describe, expect, it } from "vitest";
import { MIGRATIONS, currentFormat, migrateFile, type MigrationStep } from "../src/migrate";

/** Made-up history: format 1 had `title`, 2 renamed it `name`, 3 added `tags`. */
const steps: MigrationStep[] = [
  ({ title, ...rest }) => ({ ...rest, name: title }),
  (file) => ({ ...file, tags: [] }),
];

describe("migrateFile", () => {
  it("every file kind is at format 1, with no steps yet", () => {
    for (const kind of ["map", "pack", "fragment"] as const) {
      expect(MIGRATIONS[kind]).toEqual([]);
      expect(currentFormat(kind)).toBe(1);
    }
  });

  it("runs every step from the file's format, in order", () => {
    expect(migrateFile("map", { format: 1, title: "Main" }, steps)).toEqual({
      ok: true,
      value: { format: 3, name: "Main", tags: [] },
    });
    expect(migrateFile("map", { format: 2, name: "Main" }, steps)).toEqual({
      ok: true,
      value: { format: 3, name: "Main", tags: [] },
    });
  });

  it("leaves a current file as it is", () => {
    const file = { format: 3, name: "Main", tags: [] };
    expect(migrateFile("map", file, steps)).toEqual({ ok: true, value: file });
  });

  it("refuses a file with no format, or a format that isn't a whole number from 1", () => {
    for (const format of [undefined, "1", 0, 1.5]) {
      const result = migrateFile("map", { format }, steps);
      expect(!result.ok && result.error.code, String(format)).toBe("GLD-FILE-001");
    }
  });

  it("refuses a file from a newer Glade", () => {
    const result = migrateFile("map", { format: 4 }, steps);
    expect(!result.ok && result.error).toMatchObject({
      code: "GLD-FILE-003",
      detail: { format: 4 },
    });
  });
});
