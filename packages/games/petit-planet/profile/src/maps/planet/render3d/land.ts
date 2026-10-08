// The land from the cliff sandbox: what the cushions, leaves, lawn
// and cliff faces share between the geometry builders (TS) and the shaders (GLSL).
//
// - hashI: an integer hash, bit for bit the same in both, so a stamp the CPU instances and the
//   one the lawn shader traces in the same cell are the same stamp.
// - The field: one tileable noise texture (four channels: patch, rim warp, shade, detail) that
//   the CPU samples (bilinear, as the GPU does at mip 0) to bake real leaves' tones, and the
//   shaders sample for the core and the lawn.
// - landTone / LAND_PARS fieldTone: the sandbox's tone, the same formula on both sides.
// - LAND_PARS also holds the leaf stamp's shape, the color ramp, the day-relative light and the
//   grade's inverse.

import type { V3 } from "@glade/render";

export interface CushionLook {
  /** How far the cushion's outline stands past the face. */
  overhang: number;
  /** From the cushion's crest (coreInset above the lawn) down to its foot. */
  depth: number;
  /** Radius of the top rounding; the lawn's own stamps start this far in from the outline. */
  radius: number;
  /** Radius of the lower rounding, from the front back toward the face. */
  tuck: number;
  /** Radius of the outline's convex corners (capped so they cover the block's corner). */
  corner: number;
  /** The leaves' backing sits this far behind them; the lawn is this far below the crest. */
  coreInset: number;
  /** The backing's shade relative to its leaves, and how much it takes their underside dark. */
  coreShade: number;
  coreUnder: number;
  /** How far the backing reaches below the cushion's foot, behind its hanging leaves. */
  coreDrop: number;
}

export interface LeafPlace {
  /** A stamp's diameter. */
  size: number;
  /** Between stamps along a row. */
  spacing: number;
  /** Between rows round the cushion's profile. */
  rowStep: number;
  /** The lawn's grid. */
  topSpacing: number;
  /** Random offset of each stamp in place and size (0..1). */
  jitter: number;
  /** How far a stamp stands off its surface, and how much further the lower rows do. */
  push: number;
  layer: number;
  /** How far a row wanders up and down along its length. */
  rowWave: number;
  /** The lawn's stamps within this distance of the outline are also real leaves. */
  edgeBand: number;
  /** Random tone spread of each stamp. */
  rand: number;
  /** Outline softness of a stamp, in pixels. */
  soft: number;
  /** Rows along the foot of a face with grass below: [out from the face, height]. */
  foot: [number, number][];
  /** Rows along a path's grass sides: [how far over the path, height]. */
  pathRows: [number, number][];
}

export interface ToneLook {
  bias: number;
  byHeight: number;
  byNormal: number;
  normalPower: number;
  under: number;
  underWidth: number;
  rim: number;
  rimWidth: number;
  rimWarp: number;
  rimWarpSize: number;
  detail: number;
  detailSize: number;
  patch: number;
  patchSize: number;
  clumps: number;
  bands: number;
  clumpEdge: number;
  shadePatch: number;
  shadeSize: number;
  /** Added to the tone of grass at the land's default level (the open ground is darker). */
  ground: number;
  /**
   * The lawn's stamps fade into its soft average toward the middle of a top: by `blend`, from
   * `blendFrom` to `blendTo` in from the outline, so a flat lawn reads by its edges.
   */
  blend: number;
  blendFrom: number;
  blendTo: number;
  /**
   * How much of the rim the open ground gets (grass with the `ground` lift): on raised tops the
   * rim is their darker edge band; on the ground, already darker, it read as a dark ring round
   * every pond and drop.
   */
  groundRim: number;
}

