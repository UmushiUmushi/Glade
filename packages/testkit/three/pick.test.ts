// Picking and camera math for the 3D view: pure, like the 2D view math.

import { describe, expect, it } from "vitest";
import { rectToBox } from "@glade/core";
import { terrainAtPoint } from "../../games/petit-planet/profile/src/maps/planet/render2d";
import { hitToMinor } from "../../games/petit-planet/profile/src/maps/planet/render3d/pick";
import { spaceOf } from "../../games/petit-planet/profile/src/maps/planet/space";
import {
  boxBounds,
  fitDistance,
  orbitPosition,
  orthoHalfHeight,
  rayPlaneY,
  yawPitch,
  shadowFit,
  shadowMapSize,
  walkPitch,
  walkRange,
} from "../../three/src/pick";
import { poseCamera } from "../../three/src/capture";
import { Vector3 } from "three";

const spec = { majorW: 160, majorH: 144, areaSize: 16 };

describe("3D picking", () => {
  it("a hit on a top face maps world x, z straight to minor x, y", () => {
    expect(hitToMinor([80.5, 2, 41.25], [0, 1, 0], spec)).toEqual({ x: 80.5, y: 41.25 });
  });

  it("a hit on a cliff face picks the higher block the face belongs to", () => {
    // Block 40 (minor 79..80) at level 3 with a lower neighbor to the east: its east face is the
    // plane x = 81 with normal +x. The hit lies on the boundary; the nudge lands in block 40.
    const p = hitToMinor([81, 2.5, 80], [1, 0, 0], spec);
    expect(terrainAtPoint(p)).toEqual({ x: 40, y: 40 });
    // A west-facing face of block 41 at x = 81 belongs to block 41.
    expect(terrainAtPoint(hitToMinor([81, 2.5, 80], [-1, 0, 0], spec))).toEqual({ x: 41, y: 40 });
  });

  it("clamps to the map", () => {
    expect(hitToMinor([-3, 0, 400], [0, 1, 0], spec)).toEqual({ x: 0, y: 288 - 1e-6 });
  });

  it("intersects rays with a horizontal plane", () => {
    expect(rayPlaneY([10, 10, 10], [0, -1, 1], 2)).toEqual([10, 2, 18]);
    expect(rayPlaneY([0, 10, 0], [1, 0, 0], 2)).toBeNull();
    expect(rayPlaneY([0, 10, 0], [0, 1, 0], 2)).toBeNull(); // pointing away
  });
});

describe("3D camera math", () => {
  it("yaw 0 puts the camera south of the target, 90 east; pitch lifts it", () => {
    const t: [number, number, number] = [100, 0, 100];
    const south = orbitPosition(t, 10, 0, 0);
    expect(south[0]).toBeCloseTo(100);
    expect(south[2]).toBeCloseTo(110);
    const east = orbitPosition(t, 10, 90, 0);
    expect(east[0]).toBeCloseTo(110);
    const above = orbitPosition(t, 10, 0, 90);
    expect(above[1]).toBeCloseTo(10);
  });

  it("yawPitch inverts orbitPosition", () => {
    const t: [number, number, number] = [5, 1, 7];
    const back = yawPitch(orbitPosition(t, 42, 45, 35), t);
    expect(back.yaw).toBeCloseTo(45);
    expect(back.pitch).toBeCloseTo(35);
    expect(back.distance).toBeCloseTo(42);
  });

  it("fits a rect's bounds in the view", () => {
    const box = rectToBox(spaceOf(spec), { grid: "major", x: 16, y: 16, w: 16, h: 16 });
    const area = boxBounds(box, 2, 1, 3);
    expect(area).toEqual({ x0: 32, x1: 64, z0: 32, z1: 64, y0: 1, y1: 3 });
    // The bounding sphere (radius ~22.7) fits in a 40° square view at ~66 units.
    expect(fitDistance(area, 40, 1)).toBeCloseTo(22.69 / Math.sin((20 * Math.PI) / 180), 0);
    // Wider than tall: a landscape canvas fits the height, a portrait one the width.
    expect(orthoHalfHeight(area, 2, 1)).toBe(16);
    expect(orthoHalfHeight(area, 0.5, 1)).toBe(32);
  });

  it("fits the sun's shadow box to the view: small close up, the whole map far out", () => {
    const walk = shadowFit(26, true, 215);
    expect(walk.half).toBeCloseTo(33.8);
    expect(walk.ahead).toBeGreaterThan(0);
    expect(shadowFit(5, false, 215).half).toBe(18);
    expect(shadowFit(900, false, 215).half).toBe(215);
    // The map grows until a blur of 0.25 units is about 4 texels, up to 4096.
    expect(shadowMapSize(34, 0.25)).toBe(2048);
    expect(shadowMapSize(12, 0.25)).toBe(1024);
    expect(shadowMapSize(215, 0.25)).toBe(4096);
  });
});

describe("walk camera zoom and reference poses", () => {
  const walk = {
    fov: 27,
    pitch: 20,
    distance: 20,
    eye: 2.5,
    near: { distance: 16, pitch: 12 },
    far: { distance: 30, pitch: 25 },
  };

  it("zooms from near to far, or 0.4x to 1.6x without them", () => {
    expect(walkRange(walk)).toEqual([16, 30]);
    expect(walkRange({ fov: 30, pitch: 20, distance: 10, eye: 1 })).toEqual([4, 16]);
  });

  it("blends pitch near -> default -> far, flat past the ends", () => {
    expect(walkPitch(walk, 10)).toBe(12);
    expect(walkPitch(walk, 16)).toBe(12);
    expect(walkPitch(walk, 18)).toBeCloseTo(16);
    expect(walkPitch(walk, 20)).toBe(20);
    expect(walkPitch(walk, 25)).toBeCloseTo(22.5);
    expect(walkPitch(walk, 40)).toBe(25);
    expect(walkPitch({ fov: 30, pitch: 20, distance: 10, eye: 1 }, 3)).toBe(20);
  });

  it("puts a pose's figure straight below the screen centre", () => {
    const feet: [number, number, number] = [139, 1.65, 156];
    const { camera, target, distance } = poseCamera({ at: [0, 0], yaw: 0 }, walk, feet, 2.22);
    expect(target).toEqual([139, 4.15, 156]);
    expect(distance).toBe(20);
    expect(camera.fov).toBe(27);
    // Behind the figure to the south, 20 degrees up.
    expect(camera.position.x).toBeCloseTo(139);
    expect(camera.position.z).toBeCloseTo(156 + 20 * Math.cos((20 * Math.PI) / 180));
    const c = new Vector3(...target).project(camera);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    const f = new Vector3(...feet).project(camera);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeLessThan(-0.3);
    // A pose's own values win over the style's; yaw 90 puts the camera to the east.
    const p = poseCamera({ at: [0, 0], yaw: 90, distance: 30, fov: 20 }, walk, feet, 2);
    expect(p.camera.fov).toBe(20);
    expect(p.camera.position.x).toBeGreaterThan(feet[0] + 25);
  });
});
