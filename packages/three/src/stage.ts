// Renderer, cameras, lights, sky, fog, and orbit controls for the 3D view. Presets: top
// (orthographic, north up, matches 2D), iso (35° pitch, 45° yaw), and walk: the game's own camera,
// close behind a player-sized figure at the focus point, with the style's field of view, pitch and
// distance (world.camera.walk). The sun's shadow camera follows the view, so shadows stay sharp
// close up and soft by the style's blur.

import {
  CapsuleGeometry,
  DirectionalLight,
  Group,
  MeshToonMaterial,
  Fog,
  HemisphereLight,
  MOUSE,
  Mesh,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FigureStyle, Look, WalkCameraStyle } from "@glade/render";
import {
  boundsCenter,
  CAMERA_PRESETS,
  fitDistance,
  orbitPosition,
  orthoHalfHeight,
  walkPitch,
  walkRange,
  shadowFit,
  shadowMapSize,
  yawPitch,
  type Bounds,
  type V3,
} from "./pick";
import { applySky, curved, shared, skyMaterial } from "./materials";
import { needsPost, Post, ungraded, type PostLook } from "./post";

export type CameraKind = "top" | "iso" | "walk";

const FOV = 40;

/** Used when the style has no world.camera.walk / world.figure. */
export const DEFAULT_WALK: WalkCameraStyle = { fov: 45, pitch: 14, distance: 5, eye: 1 };
const DEFAULT_FIGURE: FigureStyle = { height: 1.9, radius: 0.34, color: "#c9573a" };

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly persp = new PerspectiveCamera(FOV, 1, 0.5, 5000);
  readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  readonly controls: OrbitControls;
  readonly sun = new DirectionalLight(0xffffff, 1);
  readonly hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  readonly sky: Mesh;
  private readonly skyMat: ShaderMaterial = skyMaterial();
  mode: "persp" | "top" = "persp";
  /** In the walk view: the camera follows the figure at the controls' target. */
  walking = false;
  walkCam: WalkCameraStyle = DEFAULT_WALK;
  /** The player-sized figure, shown in the walk view (feet at its origin). */
  readonly figure = new Group();
  /** Map bounds, for shadow fitting and fit-map. */
  world: Bounds = { x0: 0, x1: 320, y0: 0, y1: 8, z0: 0, z1: 288 };
  /** The style's curvature radius (0 when off) and the viewer's toggle; walk always bends. */
  private lookCurve = 0;
  curveOn = false;
  private fogBase = { near: 200, far: 600 };
  private sunDir = new Vector3(0, 1, 0);
  /** Shadow blur in 3D units, or null to use the style's texel radius as is. */
  private shadowBlur: number | null = null;
  private shadowTexels = 3;
  private shadowKey = "";

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    this.sky = new Mesh(new SphereGeometry(1000, 32, 16), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.buildFigure(DEFAULT_FIGURE);
    this.scene.add(this.figure);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.1;
    this.scene.add(this.sun, this.sun.target, this.hemi);
    this.scene.fog = new Fog(0xffffff, 200, 600);

    this.controls = new OrbitControls(this.persp, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.enableZoom = false; // wheel handled by the view: pan, ctrl/⌘ zoom (as in 2D)
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = (88 * Math.PI) / 180;
    this.setLeftButtonOrbit(false);
  }

  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.mode === "top" ? this.ortho : this.persp;
  }

  /** Left drag selects by default; with space held it orbits. */
  setLeftButtonOrbit(on: boolean): void {
    this.controls.mouseButtons = {
      LEFT: on ? MOUSE.ROTATE : (-1 as MOUSE),
      MIDDLE: MOUSE.PAN,
      RIGHT: MOUSE.ROTATE,
    };
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.postPass?.setSize(w, h);
    this.persp.aspect = w / Math.max(1, h);
    this.persp.updateProjectionMatrix();
    this.updateOrtho(w / Math.max(1, h));
  }

  private orthoHalf = 150;
  private updateOrtho(aspect: number): void {
    this.ortho.top = this.orthoHalf;
    this.ortho.bottom = -this.orthoHalf;
    this.ortho.left = -this.orthoHalf * aspect;
    this.ortho.right = this.orthoHalf * aspect;
    this.ortho.updateProjectionMatrix();
  }

  applyLook(look: Look, curvature: boolean, flat = false): void {
    this.post = flat
      ? { glow: null, grade: null, focus: null }
      : {
          glow: look.light.glow ?? null,
          grade: look.light.grade ?? null,
          focus: look.light.focus ?? null,
        };
    const { sun, ambient } = look.light;
    const az = (sun.azimuth * Math.PI) / 180;
    const el = (sun.elevation * Math.PI) / 180;
    const dir: V3 = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
    this.sunDir.set(...dir).normalize();
    this.sun.color.set(sun.color);
    this.sun.intensity = sun.intensity * Math.PI;
    this.sun.castShadow = !!sun.shadows;
    this.sun.shadow.intensity = sun.shadowOpacity ?? 0.3;
    this.shadowTexels = sun.shadowSoftness ?? 3;
    this.shadowBlur = sun.shadowBlur ?? null;
    this.shadowKey = "";
    const c = boundsCenter(this.world);
    this.fitShadows(new Vector3(...c), this.worldRadius());
    const walk = { ...DEFAULT_WALK, ...look.world.camera?.walk };
    const walkChanged = JSON.stringify(walk) !== JSON.stringify(this.walkCam);
    this.walkCam = walk;
    this.buildFigure({ ...DEFAULT_FIGURE, ...look.world.figure });
    if (this.walking) {
      this.persp.fov = walk.fov;
      if (walkChanged) this.placeWalkCamera(walk.distance);
    }
    this.persp.updateProjectionMatrix();
    this.hemi.color.set(ambient.sky);
    this.hemi.groundColor.set(ambient.ground);
    this.hemi.intensity = ambient.intensity * Math.PI;
    // The sky and the fog that fades into it were sampled with the grade on: undo it for them.
    const grade = this.post.grade;
    (this.scene.fog as Fog).color.copy(ungraded(look.sky.fog.color, grade));
    this.fogBase = { near: look.sky.fog.near, far: look.sky.fog.far };
    this.scene.background = ungraded(look.sky.horizon, grade);
    applySky(this.skyMat, look, grade);
    this.lookCurve = look.world.curvature.enabled ? look.world.curvature.radius : 0;
    this.curveOn = curvature;
    this.renderer.shadowMap.needsUpdate = true;
  }

  worldRadius(): number {
    return 0.5 * Math.hypot(this.world.x1 - this.world.x0, this.world.z1 - this.world.z0);
  }

  /**
   * Fit the sun's orthographic shadow box (half-width `half`) around `center`. The center snaps
   * to whole shadow texels in the light's view so shadows do not shimmer while the view moves;
   * the map is only re-rendered when the box actually changed.
   */
  fitShadows(center: Vector3, half: number): void {
    // Quantize the size so zooming refits in steps, not every frame.
    const q = Math.pow(1.2, Math.ceil(Math.log(Math.max(half, 1)) / Math.log(1.2)));
    const size = this.shadowBlur === null ? 4096 : shadowMapSize(q, this.shadowBlur);
    const texel = (2 * q) / size;
    const d = this.sunDir;
    const right = new Vector3(0, 1, 0).cross(d);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const up = d.clone().cross(right).normalize();
    const r = Math.round(center.dot(right) / texel) * texel;
    const u = Math.round(center.dot(up) / texel) * texel;
    const f = center.dot(d);
    const key = `${size}:${q.toFixed(3)}:${r.toFixed(4)}:${u.toFixed(4)}:${Math.round(f)}`;
    if (key === this.shadowKey) return;
    this.shadowKey = key;
    const snapped = right
      .multiplyScalar(r)
      .add(up.multiplyScalar(u))
      .add(d.clone().multiplyScalar(f));
    const reach = q + 40;
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(d, reach);
    const shadow = this.sun.shadow;
    if (shadow.mapSize.x !== size) {
      shadow.mapSize.set(size, size);
      shadow.map?.dispose();
      shadow.map = null;
    }
    shadow.radius =
      this.shadowBlur === null
        ? this.shadowTexels
        : Math.min(8, Math.max(1, this.shadowBlur / texel));
    const cam = shadow.camera;
    cam.left = -q;
    cam.right = q;
    cam.top = q;
    cam.bottom = -q;
    cam.near = 1;
    cam.far = reach * 2;
    cam.updateProjectionMatrix();
    this.sun.updateMatrixWorld();
    this.sun.target.updateMatrixWorld();
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Shadow box for what the camera looks at now. */
  fitShadowsToView(): void {
    const t = this.controls.target;
    const worldR = this.worldRadius();
    if (this.mode === "top") {
      const half = Math.min(
        worldR,
        (this.orthoHalf / this.ortho.zoom) * Math.max(1, this.persp.aspect),
      );
      this.fitShadows(t.clone(), half);
      return;
    }
    const dist = this.persp.position.distanceTo(t);
    const { half, ahead } = shadowFit(dist, this.walking, worldR);
    const fwd = t.clone().sub(this.persp.position).setY(0);
    if (fwd.lengthSq() > 1e-6) fwd.normalize();
    this.fitShadows(t.clone().addScaledVector(fwd, ahead), half);
  }

  private buildFigure(f: FigureStyle): void {
    const key = JSON.stringify(f);
    if (this.figure.userData.key === key) return;
    this.figure.userData.key = key;
    for (const c of this.figure.children as Mesh[]) {
      c.geometry.dispose();
      (c.material as MeshToonMaterial).dispose();
    }
    this.figure.clear();
    const head = f.radius * 1.15;
    const bodyH = Math.max(f.height - 2 * head, f.radius * 2.2);
    const body = new Mesh(
      new CapsuleGeometry(f.radius, bodyH - 2 * f.radius, 4, 12).translate(0, bodyH / 2, 0),
      curved(new MeshToonMaterial({ color: f.color }), "figure-body"),
    );
    const top = new Mesh(
      new SphereGeometry(head, 16, 12).translate(0, bodyH + head * 0.9, 0),
      curved(new MeshToonMaterial({ color: "#f0d2b4" }), "figure-head"),
    );
    for (const m of [body, top]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.figure.add(m);
    }
    this.figure.visible = this.walking;
  }

  /** Point the active camera at `b` with a preset (or explicit yaw/pitch). */
  frame(kind: CameraKind, b: Bounds, yaw?: number, pitch?: number): void {
    this.setWalking(false);
    const preset = CAMERA_PRESETS[kind];
    const aspect = this.persp.aspect;
    const center = boundsCenter(b);
    if (kind === "top" && pitch === undefined) {
      this.mode = "top";
      this.orthoHalf = orthoHalfHeight(b, aspect);
      this.updateOrtho(aspect);
      this.ortho.zoom = 1;
      this.ortho.position.set(center[0], b.y1 + 400, center[2] + 0.001);
      this.ortho.up.set(0, 1, 0);
      this.ortho.lookAt(center[0], center[1], center[2]);
      this.controls.object = this.ortho;
      this.controls.enableRotate = false;
    } else {
      this.mode = "persp";
      const p = pitch ?? preset.pitch;
      const y = yaw ?? preset.yaw;
      const dist = fitDistance(b, FOV, aspect) * (kind === "walk" ? 0.8 : 1);
      const pos = orbitPosition(center, dist, y, p);
      this.persp.position.set(...pos);
      this.persp.lookAt(center[0], center[1], center[2]);
      this.controls.object = this.persp;
      this.controls.enableRotate = true;
    }
    this.controls.target.set(center[0], center[1], center[2]);
    this.controls.update();
  }

  private setWalking(on: boolean): void {
    this.walking = on;
    this.figure.visible = on;
    this.persp.fov = on ? this.walkCam.fov : FOV;
    this.persp.updateProjectionMatrix();
    if (!on) {
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = (88 * Math.PI) / 180;
    }
  }

  /** Distance from the figure in the walk view; zooming changes it within the style's range. */
  walkDistance = DEFAULT_WALK.distance;

  /** The walk pitch for a distance: the style's pitch, blending to near / far as it zooms. */
  walkPitch(distance: number): number {
    return walkPitch(this.walkCam, distance);
  }

  /**
   * Put the walk camera at `distance` behind the figure, keeping its yaw; pitch follows the zoom
   * unless given (a reference pose).
   */
  private placeWalkCamera(distance: number, yaw?: number, pitch?: number): void {
    const [lo, hi] = walkRange(this.walkCam);
    this.walkDistance = Math.min(hi, Math.max(lo, distance));
    const t = this.controls.target;
    const y = yaw ?? yawPitch([...this.persp.position.toArray()] as V3, [t.x, t.y, t.z]).yaw;
    const p = pitch ?? this.walkPitch(this.walkDistance);
    this.persp.position.set(...orbitPosition([t.x, t.y, t.z], this.walkDistance, y, p));
    this.persp.lookAt(t);
    // Like the game: turn freely, but the pitch belongs to the zoom.
    const polar = ((90 - p) * Math.PI) / 180;
    this.controls.minPolarAngle = this.controls.maxPolarAngle = polar;
    this.controls.update();
  }

  /**
   * The walk view: the figure stands at (x, ground, z) and the camera sits behind it at the
   * style's distance and pitch, looking the way `yaw` says (orbitPosition's convention). A
   * reference pose's `view` overrides distance, pitch and field of view until the next zoom.
   */
  walkAt(
    x: number,
    ground: number,
    z: number,
    yaw: number,
    view?: { distance?: number; pitch?: number; fov?: number },
  ): void {
    const w = this.walkCam;
    this.setWalking(true);
    this.mode = "persp";
    this.controls.target.set(x, ground + w.eye, z);
    this.controls.object = this.persp;
    this.controls.enableRotate = true;
    if (view?.fov) {
      this.persp.fov = view.fov;
      this.persp.updateProjectionMatrix();
    }
    this.placeWalkCamera(view?.distance ?? w.distance, yaw, view?.pitch);
    this.figure.position.set(x, ground, z);
  }

  /**
   * Per frame in the walk view: move the figure by (forward, right) 3D units relative to where the
   * camera looks, turn by `turn` degrees, and keep the camera's eye height over `ground`.
   */
  walkStep(
    forward: number,
    right: number,
    turn: number,
    ground: (x: number, z: number) => number,
    dt: number,
  ): void {
    const t = this.controls.target;
    const cam = this.persp.position;
    if (forward || right) {
      const fwd = t.clone().sub(cam).setY(0);
      if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
      fwd.normalize();
      const side = new Vector3(-fwd.z, 0, fwd.x);
      const move = fwd.multiplyScalar(forward).addScaledVector(side, right);
      const w = this.world;
      move.x = Math.min(w.x1, Math.max(w.x0, t.x + move.x)) - t.x;
      move.z = Math.min(w.z1, Math.max(w.z0, t.z + move.z)) - t.z;
      t.add(move);
      cam.add(move);
    }
    if (turn) {
      const a = (turn * Math.PI) / 180;
      const off = cam.clone().sub(t);
      const [c, s] = [Math.cos(a), Math.sin(a)];
      cam.set(t.x + off.x * c - off.z * s, cam.y, t.z + off.x * s + off.z * c);
    }
    const g = ground(t.x, t.z);
    const dy = (g + this.walkCam.eye - t.y) * Math.min(1, dt * 12);
    t.y += dy;
    cam.y += dy;
    this.figure.position.set(t.x, t.y - this.walkCam.eye, t.z);
  }

  /** Switch preset around the current focus point, keeping roughly the same visible extent. */
  switchPreset(kind: CameraKind): void {
    this.setWalking(false);
    const t = this.controls.target;
    const tan = Math.tan((FOV * Math.PI) / 360);
    const extent =
      this.mode === "top"
        ? this.orthoHalf / this.ortho.zoom
        : this.persp.position.distanceTo(t) * tan;
    const b: Bounds = {
      x0: t.x - extent,
      x1: t.x + extent,
      z0: t.z - extent,
      z1: t.z + extent,
      y0: t.y,
      y1: t.y,
    };
    if (kind === "top") {
      this.frame("top", b);
      this.orthoHalf = extent;
      this.updateOrtho(this.persp.aspect);
      return;
    }
    const preset = CAMERA_PRESETS[kind];
    this.mode = "persp";
    this.persp.position.set(
      ...orbitPosition([t.x, t.y, t.z], extent / tan, preset.yaw, preset.pitch),
    );
    this.persp.lookAt(t);
    this.controls.object = this.persp;
    this.controls.enableRotate = true;
    this.controls.update();
  }

  /** Move the view by a screen delta in CSS px (wheel scrolling), keeping the angle. */
  panBy(dx: number, dy: number, heightPx: number): void {
    const cam = this.camera;
    const target = this.controls.target;
    const worldPerPx =
      this.mode === "top"
        ? (2 * this.orthoHalf) / this.ortho.zoom / heightPx
        : (2 * cam.position.distanceTo(target) * Math.tan((this.persp.fov * Math.PI) / 360)) /
          heightPx;
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1).setY(0);
    if (up.lengthSq() < 1e-6) up.set(0, 0, -1);
    up.normalize();
    const move = right.multiplyScalar(dx * worldPerPx).add(up.multiplyScalar(-dy * worldPerPx));
    cam.position.add(move);
    target.add(move);
    this.controls.update();
  }

  /** Zoom by `factor` (< 1 zooms in) toward a world point. */
  zoomAt(factor: number, toward: Vector3 | null): void {
    const target = this.controls.target;
    const cam = this.camera;
    const f = Math.min(4, Math.max(0.25, factor));
    if (this.walking) {
      if (this.persp.fov !== this.walkCam.fov) {
        this.persp.fov = this.walkCam.fov;
        this.persp.updateProjectionMatrix();
      }
      this.placeWalkCamera(this.walkDistance * f);
      return;
    }
    if (toward) {
      const shift = toward
        .clone()
        .sub(target)
        .multiplyScalar(1 - f);
      shift.y = 0;
      target.add(shift);
      cam.position.add(shift);
    }
    if (this.mode === "top") {
      this.ortho.zoom = Math.min(80, Math.max(0.3, this.ortho.zoom / f));
      this.ortho.updateProjectionMatrix();
    } else {
      const offset = cam.position.clone().sub(target);
      const len = Math.min(3000, Math.max(3, offset.length() * f));
      cam.position.copy(target).add(offset.setLength(len));
    }
    this.controls.update();
  }

  /**
   * Fog for a camera `distance` from what it looks at. The style's near/far suit the game's close
   * camera; farther out they slide back so the focus stays clear and only the horizon fades.
   */
  fitFog(distance: number): void {
    const fog = this.scene.fog as Fog;
    if (!Number.isFinite(distance)) {
      fog.near = fog.far = 1e6;
      return;
    }
    const { near, far } = this.fogBase;
    fog.near = Math.max(near, distance * 1.1);
    fog.far = fog.near + (far - near) * Math.max(1, distance / near);
  }

  /** Per frame: controls, curvature center (the camera's ground point), time, shadow box. */
  tick(dt: number, camera: Camera = this.camera): void {
    this.controls.update(dt);
    shared.uTime.value += dt;
    const t = this.controls.target;
    shared.uCurveCenter.value.set(t.x, t.z);
    shared.uCurveGround.value = this.walking ? t.y - this.walkCam.eye : t.y;
    const bend = this.lookCurve && (this.curveOn || this.walking);
    shared.uCurve.value = bend ? 1 / (2 * this.lookCurve) : 0;
    this.sky.position.copy(camera.position);
    this.fitFog(this.mode === "top" ? Infinity : this.persp.position.distanceTo(t));
    if (this.sun.castShadow) this.fitShadowsToView();
  }

  /** The look's focus, glow and grade, when it has them and the view is not flat; see post.ts. */
  post: PostLook = { glow: null, grade: null, focus: null };
  private postPass: Post | null = null;

  render(camera: Camera = this.camera): void {
    // With post a frame is several renders; count them all for the fps line.
    const post = needsPost(this.post);
    this.renderer.info.autoReset = !post;
    if (!post) {
      this.renderer.render(this.scene, camera);
      this.opaque();
      return;
    }
    this.renderer.info.reset();
    if (!this.postPass) {
      this.postPass = new Post(this.renderer);
      const size = this.renderer.getSize(new Vector2());
      this.postPass.setSize(size.x, size.y);
    }
    this.postPass.render(
      this.scene,
      camera,
      this.post,
      camera.position.distanceTo(this.controls.target),
    );
    this.opaque();
  }

  /**
   * Alpha to coverage (cut-out sprites) writes their edges' alpha into the canvas, and the page
   * behind shows through as a dark rim round each one: set the canvas's alpha to 1, colors kept.
   */
  private opaque(): void {
    const gl = this.renderer.getContext();
    gl.colorMask(false, false, false, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, true);
    this.renderer.resetState();
  }
}
