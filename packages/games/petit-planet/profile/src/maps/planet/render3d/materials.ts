// style.json -> material specs. Every color and value comes from the resolved Look; the host builds
// three.js materials from these specs, adds the shared curvature chunk, and updates uniforms in
// place when only values change, so style edits and preset switches need no page reload and no
// geometry rebuild.
//
// The land (lawn, cushions, leaves, cliff faces) is drawn as the cliff sandbox drew it : its day
// colors, lit by this preset over the day (gladeLand), with the grade undone. Sand, riverbeds,
// paths, water and objects keep three's toon lighting.

import type { MaterialSpec } from "@glade/render";
import type { Look } from "../style";
import { STAMPS_ACROSS, stampTexture } from "./stamps";
import { fieldTexture, LAND_PARS } from "./land";

interface Opts {
  flat: boolean;
  layers: Record<string, boolean>;
}

/** "#rrggbb" -> linear rgb times k. */
function linear(hex: string, k = 1): number[] {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return k * (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  });
}

/** The sun's direction from its azimuth and elevation (degrees), as the host places it. */
function sunDir(azimuth: number, elevation: number): number[] {
  const [az, el] = [(azimuth * Math.PI) / 180, (elevation * Math.PI) / 180];
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

/** Uniforms every land material reads (LAND_PARS and the face's and lawn's own). */
function landUniforms(look: Look, opts: Opts) {
  const land = look.terrain.land;
  const T = land.tone;
  const F = land.face;
  const C = land.cushion;
  const L = land.leaves;
  const sun = look.light.sun;
  const amb = look.light.ambient;
  const day = land.daylight;
  // The land's colors were sampled under the daylight grade; undo that one, so this look's grade
  // (a night tint, say) lands on them like on everything else.
  const grade = (!opts.flat && (day.grade ?? look.light.grade)) || {};
  return {
    uField: fieldTexture(),
    uTone: [
      T.bias,
      T.byHeight,
      T.byNormal,
      T.normalPower,
      T.under,
      T.underWidth,
      T.rim,
      T.rimWidth,
      T.rimWarp,
      T.rimWarpSize,
      T.detail,
      T.detailSize,
      T.patch,
      T.patchSize,
      T.clumps,
      T.bands,
      T.clumpEdge,
      T.shadePatch,
      T.shadeSize,
      T.ground,
      T.groundRim,
    ],
    uLandGrass: look.colors.land.grass,
    uLandFace: look.colors.land.face,
    uLandUpper: look.colors.land.upper,
    uFace: [
      F.topLine,
      F.bandAt,
      F.bandWidth,
      F.soft,
      F.wobble,
      F.wobbleScale,
      F.streaks,
      F.streakScale,
      F.haze,
      F.hazeWidth,
      F.hazeWave,
      F.ambient,
      F.sun,
      F.shade,
      F.blotch,
      F.blotchSize,
      F.vStreaks,
      F.topLight,
      F.seam,
      F.seamAt,
      F.seamWidth,
      F.follow,
      F.period,
      F.lightTo,
      F.seamDepth,
      F.seamSpread,
      F.lavenderAt,
      F.pinkFrom,
      F.pinkTo,
      F.lowAt,
      F.line,
      F.blend,
      F.bandSoft,
      0,
    ],
    uFaceShade: F.shadeTint,
    uFaceGain: look.colors.land.faceGain,
    uLawn: [
      L.topSpacing,
      L.jitter,
      L.size,
      C.coreInset + L.push,
      C.radius,
      L.rand,
      L.soft,
      C.coreShade,
    ],
    uBlend: [T.blend, T.blendFrom, T.blendTo],
    uCoreUnder: C.coreUnder,
    // The pink haze sits just below the cushion's lowest leaves and its backing.
    uHazeDepth: C.depth - C.coreInset + Math.max(L.size * 0.5 + L.layer + L.push, C.coreDrop),
    uSunDir: sunDir(sun.azimuth, sun.elevation),
    uSunCol: linear(sun.color, sun.intensity),
    uSky: linear(amb.sky, amb.intensity),
    uGround: linear(amb.ground, amb.intensity),
    uRefSunDir: sunDir(day.sun.azimuth, day.sun.elevation),
    uRefSunCol: linear(day.sun.color, day.sun.intensity),
    uRefSky: linear(day.ambient.sky, day.ambient.intensity),
    uRefGround: linear(day.ambient.ground, day.ambient.intensity),
    uGradeLift: grade.lift ?? "#000000",
    uGradeGain: grade.gain ?? "#ffffff",
    uGrade: [grade.contrast ?? 1, grade.saturation ?? 1],
    uShadowTint: look.colors.shadowTint ?? "#ffffff",
    uHeightScale: look.units.heightScale,
    uPlain: opts.layers.heights === false ? 1 : 0,
  };
}

// The sun's shadow: recorded for gladeLand (gladeSunShadow, the light it lets through) and the
// shade tint (gladeShade). On a surface turned from the light (ndl its cosine) the lookups are
// noise, so a cast shadow there is faded out. Wraps three's getShadow.
const SHADOW_PARS = /* glsl */ `
float gladeShadow(float s, float intensity, float ndl) {
  float a = clamp((1.0 - s) / max(intensity, 1e-4), 0.0, 1.0);
  a *= smoothstep(0.05, 0.3, ndl);
  gladeShade = max(gladeShade, a);
  float lit = 1.0 - a * intensity;
  gladeSunShadow = min(gladeSunShadow, lit);
  return lit;
}`;

const SHADOW_PATCH: [string, string] = [
  "#include <shadowmap_pars_fragment>",
  `#include <shadowmap_pars_fragment>
#define getShadow(m, sz, i, b, r, c) gladeShadow(getShadow(m, sz, i, b, r, c), i, dot(geometryNormal, directLight.direction))`,
];

/** The land's color replaces three's lighting; the rest keeps it, its shade tinted. */
const LAND_OUT: [string, string] = [
  "#include <opaque_fragment>",
  `if (gladeOwn) outgoingLight = gladeLand(gladeDay, gladeN);
else outgoingLight *= mix(vec3(1.0), uShadowTint, gladeShade * (1.0 - uFlat));
#include <opaque_fragment>`,
];

/** The sandbox's fbm (its weights and octaves) on the shared noise. */
const SANDBOX_FBM = /* glsl */ `
float gladeSbFbm(vec2 p) {
  return 0.5 * gladeNoise(p) + 0.3 * gladeNoise(p * 2.03 + 7.1) + 0.2 * gladeNoise(p * 4.1 + 3.3);
}`;

// ---- terrain: cliff faces, sand, riverbeds ----

const TERRAIN_VERTEX: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
attribute float level;
attribute float face;
attribute float shore;
attribute vec3 edge;
varying float vLevel;
varying float vFace;
varying float vShore;
varying vec3 vEdge;
varying vec3 vWorld;
varying vec3 vWorldN;`,
  ],
  [
    "#include <begin_vertex>",
    `#include <begin_vertex>
vLevel = level; vFace = face; vShore = shore; vEdge = edge;
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldN = normalize(mat3(modelMatrix) * objectNormal);`,
  ],
];

const TERRAIN_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
#include <glade_noise>
${LAND_PARS}
${SANDBOX_FBM}
uniform vec3 uSand, uSandWet, uBed;
uniform vec3 uLandFace[5];
uniform vec3 uLandUpper[5];
uniform float uFace[34];
uniform vec3 uFaceShade;
uniform float uFaceGain;
uniform float uHeightScale, uHazeDepth, uWetWidth, uFlat, uPlain, uBaseLevel;
varying float vLevel;
varying float vFace;
varying float vShore;
varying vec3 vEdge;
varying vec3 vWorld;
varying vec3 vWorldN;
${SHADOW_PARS}
// The face's day color in sRGB: the sandbox's brick on the base level and below
//, the game's band column by absolute height above it (§14).
vec3 gladeFaceColor(vec3 n) {
  float hs = uHeightScale;
  float y = vWorld.y;
  float u = vWorld.x + vWorld.z;
  vec3 cTop = gladeToSRGB(uLandFace[0]), cUpper = gladeToSRGB(uLandFace[1]);
  vec3 cBand = gladeToSRGB(uLandFace[2]), cLower = gladeToSRGB(uLandFace[3]);
  vec3 cSeam = gladeToSRGB(uLandFace[4]);
  float topLine = uFace[0], bandAt = uFace[1], bandWidth = uFace[2], soft = uFace[3];
  float wobble = uFace[4], wobbleScale = uFace[5], streaks = uFace[6], streakScale = uFace[7];
  float haze = uFace[8], hazeWidth = uFace[9], hazeWave = uFace[10];
  float fAmb = uFace[11], fSun = uFace[12], fShade = uFace[13];
  float blotch = uFace[14], blotchSize = uFace[15], vStreaks = uFace[16], topLight = uFace[17];
  float seam = uFace[18], seamAt = uFace[19], seamWidth = uFace[20];
  float period = uFace[22], lightTo = uFace[23], seamDepth = uFace[24], seamSpread = uFace[25];
  float lavAt = uFace[26], pinkFrom = uFace[27], pinkTo = uFace[28], lowAt = uFace[29];
  float lineK = uFace[30];
  float wob = (gladeSbFbm(vec2(u * wobbleScale, y * 3.0)) - 0.5) * 2.0 * wobble;
  float f = fract(y / hs - 1e-4) + wob;
  // The game paints its strata by height: the same band at the same height on every face, a
  // tall cliff and the steps beside it alike ("morning wide shot" and the eco-tank hill: the top
  // step light salmon, the next lavender, the base level salmon). The base level and below keep
  // the sandbox's brick (the calibration blocks).
  bool upper = floor(y / hs - 1e-4) >= uBaseLevel + 0.5;
  // Where a wall goes on above the base level, the column fades into the brick over the top
  // face.blend of the base level (pink, the light line, the lower salmon, then brick), no seam.
  float baseTop = (uBaseLevel + 1.0) * hs;
  float wCol = upper ? 1.0
    : vLevel > uBaseLevel + 1.5 ? smoothstep(baseTop - uFace[31] * hs, baseTop, y + wob * hs) : 0.0;
  vec3 cB = vec3(0.0), cC = vec3(0.0);
  if (wCol < 1.0) {
    float lo = bandAt - bandWidth * 0.5, hi = bandAt + bandWidth * 0.5;
    float bs = uFace[32];
    vec3 c = cLower;
    c = mix(c, cBand, smoothstep(lo - bs, lo + bs, f));
    c = mix(c, cUpper, smoothstep(hi - bs, hi + bs, f));
    // The top line only under the face's own top (where the cushion is), not at every level.
    if (y > vLevel * hs - hs + 1e-3) {
      c = mix(c, cTop, smoothstep(1.0 - topLine - soft * 0.5, 1.0 - topLine + soft * 0.5, f));
    }
    c *= 1.0 + topLight * (fract(y / hs) - 0.5);
    // The seam: two rows of broken dark dashes seamAt up each level, wandering a little.
    float ys = (floor(y / hs) + seamAt) * hs + (gladeSbFbm(vec2(u * 1.5, 4.0)) - 0.5) * 0.08
      + (gladeSbFbm(vec2(u * 6.0, 2.0)) - 0.5) * 0.05;
    float line = exp(-pow((y - ys) / max(seamWidth, 1e-3), 2.0));
    float dash = smoothstep(0.3, 0.62, gladeSbFbm(vec2(u * 2.5, 3.1)))
      * (0.45 + 0.55 * gladeSbFbm(vec2(u * 9.0, 1.3)));
    float line2 = exp(-pow((y - ys + seamWidth * 1.6) / max(seamWidth * 0.8, 1e-3), 2.0));
    float dash2 = smoothstep(0.45, 0.7, gladeSbFbm(vec2(u * 3.3, 8.7)));
    c = mix(c, cSeam, seam * max(line * dash, 0.5 * line2 * dash2));
    // The haze under a cushion's lowest leaves, its lower edge scalloped.
    if (vEdge.x > 0.5) {
      float at = vLevel * hs - uHazeDepth;
      float yh = y + (gladeSbFbm(vec2(u * 4.0, 7.0)) - 0.5) * 2.0 * hazeWave;
      c = mix(c, cTop, haze * smoothstep(at - hazeWidth, at - hazeWidth * 0.4, yh));
    }
    cB = c;
  }
  if (wCol > 0.0) {
    // d: levels down the column from its top (base + period, base + 2 period, ...). Soft,
    // wavering edges; no dashes.
    vec3 uLight = gladeToSRGB(uLandUpper[0]), uSalmon = gladeToSRGB(uLandUpper[1]);
    vec3 uSeamC = gladeToSRGB(uLandUpper[2]), uLav = gladeToSRGB(uLandUpper[3]);
    vec3 uLow = gladeToSRGB(uLandUpper[4]);
    float d = mod(uBaseLevel + period - y / hs + wob, period);
    float s = soft * 2.0;
    vec3 c = mix(uLight, uSalmon, smoothstep(0.3, lightTo, d));
    c = mix(c, uLav, smoothstep(lavAt - s, lavAt + s, d));
    c = mix(c, mix(uLav, uSalmon, 0.6), smoothstep(pinkFrom, pinkTo, d));
    c = mix(c, uLow, smoothstep(lowAt - s * 0.5, lowAt + s, d));
    c = mix(c, uLight, lineK * exp(-pow((d - lowAt) / 0.03, 2.0)));
    float seamL = exp(-pow((d - seamDepth) / max(seamSpread, 1e-3), 2.0));
    c = mix(c, uSeamC, 0.85 * seamL);
    vec2 pc = vec2(u * 6.0, d * 60.0);
    float peb = smoothstep(0.82, 0.9, gladeSbFbm(floor(pc) * 0.37 + 2.0)) * seamL;
    c = mix(c, vec3(0.93, 0.86, 0.8), 0.5 * peb);
    // The lower salmon only mottles, a little darker in its middle.
    c *= 1.0 - 0.06 * smoothstep(lowAt, lowAt + 0.4, d) * (1.0 - smoothstep(period - 0.3, period, d));
    cC = c;
  }
  vec3 c = mix(cB, cC, wCol);
  c *= 1.0 + (gladeSbFbm(vec2(u * 0.8, y * streakScale)) - 0.5) * 2.0 * streaks;
  // Blotches, faint vertical streaks.
  c *= 1.0 + (gladeSbFbm(vec2(u, y) / max(blotchSize, 1e-3)) - 0.5) * 2.0 * blotch;
  c *= 1.0 + (gladeSbFbm(vec2(u * 5.0, y * 0.6) + 9.0) - 0.5) * 2.0 * vStreaks;
  // The face's own light in the day; faces turned away a cooler mauve, easing in round corners.
  // The shade goes by the sun's bearing, so it turns over the whole round of a corner.
  float lit = max(dot(n, uRefSunDir), 0.0);
  vec2 sunH = normalize(uRefSunDir.xz + vec2(1e-5, 0.0));
  float facing = dot(normalize(n.xz + vec2(1e-5, 0.0)), sunH);
  c *= fAmb + fSun * lit;
  c *= mix(fShade * gladeToSRGB(uFaceShade), vec3(1.0), smoothstep(-0.45, 0.65, facing));
  return c;
}`,
  ],
  SHADOW_PATCH,
  [
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `bool gladeOwn = false;
vec3 gladeDay = vec3(1.0);
vec3 gladeN = vec3(0.0, 1.0, 0.0);
vec3 gladeL = uSunDir;
vec3 gladeBase = uBed;
if (uPlain > 0.5) {
  gladeBase = vFace > 1.5 && vFace < 2.5 ? uSand : vec3(0.78, 0.84, 0.72);
} else if (vFace < 1.5) {
  if (uFlat > 0.5) gladeBase = uLandFace[1];
  else {
    gladeOwn = true;
    gladeN = normalize(vWorldN);
    gladeDay = gladeFaceColor(gladeN) * uFaceGain;
    // This preset's sun from the day's direction (face.follow 0), so the faces keep the day's
    // pattern of light and shade through the day, in this light's color and strength.
    gladeL = normalize(mix(uRefSunDir, uSunDir, uFace[21]));
  }
} else if (vFace < 2.5) {
  gladeBase = mix(uSandWet, uSand, smoothstep(uWetWidth * 0.5, uWetWidth, vShore));
  if (uFlat < 0.5) gladeBase *= 1.0 + (gladeNoise(vWorld.xz * 3.0) - 0.5) * 0.06;
  else gladeBase = uSand;
}
vec4 diffuseColor = vec4( gladeBase, opacity );`,
  ],
  [
    LAND_OUT[0],
    LAND_OUT[1].replace("gladeLand(gladeDay, gladeN)", "gladeLand(gladeDay, gladeN, gladeL)"),
  ],
];