export interface FaceLook {
  topLine: number;
  bandAt: number;
  bandWidth: number;
  soft: number;
  wobble: number;
  wobbleScale: number;
  streaks: number;
  streakScale: number;
  haze: number;
  hazeWidth: number;
  hazeWave: number;
  /**
   * The face's own light in the day: ambient + sun * lambert, `shade` times `shadeTint` (sRGB)
   * on faces turned away (the game's shaded faces are a cooler mauve).
   */
  ambient: number;
  sun: number;
  shade: number;
  shadeTint: string;
  /**
   * How much a preset's own sun direction shows on the faces, 0..1. The game keeps the day's
   * pattern (south faces lit, east faces in shade) through the day, so 0: a preset's sun lights
   * the faces from the day's direction, in its own color and strength.
   */
  follow: number;
  /** Convex corners' radius (3D units), at most cushion corner - overhang (concentric). */
  round: number;
  /**
   * Levels above the base level carry one column of bands by absolute height (the game's
   * strata: the same band at the same height on every face), `period` levels deep, counted down
   * from the levels base + period, base + 2 period, ...; positions in levels down that column:
   * light salmon fading to salmon by `lightTo`, the seam at `seamDepth` (`seamSpread` wide, with
   * pebbles), lavender from `lavenderAt`, fading to pink from `pinkFrom` to `pinkTo`, then the
   * lower salmon from `lowAt`, a light line (`line`) on its top edge.
   */
  period: number;
  lightTo: number;
  seamDepth: number;
  seamSpread: number;
  lavenderAt: number;
  pinkFrom: number;
  pinkTo: number;
  lowAt: number;
  line: number;
  /** Levels under the base level's top over which a taller wall's column fades into the brick. */
  blend: number;
  /** Softness of the brick's band edges (fraction of a level). */
  bandSoft: number;
  dent: number;
  dentSize: number;
  blotch: number;
  blotchSize: number;
  vStreaks: number;
  topLight: number;
  seam: number;
  seamAt: number;
  seamWidth: number;
}

export interface DaylightLook {
  sun: { color: string; intensity: number; azimuth: number; elevation: number };
  ambient: { sky: string; ground: string; intensity: number };
  /** The grade the colors were sampled under; the land undoes it (absent: the look's own). */
  grade?: { saturation?: number; contrast?: number; lift?: string; gain?: string };
}

export interface LandLook {
  cushion: CushionLook;
  leaves: LeafPlace;
  tone: ToneLook;
  face: FaceLook;
  /** The midday light and grade, the ones the colors were tuned in. */
  daylight: DaylightLook;
}

// ---- the integer hash ----

/** 0..1, the same as GLSL hashI. */
export function hashI(i: number, j: number, k: number): number {
  let h =
    Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h & 0xffffff) / 16777216;
}

// ---- the noise field ----

/** Texture size and noise cells across it (it tiles every FIELD_CELLS noise cells). */
export const FIELD_SIZE = 512;
export const FIELD_CELLS = 64;

const smooth = (t: number) => t * t * (3 - 2 * t);
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A lattice of hashI values that wraps every FIELD_CELLS cells. */
function lattice(seed: number): Float64Array {
  const P = FIELD_CELLS;
  const t = new Float64Array(P * P);
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) t[y * P + x] = hashI(x, y, seed);
  return t;
}

/** Value noise on a wrapping lattice. */
function vnoise(t: Float64Array, x: number, y: number): number {
  const P = FIELD_CELLS;
  const [xi, yi] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [smooth(x - xi), smooth(y - yi)];
  const [x0, y0] = [mod(xi, P), mod(yi, P)];
  const [x1, y1] = [(x0 + 1) % P, (y0 + 1) % P];
  const top = t[y0 * P + x0] + (t[y0 * P + x1] - t[y0 * P + x0]) * fx;
  const bot = t[y1 * P + x0] + (t[y1 * P + x1] - t[y1 * P + x0]) * fx;
  return top + (bot - top) * fy;
}

/** Three octaves at whole-number frequencies, so the field still tiles. */
function fbm(seed: number): (x: number, y: number) => number {
  const [a, b, c] = [lattice(seed), lattice(seed + 1), lattice(seed + 2)];
  return (x, y) =>
    0.5 * vnoise(a, x, y) +
    0.3 * vnoise(b, 2 * x + 7, 2 * y + 7) +
    0.2 * vnoise(c, 4 * x + 3, 4 * y + 3);
}

