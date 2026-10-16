// Dialog stories: a dialog opened from a button. Play steps check its name and role, that Escape
// and the Close button both close it, and that focus goes back to the button that opened it.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Dialog } from "./dialog";

function SaveDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onPress={() => setOpen(true)}>
        Save Map As
      </Button>
      <Dialog title="Save a copy" subtitle="Lagoon Village" isOpen={open} onOpenChange={setOpen}>
        <p style={{ margin: 0 }}>The copy goes to your Library as a draft.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onPress={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onPress={() => setOpen(false)}>
            Save
          </Button>
        </div>
      </Dialog>
    </>
  );
}

const meta = { title: "Glade/Controls/Dialog", component: SaveDialog } satisfies Meta<
  typeof SaveDialog
>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenAndClose: Story = {
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole("button", { name: "Save Map As" });
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(opener);
    const dialog = await body.findByRole("dialog", { name: "Save a copy" });
    await expect(dialog).toHaveTextContent("Lagoon Village");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());

    await userEvent.click(opener);
    const again = await body.findByRole("dialog");
    await userEvent.click(within(again).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
  },
};