// ---- the lawn: grass tops, the sandbox's stamps traced in the shader ----

const LAWN_VERTEX = TERRAIN_VERTEX;

const LAWN_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
#include <glade_noise>
#include <glade_curve_pars>
${LAND_PARS}
uniform mat4 projectionMatrix;
uniform float uLawn[8];
uniform vec3 uBlend;
uniform float uCoreUnder, uFlat, uPlain, uBaseLevel;
varying float vLevel;
varying float vFace;
varying float vShore;
varying vec3 vEdge;
varying vec3 vWorld;
varying vec3 vWorldN;
${SHADOW_PARS}
// Is the lawn grid's cell c the lawn's to draw (in past the top rounding), and its stamp: xyz
// centre, w radius. The stamp sits as the CPU places the real ones (terrain.ts).
bool gladeLawnLeaf(ivec2 c, out vec4 L, out float seed, out float rnd, out float inward) {
  float g = uLawn[0], jit = uLawn[1];
  vec2 xz = (vec2(c) + (vec2(hashI(c.x, c.y, 1), hashI(c.x, c.y, 2)) - 0.5) * jit) * g;
  inward = vEdge.x + dot(xz - vWorld.xz, vEdge.yz);
  if (inward < uLawn[4]) return false;
  float r = uLawn[2] * 0.5 * (1.0 + (hashI(c.x, c.y, 3) - 0.5) * jit);
  L = vec4(xz.x, vWorld.y + uLawn[3] + hashI(c.x, c.y, 6) * 0.02, xz.y, r);
  seed = hashI(c.x, c.y, 4);
  rnd = hashI(c.x, c.y, 5);
  return true;
}
// The lawn as the sandbox drew it: the view ray against the
// stamps standing on the grid, from the camera's end back to here, stopping a step after the first
// solid one; a stamp's edge blends over the stamp behind it; far off, where a stamp is a pixel or
// two, the leaves' average. vV is this point in view space. It writes no depth of its own, so
// whatever lies flat on the ground (paths, landmarks, the viewer's outlines) draws over it.
vec3 gladeLawn(vec3 vV) {
  float g = uLawn[0], coreOut = uLawn[3], soft = uLawn[6], coreShade = uLawn[7];
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 gap = gladeGrassColor(fieldTone(up, vWorld + up * coreOut, 1.0, vEdge.x, uCoreUnder, false)) * coreShade;
  float fw = length(fwidth(vV.xy));
  float stampPx = uLawn[2] * 0.5 / max(fw, 1e-5);
  vec3 avg = mix(gap, gladeGrassColor(fieldTone(up, vWorld + up * coreOut, 1.0, vEdge.x, 1.0, false)), 0.85);
  float far = smoothstep(3.0, 1.2, stampPx) * 0.8;
  if (stampPx < 0.7) return avg;
  // Toward the camera along the ground: to its position, or (orthographic) back along the view.
  bool ortho = projectionMatrix[3][3] > 0.5;
  vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec2 toCam = ortho ? back.xz : cameraPosition.xz - vWorld.xz;
  float run = max(length(toCam), 1e-4);
  vec2 dir = toCam / run;
  vec2 perp = vec2(-dir.y, dir.x);
  float rise = max(ortho ? back.y : cameraPosition.y - vWorld.y, 1e-3) / run;
  run = ortho ? 1e9 : run;
  float reach = min((coreOut + 0.02 + uLawn[2] * 0.6) / rise, min(run, 4.0));
  float solidZ = -1e9, backZ = -1e9, partZ = -1e9, partA = 0.0, solidA = 0.0;
  vec3 solidC = gap, backC = gap, partC = gap;
  int after = -1;
  for (int k = 0; k <= 60; k++) {
    float s = reach - float(k) * g * 0.5;
    if (s < -g * 0.5 || after == 0) break;
    if (after > 0) after--;
    for (int m = -1; m <= 1; m++) {
      vec2 Q = vWorld.xz + dir * s + perp * float(m) * g;
      ivec2 c = ivec2(floor(Q / g + 0.5));
      vec4 L; float seed, rnd, inward;
      if (!gladeLawnLeaf(c, L, seed, rnd, inward)) continue;
      vec3 Cv = (viewMatrix * gladeCurve(vec4(L.xyz, 1.0))).xyz;
      if (Cv.z <= vV.z) continue;
      vec3 H = ortho ? vec3(vV.xy, Cv.z) : vV * (Cv.z / vV.z);
      vec2 loc = (H.xy - Cv.xy) / L.w;
      if (dot(loc, loc) > 1.05) continue;
      float d = gladeLeafShape(loc, seed);
      float aa = max(fw * (ortho ? 1.0 : Cv.z / vV.z) / L.w, 1e-4) * soft;
      float a = smoothstep(aa, -aa, d);
      if (a < 0.02) continue;
      vec3 col = gladeGrassColor(fieldTone(up, L.xyz, 1.0, inward, 1.0, true) + uLawn[5] * (rnd - 0.5));
      if (a >= 0.5) {
        if (Cv.z > solidZ) { backZ = solidZ; backC = solidC; solidZ = Cv.z; solidC = col; solidA = a; }
        else if (Cv.z > backZ) { backZ = Cv.z; backC = col; }
        if (after < 0) after = 4;
      } else if (Cv.z > partZ) { partZ = Cv.z; partC = col; partA = a; }
    }
  }
  vec3 c = solidZ > -1e8 ? mix(backC, solidC, solidA) : gap;
  if (partZ > solidZ) c = mix(c, partC, partA);
  // Toward the middle of a top the stamps fade into the soft average: a flat lawn reads by its
  // edges.
  float middle = uBlend.x * smoothstep(uBlend.y, max(uBlend.z, uBlend.y + 1e-3), vEdge.x);
  c = mix(c, avg, max(far, middle));
  return c;
}`,
  ],
  SHADOW_PATCH,
  [
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `bool gladeOwn = false;
vec3 gladeDay = vec3(1.0);
vec3 gladeN = vec3(0.0, 1.0, 0.0);
gladeLift = vLevel < uBaseLevel + 0.5 ? uTone[19] : 0.0;
vec3 gladeBase = uLandGrass[1];
if (uPlain > 0.5) gladeBase = vec3(0.78, 0.84, 0.72);
else if (uFlat < 0.5) {
  gladeOwn = true;
  // Under a path (shore 0): plain grass, no stamps, so the flat path shows over it.
  if (vShore < 0.5) {
    vec3 up = vec3(0.0, 1.0, 0.0);
    gladeDay = gladeGrassColor(fieldTone(up, vWorld + up * uLawn[3], 1.0, vEdge.x, 1.0, false));
  } else gladeDay = gladeLawn(-vViewPosition);
}
vec4 diffuseColor = vec4( gladeBase, opacity );`,
  ],
  [
    "#include <opaque_fragment>",
    `if (gladeOwn) outgoingLight = gladeLand(gladeDay, gladeN);
