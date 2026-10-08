import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

// Imports go one way (docs/architecture.md): apps use packages, games build on the shared
// packages, and a game's profile builds on nothing of the game's but itself.

const noApps = {
  group: ["**/apps/**", "@glade/web", "@glade/server"],
  message: "packages never import apps",
};

/** Shared packages never import a game (tests/boundaries.test.ts also greps them for game words). */
const gameFree = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        noApps,
        {
          group: ["**/games", "**/games/**", "@glade/*-profile", "@glade/*-profile/**"],
          message: "shared packages must not import games",
        },
      ],
    },
  ],
};

/** A profile describes its game and nothing else: no catalog, no UI, no editing, no app. */
const profileOnly = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        noApps,
        {
          group: ["@glade/*-catalog", "@glade/*-ui", "@glade/*-edit"],
          message: "a profile must not import its game's catalog, ui or edit packages",
        },
      ],
    },
  ],
};

export default tseslint.config(
  { ignores: ["**/node_modules", "**/dist", "packages/games/*/references"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ["packages/**/*.ts"],
    ignores: ["packages/games/**", "packages/testkit/**"],
    rules: gameFree,
  },
  {
    files: ["packages/games/*/profile/**/*.ts"],
    rules: profileOnly,
  },
);
