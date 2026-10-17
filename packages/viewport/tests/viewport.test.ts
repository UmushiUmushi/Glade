// The viewport controller with fakes: the plan drawn only when something changed, at the right
// zoom and pixel ratio; 3D loaded only when first shown and drawn every frame; cameras, look and
// layers passed on; FPS reported; and a lost 3D view reported as GLD-STAGE-001, back to the plan.

import type { GladeError } from "@glade/errors";
import { beforeEach, describe, expect, it } from "vitest";
import { createViewport } from "../src/viewport";
import {
  doc,
  FakeScene,
  fakeCanvases,
  fakeFrames,
  fakeMap,
  hoverCalls,
  load3d,
  planCalls,
} from "./fakes";

beforeEach(() => {
  planCalls.length = 0;
  hoverCalls.length = 0;
  FakeScene.made = [];
});

function setup(views = { plan: true, scene: true }, withHover = true) {
  const frames = fakeFrames();
  const parts = fakeCanvases(withHover);
  const fps: number[] = [];
  const errors: GladeError[] = [];
  const shownViews: string[] = [];
  const vp = createViewport(parts.canvases, {
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    load3d,
    onFps: (f) => fps.push(f),
    onError: (e) => errors.push(e),
    onView: (v) => shownViews.push(v),
  });
  vp.resize({ w: 400, h: 300 }, 2);
  vp.show(fakeMap(views), doc);
  return { vp, frames, parts, fps, errors, shownViews };
}

describe("the plan", () => {
  it("is drawn once after it changes, not every frame", () => {
    const { frames } = setup();
    frames.step(0);
    frames.step(16);
    frames.step(32);
    expect(planCalls).toHaveLength(1);
  });

  it("is drawn with the whole map fitted, and the pixel ratio applied", () => {
    const { frames, parts } = setup();
    frames.step(0);
    const [call] = planCalls;
    expect(call.pxPerUnit).toBeCloseTo((300 * 0.92) / 30);
    const transform = parts.plan.ctx.transforms.at(-1) ?? [];
    expect(transform[0]).toBeCloseTo(call.pxPerUnit * 2);
    expect(parts.plan.canvas.width).toBe(800);
    expect(call.layers).toEqual({ things: true });
  });

  it("is drawn again after a new document, new layers, a resize or a new camera", () => {
    const { vp, frames } = setup();
    frames.step(0);
    vp.setDoc(doc);
    frames.step(16);
    vp.setLayers({ things: false });
    frames.step(32);
    vp.resize({ w: 500, h: 300 }, 1);
    frames.step(48);
    const cam = vp.planCamera();
    if (cam) vp.setPlanCamera({ ...cam, cx: 1 });
    frames.step(64);
    vp.fit();
    frames.step(80);
    expect(planCalls).toHaveLength(6);
    expect(planCalls[2].layers).toEqual({ things: false });
  });

  it("is the canvas shown in 2D, and hidden in 3D", async () => {
    const { vp, parts } = setup();
    expect(parts.plan.canvas.style.visibility).toBe("visible");
    await vp.setView("3d");
    expect(parts.plan.canvas.style.visibility).toBe("hidden");
    expect(parts.scene.canvas.style.visibility).toBe("visible");
  });
});

describe("hover marks", () => {
  it("are drawn on their own layer for the point under the pointer, without redrawing the plan", () => {
    const { vp, frames, parts } = setup();
    frames.step(0);
    const clears = parts.hover.ctx.clears;
    vp.setHover({ x: 5, y: 6 });
    frames.step(16);
    expect(hoverCalls).toEqual([{ x: 5, y: 6 }]);
    expect(planCalls).toHaveLength(1);
    expect(parts.hover.ctx.clears).toBe(clears + 1);
  });

  it("are drawn once for a point, and again only when it moves", () => {
    const { vp, frames } = setup();
    frames.step(0);
    vp.setHover({ x: 5, y: 6 });
    frames.step(16);
    vp.setHover({ x: 5, y: 6 });
    frames.step(32);
    vp.setHover({ x: 7, y: 6 });
    frames.step(48);
    expect(hoverCalls).toEqual([
      { x: 5, y: 6 },
      { x: 7, y: 6 },
    ]);
  });

  it("are cleared when the pointer leaves", () => {
    const { vp, frames, parts } = setup();
    vp.setHover({ x: 5, y: 6 });
    frames.step(0);
    const clears = parts.hover.ctx.clears;
    vp.setHover(null);
    frames.step(16);
    expect(hoverCalls).toHaveLength(1);
    expect(parts.hover.ctx.clears).toBe(clears + 1);
  });

  it("follow the plan's camera, sit on a layer the plan's size, and hide in 3D", async () => {
    const { vp, frames, parts } = setup();
    vp.setHover({ x: 5, y: 6 });
    frames.step(0);
    const cam = vp.planCamera();
    if (cam) vp.setPlanCamera({ ...cam, cx: 1 });
    frames.step(16);
    expect(hoverCalls).toHaveLength(2);
    expect(parts.hover.canvas.width).toBe(parts.plan.canvas.width);
    expect(parts.hover.canvas.height).toBe(parts.plan.canvas.height);
    await vp.setView("3d");
    expect(parts.hover.canvas.style.visibility).toBe("hidden");
  });

  it("are left out when there is no hover layer", () => {
    const { vp, frames } = setup({ plan: true, scene: true }, false);
    vp.setHover({ x: 5, y: 6 });
    frames.step(0);
    expect(hoverCalls).toEqual([]);
    expect(planCalls).toHaveLength(1);
  });
});