let pixels: Uint8Array | null = null;

/** RGBA bytes: r patch, g rim warp, b shade, a detail; built once. */
export function fieldPixels(): Uint8Array {
  if (pixels) return pixels;
  const S = FIELD_SIZE;
  const out = new Uint8Array(S * S * 4);
  const k = FIELD_CELLS / S;
  const channels = [101, 211, 307, 401].map(fbm);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const [x, y] = [(px + 0.5) * k, (py + 0.5) * k];
      const o = (py * S + px) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = Math.round(channels[c](x, y) * 255);
    }
  }
  pixels = out;
  return out;
}

export const fieldTexture = () => ({
  texture: { key: "pp-land-field", width: FIELD_SIZE, height: FIELD_SIZE, data: fieldPixels() },
});

/** The field at q (noise cells), one channel 0..1: bilinear, wrapping, as the GPU's mip 0. */
export function fieldAt(qx: number, qy: number, ch: number): number {
  const S = FIELD_SIZE;
  const m = S - 1; // S is a power of two
  const p = pixels ?? fieldPixels();
  const u = (qx / FIELD_CELLS) * S - 0.5;
  const v = (qy / FIELD_CELLS) * S - 0.5;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const [xa, xb, ya, yb] = [x0 & m, (x0 + 1) & m, (y0 & m) * S, ((y0 + 1) & m) * S];
  const a = p[(ya + xa) * 4 + ch];
  const b = p[(ya + xb) * 4 + ch];
  const c = p[(yb + xa) * 4 + ch];
  const d = p[(yb + xb) * 4 + ch];
  const top = a + (b - a) * fx;
  return (top + (c + (d - c) * fx - top) * fy) / 255;
}

// ---- tone ----

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A grass point's tone: n its normal, p its position, h 0..1
 * up the cushion (1 on the lawn), inward its distance in from the cushion's outline, under how much
 * of the underside's dark it takes. The same as GLSL fieldTone.
 */
export function landTone(
  T: ToneLook,
  n: V3,
  p: V3,
  h: number,
  inward: number,
  under = 1,
  lift = 0,
): number {
  const up = Math.sign(n[1]) * Math.pow(Math.abs(n[1]), T.normalPower);
  const patch =
    fieldAt((p[0] + p[1] * 0.7) / T.patchSize, (p[2] - p[1] * 0.4) / T.patchSize, 0) * 2 - 1;
  const detail =
    fieldAt((p[0] - p[1] * 0.6) / T.detailSize + 17, (p[2] + p[1] * 0.8) / T.detailSize + 17, 3) *
      2 -
    1;
  const warp = fieldAt(p[0] / T.rimWarpSize + 3.7, p[2] / T.rimWarpSize + 9.2, 1) * 2 - 1;
  const shade =
    T.shadePatch > 0
      ? sstep(0.42, 0.62, fieldAt(p[0] / T.shadeSize + 11.3, p[2] / T.shadeSize + 4.7, 2)) *
        sstep(0.3, 0.9, n[1])
      : 0;
  const hh = Math.min(1, Math.max(0, h));
  const rim =
    (lift !== 0 ? T.groundRim : 1) *
    T.byNormal *
    up *
    0.5 *
    T.rim *
    (1 - sstep(0, Math.max(T.rimWidth, 1e-3), inward + warp * T.rimWarp));
  const t =
    T.bias +
    T.byHeight * (hh - 0.5) +
    T.byNormal * up * 0.5 -
    under * T.under * (1 - sstep(0, Math.max(T.underWidth, 1e-3), hh)) +
    patch * T.patch +
    detail * T.detail -
    T.shadePatch * shade -
    rim +
    lift;
  const b = t * T.bands;
  const f = b - Math.floor(b);
  const q = (Math.floor(b) + Math.pow(f, T.clumpEdge)) / T.bands;
  return t + (q - t) * T.clumps;
}

