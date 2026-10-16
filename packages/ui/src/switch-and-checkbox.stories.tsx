// Switch and Checkbox stories. Play steps check the roles (switch, checkbox), that a click and the
// Space key both flip them, and that "on" shows a tick, not only a colour.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";

function Controls() {
  const [snap, setSnap] = useState(false);
  const [snow, setSnow] = useState(true);
  const [ruler, setRuler] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
      <Switch isSelected={snap} onChange={setSnap}>
        Snap to grid
      </Switch>
      <Checkbox isSelected={snow} onChange={setSnow} icon="snow">
        Snow
      </Checkbox>
      <Checkbox isSelected={ruler} onChange={setRuler}>
        Ruler
      </Checkbox>
    </div>
  );
}

const meta = {
  title: "Controls/Switch and Checkbox",
  component: Controls,
} satisfies Meta<typeof Controls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Both: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const snapSwitch = canvas.getByRole("switch", { name: "Snap to grid" });
    await expect(snapSwitch).not.toBeChecked();
    await userEvent.click(snapSwitch);
    await expect(snapSwitch).toBeChecked();
    const ruler = canvas.getByRole("checkbox", { name: "Ruler" });
    ruler.focus();
    await userEvent.keyboard(" ");
    await expect(ruler).toBeChecked();
    const snow = canvas.getByRole("checkbox", { name: "Snow" });
    await expect(snow).toBeChecked();
    const tick = snow.closest("label")?.querySelector(".glade-checkbox-box svg");
    await expect(tick).not.toBeNull();
  },
};
