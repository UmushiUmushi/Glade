// Slider and Stepper stories: the time of day (four stops, read out by name) and the builder's
// footprint width. Play steps move them by keyboard and press, and check their limits.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { Slider } from "./slider";
import { Stepper } from "./stepper";

const TIMES = ["Dawn", "Day", "Dusk", "Night"];

function Both() {
  const [time, setTime] = useState(1);
  const [width, setWidth] = useState(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Slider
        label="Time of day"
        value={time}
        onChange={setTime}
        min={0}
        max={3}
        valueText={(v) => TIMES[Math.round(v)]}
        stops={TIMES}
      />
      <Stepper
        label="Width"
        value={width}
        onChange={setWidth}
        min={0.5}
        max={1.5}
        step={0.5}
        decrementLabel="Narrower"
        incrementLabel="Wider"
      />
    </div>
  );
}

const meta = { title: "Glade/Controls/Slider and Stepper", component: Both } satisfies Meta<
  typeof Both
>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TimeAndWidth: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const time = canvas.getByRole("slider", { name: "Time of day" });
    await expect(time).toHaveAttribute("aria-valuetext", "Day");
    // The browser moves a range input with the arrow keys itself; tests set its value instead.
    await fireEvent.change(time, { target: { value: "2" } });
    await expect(time).toHaveAttribute("aria-valuetext", "Dusk");

    const group = canvas.getByRole("group", { name: "Width" });
    const wider = within(group).getByRole("button", { name: "Wider" });
    await userEvent.click(wider);
    await expect(group).toHaveTextContent("1.5");
    await expect(wider).toBeDisabled();
    await userEvent.click(within(group).getByRole("button", { name: "Narrower" }));
    await userEvent.click(within(group).getByRole("button", { name: "Narrower" }));
    await expect(group).toHaveTextContent("0.5");
    await expect(within(group).getByRole("button", { name: "Narrower" })).toBeDisabled();
  },
};
