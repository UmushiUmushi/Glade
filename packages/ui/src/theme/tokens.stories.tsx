// The theme's tokens on one page: every colour as a swatch with its token name, and the type. Pick
// a theme and light or dark in the toolbar to compare. The play step checks every colour token is
// set on the theme root.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { gladeTheme } from "./glade";
import { cssName } from "./tokens";

const COLORS = Object.keys(gladeTheme.light);

function Tokens() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-title)", color: "var(--ink-title)" }}>
        Theme tokens
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        {COLORS.map((token) => (
          <div key={token} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              data-token={token}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `var(${cssName(token)})`,
                boxShadow: "inset 0 0 0 1px var(--line)",
              }}
            />
            <code style={{ fontSize: 13, color: "var(--ink)" }}>{cssName(token)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

const meta = { title: "Glade/Theme/Tokens", component: Tokens } satisfies Meta<typeof Tokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colours: Story = {
  play: async ({ canvasElement }) => {
    const root = canvasElement.closest(".glade-root") ?? canvasElement.querySelector(".glade-root");
    const style = root ? getComputedStyle(root) : null;
    for (const token of COLORS) {
      await expect(style?.getPropertyValue(cssName(token)).trim(), token).not.toBe("");
    }
  },
};

export const ColoursDark: Story = { ...Colours, globals: { mode: "dark" } };
