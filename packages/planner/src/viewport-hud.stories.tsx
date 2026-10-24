// The controls over the map with made-up modes, on a plain backdrop, driven by the planner's
// reducer. Play steps pick a mode, check undo and redo wait for history, switch 2D and 3D, pick the
// walk camera, fit, fold the menu to its tag and back, go into Preview and out; and the save pill
// in its three states.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useReducer } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { initialPlanner, plannerReducer } from "./state";
import { SaveStatus, ViewportHud, type ModeDef } from "./viewport-hud";

const MODES: ModeDef[] = [
  { id: "build", label: "Build", icon: "home", tip: "Build mode: place things" },
  { id: "draw", label: "Draw", icon: "pencil", tip: "Draw mode: draw lines" },
];

function Hud(props: { onFit: () => void; views: ("2d" | "3d")[] }) {
  const [state, dispatch] = useReducer(plannerReducer, { mode: "build" }, initialPlanner);
  return (
    <div
      style={{
        position: "relative",
        width: 900,
        height: 520,
        background: "#0c6d8f",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
      }}
    >
      <ViewportHud
        state={state}
        dispatch={dispatch}
        modes={MODES}
        views={props.views}
        onFit={props.onFit}
        fps={60}
        coords="Tile 3.5, 4"
      />
      <p style={{ position: "absolute", left: 16, bottom: 56, color: "white" }}>
        {`${state.view} ${state.camera}${state.preview ? " preview" : ""}`}
      </p>
    </div>
  );
}

const meta = {
  title: "Glade/Planner/Viewport controls",
  component: Hud,
  args: { onFit: fn(), views: ["2d", "3d"] },
} satisfies Meta<typeof Hud>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ModesAndHistory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const build = canvas.getByRole("button", { name: "Build mode" });
    await expect(build).toHaveAttribute("aria-pressed", "true");
    await expect(within(build).getByText("Build")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Draw mode" }));
    await expect(canvas.getByRole("button", { name: "Draw mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getByRole("button", { name: "Nothing to undo" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Nothing to redo" })).toBeDisabled();
    await expect(canvas.getByText("60 FPS")).toBeVisible();
    await expect(canvas.getByText("Tile 3.5, 4")).toBeVisible();
  },
};

export const ViewMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "View: Iso. Change view" }));
    await userEvent.click(await body.findByRole("menuitemradio", { name: "Walk" }));
    await expect(canvas.getByText("3d walk")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Showing 3D. Switch to 2D" }));
    await expect(canvas.getByText("2d walk")).toBeVisible();
    // The camera button is for 3D only.
    await expect(canvas.queryByRole("button", { name: /^View:/ })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: /^Fit/ }));
    await expect(args.onFit).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Collapse viewport menu" }));
    await expect(canvas.queryByRole("toolbar", { name: "Viewport menu" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Show viewport menu" }));
    await expect(canvas.getByRole("toolbar", { name: "Viewport menu" })).toBeVisible();
  },
};

export const Preview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Preview/ }));
    await expect(canvas.queryByRole("group", { name: "Viewport mode" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Exit preview" }));
    await expect(canvas.getByRole("group", { name: "Viewport mode" })).toBeVisible();
  },
};

export const OneView: Story = {
  args: { views: ["2d"] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: /^Showing/ })).toBeNull();
  },
};

/** The save pill: Saved, Saving…, and Couldn't save, which tries again on a click. */
export const SavePill: StoryObj<typeof SaveStatus> = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12 }}>
      <SaveStatus state="saved" where="on this device" onRetry={args.onRetry} />
      <SaveStatus state="saving" where="on this device" onRetry={args.onRetry} />
      <SaveStatus state="failed" where="on this device" onRetry={args.onRetry} />
    </div>
  ),
  args: { onRetry: fn() } as never,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /^Saved\./ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Saving…/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /^Couldn't save/ }));
    await expect((args as unknown as { onRetry: () => void }).onRetry).toHaveBeenCalledOnce();
  },
};