/** The tone of the lawn at a point (facing up, far from any edge unless told). */
export const lawnTone = (T: ToneLook, x: number, y: number, z: number, inward = 9, lift = 0) =>
  landTone(T, [0, 1, 0], [x, y, z], 1, inward, 1, lift);

/** The tone lift of grass whose top is at world height y: tone.ground at the default level. */
export function groundLift(land: LandLook, y: number, heightScale: number, baseLevel: number) {
  return Math.round(y / heightScale) <= baseLevel ? land.tone.ground : 0;
}

// ---- real leaves ----

export interface LeafList {
  matrices: number[];
  colors: string[];
}

/**
 * One stamp at (x, y, z), radius r. The material turns the quad to the camera and reads its
 * diagonal: x the radius, y 1 + tone, z 1 + seed (0..1, its shape).
 */
export function pushLeaf(
  out: LeafList,
  x: number,
  y: number,
  z: number,
  r: number,
  tone: number,
  seed: number,
) {
  out.matrices.push(r, 0, 0, 0, 0, 1 + tone, 0, 0, 0, 0, 1 + seed * 0.999, 0, x, y, z, 1);
  out.colors.push("#ffffff");
}

/**
 * Stamps along a ground line from p0 to p1 (x, z) at height y, out toward n, on the world
 * lattice of `spacing` along the line's direction (so two pieces of one line agree), each
 * jittered and toned as the lawn there. `key` tells rows apart.
 */
export function pushLine(
  out: LeafList,
  land: LandLook,
  p0: [number, number],
  p1: [number, number],
  y: number,
  key: number,
  lift: number,
  keep: (x: number, z: number) => boolean = () => true,
) {
  const L = land.leaves;
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (len < 1e-6) return;
  const t: [number, number] = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
  const n: [number, number] = [t[1], -t[0]];
  const u0 = p0[0] * t[0] + p0[1] * t[1];
  const line =
    Math.round((p0[0] * n[0] + p0[1] * n[1]) * 64) * 31 + Math.round(Math.atan2(t[1], t[0]) * 100);
  const phase = hashI(line, key, 1);
  for (let k = Math.ceil(u0 / L.spacing - phase); (k + phase) * L.spacing < u0 + len; k++) {
    const u = (k + phase) * L.spacing - u0;
    if (u < 0) continue;
    const [h1, h2, h3, h4, h5] = [
      hashI(k, line, key * 8 + 1),
      hashI(k, line, key * 8 + 2),
      hashI(k, line, key * 8 + 3),
      hashI(k, line, key * 8 + 4),
      hashI(k, line, key * 8 + 5),
    ];
    const along = u + (h1 - 0.5) * L.jitter * L.spacing;
    const across = (h2 - 0.5) * L.jitter * L.spacing * 0.5;
    const x = p0[0] + t[0] * along + n[0] * across;
    const z = p0[1] + t[1] * along + n[1] * across;
    if (!keep(x, z)) continue;
    const r = (L.size / 2) * (1 + (h3 - 0.5) * L.jitter);
    const tone = lawnTone(land.tone, x, y, z, 9, lift) + L.rand * (h5 - 0.5);
    pushLeaf(out, x, y + (h2 - 0.5) * L.jitter * 0.04, z, r, tone, h4);
  }
}

/** A ring of stamps round (cx, cz), radius `rad`, at height y, toned as the lawn there. */
export function pushRing(
  out: LeafList,
  land: LandLook,
  cx: number,
  cz: number,
  rad: number,
  y: number,
  lift: number,
  keep: (x: number, z: number) => boolean,
) {
  const L = land.leaves;
  const count = Math.max(5, Math.round((2 * Math.PI * rad) / L.spacing));
  const key = Math.round(cx * 64) * 4099 + Math.round(cz * 64);
  for (let k = 0; k < count; k++) {
    const [h1, h2, h3, h4, h5] = [
      hashI(key, k, 1),
      hashI(key, k, 2),
      hashI(key, k, 3),
      hashI(key, k, 4),
      hashI(key, k, 5),
    ];
    const a = (k / count) * 2 * Math.PI + h1 * 0.3;
    const rr = rad + (h2 - 0.5) * L.jitter * 0.3;
    const [x, z] = [cx + Math.cos(a) * rr, cz + Math.sin(a) * rr];
    if (!keep(x, z)) continue;
    const r = (L.size / 2) * (1 + (h3 - 0.5) * L.jitter);
    pushLeaf(out, x, y, z, r, lawnTone(land.tone, x, y, z, 9, lift) + L.rand * (h5 - 0.5), h4);
  }
}

