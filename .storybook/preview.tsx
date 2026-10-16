// Every story inside a theme root, with toolbar switches for the theme (Glade, or a game's) and
// light or dark. Accessibility checks (axe) fail a story's test, not just warn.

import { ThemeRoot } from "@glade/ui";
import type { Decorator, Preview } from "@storybook/react-vite";
import { THEMES } from "./themes";

const withTheme: Decorator = (Story, context) => {
  const chosen = THEMES[String(context.globals.theme)] ?? THEMES.glade;
  const mode = context.globals.mode === "dark" ? "dark" : "light";
  return (
    <ThemeRoot theme={chosen.theme} mode={mode} icons={chosen.icons}>
      <div style={{ padding: 24, minHeight: 200, background: "var(--ground)" }}>
        <Story />
      </div>
    </ThemeRoot>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: { icon: "paintbrush", items: Object.keys(THEMES), dynamicTitle: true },
    },
    mode: {
      description: "Light or dark",
      toolbar: { icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "glade", mode: "light" },
  parameters: {
    a11y: { test: "error" },
    layout: "fullscreen",
  },
};

export default preview;
