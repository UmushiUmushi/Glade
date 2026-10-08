// @glade/three: runs a map's render formula in three.js. MapScene builds a map's chunks and
// materials and draws them on a Stage, with the look's sky, light, fog, curvature and
// post-processing, and captures images. No UI and no game: apps build their own 3D view around
// it.

export { MapScene, type CaptureLooks, type LookOptions } from "./map-scene";
export { DEFAULT_WALK, Stage, type CameraKind } from "./stage";
export { curved, MaterialSet, shared, texturesReady } from "./materials";
export { focusing, glowing, grading, needsPost, ungraded, type PostLook } from "./post";
export { captureBounds, captureCamera, poseCamera, RENDER_SIZES } from "./capture";
export {
  boundsCenter,
  boxBounds,
  CAMERA_PRESETS,
  orbitPosition,
  rayPlaneY,
  yawPitch,
  type Bounds,
  type V3,
} from "./pick";
export { geometryOf, unitGeometry } from "./geometry";