else outgoingLight *= mix(vec3(1.0), uShadowTint, gladeShade * (1.0 - uFlat));
#include <opaque_fragment>`,
  ],
];

// ---- the cushions' core: the leaves' backing ----

const CORE_VERTEX: [string, string][] = [
  [
    "#include <common>",
    "#include <common>\nattribute vec3 lip;\nattribute vec3 lipN;\nvarying vec3 vLip;\nvarying vec3 vLipN;\nvarying vec3 vWorld;",
  ],
  [
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvLip = lip;\nvLipN = lipN;\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
  ],
];

const CORE_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
#include <glade_noise>
${LAND_PARS}
uniform float uLawn[8];
uniform float uCoreUnder, uFlat, uPlain;
varying vec3 vLip;
varying vec3 vLipN;
varying vec3 vWorld;
${SHADOW_PARS}`,
  ],
  SHADOW_PATCH,
  [
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `bool gladeOwn = false;
vec3 gladeDay = vec3(1.0);
vec3 gladeN = vec3(0.0, 1.0, 0.0);
vec3 gladeBase = uLandGrass[1];
if (uPlain > 0.5) gladeBase = vec3(0.78, 0.84, 0.72);
else if (uFlat < 0.5) {
  gladeOwn = true;
  vec3 n = normalize(vLipN);
  gladeLift = vLip.z;
  // The tone where the leaves sit (the core is inset behind them), so the gaps match them.
  gladeDay = gladeGrassColor(fieldTone(n, vWorld + n * uLawn[3], vLip.x, vLip.y, uCoreUnder, false)) * uLawn[7];
}
vec4 diffuseColor = vec4( gladeBase, opacity );`,
  ],
  LAND_OUT,
];

// ---- leaf stamps: instanced quads turned to the camera ----

// Each instance's quad is turned to the camera round its position, the diagonal of its matrix
// (radius, 1 + tone, 1 + seed) undone so instanceMatrix * position lands there.
const LEAVES_VERTEX: [string, string][] = [
  [
    "#include <common>",
    "#include <common>\nvarying vec2 vLeafUv;\nvarying float vLeafTone;\nvarying float vLeafSeed;",
  ],
  [
    "#include <beginnormal_vertex>",
    "#include <beginnormal_vertex>\nobjectNormal = vec3(0.0, 1.0, 0.0);",
  ],
  [
    "#include <begin_vertex>",
    `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 gladeDiag = vec3(instanceMatrix[0][0], instanceMatrix[1][1], instanceMatrix[2][2]);