// ---- GLSL ----

/** sRGB <-> linear, and the land's own color pipeline. Needs glade_noise. */
export const LAND_PARS = /* glsl */ `
uniform sampler2D uField;
uniform float uTone[21];
uniform vec3 uLandGrass[3];
uniform vec3 uSunDir, uSunCol, uSky, uGround;
uniform vec3 uRefSunDir, uRefSunCol, uRefSky, uRefGround;
uniform vec3 uGradeLift, uGradeGain;
uniform vec2 uGrade;
uniform vec3 uShadowTint;
float gladeSunShadow = 1.0;
// tone.ground on grass at the land's default level, set before the tone is read.
float gladeLift = 0.0;
float gladeShade = 0.0;
vec3 gladeToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 gladeToSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float hashI(int i, int j, int k) {
  uint h = (uint(i) * 0x27d4eb2du) ^ (uint(j) * 0x165667b1u) ^ (uint(k) * 0x9e3779b1u);
  h = (h ^ (h >> 15u)) * 0x85ebca6bu;
  h ^= h >> 13u;
  return float(h & 0xFFFFFFu) / 16777216.0;
}
// The field at q (noise cells): lod 0 where a stamp's tone must match the CPU's bake.
vec4 gladeField(vec2 q) { return texture2D(uField, q / ${FIELD_CELLS.toFixed(1)}); }
vec4 gladeField0(vec2 q) { return textureLod(uField, q / ${FIELD_CELLS.toFixed(1)}, 0.0); }
// The sandbox's tone (land.ts landTone); exact selects the lod-0 lookups.
float fieldTone(vec3 n, vec3 p, float h, float inward, float under, bool exact) {
  float bias = uTone[0], byHeight = uTone[1], byNormal = uTone[2], normalPower = uTone[3];
  float tUnder = uTone[4], underWidth = uTone[5], rimK = uTone[6], rimWidth = uTone[7];
  float rimWarp = uTone[8], rimWarpSize = uTone[9], detailK = uTone[10], detailSize = uTone[11];
  float patchK = uTone[12], patchSize = uTone[13], clumps = uTone[14], bands = uTone[15];
  float clumpEdge = uTone[16], shadeK = uTone[17], shadeSize = uTone[18];
  vec2 qp = vec2(p.x + p.y * 0.7, p.z - p.y * 0.4) / patchSize;
  vec2 qd = vec2(p.x - p.y * 0.6, p.z + p.y * 0.8) / detailSize + 17.0;
  vec2 qw = p.xz / rimWarpSize + vec2(3.7, 9.2);
  vec2 qs = p.xz / shadeSize + vec2(11.3, 4.7);
  float patchN, detailN, warpN, shadeN;
  if (exact) {
    patchN = gladeField0(qp).r; detailN = gladeField0(qd).a; warpN = gladeField0(qw).g; shadeN = gladeField0(qs).b;
  } else {
    patchN = gladeField(qp).r; detailN = gladeField(qd).a; warpN = gladeField(qw).g; shadeN = gladeField(qs).b;
  }
  float up = sign(n.y) * pow(abs(n.y), normalPower);
  float hh = clamp(h, 0.0, 1.0);
  float shade = smoothstep(0.42, 0.62, shadeN) * smoothstep(0.3, 0.9, n.y);
  float rim = (gladeLift != 0.0 ? uTone[20] : 1.0) * byNormal * up * 0.5 * rimK
    * (1.0 - smoothstep(0.0, max(rimWidth, 1e-3), inward + (warpN * 2.0 - 1.0) * rimWarp));
  float t = bias + byHeight * (hh - 0.5) + byNormal * up * 0.5
    - under * tUnder * (1.0 - smoothstep(0.0, max(underWidth, 1e-3), hh))
    + (patchN * 2.0 - 1.0) * patchK + (detailN * 2.0 - 1.0) * detailK
    - shadeK * shade - rim + gladeLift;
  float b = t * bands;
  float q = (floor(b) + pow(fract(b), clumpEdge)) / bands;
  return mix(t, q, clumps);
}
// The ramp, in sRGB: dark .. mid .. light, running a little past light for light patches.
vec3 gladeGrassColor(float t) {
  t = clamp(t, 0.0, 1.3);
  vec3 d = gladeToSRGB(uLandGrass[0]), m = gladeToSRGB(uLandGrass[1]), l = gladeToSRGB(uLandGrass[2]);
  return t < 0.5 ? mix(d, m, t * 2.0) : mix(m, l, t * 2.0 - 1.0);
}
// A leaf stamp's signed distance (negative inside) at p in stamp units (radius 1).
float gladeLeafShape(vec2 p, float seed) {
  float n = 6.0 + floor(gladeHash(vec2(seed, 1.7)) * 4.0);
  float a0 = gladeHash(vec2(seed, 3.1)) * 6.2831853;
  float k0 = floor((atan(p.y, p.x) - a0) * n / 6.2831853 + 0.5);
  float d = length(p) - 0.42;
  for (int j = -1; j <= 1; j++) {
    float k = k0 + float(j);
    float kk = mod(k, n);
    float axis = a0 + k * 6.2831853 / n;
    vec2 dir = vec2(cos(axis), sin(axis));
    float len = 0.48 + 0.26 * gladeHash(vec2(seed + kk, 5.0));
    float w = 0.19 + 0.06 * gladeHash(vec2(seed + kk, 9.0));
    float t = clamp(dot(p, dir), 0.0, len);
    d = min(d, length(p - dir * t) - w);
  }
  return d;
}
vec3 gladeIrradiance(vec3 n, vec3 L, vec3 sun, vec3 sky, vec3 gnd, float shadow) {
  return mix(gnd, sky, 0.5 + 0.5 * n.y) + sun * max(dot(n, L), 0.0) * shadow;
}
// The color shown: the day color (sRGB) times this light over the day's at normal n (with the
// sun's shadow and the shade's tint), then the grade undone, so the grade pass lands on it.
// Returns linear light for three's output. L is the direction this light's sun is taken from
// (its own, or the day's for faces that keep the day's pattern, ).
vec3 gladeLand(vec3 dayColor, vec3 n, vec3 L) {
  vec3 now = gladeIrradiance(n, L, uSunCol, uSky, uGround, gladeSunShadow);
  vec3 ref = gladeIrradiance(n, uRefSunDir, uRefSunCol, uRefSky, uRefGround, 1.0);
  vec3 lin = gladeToLinear(dayColor) * now / max(ref, vec3(1e-4));
  lin *= mix(vec3(1.0), uShadowTint, gladeShade);
  vec3 t = clamp(gladeToSRGB(lin), 0.0, 1.0);
  float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = l + (t - l) / max(uGrade.y, 1e-3);
  c = (c - 0.5) / max(uGrade.x, 1e-3) + 0.5;
  vec3 lift = gladeToSRGB(uGradeLift), gain = gladeToSRGB(uGradeGain);
  c = (c - lift) / max(gain - lift, vec3(1e-3));
  return gladeToLinear(clamp(c, 0.0, 1.0));
}
vec3 gladeLand(vec3 dayColor, vec3 n) {
  return gladeLand(dayColor, n, uSunDir);
}`;