describe("3D", () => {
  it("loads only when first shown, then gets the map, document, layers, look and camera", async () => {
    const { vp } = setup();
    expect(FakeScene.made).toHaveLength(0);
    await vp.setView("3d");
    expect(FakeScene.made).toHaveLength(1);
    expect(FakeScene.made[0].calls).toEqual([
      "resize 400x300",
      "map",
      "doc",
      "layers",
      "look curvature=false",
      "frame iso",
    ]);
    expect(vp.state()).toEqual({ view: "3d", camera: "iso", ready3d: true });
    await vp.setView("2d");
    await vp.setView("3d");
    expect(FakeScene.made).toHaveLength(1);
  });

  it("is drawn every frame while shown, and reports its build", async () => {
    const { vp, frames } = setup();
    expect(vp.stats()).toEqual({ frames: 0, build: null });
    await vp.setView("3d");
    for (let t = 0; t < 5; t++) frames.step(t * 16);
    expect(FakeScene.made[0].frames).toBe(5);
    expect(vp.stats()).toEqual({ frames: 5, build: { ms: 12, chunks: 3 } });
  });

  it("passes cameras, the look for a time, layers and documents on", async () => {
    const { vp } = setup({ plan: true, scene: true });
    await vp.setView("3d");
    const scene = FakeScene.made[0];
    scene.calls = [];
    vp.setCamera("top");
    vp.setEnvironment({ hour: 21, season: "winter" });
    vp.setLayers({ things: false });
    vp.setDoc(doc);
    vp.fit();
    expect(scene.calls).toEqual([
      "preset top",
      "look curvature=false",
      "layers",
      "doc",
      "frame top",
    ]);
    expect(scene.looks.at(-1)).toMatchObject({ preset: "night", season: "winter" });
  });

  it("is never offered for a map without one", async () => {
    const { vp } = setup({ plan: true, scene: false });
    await vp.setView("3d");
    expect(FakeScene.made).toHaveLength(0);
    expect(vp.state().view).toBe("2d");
  });

  it("losing the GPU context is GLD-STAGE-001, and the plan is shown", async () => {
    const { vp, parts, errors, shownViews } = setup();
    await vp.setView("3d");
    parts.scene.canvas.fire("webglcontextlost");
    expect(errors.map((e) => e.code)).toEqual(["GLD-STAGE-001"]);
    expect(vp.state().view).toBe("2d");
    expect(shownViews).toEqual(["2d"]);
  });

  it("failing to start is GLD-STAGE-001 too", async () => {
    const frames = fakeFrames();
    const errors: GladeError[] = [];
    const vp = createViewport(fakeCanvases().canvases, {
      ...frames,
      load3d: () => Promise.reject(new Error("no WebGL")),
      onError: (e) => errors.push(e),
    });
    vp.show(fakeMap({ plan: true, scene: true }), doc);
    await vp.setView("3d");
    expect(errors.map((e) => e.code)).toEqual(["GLD-STAGE-001"]);
    expect(vp.state()).toMatchObject({ view: "2d", ready3d: false });
  });
});

describe("the loop", () => {
  it("reports the frame rate once a second", () => {
    const { frames, fps } = setup();
    for (let i = 0; i <= 60; i++) frames.step(i * (1000 / 60));
    expect(fps).toEqual([60]);
  });

  it("stops when disposed", async () => {
    const { vp, frames } = setup();
    await vp.setView("3d");
    vp.dispose();
    expect(frames.cancelled()).toBe(1);
    expect(FakeScene.made[0].calls).toContain("dispose");
  });

  it("a map whose views don't include the current one opens in the one it has", () => {
    const frames = fakeFrames();
    const vp = createViewport(fakeCanvases().canvases, { ...frames, load3d });
    vp.show(fakeMap({ plan: false, scene: true }), doc);
    expect(vp.state().view).toBe("3d");
  });
});
