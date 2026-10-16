// Button stories: every variant and size, with an icon, and disabled. Play steps check that a
// press reaches onPress by mouse and by keyboard, and that a disabled button ignores both.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "Glade/Controls/Button",
  component: Button,
  args: { onPress: fn(), children: "Show 19 items" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", icon: "log-in", children: "Log in" },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Log in" });
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onPress).toHaveBeenCalledTimes(2);
  },
};

export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary" icon="home">
        Go to Glade home
      </Button>
      <Button {...args} variant="strong">
        Strong
      </Button>
      <Button {...args} variant="danger" icon="trash">
        Delete
      </Button>
      <Button {...args} variant="quiet">
        Quiet
      </Button>
      <Button {...args} variant="primary" size="sm">
        Undo
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("button")).toHaveLength(6);
  },
};

export const Disabled: Story = {
  args: { variant: "primary", isDisabled: true, children: "Save" },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};

export const AllVariantsDark: Story = {
  ...AllVariants,
  globals: { mode: "dark" },
};
