// Petit Planet's own icons, each with its id and file name: the list of drawings to redraw by hand.
// Saving over a file in packages/games/petit-planet/ui/theme/icons/ updates it everywhere.

import { petitPlanetIcons, petitPlanetTheme } from "@glade/petit-planet-ui";
import { Icon, ThemeRoot } from "@glade/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

/** "layer-paths" → "LayerPaths.svg". */
const fileOf = (id: string) =>
  id.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase()) + ".svg";

function Gallery(props: { mode: "light" | "dark" }) {
  return (
    <ThemeRoot theme={petitPlanetTheme} mode={props.mode} icons={petitPlanetIcons}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 12,
          padding: 16,
          background: "var(--paper)",
          color: "var(--ink)",
        }}
      >
        {Object.keys(petitPlanetIcons).map((id) => (
          <figure
            key={id}
            style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", minHeight: 48 }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 48,
                height: 48,
                borderRadius: 999,
                background: id.startsWith("mode-") ? "var(--selected)" : "var(--inset)",
              }}
            >
              <Icon id={id} size={28} />
            </span>
            <figcaption style={{ fontSize: 13, lineHeight: "16px" }}>
              {id}
              <br />
              <span style={{ color: "var(--ink-muted)" }}>{fileOf(id)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </ThemeRoot>
  );
}

const meta = {
  title: "Petit Planet/Icons",
  component: Gallery,
  args: { mode: "light" },
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  play: async ({ canvasElement }) => {
    const figures = canvasElement.querySelectorAll("figure");
    await expect(figures.length).toBe(Object.keys(petitPlanetIcons).length);
    for (const f of figures) await expect(f.querySelector("svg")).not.toBeNull();
  },
};

export const Dark: Story = { args: { mode: "dark" } };
