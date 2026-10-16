// The viewport with real maps: Petit Planet's real-size island (and its small demo) in 2D and 3D,
// and the fixture game's sheet, which has only a plan. The controls pick the view, camera, time of
// day and season. Play steps check the map is drawn and the frame rate is reported.

import { MapViewport, type CameraKind, type ViewKind, type Viewport } from "@glade/viewport";
import { bound, games } from "@glade/testkit/src/games";
import { Pill } from "@glade/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, waitFor, within } from "storybook/test";

type Sample = "island" | "demo" | "sheet";

function load(sample: Sample) {
  if (sample === "sheet") {
    const g = games._fixture;
    const def = g.game.maps.sheet;
    const map = bound(def, g.maps.sheet);
    return { map, doc: g.maps.sheet.demo(map), title: "Sheet" };
  }
  const g = games["petit-planet"];
  const def = g.game.maps.planet;
  const samples = g.maps.planet;
  if (sample === "island" && samples.large) {
    const map = bound(def, { ...samples, items: samples.large.items });
    return { map, doc: samples.large.map(), title: "Island" };
  }
  const map = bound(def, samples);
  return { map, doc: samples.demo(map), title: "Demo island" };
}

interface DemoProps {
  sample: Sample;
  view: ViewKind;
  camera: CameraKind;
  hour: number;
  season: "spring" | "winter";
  onViewport?: (vp: Viewport) => void;
}

function ViewportDemo(props: DemoProps) {
  const { map, doc, title } = useMemo(() => load(props.sample), [props.sample]);
  const [fps, setFps] = useState<number | null>(null);
  const [vp, setVp] = useState<Viewport | null>(null);
  const build = fps === null ? null : vp?.stats().build;
  const environment = useMemo(
    () => ({ hour: props.hour, season: props.season }),
    [props.hour, props.season],
  );
  return (
    <div
      style={{
        position: "relative",
        width: 900,
        height: 560,
        borderRadius: 24,
        overflow: "hidden",
        background: "#69d2ff",
      }}
    >
      <MapViewport
        map={map}
        doc={doc}
        view={props.view}
        camera={props.camera}
        environment={environment}
        label={`${title}, ${props.view === "3d" ? "3D" : "2D"} view`}
        onFps={setFps}
        onReady={(ready) => {
          setVp(ready);
          props.onViewport?.(ready);
        }}
      />
      <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 6 }}>
        <Pill>{fps === null ? "… FPS" : `${fps} FPS`}</Pill>
        {build && <Pill>{`built in ${Math.round(build.ms)} ms`}</Pill>}
      </div>
    </div>
  );
}

const meta = {
  title: "Viewport/Maps",
  component: ViewportDemo,
  args: { sample: "island", view: "3d", camera: "iso", hour: 12, season: "spring" },
  argTypes: {
    sample: { control: "inline-radio", options: ["island", "demo", "sheet"] },
    view: { control: "inline-radio", options: ["3d", "2d"] },
    camera: { control: "inline-radio", options: ["iso", "top", "walk"] },
    hour: { control: { type: "range", min: 0, max: 24, step: 0.5 } },
    season: { control: "inline-radio", options: ["spring", "winter"] },
  },
} satisfies Meta<typeof ViewportDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waits for the FPS pill to show a number. */
async function framesReported(canvasElement: HTMLElement) {
  await waitFor(() => expect(within(canvasElement).getByText(/^\d+ FPS$/)).toBeVisible(), {
    timeout: 15000,
  });
}

/**
 * The real-size island in 3D. Not run as a test: the test browser draws 3D in software, far
 * slower than a GPU. On an Apple M4 it holds 60 FPS (docs/planner/internals.md).
 */
export const Island3D: Story = { tags: ["!test"] };

export const Island2D: Story = {
  args: { view: "2d" },
  play: async ({ canvasElement }) => {
    await framesReported(canvasElement);
    const plan = canvasElement.querySelector("canvas");
    const ctx = plan?.getContext("2d");
    const pixel = ctx?.getImageData(
      Math.floor((plan?.width ?? 0) / 2),
      Math.floor((plan?.height ?? 0) / 2),
      1,
      1,
    ).data;
    await expect(pixel?.[3]).toBeGreaterThan(0);
  },
};

export const IslandEveningWinter: Story = {
  args: { hour: 19, season: "winter", camera: "top" },
  tags: ["!test"],
};

export const IslandWalk: Story = { args: { camera: "walk", hour: 16 }, tags: ["!test"] };

/** The last viewport a story made, for its play steps. */
const shown: { viewport: Viewport | null } = { viewport: null };

/** The small demo island in 3D: the scene starts and draws (the test browser draws slowly). */
export const DemoIsland: Story = {
  args: { sample: "demo", onViewport: (vp) => (shown.viewport = vp) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "Demo island, 3D view" }),
    ).toBeVisible();
    await waitFor(
      async () => {
        await expect(shown.viewport?.state().ready3d).toBe(true);
        await expect(shown.viewport?.stats().frames).toBeGreaterThan(0);
      },
      { timeout: 60000 },
    );
  },
};

export const SheetHasNo3D: Story = {
  args: { sample: "sheet", view: "3d" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("img", { name: /Sheet/ })).toBeVisible();
    await framesReported(canvasElement);
    const [plan, scene] = canvasElement.querySelectorAll("canvas");
    await expect(plan.style.visibility).toBe("visible");
    await expect(scene.style.visibility).toBe("hidden");
  },
};
