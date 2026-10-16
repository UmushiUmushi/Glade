// Petit Planet in the viewport: the real-size island (and the small demo island) in 2D and 3D.
// The controls pick the view, camera, time of day and season.

import { bound, games } from "@glade/testkit/src/games";
import type { CameraKind, ViewKind, Viewport } from "@glade/viewport";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, waitFor, within } from "storybook/test";
import { framesReported, planDrawn, ViewportDemo } from "./viewport-demo";

interface Props {
  sample: "island" | "demo";
  view: ViewKind;
  camera: CameraKind;
  hour: number;
  season: "spring" | "winter";
  onViewport?: (vp: Viewport) => void;
}

function load(sample: Props["sample"]) {
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

function PetitPlanetViewport({ sample, ...rest }: Props) {
  const loaded = useMemo(() => load(sample), [sample]);
  return <ViewportDemo {...loaded} {...rest} />;
}

const meta = {
  title: "Petit Planet/Viewport",
  component: PetitPlanetViewport,
  args: { sample: "island", view: "3d", camera: "iso", hour: 12, season: "spring" },
  argTypes: {
    sample: { control: "inline-radio", options: ["island", "demo"] },
    view: { control: "inline-radio", options: ["3d", "2d"] },
    camera: { control: "inline-radio", options: ["iso", "top", "walk"] },
    hour: { control: { type: "range", min: 0, max: 24, step: 0.5 } },
    season: { control: "inline-radio", options: ["spring", "winter"] },
  },
} satisfies Meta<typeof PetitPlanetViewport>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The real-size island in 3D. Not run as a test: the test browser draws 3D in software, far
 * slower than a GPU. On an Apple M4 it holds 60 FPS (docs/roadmap.md, Measured speed).
 */
export const Island3D: Story = { name: "Island 3D", tags: ["!test"] };

export const Island2D: Story = {
  name: "Island 2D",
  args: { view: "2d" },
  play: async ({ canvasElement }) => {
    await framesReported(canvasElement);
    await planDrawn(canvasElement);
  },
};

/** The last viewport a story made, for its play steps. */
const shown: { viewport: Viewport | null } = { viewport: null };

/** A 2D story looking at one spot up close (the plan has no mouse zoom yet). */
function closeUp(name: string, cam: { cx: number; cy: number; pxPerUnit: number }): Story {
  return {
    name,
    args: { view: "2d", onViewport: (vp) => (shown.viewport = vp) },
    play: async ({ canvasElement }) => {
      await framesReported(canvasElement);
      const vp = shown.viewport;
      await expect(vp?.planCamera()).toBeTruthy();
      vp?.setPlanCamera(cam);
      await planDrawn(canvasElement);
    },
  };
}

/** South of the town center: houses, furniture, plants and a pond, with their shadows. */
export const Island2DCloseUp = closeUp("Island 2D close-up", { cx: 88, cy: 104, pxPerUnit: 24 });

/** The terraced hill west of the town center: raised ground and the shadows it casts. */
export const Island2DCliffs = closeUp("Island 2D cliffs", { cx: 50, cy: 66, pxPerUnit: 20 });

export const IslandEveningWinter: Story = {
  args: { hour: 19, season: "winter", camera: "top" },
  tags: ["!test"],
};

export const IslandWalk: Story = { args: { camera: "walk", hour: 16 }, tags: ["!test"] };

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
