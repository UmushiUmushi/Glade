// The frame the viewport pages share: a map in <MapViewport> at a fixed size, with the FPS and the
// 3D build time in pills. Each game's viewport page picks its own maps.

import type { Doc } from "@glade/core";
import { Pill } from "@glade/ui";
import {
  MapViewport,
  type CameraKind,
  type ShownMap,
  type ViewKind,
  type Viewport,
} from "@glade/viewport";
import { useMemo, useState } from "react";
import { expect, waitFor, within } from "storybook/test";

export interface ViewportDemoProps {
  map: ShownMap;
  doc: Doc;
  /** What the map is, for its label: "Island". */
  title: string;
  view: ViewKind;
  camera: CameraKind;
  hour: number;
  season?: string;
  onViewport?: (vp: Viewport) => void;
}

export function ViewportDemo(props: ViewportDemoProps) {
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
        map={props.map}
        doc={props.doc}
        view={props.view}
        camera={props.camera}
        environment={environment}
        label={`${props.title}, ${props.view === "3d" ? "3D" : "2D"} view`}
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

/** Waits for the FPS pill to show a number. */
export async function framesReported(canvasElement: HTMLElement): Promise<void> {
  await waitFor(() => expect(within(canvasElement).getByText(/^\d+ FPS$/)).toBeVisible(), {
    timeout: 15000,
  });
}

/** Whether the plan canvas has something drawn in its middle. */
export async function planDrawn(canvasElement: HTMLElement): Promise<void> {
  const plan = canvasElement.querySelector("canvas");
  const ctx = plan?.getContext("2d");
  const x = Math.floor((plan?.width ?? 0) / 2);
  const y = Math.floor((plan?.height ?? 0) / 2);
  await expect(ctx?.getImageData(x, y, 1, 1).data[3]).toBeGreaterThan(0);
}
