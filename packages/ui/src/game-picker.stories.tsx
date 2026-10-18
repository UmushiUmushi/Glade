// Game picker stories: the pill with the current game's name, the menu with each game in its own
// title font, and a game that isn't ready shown as "Soon" and not pickable. Play steps pick a game
// by mouse and by keyboard, and check the not-ready one can't be picked.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { GamePicker, type GameChoice } from "./game-picker";

const GAMES: GameChoice[] = [
  { id: "first", title: "First Game", ready: true },
  { id: "second", title: "Second Game", titleFont: "Georgia, serif", ready: true },
  { id: "later", title: "Later Game", ready: false },
];

function Picker(props: { onPick: (id: string) => void }) {
  const [current, setCurrent] = useState("first");
  return (
    <div style={{ width: 240 }}>
      <GamePicker
        games={GAMES}
        current={current}
        onPick={(id) => {
          setCurrent(id);
          props.onPick(id);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Glade/Controls/Game picker",
  component: Picker,
  args: { onPick: fn() },
} satisfies Meta<typeof Picker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickAGame: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = canvas.getByRole("button", { name: "Game: First Game. Switch game" });
    await userEvent.click(pill);
    // React Aria names a menu after its trigger.
    const menu = await body.findByRole("menu", { name: "Game: First Game. Switch game" });
    await expect(menu).toBeVisible();
    const first = body.getByRole("menuitemradio", { name: "First Game" });
    await expect(first).toHaveAttribute("aria-checked", "true");
    await userEvent.click(body.getByRole("menuitemradio", { name: "Second Game" }));
    await waitFor(() => expect(args.onPick).toHaveBeenCalledWith("second"));
    await expect(
      canvas.getByRole("button", { name: "Game: Second Game. Switch game" }),
    ).toBeVisible();
  },
};

export const SoonCannotBePicked: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    canvas.getByRole("button", { name: /Switch game/ }).focus();
    await userEvent.keyboard("{Enter}");
    // The badge is part of the row's name: "Later Game Soon".
    const later = await body.findByRole("menuitemradio", { name: /^Later Game/ });
    await expect(later).toHaveAttribute("aria-disabled", "true");
    await expect(within(later).getByText("Soon")).toBeVisible();
    await userEvent.click(later);
    await expect(args.onPick).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
  },
};
