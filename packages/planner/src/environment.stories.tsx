// The Environment section with made-up stops: the sky dome over the time slider, and Snow. Play
// steps move the time with the keys (15 minutes, the next stop, the ends), check what screen
// readers hear and the dome's name, and tick Snow; another story has no winter, so no Snow.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useReducer } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { EnvironmentSection } from "./environment";
import { initialPlanner, plannerReducer } from "./state";
import type { TimeStop } from "./time";

const STOPS: TimeStop[] = [
  { label: "Early", hour: 7, sky: "#e39aac" },
  { label: "Noon", hour: 12, sky: "#69d2ff" },
  { label: "Late", hour: 16.5, sky: "#efc05a" },
  { label: "Dark", hour: 21, sky: "#10283b" },
];

function Environment({ hasSnow }: { hasSnow: boolean }) {
  const [state, dispatch] = useReducer(plannerReducer, { hour: 12 }, initialPlanner);
  return (
    <div style={{ width: "calc(300 * var(--u))", background: "var(--paper)", padding: 16 }}>
      <EnvironmentSection state={state} dispatch={dispatch} stops={STOPS} hasSnow={hasSnow} />
      <p style={{ fontFamily: "var(--font-ui)" }}>
        {state.hour} h{state.snow ? ", snow" : ""}
      </p>
    </div>
  );
}

const meta = {
  title: "Glade/Planner/Environment",
  component: Environment,
  args: { hasSnow: true },
} satisfies Meta<typeof Environment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TimeAndSnow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slider = canvas.getByRole("slider", { name: "Time of day" });
    await expect(slider).toHaveAttribute("aria-valuetext", "Noon, 12:00 PM");
    await expect(canvas.getByRole("img", { name: "Sky at Noon" })).toBeVisible();
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByText("12.25 h")).toBeVisible();
    await userEvent.keyboard("{PageUp}");
    await expect(slider).toHaveAttribute("aria-valuetext", "Late, 4:30 PM");
    await userEvent.keyboard("{End}");
    await expect(canvas.getByRole("img", { name: "Sky at Dark" })).toBeVisible();
    await userEvent.keyboard("{Home}");
    await expect(canvas.getByText("7 h")).toBeVisible();
    // Dragging near a stop snaps to it: 1.9 on the track is 15.6 h, within 0.75 h of 16.5.
    await fireEvent.change(slider, { target: { value: "1.9" } });
    await expect(canvas.getByText("16.5 h")).toBeVisible();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Snow" }));
    await expect(canvas.getByText("16.5 h, snow")).toBeVisible();
  },
};

export const NoWinter: Story = {
  args: { hasSnow: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("checkbox", { name: "Snow" })).toBeNull();
  },
};
