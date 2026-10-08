// Material specs -> three.js materials. The host owns the shader chunks every material shares:
// curvature (y -= d² / (2 · radius), d = horizontal distance from the camera's ground point,
// applied after the model matrix; shadows, picking and measurements use the undisplaced world) and
// noise, plus the shared uniforms (time, flat colors, curvature). A game's spec with the same key
// is updated in place: only uniform values change, so style edits and preset switches need no
// recompile and no geometry rebuild.

import {
  BackSide,
  Color,
  DataTexture,
  DoubleSide,
  FrontSide,
  Material,
  MeshBasicMaterial,
  MeshToonMaterial,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  ShaderChunk,
  ShaderMaterial,
  Texture,
  TextureLoader,
  UniformsLib,
  UniformsUtils,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { MaterialSpec, TextureValue, UniformValue } from "@glade/render";
import type { GradeStyle, Look } from "@glade/render";
import { ungraded } from "./post";

// ---- shared shader chunks ----

const CURVE_PARS = /* glsl */ `
uniform float uCurve;
uniform vec2 uCurveCenter;
vec4 gladeCurve(vec4 world) {
  vec2 d = world.xz - uCurveCenter;
  world.y -= dot(d, d) * uCurve;
  return world;
}
`;

const CURVE_PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = viewMatrix * gladeCurve( modelMatrix * mvPosition );
gl_Position = projectionMatrix * mvPosition;
`;

const NOISE = /* glsl */ `
float gladeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float gladeNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gladeHash(i), gladeHash(i + vec2(1.0, 0.0)), u.x),
             mix(gladeHash(i + vec2(0.0, 1.0)), gladeHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gladeFbm(vec2 p) {
  return 0.55 * gladeNoise(p) + 0.3 * gladeNoise(p * 2.13 + 7.1) + 0.15 * gladeNoise(p * 4.37 + 3.3);
}
`;

const chunks = ShaderChunk as unknown as Record<string, string>;
chunks.glade_noise = NOISE;
chunks.glade_curve_pars = CURVE_PARS;

/** Uniforms every material shares. */
export const shared = {
  uCurve: { value: 0 },
  uCurveCenter: { value: new Vector2() },
  /** Ground height at the curvature center: with the camera's height it sets the horizon's dip. */
  uCurveGround: { value: 0 },
  uTime: { value: 0 },
  uFlat: { value: 0 },
};

type Shader = WebGLProgramParametersWithUniforms;

function withCurve(shader: Shader): void {
  shader.uniforms.uCurve = shared.uCurve;
  shader.uniforms.uCurveCenter = shared.uCurveCenter;
  shader.vertexShader =
    CURVE_PARS + shader.vertexShader.replace("#include <project_vertex>", CURVE_PROJECT);
}

/** Give any built-in material (basic, line) the curvature chunk. */
export function curved<T extends Material>(m: T, key: string): T {
  m.onBeforeCompile = (s) => withCurve(s);
  m.customProgramCacheKey = () => `glade-curved-${key}`;
  return m;
}

function gradientMap(steps: number): DataTexture {
  const n = Math.max(2, Math.round(steps));
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.round(255 * (0.5 + (0.5 * i) / (n - 1)));
  const t = new DataTexture(data, n, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const isTexture = (v: unknown): v is TextureValue => !!v && typeof v === "object" && "texture" in v;

/** Textures by key, uploaded once and shared by every material that names them. */
const textures = new Map<string, Texture>();
/** Images still loading. */
const loading = new Set<Promise<unknown>>();
const loader = new TextureLoader();

/** Resolves once every texture image asked for so far has loaded (or failed). */
export async function texturesReady(): Promise<void> {
  while (loading.size) await Promise.all([...loading]);
}

function textureOf({ texture: t }: TextureValue): Texture {
  let tex = textures.get(t.key);
  if (!tex) {
    if ("url" in t) {
      const done = loader.loadAsync(t.url).then(
        (img) => {
          tex!.image = img.image;
          tex!.needsUpdate = true;
        },
        (e) => console.warn(`texture ${t.key}: ${e}`),
      );
      loading.add(done);
      void done.finally(() => loading.delete(done));
      // Mid grey until it loads (a detail map's neutral value), not black.
      const grey = document.createElement("canvas");
      grey.width = grey.height = 1;
      const g = grey.getContext("2d")!;
      g.fillStyle = "#808080";
      g.fillRect(0, 0, 1, 1);
      tex = new Texture(grey);
      tex.needsUpdate = true;
    } else {
      tex = new DataTexture(t.data, t.width, t.height, RGBAFormat);
      tex.needsUpdate = true;
    }
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    // The ground is seen at a low angle: keep its detail along the view.
    tex.anisotropy = 8;
    textures.set(t.key, tex);
  }
  return tex;
}

/** A uniform value as three.js wants it: colors as Color, color lists as Color[], textures. */
function uniformValue(v: UniformValue): unknown {
  if (isTexture(v)) return textureOf(v);
  if (isColor(v)) return new Color(v);
  if (Array.isArray(v) && v.length && isColor(v[0]))
    return (v as string[]).map((c) => new Color(c));
  return Array.isArray(v) ? [...v] : v;
}

/** Update a uniform in place (keeps Color and array identities). */
function setUniform(u: { value: unknown }, v: UniformValue): void {
  if (isColor(v) && u.value instanceof Color) u.value.set(v);
  else if (Array.isArray(v) && Array.isArray(u.value) && u.value.length === v.length) {
    v.forEach((x, i) => {
      const cur = (u.value as unknown[])[i];
      if (cur instanceof Color && isColor(x)) cur.set(x);
      else (u.value as unknown[])[i] = x;
    });
  } else u.value = uniformValue(v);
}

const SIDES = { front: FrontSide, back: BackSide, double: DoubleSide };

interface Built {
  spec: MaterialSpec;
  material: Material;
  uniforms: Record<string, { value: unknown }>;
}

/** The game's materials, rebuilt only when a spec's key changes. */
export class MaterialSet {
  private built = new Map<string, Built>();

  get(name: string): Material | undefined {
    return this.built.get(name)?.material;
  }

  has(name: string): boolean {
    return this.built.has(name);
  }

  /** Apply a fresh set of specs; returns true when the set of names or programs changed. */
  apply(specs: Record<string, MaterialSpec>): boolean {
    let changed = false;
    for (const [name, b] of this.built) {
      if (!specs[name] || specs[name].key !== b.spec.key) {
        b.material.dispose();
        this.built.delete(name);
        changed = true;
      }
    }
    for (const [name, spec] of Object.entries(specs)) {
      const b = this.built.get(name);
      if (b) this.update(b, spec);
      else {
        this.built.set(name, this.build(spec));
        changed = true;
      }
    }
    return changed;
  }

  private build(spec: MaterialSpec): Built {
    const uniforms: Record<string, { value: unknown }> = {};
    for (const [k, v] of Object.entries(spec.uniforms ?? {}))
      uniforms[k] = { value: uniformValue(v) };
    let material: Material;
    if (spec.base === "shader") {
      const m = new ShaderMaterial({
        uniforms: UniformsUtils.merge([UniformsLib.fog]),
        vertexShader: spec.vertexShader ?? "",
        fragmentShader: spec.fragmentShader ?? "",
        fog: spec.fog ?? false,
      });
      Object.assign(m.uniforms, uniforms, shared);
      material = m;
    } else {
      const params = { color: spec.color ?? "#ffffff" };
      const m = spec.base === "toon" ? new MeshToonMaterial(params) : new MeshBasicMaterial(params);
      const patch = (s: Shader) => {
        withCurve(s);
        Object.assign(s.uniforms, uniforms, { uTime: shared.uTime, uFlat: shared.uFlat });
        for (const [a, b] of spec.vertexPatches ?? [])
          s.vertexShader = s.vertexShader.replace(a, b);
        for (const [a, b] of spec.fragmentPatches ?? []) {
          s.fragmentShader = s.fragmentShader.replace(a, b);
        }
      };
      m.onBeforeCompile = patch;
      if (spec.fog !== undefined) m.fog = spec.fog;
      material = m;
    }
    material.customProgramCacheKey = () => `glade-${spec.key}`;
    const b: Built = { spec, material, uniforms };
    this.update(b, spec);
    return b;
  }

  private update(b: Built, spec: MaterialSpec): void {
    b.spec = spec;
    const m = b.material;
    for (const [k, v] of Object.entries(spec.uniforms ?? {})) {
      if (b.uniforms[k]) setUniform(b.uniforms[k], v);
    }
    m.side = SIDES[spec.side ?? "front"];
    m.transparent = spec.transparent ?? false;
    m.depthWrite = spec.depthWrite ?? true;
    m.opacity = spec.opacity ?? 1;
    m.alphaToCoverage = !!spec.alphaToCoverage;
    m.polygonOffset = !!spec.polygonOffset;
    [m.polygonOffsetFactor, m.polygonOffsetUnits] = spec.polygonOffset ?? [0, 0];
    if (m instanceof MeshToonMaterial || m instanceof MeshBasicMaterial) {
      m.color.set(spec.color ?? "#ffffff");
    }
    if (m instanceof MeshToonMaterial) {
      m.gradientMap?.dispose();
      m.gradientMap = spec.gradientSteps ? gradientMap(spec.gradientSteps) : null;
    }
  }
}

/**
 * The sky dome: a gradient from horizon through an optional middle stop to top (by degrees above
 * the horizon), white dot stars and yellow five-pointed stars down to the horizon, shooting
 * stars, glowing glyphs, and drifting clouds.
 */
export function skyMaterial(): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: {
      uTop: { value: new Color() },
      uMid: { value: new Color() },
      uHorizon: { value: new Color() },
      uClouds: { value: new Color() },
      uStarColor: { value: new Color() },
      uSparkColor: { value: new Color() },
      uMidAt: { value: 0 },
      uTopAt: { value: 90 },
      uStarAlpha: { value: 0.5 },
      uSparkles: { value: 0 },
      uCloudAlpha: { value: 0.6 },
      uMeteors: { value: 0 },
      uGlyphs: { value: 0 },
      uGlyphShape: { value: 0 },
      uGlyphSize: { value: 3 },
      uGlyphColor: { value: new Color() },
      uTime: shared.uTime,
      uCurve: shared.uCurve,
      uCurveGround: shared.uCurveGround,
    },
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`,
    fragmentShader: /* glsl */ `
${NOISE}
uniform vec3 uTop, uMid, uHorizon, uClouds, uStarColor, uSparkColor;
uniform float uMidAt, uTopAt, uStarAlpha, uSparkles, uCloudAlpha, uTime, uCurve, uCurveGround;
uniform float uMeteors, uGlyphs, uGlyphShape, uGlyphSize;
uniform vec3 uGlyphColor;
varying vec3 vDir;
// Signed distance to a glyph (unit size, centered): 0 paw, 1 heart, 2 crescent moon.
// A five-pointed star of outer radius r, inner radius ratio rf (Inigo Quilez's sdStar5).
float gladeStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float hh = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * hh) * sign(p.y * ba.x - p.x * ba.y);
}
float gladeGlyph(vec2 p, float shape) {
  if (shape < 0.5) {
    float pad = length((p - vec2(0.0, -0.14)) / vec2(0.26, 0.2)) - 1.0;
    pad *= 0.2;
    float toes = min(
      min(length(p - vec2(-0.27, 0.1)), length(p - vec2(0.27, 0.1))) - 0.09,
      min(length(p - vec2(-0.1, 0.28)), length(p - vec2(0.1, 0.28))) - 0.1);
    return min(pad, toes);
  }
  if (shape < 1.5) {
    // Inigo Quilez's heart, scaled to about 0.7 across.
    vec2 q = vec2(abs(p.x), p.y + 0.3) * 1.6;
    if (q.y + q.x > 1.0) return (length(q - vec2(0.25, 0.75)) - 0.35355) / 1.6;
    vec2 e = q - 0.5 * max(q.x + q.y, 0.0);
    return sqrt(min(dot(q - vec2(0.0, 1.0), q - vec2(0.0, 1.0)), dot(e, e))) * sign(q.x - q.y) / 1.6;
  }
  return max(length(p) - 0.3, -(length(p - vec2(0.13, 0.08)) - 0.26));
}
void main() {
  vec3 d = normalize(vDir);
  // Measure up from the horizon the viewer sees: on a curved world it dips below level by
  // atan(2 sqrt(h k)) for a camera h above the ground (k = uCurve), so the walk camera, which
  // looks down past level, still sees the whole gradient, stars and all.
  float dip = uCurve > 0.0 ? atan(2.0 * sqrt(max(cameraPosition.y - uCurveGround, 0.0) * uCurve)) : 0.0;
  // Below the horizon the sky continues as a reflection of itself (with its own stars), so a
  // camera looking down past the land, as the top and iso views do on a flat world, sees sky.
  float raw = asin(clamp(d.y, -1.0, 1.0)) + dip;
  float below = step(raw, 0.0);
  float el = abs(raw);
  float t = clamp(sin(el), 0.0, 1.0);
  // The reflection stays near the horizon's color for longer, so the land's edge meets it softly.
  float deg = degrees(el) * mix(1.0, 0.35, below);
  vec3 col;
  if (uMidAt > 0.0) {
    col = deg < uMidAt
      ? mix(uHorizon, uMid, smoothstep(0.0, uMidAt, deg))
      : mix(uMid, uTop, smoothstep(uMidAt, max(uTopAt, uMidAt + 1.0), deg));
  } else {
    col = mix(uHorizon, uTop, pow(uTopAt >= 90.0 ? t : clamp(deg / uTopAt, 0.0, 1.0), 0.55));
  }
  vec2 sp = vec2(atan(d.z, d.x) * 60.0, el * 60.0 + below * 1000.0);
  vec2 cell = floor(sp);
  float h = gladeHash(cell);
  vec2 f = fract(sp) - 0.5;
  // Stars reach down to the horizon (only the last sliver fades), so a camera that sees just
  // the low sky, as the iso and top views do on a flat world, still sees them.
  float up = smoothstep(-0.005, 0.03, t);
  float star = step(0.985, h) * smoothstep(0.18, 0.0, length(f)) * up;
  col = mix(col, uStarColor, clamp(star * uStarAlpha * (0.6 + 0.4 * sin(uTime * 2.0 + h * 40.0)), 0.0, 1.0));
  // Bigger stars: warm yellow five-pointed stars in some cells, turned at random, twinkling, with
  // a soft glow that grows with uSparkles (night).
  vec2 sq = sp / 2.2;
  vec2 sc = floor(sq);
  float h2 = gladeHash(sc + 91.7);
  vec2 g = fract(sq) - 0.5 - 0.3 * (vec2(gladeHash(sc + 5.1), gladeHash(sc + 8.3)) - 0.5);
  float rs = gladeHash(sc + 2.2) * 6.2832;
  g = vec2(g.x * cos(rs) - g.y * sin(rs), g.x * sin(rs) + g.y * cos(rs));
  float sd = gladeStar5(g, 0.06 + 0.07 * gladeHash(sc + 3.3), 0.42);
  float body = 1.0 - smoothstep(-0.005, 0.02, sd);
  float glow = exp(-max(sd, 0.0) * 30.0) * 0.6 * uSparkles;
  float twinkle = 0.75 + 0.25 * sin(uTime * 1.3 + h2 * 50.0);
  float spark = step(0.9, h2) * (body + glow) * up;
  col = mix(col, uSparkColor, clamp(spark * uSparkles * uStarAlpha * twinkle, 0.0, 1.0));
  // Shooting stars: parallel streaks rising to the right, each a thin line with a bright head
  // fading along its tail, drifting slowly along itself.
  if (uMeteors > 0.0) {
    vec2 m = sp / vec2(14.0, 6.0);
    float ang = 0.42;
    vec2 r = vec2(m.x * cos(ang) + m.y * sin(ang), -m.x * sin(ang) + m.y * cos(ang));
    r.x -= uTime * 0.05;
    vec2 cellM = vec2(floor(r.x / 3.0), floor(r.y));
    float hm = gladeHash(cellM + 41.3);
    float along = fract(r.x / 3.0);
    float across = fract(r.y) - (0.2 + 0.6 * gladeHash(cellM + 7.7));
    float len = 0.4 + 0.5 * gladeHash(cellM + 2.9);
    float head = 0.95;
    float tail = smoothstep(head - len, head, along) * step(along, head);
    float width = 0.02 + 0.035 * tail;
    float line = (1.0 - smoothstep(width * 0.3, width, abs(across))) * tail;
    col = mix(col, vec3(1.0), clamp(line * step(1.0 - uMeteors * 0.6, hm) * up, 0.0, 1.0));
  }
  // Glyphs: rare glowing shapes, each with a soft halo.
  if (uGlyphs > 0.0) {
    vec2 gq = sp / (uGlyphSize * 2.2);
    vec2 gc = floor(gq);
    float hg = gladeHash(gc + 13.1);
    vec2 gp = (fract(gq) - 0.5 - 0.2 * (vec2(gladeHash(gc + 5.0), gladeHash(gc + 9.0)) - 0.5)) * 2.2;
    float rot = (gladeHash(gc + 1.7) - 0.5) * 0.9;
    gp = vec2(gp.x * cos(rot) - gp.y * sin(rot), gp.x * sin(rot) + gp.y * cos(rot));
    float sd = gladeGlyph(gp, uGlyphShape);
    float on = step(1.0 - uGlyphs * 0.12, hg) * up;
    float body = 1.0 - smoothstep(-0.01, 0.02, sd);
    float halo = exp(-max(sd, 0.0) * 14.0) * 0.45;
    vec3 gcol = mix(uGlyphColor, vec3(1.0, 0.97, 0.8), smoothstep(0.0, -0.12, sd) * 0.5);
    col = mix(col, uGlyphColor, clamp(halo * on, 0.0, 1.0));
    col = mix(col, gcol, clamp(body * on, 0.0, 1.0));
  }
  vec2 cp = d.xz / max(t + 0.25, 0.08) * 1.4 + vec2(uTime * 0.01, 0.0);
  float c = smoothstep(0.7, 0.82, gladeFbm(cp)) * smoothstep(0.0, 0.06, t) * uCloudAlpha;
  col = mix(col, uClouds, c);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
  });
  m.customProgramCacheKey = () => "glade-sky";
  return m;
}

/** `grade`: the look's grade when it runs; the sky's colors are undone against it (post.ts). */
export function applySky(m: ShaderMaterial, look: Look, grade: GradeStyle | null = null): void {
  const u = m.uniforms;
  u.uTop.value.copy(ungraded(look.sky.top, grade));
  u.uMid.value.copy(ungraded(look.sky.mid ?? look.sky.top, grade));
  u.uMidAt.value = look.sky.mid ? (look.sky.midAt ?? 10) : 0;
  u.uTopAt.value = look.sky.topAt ?? 90;
  u.uSparkles.value = look.sky.sparkles ?? 0;
  u.uHorizon.value.copy(ungraded(look.sky.horizon, grade));
  u.uClouds.value.copy(ungraded(look.sky.clouds ?? look.sky.horizon, grade));
  // Stars are white and warm yellow at every hour: undo the grade (a night tint) for them too.
  u.uStarColor.value.copy(ungraded("#ffffff", grade));
  u.uSparkColor.value.copy(ungraded("#ffe080", grade));
  u.uStarAlpha.value = look.sky.stars ? (look.sky.starAlpha ?? 1) : 0;
  u.uCloudAlpha.value = look.sky.clouds ? 0.7 : 0;
  u.uMeteors.value = look.sky.meteors ?? 0;
  const g = look.sky.glyphs;
  u.uGlyphs.value = g?.amount ?? 0;
  u.uGlyphShape.value = ["paw", "heart", "moon"].indexOf(g?.shape ?? "paw");
  u.uGlyphSize.value = g?.size ?? 3;
  u.uGlyphColor.value.set(g?.color ?? "#ffc040");
}
