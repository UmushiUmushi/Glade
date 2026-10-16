// Fakes for the viewport's tests in Node: a made-up map with a small style, canvases that record
// what is drawn, a 3D scene that records what it is told, and a frame loop the test steps by hand.

import type { Doc } from "@glade/core";
import type { RenderableMap, Style } from "@glade/render";
import type { MapScene } from "@glade/three";
import type { ShownMap, ViewportCanvases } from "../src/viewport";

const style = {
  units: { heightScale: 1 },
  world: {},
  shared: {},
  presets: { morning: { hour: 7 }, midday: { hour: 12 }, night: { hour: 21 } },
  defaultPreset: "midday",
  seasons: { spring: {}, winter: {} },
  defaultSeason: "spring",
} as unknown as Style;

/** Calls a plan view gets, to check what was drawn and how. */
export const planCalls: { visible: unknown; pxPerUnit: number; layers: Record<string, boolean> }[] =
  [];

export function fakeMap(views: { plan: boolean; scene: boolean; curvature?: boolean }): ShownMap {
  return {
    game: "toy",
    id: "yard",
    space: { unit: "m", bounds: { x: 0, y: 0, w: 40, h: 30 }, grids: {} },
    style: { schema: {} as never, defaults: style },
    ui: { layerNames: () => [{ id: "things", label: "Things", default: true }] },
    views: {
      plan: views.plan
        ? {
            draw: (
              _ctx: unknown,
              _doc: unknown,
              _g: unknown,
              layers: Record<string, boolean>,
              visible: unknown,
              pxPerUnit: number,
            ) => {
              planCalls.push({ visible, pxPerUnit, layers });
            },
          }
        : undefined,
      scene: views.scene ? { capabilities: { curvature: views.curvature ?? false } } : undefined,
    },
    catalog: { entries: [] },
  } as unknown as ShownMap & RenderableMap;
}

export const doc = {
  version: 3,
  game: "toy",
  map: "yard",
  name: "d",
  layers: {},
  meta: {},
} as unknown as Doc;

/** A canvas that records its 2D context's transforms and clears. */
export function fakeCanvas() {
  const ctx = {
    transforms: [] as number[][],
    clears: 0,
    setTransform(...m: number[]) {
      this.transforms.push(m);
    },
    clearRect() {
      this.clears++;
    },
  };
  const listeners = new Map<string, (e: Event) => void>();
  const canvas = {
    width: 0,
    height: 0,
    style: { visibility: "" },
    getContext: () => ctx,
    addEventListener: (type: string, run: (e: Event) => void) => listeners.set(type, run),
    fire: (type: string) => listeners.get(type)?.({ preventDefault() {} } as Event),
  };
  return { canvas, ctx };
}

export function fakeCanvases() {
  const plan = fakeCanvas();
  const scene = fakeCanvas();
  return {
    plan,
    scene,
    canvases: { plan: plan.canvas, scene: scene.canvas } as unknown as ViewportCanvases,
  };
}

/** A 3D scene that records what the viewport asks of it. */
export class FakeScene {
  static made: FakeScene[] = [];
  calls: string[] = [];
  frames = 0;
  looks: unknown[] = [];
  lastBuild = { ms: 12, chunks: 3 };
  stage = {
    world: { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 },
    resize: (w: number, h: number) => this.calls.push(`resize ${w}x${h}`),
    frame: (kind: string) => this.calls.push(`frame ${kind}`),
    switchPreset: (kind: string) => this.calls.push(`preset ${kind}`),
    renderer: { dispose: () => this.calls.push("dispose") },
  };
  constructor(readonly canvas: unknown) {
    FakeScene.made.push(this);
  }
  setMap() {
    this.calls.push("map");
  }
  setDoc() {
    this.calls.push("doc");
  }
  setLayers() {
    this.calls.push("layers");
  }
  setLook(look: unknown, opts: { curvature: boolean }) {
    this.looks.push(look);
    this.calls.push(`look curvature=${opts.curvature}`);
  }
  render() {
    this.frames++;
  }
}

export const load3d = async () => ({
  MapScene: FakeScene as unknown as new (c: HTMLCanvasElement) => MapScene,
});

/** A frame loop stepped by the test: `step(ms)` runs the waiting frame at that time. */
export function fakeFrames() {
  let waiting: ((now: number) => void) | null = null;
  let cancelled = 0;
  return {
    requestFrame: (run: (now: number) => void) => {
      waiting = run;
      return 1;
    },
    cancelFrame: () => {
      cancelled++;
      waiting = null;
    },
    step(now: number) {
      const run = waiting;
      waiting = null;
      run?.(now);
    },
    cancelled: () => cancelled,
  };
}