vec3 gladeRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
vec3 gladeUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
transformed = (gladeRight * position.x + gladeUp * position.y) * gladeDiag.x / gladeDiag;
vLeafTone = gladeDiag.y - 1.0;
vLeafSeed = gladeDiag.z - 1.0;
#endif
vLeafUv = position.xy;`,
  ],
];

const LEAVES_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
#include <glade_noise>
${LAND_PARS}
uniform float uLawn[8];
uniform float uFlat, uPlain;
varying vec2 vLeafUv;
varying float vLeafTone;
varying float vLeafSeed;
${SHADOW_PARS}`,
  ],
  SHADOW_PATCH,
  [
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `float gladeD = gladeLeafShape(vLeafUv, vLeafSeed);
float gladeAa = max(fwidth(gladeD), 1e-4) * max(uLawn[6], 0.5);
float gladeA = smoothstep(gladeAa, -gladeAa, gladeD);
if (gladeA < 0.02) discard;
bool gladeOwn = uFlat < 0.5 && uPlain < 0.5;
vec3 gladeDay = gladeGrassColor(vLeafTone);
vec3 gladeN = vec3(0.0, 1.0, 0.0);
vec3 gladeBase = uPlain > 0.5 ? vec3(0.78, 0.84, 0.72) : uLandGrass[1];
vec4 diffuseColor = vec4( gladeBase, gladeA );`,
  ],
  LAND_OUT,
];

