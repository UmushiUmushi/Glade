import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "{apps,packages}/**/*.test.ts"],
    exclude: ["**/node_modules/**", "packages/games/*/references/**"],
  },
});
