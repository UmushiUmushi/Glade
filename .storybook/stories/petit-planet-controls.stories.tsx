// The shared controls in Petit Planet's look, laid out on a card like the design's side panel, to
// compare with the design side by side. Switch light and dark in the toolbar.

import { petitPlanetIcons, petitPlanetTheme } from "@glade/petit-planet-ui";
import {
  Button,
  Checkbox,
  Chip,
  IconButton,
  Pill,
  Slider,
  Stepper,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ThemeRoot,
  Toast,
} from "@glade/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";

const TIMES = ["Dawn", "Day", "Dusk", "Night"];

function Sampler(props: { mode: "light" | "dark" }) {
  const [time, setTime] = useState(1);
  const [snow, setSnow] = useState(false);
  const [water, setWater] = useState(true);
  const [width, setWidth] = useState(1.5);
  const [tool, setTool] = useState("pointer");
  return (
    <ThemeRoot theme={petitPlanetTheme} mode={props.mode} icons={petitPlanetIcons}>
      <div style={{ background: "var(--ground)", padding: 12, display: "flex", gap: 12 }}>
        <section
          style={{
            width: 336,
            background: "var(--paper)",
            border: "var(--border-card) solid var(--frame)",
            borderRadius: "var(--radius-card)",
            boxShadow: "0 5px 0 var(--lip)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontFamily: "var(--font-title)", color: "var(--ink-title)" }}>
            Tools
          </h2>
          <div role="toolbar" aria-label="Tools" style={{ display: "flex", gap: 8 }}>
            {["grab", "pointer", "lasso", "select-rect", "select-circle", "magic"].map((id) => (
              <IconButton
                key={id}
                label={id}
                icon={id}
                variant="plain"
                selected={tool === id}
                onSelectedChange={() => setTool(id)}
              />
            ))}
          </div>
          <Slider
            label="Time of day"
            value={time}
            onChange={setTime}
            min={0}
            max={3}
            stops={TIMES}
            valueText={(v) => TIMES[Math.round(v)]}
          />
          <Checkbox isSelected={snow} onChange={setSnow} icon="snow">
            Snow
          </Checkbox>
          <Switch isSelected={water} onChange={setWater}>
            Water decor
          </Switch>
        </section>
        <section
          style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}
        >
          <Tabs>
            <TabList aria-label="Categories">
              <Tab id="all">All</Tab>
              <Tab id="basic">Basic Furniture</Tab>
              <Tab id="greenery">Greenery</Tab>
            </TabList>
            {["all", "basic", "greenery"].map((id) => (
              <TabPanel key={id} id={id}>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>19 items</span>
              </TabPanel>
            ))}
          </Tabs>
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="primary" icon="log-in">
              Log in
            </Button>
            <Button icon="home">Go to Glade home</Button>
            <Button variant="danger" icon="trash">
              Delete
            </Button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <IconButton label="Rotate left" icon="rotate-left" shortcut="[" />
            <IconButton label="Menu" icon="menu" variant="strong" />
            <Stepper label="Width" value={width} onChange={setWidth} min={0.5} max={4} step={0.5} />
            <Chip selected onSelectedChange={() => {}}>
              Sittable
            </Chip>
            <Pill>60 FPS</Pill>
          </div>
          <Toast message="2 maps deleted" action={{ label: "Undo", onPress: () => {} }} />
        </section>
      </div>
    </ThemeRoot>
  );
}

const meta = {
  title: "Petit Planet/Controls",
  component: Sampler,
  args: { mode: "light" },
} satisfies Meta<typeof Sampler>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  play: async ({ canvasElement }) => {
    const tools = within(canvasElement).getByRole("toolbar", { name: "Tools" });
    await expect(within(tools).getAllByRole("button")).toHaveLength(6);
  },
};

export const Dark: Story = { args: { mode: "dark" } };
