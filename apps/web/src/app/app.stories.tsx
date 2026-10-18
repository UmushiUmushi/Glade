// The app with a fake API and a history in memory: the home page (the server answering, partly
// down, or out of reach), a game's planner opened from the home page in the game's own look, the
// game picker, and the pages for an unknown address and a game that isn't ready.

import { err, gladeError, ok } from "@glade/errors";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ApiClient } from "../platform/api-client";
import { App } from "./app";
import { memoryHistory } from "./routes";

/** An API whose health check gives one fixed answer. */
function fakeApi(answer: Awaited<ReturnType<ApiClient["getJson"]>>): ApiClient {
  return { getJson: async () => answer as never };
}

const meta = {
  title: "Glade/Web app/App",
  component: App,
  args: {
    api: fakeApi(ok({ status: "ok", version: "0.1.0", checks: {} })),
    history: memoryHistory("/"),
    onError: fn(),
    // The test browser is narrower than a desktop: force the desktop layout, as Settings can.
    layout: "desktop",
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { history: memoryHistory("/") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Glade" })).toBeVisible();
    await expect(await canvas.findByText("Server ok · version 0.1.0")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Petit Planet" })).toHaveAttribute(
      "href",
      "/petit-planet/planner",
    );
    await expect(canvas.getByText("Palworld")).toBeVisible();
    await expect(canvas.queryByRole("link", { name: /Palworld/ })).toBeNull();
  },
};

export const ServerPartlyDown: Story = {
  args: {
    api: fakeApi(ok({ status: "down", version: "0.1.0", checks: { disk: "down" } })),
    history: memoryHistory("/"),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("The server is up, but not everything works."),
    ).toBeVisible();
  },
};

export const Offline: Story = {
  args: { api: fakeApi(err(gladeError("GLD-NET-001"))), history: memoryHistory("/") },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Can't reach Glade's server. Changes waiting."),
    ).toBeVisible();
  },
};

/** From the home page into a game's planner, which wears the game's look. */
export const OpenAPlanner: Story = {
  args: { history: memoryHistory("/") },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("link", { name: "Petit Planet" }));
    const pill = await canvas.findByRole("button", { name: "Game: Petit Planet. Switch game" });
    await expect(pill).toBeVisible();
    await expect(args.history.path()).toBe("/petit-planet/planner");
    await expect(
      canvas.getByRole("img", { name: "Petit Planet map, new and empty" }),
    ).toBeVisible();
    // The theme root nearest the page (Storybook's own toolbar theme sits further out).
    const root = pill.closest<HTMLElement>("[data-theme]");
    await expect(root?.dataset.theme).toBe("petit-planet");
  },
};

/** The game picker lists every game; the ones that aren't ready say "Soon". */
export const PickerListsGames: Story = {
  args: { history: memoryHistory("/petit-planet/planner") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: /Switch game/ }));
    const current = await body.findByRole("menuitemradio", { name: "Petit Planet" });
    await expect(current).toHaveAttribute("aria-checked", "true");
    // The menu opens inside the game's theme root, so it wears the game's look.
    const menuRoot = current.closest<HTMLElement>("[data-theme]");
    await expect(menuRoot?.dataset.theme).toBe("petit-planet");
    const later = body.getByRole("menuitemradio", { name: /^Palworld/ });
    await expect(later).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
  },
};

/** On a tablet the side panel is the rail, 76 px wide. */
export const TabletRail: Story = {
  args: { history: memoryHistory("/petit-planet/planner"), layout: "tablet" },
  play: async ({ canvasElement }) => {
    const rail = await within(canvasElement).findByRole("navigation", {
      name: "Planner controls, minimized",
    });
    await expect(rail.getBoundingClientRect().width).toBe(76);
  },
};

export const NotFound: Story = {
  args: { history: memoryHistory("/no/such/page") },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Go to the home page" }));
    await expect(await canvas.findByRole("heading", { name: "Glade" })).toBeVisible();
    await expect(args.history.path()).toBe("/");
  },
};

export const GameNotReady: Story = {
  args: { history: memoryHistory("/palworld/planner") },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("heading", { name: "Palworld isn't ready yet" }),
    ).toBeVisible();
  },
};
