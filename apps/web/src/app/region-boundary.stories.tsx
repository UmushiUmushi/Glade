// The region safety net: a part that crashes while drawing shows "This part stopped working" with
// Reload, logs GLD-UI-001 once, and the rest of the screen keeps working.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { RegionBoundary } from "./region-boundary";

/** A part that throws while drawing, until it is fixed. */
function Part(props: { broken: boolean }) {
  if (props.broken) throw new Error("drawing failed");
  return <p>The part works again.</p>;
}

function Breakable(props: { onError: () => void }) {
  const [broken, setBroken] = useState(true);
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <section aria-label="Broken part" style={{ flex: 1 }}>
        <RegionBoundary region="side-panel" onError={props.onError}>
          <Part broken={broken} />
        </RegionBoundary>
      </section>
      <section aria-label="Other part" style={{ flex: 1 }}>
        <p>This part still works.</p>
        <button type="button" onClick={() => setBroken(false)}>
          Fix it
        </button>
      </section>
    </div>
  );
}

const meta = {
  title: "Glade/Web app/Region safety net",
  component: Breakable,
  args: { onError: fn() },
} satisfies Meta<typeof Breakable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CatchesACrash: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("This part stopped working.");
    await expect(canvas.getByText("This part still works.")).toBeVisible();
    await waitFor(() =>
      expect(args.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "GLD-UI-001", detail: { region: "side-panel" } }),
      ),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Fix it" }));
    await userEvent.click(canvas.getByRole("button", { name: "Reload part" }));
    await expect(await canvas.findByText("The part works again.")).toBeVisible();
  },
};
