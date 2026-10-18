// Which layout the window gets: the window's size decides (Auto), following resizes, unless a
// layout is forced, as Settings can. Play steps read the layout this test window gets.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { layoutFor, useScreenLayout, type LayoutSetting } from "./screen-size";

function Readout({ setting }: { setting: LayoutSetting }) {
  const layout = useScreenLayout(setting);
  return <p style={{ fontFamily: "var(--font-ui)", color: "var(--ink)" }}>Layout: {layout}</p>;
}

const meta = {
  title: "Glade/Planner/Screen layout",
  component: Readout,
  args: { setting: "auto" },
} satisfies Meta<typeof Readout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Auto: Story = {
  play: async ({ canvasElement }) => {
    const expected = layoutFor(window.innerWidth, window.innerHeight);
    const canvas = within(canvasElement);
    await expect(canvas.getByText(`Layout: ${expected}`)).toBeVisible();
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => expect(canvas.getByText(`Layout: ${expected}`)).toBeVisible());
  },
};

export const ForcedPhone: Story = {
  args: { setting: "phone" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Layout: phone")).toBeVisible();
  },
};
