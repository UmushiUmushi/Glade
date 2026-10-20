// The rail with made-up layer rows and time stops, driven by the planner's reducer. Play steps
// swap the tool, pick the last select tool and open its flyout by hovering and by keyboard (the
// right arrow moves in, Esc comes back), toggle the ruler and snow, move the time in its flyout,
// toggle layers and "Always on", and expand.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@glade/ui";
import { useReducer } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Rail } from "./rail";
import { initialPlanner, plannerReducer, type LayerRow, type PlannerAction } from "./state";
import type { TimeStop } from "./time";

const ROWS: LayerRow[] = [
  { id: "houses", label: "Houses", icon: "home", layers: ["things"] },
  { id: "notes", label: "Notes", icon: "pencil", layers: ["notes"] },
  { id: "grid", label: "Grid", icon: "grid", layers: [], host: "grid" },
  { id: "area", label: "Area", icon: "layers", layers: [], host: "area" },
];

const STOPS: TimeStop[] = [
  { label: "Early", hour: 7, sky: "#e39aac", icon: "sunrise" },
  { label: "Noon", hour: 12, sky: "#69d2ff", icon: "sun" },
  { label: "Late", hour: 16.5, sky: "#efc05a", icon: "sunset" },
  { label: "Dark", hour: 21, sky: "#10283b", icon: "moon" },
];

function RailStory(props: { onAction: (a: PlannerAction) => void; onClear: () => void }) {
  const [state, dispatch] = useReducer(plannerReducer, { panel: "rail" }, initialPlanner);
  return (
    <div
      style={{
        width: "calc(76 * var(--u))",
        height: 900,
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
        border: "var(--border-card) solid var(--frame)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <Rail
        state={state}
        dispatch={(a) => {
          props.onAction(a);
          dispatch(a);
        }}
        menu={<Button variant="strong">M</Button>}
        picker={<Button variant="strong">G</Button>}
        layers={ROWS}
        time={{ stops: STOPS, hasSnow: true }}
        onClearSelection={props.onClear}
      />
    </div>
  );
}

const meta = {
  title: "Glade/Planner/Rail",
  component: RailStory,
  args: { onAction: fn(), onClear: fn() },
} satisfies Meta<typeof RailStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolsAndSelect: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Pointer" }));
    await expect(canvas.getByRole("button", { name: "Camera" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The Select button picks the last select tool, and shows the mode's badge.
    const select = canvas.getByRole("button", { name: "Select: Rectangle select, set" });
    await expect(select).toHaveTextContent("=");
    await userEvent.click(select);
    await expect(select).toHaveAttribute("aria-pressed", "true");
    // Keyboard: focus opens the flyout, the right arrow moves in, Esc comes back.
    select.focus();
    const flyout = await body.findByRole("group", { name: "Selection options" });
    await expect(flyout).toBeVisible();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(flyout).toContainElement(document.activeElement as HTMLElement));
    await userEvent.click(body.getByRole("radio", { name: "Lasso" }));
    await userEvent.click(body.getByRole("radio", { name: "Add to the selection" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("group", { name: "Selection options" })).toBeNull(),
    );
    const lasso = canvas.getByRole("button", { name: "Select: Lasso, add to the selection" });
    await expect(lasso).toHaveFocus();
    await expect(lasso).toHaveTextContent("+");
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }));
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

export const HoverOpensTheFlyout: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.hover(within(canvasElement).getByRole("button", { name: /^Select:/ }));
    await expect(await body.findByRole("group", { name: "Selection options" })).toBeVisible();
  },
};

export const TimeRulerAndSnow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const ruler = canvas.getByRole("button", { name: "Ruler" });
    await userEvent.click(ruler);
    await expect(ruler).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Snow" }));
    await expect(canvas.getByRole("button", { name: "Snow" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Time of day: Noon" }));
    const slider = await body.findByRole("slider", { name: "Time of day" });
    slider.focus();
    await userEvent.keyboard("{PageUp}");
    await expect(canvas.getByRole("button", { name: "Time of day: Late" })).toBeVisible();
  },
};

export const LayersAndAlwaysOn: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const houses = canvas.getByRole("button", { name: "Houses" });
    await userEvent.click(houses);
    await expect(houses).toHaveAttribute("aria-pressed", "false");
    await expect(
      canvas.getByRole("button", { name: "Area (tick Always on to use)" }),
    ).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Always on: Area" }));
    await expect(canvas.getByRole("button", { name: "Area" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Expand panel" }));
    await expect(args.onAction).toHaveBeenCalledWith({ type: "panel", panel: "open" });
  },
};
