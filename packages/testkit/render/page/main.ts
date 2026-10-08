// The page the render goldens open in headless Chrome: one map's demo drawn by @glade/three's
// MapScene with the map's default look, as a planner's 3D view starts. No UI. For each view in
// ?capture=[{ name, request }, ...] it posts { name, png } (or { name, error }) to /api/capture.
// ?map=<game>/<map> picks the map (the game's default map when left out).

import { resolveLook, resolveLookAt, type RenderRequest } from "@glade/render";
import { MapScene } from "@glade/three";
import { bound, games } from "../../src/games";

const query = new URLSearchParams(location.search);
const [gameId, mapId] = (query.get("map") ?? "petit-planet").split("/");
const entry = games[gameId];
if (!entry) throw new Error(`unknown game "${gameId}"`);
const def = entry.game.maps[mapId ?? entry.game.defaultMap];
if (!def) throw new Error(`${gameId} has no map "${mapId}"`);
const samples = entry.maps[def.id];
const map = bound(def, samples);
const style = map.style.defaults;

const canvas = document.querySelector("canvas")!;
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
const scene = new MapScene(canvas);
scene.stage.resize(canvas.width, canvas.height);
scene.setMap(map);
scene.setDoc(samples.demo(map));
scene.setLayers(Object.fromEntries(map.ui.layerNames().map((l) => [l.id, l.default])));

const live = resolveLook(style);
const restore = () => scene.setLook(live, { flat: false, curvature: false });
restore();

const lookFor = (preset?: string, season?: string, time?: number) =>
  time !== undefined && time !== null
    ? resolveLookAt(style, time, season)
    : resolveLook(style, preset, season);

const views = JSON.parse(query.get("capture") ?? "[]") as {
  name: string;
  request: RenderRequest;
}[];
for (const { name, request } of views) {
  let body: { name: string; png?: string; error?: string };
  try {
    body = { name, png: await scene.capture(request, { lookFor, restore }) };
  } catch (e) {
    body = { name, error: e instanceof Error ? e.message : String(e) };
  }
  await fetch("/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