/** Contact shading: black, fading out from the wall. */
const CONTACT_VERTEX: [string, string][] = [
  ["#include <common>", "#include <common>\nattribute float fade;\nvarying float vFade;"],
  ["#include <begin_vertex>", "#include <begin_vertex>\nvFade = fade;"],
];

const CONTACT_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
uniform float uContact, uFlat;
varying float vFade;`,
  ],
  [
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `float k = 1.0 - vFade;
vec4 diffuseColor = vec4( diffuse, uContact * k * k * (1.0 - uFlat) );`,
  ],
];

/** Snow on the upward faces of plants and items (winter). */
const OBJECT_VERTEX: [string, string][] = [
  ["#include <common>", "#include <common>\nvarying float vUp;\nvarying vec3 vObjWorld;"],
  [
    "#include <begin_vertex>",
    `#include <begin_vertex>
vec3 gladeN = normal;
vec4 gladeP = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  gladeN = inverse(transpose(mat3(instanceMatrix))) * normal;
  gladeP = instanceMatrix * gladeP;
#endif
vUp = normalize(mat3(modelMatrix) * gladeN).y;
vObjWorld = (modelMatrix * gladeP).xyz;`,
  ],
];

const OBJECT_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
#include <glade_noise>
uniform vec3 uSnow;
uniform float uSnowCover, uFlat;
varying float vUp;
varying vec3 vObjWorld;`,
  ],
  [
    "#include <color_fragment>",
    `#include <color_fragment>
if (uSnowCover > 0.0 && uFlat < 0.5) {
  float n = gladeNoise(vObjWorld.xz * 3.0 + vObjWorld.y * 2.0);
  float m = smoothstep(0.5, 0.75, vUp + (n - 0.5) * 0.35 + (uSnowCover - 0.5) * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnow, m);
}`,
  ],
];