// ---- the cushion's shape ----

/** A profile point: d out from the outline (<= 0), y, and its normal (nd out, ny up). */
export type ProfilePoint = [number, number, number, number];

/**
 * The cushion's profile from its foot up to where its top rounding ends: `rows` resampled every `step` of arc (the leaf rows), `all` the outline's points
 * (the swept core).
 */
export function cushionProfile(
  C: CushionLook,
  bottom: number,
  crest: number,
  step: number,
): { rows: ProfilePoint[]; all: ProfilePoint[] } {
  const span = Math.max(crest - bottom, 1e-3);
  const rb = Math.max(1e-3, Math.min(C.tuck, span / 2));
  const rt = Math.max(1e-3, Math.min(C.radius, span / 2));
  /** The outline as points at most `res` apart along it. */
  const outline = (res: number): ProfilePoint[] => {
    const out: ProfilePoint[] = [];
    const arc = (cd: number, cy: number, r: number, q0: number, q1: number) => {
      const n = Math.max(2, Math.ceil((Math.abs(q1 - q0) * r) / res));
      for (let i = out.length ? 1 : 0; i <= n; i++) {
        const q = q0 + ((q1 - q0) * i) / n;
        out.push([cd + r * Math.cos(q), cy + r * Math.sin(q), Math.cos(q), Math.sin(q)]);
      }
    };
    arc(-rb, bottom + rb, rb, -Math.PI / 2, 0);
    const side = crest - rt - (bottom + rb);
    const ns = Math.max(1, Math.ceil(side / res));
    for (let i = 1; i < ns && side > 0; i++) out.push([0, bottom + rb + (side * i) / ns, 1, 0]);
    arc(-rt, crest - rt, rt, 0, Math.PI / 2);
    return out;
  };
  // Rows from a fine outline; the core (under the leaves) needs far fewer points.
  const pts = outline(step / 4);
  const rows: ProfilePoint[] = [];
  let acc = 0;
  let next = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    while (next <= acc + l) {
      const f = l ? (next - acc) / l : 0;
      const m = p.map((v, k) => v + (q[k] - v) * f) as ProfilePoint;
      const nl = Math.hypot(m[2], m[3]) || 1;
      rows.push([m[0], m[1], m[2] / nl, m[3] / nl]);
      next += step;
    }
    acc += l;
  }
  return { rows, all: outline(0.12) };
}

