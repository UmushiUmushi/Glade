// The side panel with made-up layer rows, driven by the planner's reducer. Play steps pick tools
// by mouse and by arrow keys, switch the selection mode, tick the ruler, hide a row (the count
// follows), check the area row stays locked until "Always on: Area" is ticked, and minimize it.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@glade/ui";
import { useReducer } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { SidePanel } from "./side-panel";
import { initialPlanner, plannerReducer, type LayerRow, type PlannerAction } from "./state";

const ROWS: LayerRow[] = [
  { id: "houses", label: "Houses", icon: "home", layers: ["things"] },
  { id: "notes", label: "Notes", icon: "pencil", layers: ["notes"] },
  { id: "grid", label: "Grid", icon: "grid", layers: [], host: "grid" },
  { id: "area", label: "Area", icon: "layers", layers: [], host: "area" },
];

function Panel(props: { onAction: (a: PlannerAction) => void; onClear: () => void }) {
  const [state, dispatch] = useReducer(plannerReducer, {}, initialPlanner);
  return (
    <div
      style={{
        width: 336,
        height: 860,
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
        border: "var(--border-card) solid var(--frame)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <SidePanel
        state={state}
        dispatch={(a) => {
          props.onAction(a);
          dispatch(a);
        }}
        menu={<Button variant="strong">Menu</Button>}
        picker={<Button variant="strong">Game</Button>}
        layers={ROWS}
        onClearSelection={props.onClear}
      />
    </div>
  );
}

const meta = {
  title: "Glade/Planner/Side panel",
  component: Panel,
  args: { onAction: fn(), onClear: fn() },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tools: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Tools" })).toBeVisible();
    const pointer = canvas.getByRole("radio", { name: /^Pointer/ });
    await expect(pointer).toBeChecked();
    await userEvent.click(canvas.getByRole("radio", { name: /^Camera/ }));
    await expect(canvas.getByRole("radio", { name: /^Camera/ })).toBeChecked();
    await expect(pointer).not.toBeChecked();
    // A select tool puts the camera down: one tool at a time.
    await userEvent.click(canvas.getByRole("radio", { name: "Lasso" }));
    await expect(canvas.getByRole("radio", { name: "Lasso" })).toBeChecked();
    await expect(canvas.getByRole("radio", { name: /^Camera/ })).not.toBeChecked();
    // Arrow keys move inside a toolbar; Space picks.
    await userEvent.keyboard("{ArrowRight} ");
    await expect(canvas.getByRole("radio", { name: "Rectangle select" })).toBeChecked();
  },
};

export const SelectModeAndRuler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Add to the selection" }));
    await expect(canvas.getByRole("radio", { name: "Add to the selection" })).toBeChecked();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Ruler" }));
    await expect(canvas.getByRole("checkbox", { name: "Ruler" })).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Clear Selection" }));
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

export const Layers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3 of 4 visible")).toBeVisible();
    const houses = canvas.getByRole("button", { name: "Houses" });
    await expect(houses).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(houses);
    await expect(houses).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.getByText("2 of 4 visible")).toBeVisible();
    // The area row is locked until its "Always on" is ticked.
    const area = canvas.getByRole("button", { name: "Area (tick Always on to use)" });
    await expect(area).toBeDisabled();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Always on: Area" }));
    await expect(canvas.getByRole("button", { name: "Area" })).toBeEnabled();
    await expect(canvas.getByText("3 of 4 visible")).toBeVisible();
  },
};

export const Minimize: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Minimize panel" }));
    await expect(args.onAction).toHaveBeenCalledWith({ type: "panel", panel: "rail" });
  },
};
