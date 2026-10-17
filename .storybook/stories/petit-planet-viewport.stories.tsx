// Petit Planet in the viewport: the real-size island (and the small demo island) in 2D and 3D.
// The controls pick the view, camera, time of day and season.

import { bound, games } from "@glade/testkit/src/games";
import {
  frontArrow,
  type Catalog,
  isA,
  itemRect,
  itemsOf,
  type Item,
  type MapDoc,
} from "@glade/petit-planet-profile";
import { planToScreen, type CameraKind, type ViewKind, type Viewport } from "@glade/viewport";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, fireEvent, waitFor, within } from "storybook/test";
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

/**
 * Hovering a house in 2D shows which way it faces: an arrow out of its front. The play step points
 * at the house nearest the close-up's middle and checks the hover layer drew the arrow there; the
 * arrow stays, to look at.
 */
export const Island2DFrontOnHover: Story = {
  name: "Island 2D front on hover",
  args: { view: "2d", onViewport: (vp) => (shown.viewport = vp) },
  play: async ({ canvasElement }) => {
    await framesReported(canvasElement);
    const vp = shown.viewport;
    if (!vp) throw new Error("the viewport is ready");
    const cam = { cx: 88, cy: 104, pxPerUnit: 24 };
    vp.setPlanCamera(cam);
    const { map, doc } = load("island");
    const catalog = map.catalog as unknown as Catalog;
    const centre = (i: Item) => {
      const r = itemRect(catalog, i);
      return { x: (r.x + r.w / 2) / 2, y: (r.y + r.h / 2) / 2 };
    };
    const house = itemsOf(doc as MapDoc)
      .filter((i) => isA(catalog, i.type, "building"))
      .map((i) => ({ i, c: centre(i) }))
      .sort(
        (a, b) =>
          Math.hypot(a.c.x - cam.cx, a.c.y - cam.cy) - Math.hypot(b.c.x - cam.cx, b.c.y - cam.cy),
      )[0];
    const box = within(canvasElement).getByRole("img");
    const rect = box.getBoundingClientRect();
    const at = planToScreen(cam, { w: rect.width, h: rect.height }, house.c);
    await fireEvent.pointerMove(box, { clientX: rect.left + at.x, clientY: rect.top + at.y });
    // The arrow's tip, just outside the front edge, in the hover layer's pixels.
    const [tip] = frontArrow(itemRect(catalog, house.i), house.i.rot, 1);
    const tipAt = planToScreen(
      cam,
      { w: rect.width, h: rect.height },
      { x: tip[0] / 2, y: tip[1] / 2 },
    );
    const hover = canvasElement.querySelector<HTMLCanvasElement>('canvas[data-layer="hover"]');
    if (!hover) throw new Error("the viewport has a hover layer");
    const k = hover.width / rect.width;
    await waitFor(() => {
      const ctx = hover.getContext("2d");
      const px = ctx?.getImageData(Math.round(tipAt.x * k), Math.round(tipAt.y * k), 1, 1).data;
      return expect(px?.[3]).toBeGreaterThan(0);
    });
  },
};

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
