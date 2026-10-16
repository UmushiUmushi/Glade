// Tabs, Pill, Chip and Toast stories. Play steps pick tabs by mouse and arrow keys, toggle a chip,
// and press a toast's action.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Chip, Pill } from "./pill";
import { Tab, TabList, TabPanel, Tabs } from "./tabs";
import { Toast } from "./toast";

const CATEGORIES = ["All", "Seats", "Tables", "Lights", "Storage", "Other"];

function Parts(props: { onUndo: () => void }) {
  const [wood, setWood] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <Tabs>
        <TabList aria-label="Categories">
          {CATEGORIES.map((c) => (
            <Tab key={c} id={c}>
              {c}
            </Tab>
          ))}
        </TabList>
        {CATEGORIES.map((c) => (
          <TabPanel key={c} id={c}>
            {c} items
          </TabPanel>
        ))}
      </Tabs>
      <div style={{ display: "flex", gap: 6 }}>
        <Pill>60 FPS</Pill>
        <Pill>x 32 · y 18</Pill>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <Chip selected={wood} onSelectedChange={setWood}>
          Wood
        </Chip>
        <Chip selected={false} onSelectedChange={() => {}}>
          Stone
        </Chip>
      </div>
      <div>
        <Toast message="2 maps deleted" action={{ label: "Undo", onPress: props.onUndo }} />
      </div>
    </div>
  );
}

const meta = {
  title: "Controls/Tabs, Pills and Toast",
  component: Parts,
  args: { onUndo: fn() },
} satisfies Meta<typeof Parts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const all = canvas.getByRole("tab", { name: "All" });
    await expect(all).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("tab", { name: "Tables" }));
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Tables items");
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: "Lights" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const wood = canvas.getByRole("button", { name: "Wood" });
    await userEvent.click(wood);
    await expect(wood).toHaveAttribute("aria-pressed", "true");

    await expect(canvas.getByRole("status")).toHaveTextContent("2 maps deleted");
    await userEvent.click(canvas.getByRole("button", { name: "Undo" }));
    await expect(args.onUndo).toHaveBeenCalled();
  },
};
