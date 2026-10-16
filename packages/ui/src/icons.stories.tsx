// Icon stories: every icon in the shared set with its id, for picking and for reference, and a
// game's own drawing replacing a shared icon. Play steps check both.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Icon, IconProvider, SHARED_ICONS } from "./icons";

function Gallery() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 12,
        color: "var(--ink)",
      }}
    >
      {Object.keys(SHARED_ICONS).map((id) => (
        <figure key={id} style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <Icon id={id} size={24} />
          <figcaption style={{ fontSize: 13 }}>{id}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const meta = { title: "Theme/Icons", component: Gallery } satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SharedSet: Story = {
  play: async ({ canvasElement }) => {
    const figures = canvasElement.querySelectorAll("figure");
    await expect(figures.length).toBe(Object.keys(SHARED_ICONS).length);
    await expect(canvasElement.querySelectorAll("figure svg").length).toBe(figures.length);
  },
};

const SQUARE =
  '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="#e39aac"/></svg>';

export const GameDrawing: Story = {
  render: () => (
    <IconProvider icons={{ grab: SQUARE }}>
      <span data-testid="game">
        <Icon id="grab" size={48} />
      </span>
      <span data-testid="shared">
        <Icon id="pointer" size={48} />
      </span>
      <span data-testid="unknown">
        <Icon id="no-such-icon" />
      </span>
    </IconProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("game").querySelector("rect")).not.toBeNull();
    await expect(canvas.getByTestId("shared").querySelector("svg.lucide")).not.toBeNull();
    await expect(canvas.getByTestId("unknown")).toBeEmptyDOMElement();
  },
};
