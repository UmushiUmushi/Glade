// Menu stories: the Glade menu (actions, groups split by a dotted line) and the game picker (a
// choice of one, with a tick). Play steps open each by mouse and keyboard and pick a row.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { IconButton } from "./icon-button";
import { Button } from "./button";
import { Menu, MenuItem, MenuSeparator } from "./menu";

function GladeMenu(props: { onAction: (id: Key) => void }) {
  return (
    <Menu
      label="Glade menu"
      trigger={<IconButton label="Menu" icon="menu" variant="strong" />}
      onAction={props.onAction}
      width={280}
    >
      <MenuItem id="home" icon="home">
        Home
      </MenuItem>
      <MenuItem id="settings" icon="settings">
        Settings
      </MenuItem>
      <MenuSeparator />
      <MenuItem id="new" icon="new-file">
        New Map
      </MenuItem>
      <MenuItem id="save" icon="save">
        Save Map
      </MenuItem>
    </Menu>
  );
}

const meta = {
  title: "Glade/Controls/Menu",
  component: GladeMenu,
  args: { onAction: fn() },
} satisfies Meta<typeof GladeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Actions: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Menu" }));
    const body = within(canvasElement.ownerDocument.body);
    // A menu is named after the button that opens it.
    const menu = await body.findByRole("menu", { name: "Menu" });
    await expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Settings" }));
    // The menu closes first, then reports the action.
    await waitFor(() => expect(args.onAction).toHaveBeenCalledWith("settings"));
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());
  },
};

function GamePicker() {
  const [game, setGame] = useState<Key>("glade");
  return (
    <Menu
      label="Switch game"
      trigger={<Button>Game</Button>}
      selected={game}
      onSelectedChange={setGame}
    >
      <MenuItem id="glade">Glade</MenuItem>
      <MenuItem id="other">Another game</MenuItem>
    </Menu>
  );
}

export const ChooseOne: Story = {
  render: () => <GamePicker />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Game" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    const first = await body.findByRole("menuitemradio", { name: "Glade" });
    await expect(first).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(trigger);
    const other = await body.findByRole("menuitemradio", { name: "Another game" });
    await expect(other).toHaveAttribute("aria-checked", "true");
  },
};
