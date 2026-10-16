// ESLint for the whole repo: the import rules from docs/architecture.md and the code style from
// docs/engineering/code-style.md. Prettier owns formatting; tests/ guards what lint cannot see.

import js from "@eslint/js";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
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

/**
 * A game's ui package is data and plain functions, never React: the shared screens draw every game
 * with the same components. It may use @glade/ui's types (Theme, GameIcons), not its components.
 */
const uiDataOnly = {
  "@typescript-eslint/no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "@glade/ui", allowTypeImports: true, message: "a game's ui imports only types" },
        ...["react", "react-dom", "react-aria-components", "lucide-react"].map((name) => ({
          name,
          message: "a game's ui package is data, never React",
        })),
      ],
      patterns: [
        noApps,
        {
          group: ["@glade/*-catalog", "@glade/*-edit", "@glade/*-builder"],
          message: "a game's ui never imports its catalog, edit or builder",
        },
      ],
    },
  ],
};

// Code style (docs/engineering/code-style.md), one block per rule.

/** Rule 3 and the lint list: a promise is awaited or handled, never dropped. */
const promises = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": "error",
};

/** Rule 9: named exports only, so search and rename work. Tool config files are the exception. */
const namedExports = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "ExportDefaultDeclaration",
      message: "Use a named export (docs/engineering/code-style.md, rule 9).",
    },
  ],
};

/** Rule 10: no `!` unless a disable comment says why (`-- reason`). Tests may assert freely. */
const nonNull = {
  "@typescript-eslint/no-non-null-assertion": "error",
};

/** Rule 12: short functions. A warning, since the fix is to split by step, not by size. */
const shortFunctions = {
  "max-lines-per-function": [
    "warn",
    { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
};

/** Every disable comment says why (`-- reason`). Stale ones fail through linterOptions below. */
const disableComments = {
  "@eslint-community/eslint-comments/require-description": ["error", { ignore: [] }],
};

const SOURCE = ["{apps,packages}/**/src/**/*.{ts,tsx}"];
const TESTS = ["**/*.test.{ts,tsx}", "**/tests/**", "**/samples/**", "packages/testkit/**"];
/** Files whose tools need a default export: config files, and stories (their meta). */
const CONFIGS = ["*.config.{js,ts}", "**/*.config.{js,ts}", ".storybook/**", "**/*.stories.tsx"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/coverage",
      "storybook-static",
      "packages/games/*/references",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  comments.recommended,
  reactHooks.configs.flat["recommended-latest"],
  prettier,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      ...promises,
      ...namedExports,
      ...disableComments,
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: CONFIGS,
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: SOURCE,
    ignores: TESTS,
    rules: { ...nonNull, ...shortFunctions },
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
  {
    files: ["packages/games/*/ui/src/**/*.ts"],
    rules: uiDataOnly,
  },
);