/** Glowing parts (lamps): their own color added as light, as strong as the preset's glow. */
const GLOW_FRAGMENT: [string, string][] = [
  ["#include <common>", "#include <common>\nuniform vec3 uGlow;\nuniform float uFlat;"],
  [
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * uGlow * (1.0 - uFlat);`,
  ],
];

const PATH_VERTEX: [string, string][] = [
  [
    "#include <common>",
    "#include <common>\nattribute vec3 pcolor;\nattribute float pattern;\nattribute vec4 open;\nattribute vec4 corner;\nvarying vec3 vColor;\nvarying float vPattern;\nvarying vec4 vOpen;\nvarying vec4 vCorner;\nvarying vec3 vWorld;",
  ],
  [
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvColor = pcolor;\nvPattern = pattern;\nvOpen = open;\nvCorner = corner;\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
  ],
];

const PATH_FRAGMENT: [string, string][] = [
  [
    "#include <common>",
    `#include <common>
#include <glade_noise>
uniform float uFlat, uPathFringe, uPathCorner;
varying vec3 vColor;
varying float vPattern;
varying vec4 vOpen;
varying vec4 vCorner;
// Outside a corner of radius r whose two sides are q away (both under r): past the arc.
bool gladePastCorner(vec2 q, float r) {
  vec2 d = r - q;
  return d.x > 0.0 && d.y > 0.0 && length(d) > r;
}
varying vec3 vWorld;
// Lobed grass edge along a side: how far (world units) the grass reaches over the path at a.
float gladeLobe(float a, float seed) {
  float p = a / 0.42;
  float k = floor(p);
  float x = fract(p) * 2.0 - 1.0;
  float r = sqrt(max(0.0, 1.0 - x * x)) * (0.55 + 0.45 * gladeHash(vec2(k, seed)));
  float p2 = (a + 0.21) / 0.33;
  float x2 = fract(p2) * 2.0 - 1.0;
  float r2 = sqrt(max(0.0, 1.0 - x2 * x2)) * (0.4 + 0.4 * gladeHash(vec2(floor(p2), seed + 9.0)));
  return max(r, r2);
}`,
  ],
  [
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `if (uPathCorner > 0.0) {
  // Corners with no path on either side are rounded a little (the cell's own corner only).
  vec2 c = vWorld.xz - 2.0 * floor(vWorld.xz / 2.0);
  vec2 o = 2.0 - c;
  if ((vCorner.x > 0.5 && gladePastCorner(c, uPathCorner)) ||
      (vCorner.y > 0.5 && gladePastCorner(vec2(o.x, c.y), uPathCorner)) ||
      (vCorner.z > 0.5 && gladePastCorner(o, uPathCorner)) ||
      (vCorner.w > 0.5 && gladePastCorner(vec2(c.x, o.y), uPathCorner))) discard;
}
vec3 pc = vColor;
float pattern = vPattern;
if (uFlat < 0.5 && uPathFringe > 0.0) {
  // Grass lobes over the sides that border grass, and their soft shade on the path.
  vec2 l = vWorld.xz - 2.0 * floor(vWorld.xz / 2.0);
  float gap = 9.0;
  if (vOpen.x > 0.5) gap = min(gap, l.y - uPathFringe * gladeLobe(vWorld.x, 1.0));
  if (vOpen.y > 0.5) gap = min(gap, 2.0 - l.x - uPathFringe * gladeLobe(vWorld.z, 2.0));
  if (vOpen.z > 0.5) gap = min(gap, 2.0 - l.y - uPathFringe * gladeLobe(vWorld.x, 3.0));
  if (vOpen.w > 0.5) gap = min(gap, l.x - uPathFringe * gladeLobe(vWorld.z, 4.0));
  if (gap < 0.0) discard;
  pc *= 0.82 + 0.18 * smoothstep(0.0, 0.14, gap);
}
if (uFlat < 0.5) {
  // Rounded cobbles, two per tile, with a light grout; plain types just get a soft mottle.
  vec2 cell = vWorld.xz;
  vec2 f = abs(fract(cell) - 0.5);
  float d = length(max(f - 0.28, 0.0));
  float grout = smoothstep(0.1, 0.2, d) * pattern;
  float n = gladeNoise(vWorld.xz * 2.3);
  pc *= mix(0.94 + 0.12 * n, 0.9 + 0.2 * gladeHash(floor(cell)), pattern);
  pc = mix(pc, pc * 0.8 + 0.12, grout);
}
vec4 diffuseColor = vec4( pc, opacity );`,
  ],
];

const WATER_VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <glade_curve_pars>
attribute float kind;
attribute float shore;
attribute vec2 run;
uniform float uTime, uWaveAmp, uWaveSpeed, uWaveScale;
varying float vKind;
varying float vShore;
varying vec2 vUv;
varying vec2 vRun;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  if (kind < 0.5) {
    p.y += (sin(p.x * uWaveScale + uTime * uWaveSpeed * 6.0) + cos(p.z * uWaveScale * 0.8 - uTime * uWaveSpeed * 5.0)) * uWaveAmp;
  }
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vKind = kind; vShore = shore; vUv = uv; vRun = run;
  vec4 mvPosition = viewMatrix * gladeCurve(world);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// Surface: the water's color, darker toward the banks (their shade), soft light patches and
// drifting caustic lines on the bed below, a fresnel sheen. Fall: a dark translucent sheet,
// darkest at the lip, with bands sliding down, thin white streaks, light edges at the run's ends
// and mist toward the landing. Foam: a bubbly white mound whose outer edge breaks into lobes.
const WATER_FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
#include <glade_noise>
uniform vec3 uWater, uFall, uFoam;
uniform float uTime, uOpacity, uShallow, uShoreFoam, uStreaks, uFallSpeed, uWaveScale, uLight, uFlat;
uniform float uEdgeDark, uCaustics, uFallStreaks, uFallEdge;
uniform sampler2D uStamp;
uniform float uStampPeriod, uPatches;
varying float vKind;
varying float vShore;
varying vec2 vUv;
varying vec2 vRun;
varying vec3 vWorld;
// Distance to the nearest and second-nearest jittered point (2D cells), for caustics and foam.
vec2 gladeCells(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = vec2(float(x), float(y));
    vec2 h = vec2(gladeHash(i + c), gladeHash(i + c + 17.3));
    vec2 o = c + 0.5 + 0.4 * sin(uTime * 0.6 + 6.2831 * h) - f;
    float l = dot(o, o);
    if (l < d1) { d2 = d1; d1 = l; } else if (l < d2) d2 = l;
  }
  return sqrt(vec2(d1, d2));
}
void main() {
  vec3 col;
  float a = uOpacity;
  if (vKind < 0.5) {
    col = mix(uWater, mix(uWater, vec3(1.0), 0.35), (1.0 - vShore) * uShallow);
    if (uFlat < 0.5) {
      col *= 1.0 - uEdgeDark * (1.0 - smoothstep(0.0, 0.7, vShore));
      float r = gladeNoise(vWorld.xz * uWaveScale * 0.7 + vec2(uTime * 0.3, -uTime * 0.2));
      col += smoothstep(0.72, 0.9, r) * 0.06;
      // Soft lighter patches, as if the bed showed through: the stamps, large and drifting.
      float st = texture2D(uStamp, vWorld.xz / (uStampPeriod * 2.5) + vec2(uTime * 0.004, uTime * 0.003)).r;
      col *= 1.0 + smoothstep(0.55, 0.85, st) * uPatches;
      // Caustics: bright thin lines where two cells meet, broken up so they read as light.
      vec2 cc = gladeCells(vWorld.xz * 0.9);
      float line = 1.0 - smoothstep(0.0, 0.22, cc.y - cc.x);
      col += line * uCaustics * smoothstep(0.2, 0.8, vShore) * (0.6 + 0.4 * gladeNoise(vWorld.xz * 0.5));
      vec3 v = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
      col = mix(col, col * 1.18 + 0.05, fres * 0.6);
      a = mix(a, 1.0, fres * 0.5);
      float ring = (1.0 - smoothstep(0.0, 0.18, vShore)) * uShoreFoam;
      col = mix(col, uFoam, ring);
    }
  } else if (vKind < 1.5) {
    float u = vUv.x;
    float down = vUv.y;
    if (uFlat > 0.5) {
      col = uFall;
    } else {
      float t = uTime * uFallSpeed;
      // Darkest at the lip, lighter as it falls.
      col = uFall * mix(0.72, 1.0, smoothstep(0.0, 1.6, down));
      // Darker bands sliding down, level across with wavy, dripping lower edges.
      float wave = 0.12 * sin(u * 5.0 + gladeNoise(vec2(u * 3.0, 0.0)) * 4.0) + 0.1 * gladeNoise(vec2(u * 9.0, 5.0));
      float phase = (down + wave) * uStreaks * 0.4 - t * 0.9;
      float band = smoothstep(0.35, 0.5, fract(phase)) * (1.0 - smoothstep(0.85, 1.0, fract(phase)));
      col *= 1.08 - 0.26 * band;
      // Thin white streaks.
      float n = gladeNoise(vec2(u * 11.0, down * 0.35 - t * 0.9));
      float streak = smoothstep(0.76, 0.9, n) * (0.5 + 0.5 * gladeNoise(vec2(u * 3.0, down * 2.0 - t * 2.0)));
      col = mix(col, uFoam, streak * uFallStreaks);
      // Light edges where the run ends.
      float edge = 1.0 - smoothstep(0.03, 0.35, min(u, vRun.x - u));
      col = mix(col, uFoam, edge * uFallEdge);
      // Mist toward the landing.
      col = mix(col, uFoam, smoothstep(0.7, 1.0, down / max(vRun.y, 0.01)) * 0.25);
    }
    a = mix(uOpacity, 1.0, 0.85);
  } else {
    float n = gladeNoise(vec2(vUv.x * 6.0, vUv.y * 3.0 - uTime * 0.8));
    vec2 cc = gladeCells(vec2(vUv.x * 3.5, vUv.y * 2.5 - uTime * 0.3));
    float bubbles = smoothstep(0.35, 0.55, cc.x);
    col = uFoam * (0.93 + 0.07 * n) * (1.0 - 0.08 * (1.0 - bubbles));
    // The outer edge breaks into lobes rather than a straight line.
    float reach = 0.7 + 0.3 * n - 0.25 * (1.0 - bubbles);
    a = (1.0 - smoothstep(reach - 0.15, reach, vUv.y)) * 0.97;
    if (uFlat > 0.5) a = 0.9;
  }
  gl_FragColor = vec4(col * uLight, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Landmark slabs: translucent violet with diagonal hatching, drawn as an overlay. */
const LANDMARK_VERTEX = /* glsl */ `
#include <glade_curve_pars>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * gladeCurve(world);
}`;

const LANDMARK_FRAGMENT = /* glsl */ `
varying vec3 vWorld;
void main() {
  float d = fract((vWorld.x - vWorld.z) / 1.5);
  float line = step(d, 0.094);
  vec4 bg = vec4(120.0, 90.0, 160.0, 0.18 * 255.0) / 255.0;
  vec4 fg = vec4(90.0, 60.0, 120.0, 0.55 * 255.0) / 255.0;
  gl_FragColor = mix(bg, fg, line);
  #include <colorspace_fragment>
}`;

/** Every material the Petit Planet meshes use, for one look. */
export function materials(look: Look, opts: Opts, baseLevel: number): Record<string, MaterialSpec> {
  const c = look.colors;
  const land = { ...landUniforms(look, opts), uBaseLevel: baseLevel };
  const steps = look.toon.steps;
  const toon = (key: string, extra: Partial<MaterialSpec>): MaterialSpec => ({
    key,
    base: "toon",
    color: "#ffffff",
    gradientSteps: steps,
    ...extra,
  });
  const out: Record<string, MaterialSpec> = {
    terrain: toon("pp-terrain", {
      uniforms: {
        ...land,
        uSand: c.sand,
        uSandWet: c.sandWet,
        uBed: c.bed ?? c.strata[c.strata.length - 1],
        uWetWidth: look.terrain.sand.wetWidth,
      },
      vertexPatches: TERRAIN_VERTEX,
      fragmentPatches: TERRAIN_FRAGMENT,
    }),
    lawn: toon("pp-lawn", {
      uniforms: land,
      vertexPatches: LAWN_VERTEX,
      fragmentPatches: LAWN_FRAGMENT,
    }),
    fringe: toon("pp-cushion", {
      side: "double",
      uniforms: land,
      vertexPatches: CORE_VERTEX,
      fragmentPatches: CORE_FRAGMENT,
    }),
    leaves: toon("pp-leaves", {
      side: "double",
      alphaToCoverage: true,
      uniforms: land,
      vertexPatches: LEAVES_VERTEX,
      fragmentPatches: LEAVES_FRAGMENT,
    }),
    paths: {
      key: "pp-paths",
      base: "toon",
      color: "#ffffff",
      polygonOffset: [-1, -2],
      gradientSteps: steps,
      uniforms: {
        uPathFringe: look.paths?.fringe ?? 0,
        uPathCorner: look.paths?.corner ?? 0,
      },
      vertexPatches: PATH_VERTEX,
      fragmentPatches: PATH_FRAGMENT,
    },
    contact: {
      key: "pp-contact",
      base: "basic",
      color: c.occlusion ?? "#000000",
      transparent: true,
      depthWrite: false,
      polygonOffset: [-2, -4],
      fog: true,
      uniforms: { uContact: look.terrain.contact?.strength ?? 0 },
      vertexPatches: CONTACT_VERTEX,
      fragmentPatches: CONTACT_FRAGMENT,
    },
    objects: {
      key: "pp-objects",
      base: "toon",
      color: "#ffffff",
      gradientSteps: look.objects.toonSteps,
      uniforms: { uSnow: c.snow ?? "#ffffff", uSnowCover: look.objects.snow ?? 0 },
      vertexPatches: OBJECT_VERTEX,
      fragmentPatches: OBJECT_FRAGMENT,
    },
    "objects-glow": {
      key: "pp-objects-glow",
      base: "toon",
      color: "#ffffff",
      gradientSteps: look.objects.toonSteps,
      uniforms: { uGlow: c.glow ?? "#000000" },
      fragmentPatches: GLOW_FRAGMENT,
    },
    "objects-glass": {
      key: "pp-objects-glass",
      base: "toon",
      color: "#ffffff",
      gradientSteps: look.objects.toonSteps,
      transparent: true,
      depthWrite: false,
      opacity: look.objects.glass ?? 0.45,
    },
    sea: { key: "pp-sea", base: "toon", color: c.sea ?? c.water, gradientSteps: steps },
    water: {
      key: "pp-water",
      base: "shader",
      transparent: true,
      depthWrite: false,
      fog: true,
      side: "double",
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      uniforms: {
        uWater: c.water,
        uFall: c.fall,
        uFoam: c.foam,
        uOpacity: look.water.opacity,
        uShallow: look.water.shallow ?? 0,
        uShoreFoam: look.water.shoreFoam ?? 0,
        uWaveAmp: look.water.waves.amplitude,
        uWaveSpeed: look.water.waves.speed,
        uWaveScale: look.water.waves.scale,
        uStreaks: look.water.fall.streaks,
        uFallStreaks: look.water.fall.white ?? 0,
        uFallEdge: look.water.fall.edge ?? 0,
        uEdgeDark: look.water.edgeDark ?? 0,
        uCaustics: look.water.caustics ?? 0,
        uStamp: stampTexture(),
        uStampPeriod: 0.7 * STAMPS_ACROSS,
        uPatches: look.water.patches ?? 0,
        uFallSpeed: look.water.fall.speed,
        uLight: Math.min(
          1,
          0.55 + (0.45 * (look.light.ambient.intensity + look.light.sun.intensity)) / 1.8,
        ),
      },
    },
    landmark: {
      key: "pp-landmark",
      base: "shader",
      transparent: true,
      depthWrite: false,
      polygonOffset: [-1, -2],
      vertexShader: LANDMARK_VERTEX,
      fragmentShader: LANDMARK_FRAGMENT,
    },
  };
  if (look.toon.outline.enabled) {
    // Inverted hull: back faces pushed out along their normals.
    out.outline = {
      key: "pp-outline",
      base: "basic",
      color: look.toon.outline.color,
      side: "back",
      uniforms: { uOutlineWidth: 0.04 * look.toon.outline.width },
      vertexPatches: [
        ["#include <common>", "#include <common>\nuniform float uOutlineWidth;"],
        [
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed += normalize(normal) * uOutlineWidth;",
        ],
      ],
    };
  }
  return out;
}
