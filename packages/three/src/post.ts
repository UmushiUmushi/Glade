// Post-processing for looks that ask for it (a preset's light.focus, light.glow and light.grade):
// the scene with the distance softened by depth (focus), through three's UnrealBloomPass for a
// soft glow, then a color grade in display space (lift, gain, contrast, saturation), the way a
// game's final color pass settles its palette. A look with none of them renders straight to the
// canvas as before; nothing here runs for it.

import {
  Color,
  DataUtils,
  DepthTexture,
  HalfFloatType,
  OrthographicCamera,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { FocusStyle, GlowStyle, GradeStyle } from "@glade/render";

/** True when a look's glow does anything. */
export const glowing = (g: GlowStyle | undefined | null): g is GlowStyle => !!g && g.strength > 0;

/** True when a look's grade changes anything. */
export const grading = (g: GradeStyle | undefined | null): g is GradeStyle =>
  !!g &&
  ((g.saturation ?? 1) !== 1 ||
    (g.contrast ?? 1) !== 1 ||
    (g.lift ?? "#000000").toLowerCase() !== "#000000" ||
    (g.gain ?? "#ffffff").toLowerCase() !== "#ffffff" ||
    (g.tint ?? [1, 1, 1]).some((v) => v !== 1));

/**
 * The color that the grade turns into `hex`: for colors sampled from the game with the grade in
 * place (the sky, the fog it fades into), so they show as sampled while objects take the grade.
 * The grade pass undone in display space, as the land's shader does it.
 */
export function ungraded(hex: string, g: GradeStyle | null | undefined): Color {
  const out = new Color(hex);
  if (!grading(g)) return out;
  const t = out.clone().convertLinearToSRGB();
  const lift = new Color(g.lift ?? "#000000").convertLinearToSRGB();
  const gain = new Color(g.gain ?? "#ffffff").convertLinearToSRGB();
  const sat = Math.max(g.saturation ?? 1, 1e-3);
  const con = Math.max(g.contrast ?? 1, 1e-3);
  const [tr, tg, tb] = g.tint ?? [1, 1, 1];
  // Not clamped at 1: the scene is rendered in half float, so a sky brighter than white before
  // the grade (a white star under a tint that cuts red) comes out as written after it.
  t.setRGB(t.r / Math.max(tr, 1e-3), t.g / Math.max(tg, 1e-3), t.b / Math.max(tb, 1e-3));
  const l = 0.2126 * t.r + 0.7152 * t.g + 0.0722 * t.b;
  const undo = (v: number, lo: number, hi: number) => {
    const c = (l + (v - l) / sat - 0.5) / con + 0.5;
    return Math.max(0, (c - lo) / Math.max(hi - lo, 1e-3));
  };
  return out.setRGB(
    undo(t.r, lift.r, gain.r),
    undo(t.g, lift.g, gain.g),
    undo(t.b, lift.b, gain.b),
    SRGBColorSpace,
  );
}

/** True when a look's focus softens anything. */
export const focusing = (f: FocusStyle | undefined | null): f is FocusStyle => !!f && f.blur > 0;

export interface PostLook {
  glow: GlowStyle | null;
  grade: GradeStyle | null;
  focus?: FocusStyle | null;
}

/** True when a frame needs the composer at all. */
export const needsPost = (p: PostLook) => glowing(p.glow) || grading(p.grade) || focusing(p.focus);

// Depth of field as one gather in linear light, before the glow: every pixel looks at a fixed
// disc of samples (the widest blur), and a sample counts where its own blur reaches this far, so
// sharp things never smear onto their neighbours and soft land spills over the sky's edge. A
// sample behind this pixel counts only where this pixel's blur reaches too, so a soft background
// cannot creep over a sharp edge in front of it. The sky writes no depth (1.0) and stays sharp.
const FOCUS_TAPS = 32;
const FOCUS = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse, tDepth;
uniform vec2 uTexel;
uniform float uNear, uFar, uOrtho, uFocus, uStart, uEnd, uRadius;
varying vec2 vUv;
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (d >= 1.0) return 1e9;
  return uOrtho > 0.5
    ? -orthographicDepthToViewZ(d, uNear, uFar)
    : -perspectiveDepthToViewZ(d, uNear, uFar);
}
float blurAt(float z) {
  return z > 1e8 ? 0.0 : uRadius * smoothstep(uStart * uFocus, uEnd * uFocus, z);
}
void main() {
  vec4 c0 = texture2D(tDiffuse, vUv);
  float z0 = viewZ(vUv);
  float b0 = blurAt(z0);
  vec3 sum = c0.rgb;
  float weight = 1.0;
  for (int i = 0; i < ${FOCUS_TAPS}; i++) {
    float r = uRadius * sqrt((float(i) + 0.5) / ${FOCUS_TAPS}.0);
    float a = float(i) * 2.39996;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
    float z = viewZ(uv);
    float w = clamp(blurAt(z) - r + 1.0, 0.0, 1.0);
    if (z > z0) w *= clamp(b0 - r + 1.0, 0.0, 1.0);
    sum += texture2D(tDiffuse, uv).rgb * w;
    weight += w;
  }
  gl_FragColor = vec4(sum / weight, c0.a);
}`;

/** The focus pass: reads the color and depth the scene just rendered, writes the softened frame. */
class FocusPass extends Pass {
  private quad: FullScreenQuad;
  private blur = 0;
  readonly material = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uTexel: { value: new Vector2() },
      uNear: { value: 1 },
      uFar: { value: 1000 },
      uOrtho: { value: 0 },
      uFocus: { value: 20 },
      uStart: { value: 1 },
      uEnd: { value: 2 },
      uRadius: { value: 0 },
    },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: FOCUS,
  });

  constructor() {
    super();
    this.quad = new FullScreenQuad(this.material);
  }

  /** The camera that drew the frame, how far it looks, and the look's focus. */
  set(camera: Camera, distance: number, f: FocusStyle): void {
    const u = this.material.uniforms;
    const c = camera as Camera & { near: number; far: number };
    u.uNear.value = c.near;
    u.uFar.value = c.far;
    u.uOrtho.value = camera instanceof OrthographicCamera ? 1 : 0;
    u.uFocus.value = distance;
    u.uStart.value = f.start;
    u.uEnd.value = Math.max(f.end, f.start + 1e-3);
    this.blur = Math.min(f.blur, 64);
  }

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    (u.uTexel.value as Vector2).set(1 / readBuffer.width, 1 / readBuffer.height);
    // blur is per 1000 pixels of height, so a 512 render and a big canvas look alike.
    u.uRadius.value = this.blur * (readBuffer.height / 1000);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

// In display (sRGB) space, after the output pass: gain scales, lift raises the blacks toward its
// color, contrast pivots around mid grey, saturation mixes from the luma.
const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new Color(0, 0, 0) },
    uGain: { value: new Color(1, 1, 1) },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uTint: { value: new Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uLift, uGain, uTint;
uniform float uContrast, uSaturation;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tDiffuse, vUv);
  // Values above 1 (a sky written to come out white under a tint) pass into the grade.
  vec3 c = max(t.rgb, 0.0);
  c = c * uGain + uLift * (1.0 - c);
  c = (c - 0.5) * uContrast + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c *= uTint;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
}`,
};

