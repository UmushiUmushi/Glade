// Storybook for every package's components: stories sit next to the code (*.stories.tsx). It
// lives at the repo root so the theme switcher can show every game's look; packages stay game-free.
// Pages about one game's look (its icons, the controls in its theme) live in ./stories.

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    // Shared packages and apps only: game packages have no React (and a game package's
    // node_modules links back to the shared ones, which would list every story twice).
    "../packages/*/src/**/*.stories.@(ts|tsx)",
    "../apps/*/src/**/*.stories.@(ts|tsx)",
    "./stories/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
};

export default config;
