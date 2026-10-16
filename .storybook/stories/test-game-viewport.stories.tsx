// The made-up test game (packages/games/_fixture) in the viewport. Its sheet has only a plan, so
// the viewport offers no 3D for it: the check that shared code works with any set of views.

import { bound, games } from "@glade/testkit/src/games";
import type { ViewKind } from "@glade/viewport";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, within } from "storybook/test";
import { framesReported, planDrawn, ViewportDemo } from "./viewport-demo";

interface Props {
  map: "board" | "sheet";
  view: ViewKind;
}

function TestGameViewport(props: Props) {
  const loaded = useMemo(() => {
    const g = games._fixture;
    const def = g.game.maps[props.map];
    const samples = g.maps[props.map];
    const map = bound(def, samples);
    return { map, doc: samples.demo(map), title: def.title };
  }, [props.map]);
  return <ViewportDemo {...loaded} view={props.view} camera="iso" hour={12} />;
}

const meta = {
  title: "Test game/Viewport",
  component: TestGameViewport,
  args: { map: "sheet", view: "3d" },
  argTypes: {
    map: { control: "inline-radio", options: ["board", "sheet"] },
    view: { control: "inline-radio", options: ["2d", "3d"] },
  },
} satisfies Meta<typeof TestGameViewport>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Asked for 3D, the sheet shows its plan: it has no 3D view. */
export const SheetHasNo3D: Story = {
  name: "Sheet has no 3D",
  play: async ({ canvasElement }) => {
    await framesReported(canvasElement);
    const [plan, scene] = canvasElement.querySelectorAll("canvas");
    await expect(plan.style.visibility).toBe("visible");
    await expect(scene.style.visibility).toBe("hidden");
    await planDrawn(canvasElement);
    await expect(within(canvasElement).getByRole("img")).toBeVisible();
  },
};

export const Board2D: Story = { name: "Board 2D", args: { map: "board", view: "2d" } };
