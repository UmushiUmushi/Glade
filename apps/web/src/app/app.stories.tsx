// The app's placeholder page with a fake API: the server answering, the server partly down, and no
// server at all. The page says which, in plain words.

import { err, gladeError, ok } from "@glade/errors";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import type { ApiClient } from "../platform/api-client";
import { App } from "./app";

/** An API whose health check gives one fixed answer. */
function fakeApi(answer: Awaited<ReturnType<ApiClient["getJson"]>>): ApiClient {
  return { getJson: async () => answer as never };
}

const meta = {
  title: "Web/App",
  component: App,
  args: {
    api: fakeApi(ok({ status: "ok", version: "0.1.0", checks: {} })),
    onError: fn(),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServerOk: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Glade" })).toBeVisible();
    await expect(await canvas.findByText("Server ok · version 0.1.0")).toBeVisible();
  },
};

export const ServerPartlyDown: Story = {
  args: { api: fakeApi(ok({ status: "down", version: "0.1.0", checks: { disk: "down" } })) },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("The server is up, but not everything works."),
    ).toBeVisible();
  },
};

export const Offline: Story = {
  args: { api: fakeApi(err(gladeError("GLD-NET-001"))) },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Can't reach Glade's server. Changes waiting."),
    ).toBeVisible();
  },
};