/**
 * The radius of the cushion's rounded convex corner at offset s from the face (turn theta, the
 * two edges' lengths): the style's `corner` at the outline (s = overhang), less further in,
 * capped so the rounding still covers the block's corner and fits its edges.
 */
export function cornerRadius(
  C: CushionLook,
  s: number,
  theta: number,
  lenA: number,
  lenB: number,
): number {
  if (theta <= 1e-6) return 0;
  const interior = Math.PI - theta;
  // About covering the block's corner (r (1 - sin(interior / 2)) <= s, give or take 0.06, as
  // in the sandbox); where the corner still pokes through, the plug (terrain.ts) shows green.
  const cover = (s + 0.06) / Math.max(1e-3, 1 - Math.sin(interior / 2));
  const fit = s + Math.min(lenA, lenB) / 2 / Math.max(Math.tan(theta / 2), 1e-6);
  return Math.max(0, Math.min(C.corner + s - C.overhang, cover, fit));
}

/** Smooth 3D value noise 0..1 (hashI), for denting the faces. */
export function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const fz = smooth(z - zi);
  const sx = xi + seed * 7919;
  const sz = zi + seed * 104729;
  const c000 = hashI(sx, yi, sz);
  const c100 = hashI(sx + 1, yi, sz);
  const c010 = hashI(sx, yi + 1, sz);
  const c110 = hashI(sx + 1, yi + 1, sz);
  const c001 = hashI(sx, yi, sz + 1);
  const c101 = hashI(sx + 1, yi, sz + 1);
  const c011 = hashI(sx, yi + 1, sz + 1);
  const c111 = hashI(sx + 1, yi + 1, sz + 1);
  const a0 = c000 + (c100 - c000) * fx;
  const a1 = c010 + (c110 - c010) * fx;
  const b0 = c001 + (c101 - c001) * fx;
  const b1 = c011 + (c111 - c011) * fx;
  const a = a0 + (a1 - a0) * fy;
  return a + (b0 + (b1 - b0) * fy - a) * fz;
}
