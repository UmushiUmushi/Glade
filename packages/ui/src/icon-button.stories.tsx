// IconButton stories: each variant and size, and a tool toggle. Play steps check that the name is
// read out, that the tooltip with its key shows on keyboard focus, and that a toggle reports
// pressed and not pressed.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { IconButton } from "./icon-button";

const meta = {
  title: "Glade/Controls/IconButton",
  component: IconButton,
  args: { label: "Rotate left", icon: "rotate-left", shortcut: "[", onPress: fn() },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Float: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Rotate left" });
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

export const TooltipOnFocus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const body = within(canvasElement.ownerDocument.body);
    const tip = await body.findByRole("tooltip");
    await expect(tip).toHaveTextContent("Rotate left");
    await expect(tip).toHaveTextContent("[");
  },
};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <IconButton {...args} variant="float" />
      <IconButton {...args} variant="float" size={36} />
      <IconButton {...args} label="Menu" icon="menu" variant="strong" />
      <IconButton {...args} label="Settings" icon="settings" variant="plain" />
      <IconButton {...args} label="Close" icon="close" variant="strong" size={36} />
    </div>
  ),
};

function ToolToggle() {
  const [on, setOn] = useState(false);
  return <IconButton label="Ruler" icon="ruler" selected={on} onSelectedChange={setOn} />;
}

export const Toggle: Story = {
  render: () => <ToolToggle />,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Ruler" });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
  },
};
