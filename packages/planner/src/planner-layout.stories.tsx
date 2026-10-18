// The planner's layout with placeholder contents: the side panel open (desktop) and as the rail
// (tablet), and without a toolbox. Play steps check the named regions a screen reader finds and the
// panel's widths.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PlannerLayout } from "./planner-layout";

function Fill({ children }: { children: string }) {
  return (
    <div style={{ padding: 18, color: "var(--ink-muted)", fontFamily: "var(--font-ui)" }}>
      {children}
    </div>
  );
}

/** One interface pixel where `el` is (the theme root's --u), in CSS pixels. */
const unit = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--u")) || 1;

const meta = {
  title: "Glade/Planner/Layout",
  component: PlannerLayout,
  args: {
    panelState: "open",
    panel: <Fill>Side panel</Fill>,
    viewport: <Fill>Map</Fill>,
    toolbox: <Fill>Toolbox</Fill>,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PlannerLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByRole("complementary", { name: "Planner controls" });
    await expect(panel.getBoundingClientRect().width).toBeCloseTo(336 * unit(panel), 1);
    await expect(canvas.getByRole("region", { name: "Map viewport" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Toolbox" })).toBeVisible();
  },
};

export const TabletRail: Story = {
  args: { panelState: "rail", panel: <Fill>·</Fill> },
  play: async ({ canvasElement }) => {
    const rail = within(canvasElement).getByRole("navigation", {
      name: "Planner controls, minimized",
    });
    await expect(rail.getBoundingClientRect().width).toBeCloseTo(76 * unit(rail), 1);
  },
};

export const NoToolbox: Story = {
  args: { toolbox: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("region", { name: "Toolbox" })).toBeNull();
  },
};