/** Render, bloom, output and grade for one size: the canvas, or an offscreen w x h target. */
export class Post {
  private composer: EffectComposer;
  private pass: RenderPass;
  private focus: FocusPass;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private size = new Vector2();

  /** `offscreen`: render into the composer's own buffer for reading back (image capture). */
  constructor(
    private renderer: WebGLRenderer,
    private offscreen = false,
  ) {
    // Multisampled like the plain render, so edges stay smooth with post on; the depth resolves
    // into a texture for the focus pass.
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: 4,
      depthTexture: new DepthTexture(1, 1),
    });
    this.composer = new EffectComposer(renderer, target);
    this.pass = new RenderPass(null as unknown as Scene, null as unknown as Camera);
    this.focus = new FocusPass();
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0, 0, 1);
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.pass);
    this.composer.addPass(this.focus);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
    this.composer.renderToScreen = !offscreen;
    if (offscreen) this.composer.setPixelRatio(1);
  }

  /** Match the canvas (pixel ratio included) or an offscreen size. */
  setSize(w: number, h: number): void {
    if (this.size.x === w && this.size.y === h) return;
    this.size.set(w, h);
    if (!this.offscreen) this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  /** `distance`: from the camera to the point it looks at, where the focus is. */
  render(scene: Scene, camera: Camera, look: PostLook, distance: number): void {
    this.pass.scene = scene;
    this.pass.camera = camera;
    const f = look.focus;
    this.focus.enabled = focusing(f) && Number.isFinite(distance) && distance > 0;
    if (f && this.focus.enabled) this.focus.set(camera, distance, f);
    const g = look.glow;
    this.bloom.enabled = glowing(g);
    if (g) {
      this.bloom.strength = g.strength;
      this.bloom.radius = g.radius;
      this.bloom.threshold = g.threshold;
    }
    const gr = look.grade;
    this.grade.enabled = grading(gr);
    if (gr) {
      const u = this.grade.uniforms;
      // The pass works in display space, so lift and gain are display colors too.
      (u.uLift.value as Color).set(gr.lift ?? "#000000").convertLinearToSRGB();
      (u.uGain.value as Color).set(gr.gain ?? "#ffffff").convertLinearToSRGB();
      u.uContrast.value = gr.contrast ?? 1;
      u.uSaturation.value = gr.saturation ?? 1;
      (u.uTint.value as Vector3).fromArray(gr.tint ?? [1, 1, 1]);
    }
    this.composer.render();
  }

  /** After an offscreen render: its pixels as RGBA bytes, bottom row first (as GL reads). */
  read(): Uint8Array {
    const { x: w, y: h } = this.size;
    const half = new Uint16Array(w * h * 4);
    this.renderer.readRenderTargetPixels(this.composer.readBuffer, 0, 0, w, h, half);
    const out = new Uint8Array(w * h * 4);
    for (let i = 0; i < half.length; i++) {
      out[i] = Math.round(Math.min(1, Math.max(0, DataUtils.fromHalfFloat(half[i]))) * 255);
    }
    return out;
  }

  dispose(): void {
    this.composer.dispose();
    this.focus.dispose();
    this.bloom.dispose();
  }
}
