// A tileable texture of overlapping leafy clumps, now only the water's soft light patches (the land
// draws its own leaf stamps, §13): R each stamp's tone, G its height, B coverage. Pure and seeded,
// so every build draws the same pixels.

import type { TextureValue } from "@glade/render";

/** Texels per side. */
export const STAMP_TEXELS = 256;
/** Stamp diameters across one repeat of the texture. */
export const STAMPS_ACROSS = 6;

/** Tone change from a stamp's top to its middle, and how much darker its lower rim is. */
const SHADE = 0.12;
const RIM = 0.3;

/** mulberry32: a small seeded generator in [0, 1). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RGBA texels, `size` x `size`, repeating: R tone, G height, B coverage count, A 255. */
export function stampPixels(size = STAMP_TEXELS, seed = 7): Uint8Array {
  const rand = rng(seed);
  const tone = new Float32Array(size * size).fill(0.5);
  const height = new Float32Array(size * size).fill(0.5);
  const count = new Uint8Array(size * size);
  const R = size / STAMPS_ACROSS / 2;
  // Three layers, each a jittered grid with one stamp per cell, so every texel is covered.
  const LAYERS = 3;
  const cells = Math.round(size / (R * 1.5));
  const step = size / cells;
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const cx = (gx + rand()) * step;
        const cy = (gy + rand()) * step;
        const r = R * (0.8 + 0.4 * rand());
        // A rounded core ringed by 7..9 small leaves reaching past it, so the outline is
        // serrated like the game's leafy clumps rather than round.
        const petals = 7 + Math.floor(rand() * 3);
        const phase = rand() * Math.PI * 2;
        const discs: [number, number, number][] = [[0, 0, r * 0.6]];
        for (let k = 0; k < petals; k++) {
          const a = phase + (k / petals) * Math.PI * 2 + (rand() - 0.5) * 0.4;
          const pr = r * (0.22 + 0.1 * rand());
          const at = r - pr * 0.8;
          discs.push([Math.cos(a) * at, Math.sin(a) * at, pr]);
        }
        const t = 0.35 + 0.35 * ((layer + rand()) / LAYERS) + 0.3 * rand();
        const h = 0.25 + 0.5 * rand();
        const reach = Math.ceil(r) + 1;
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const px = Math.floor(cx) + dx;
            const py = Math.floor(cy) + dy;
            const ox = px + 0.5 - cx;
            const oy = py + 0.5 - cy;
            // Signed distance to the union of discs (negative inside), anti-aliased over a texel.
            let sd = Infinity;
            for (const [x, y, dr] of discs) sd = Math.min(sd, Math.hypot(ox - x, oy - y) - dr);
            const cover = Math.min(1, Math.max(0, 0.5 - sd));
            if (cover <= 0) continue;
            const i = (((py % size) + size) % size) * size + (((px % size) + size) % size);
            // Lit from the top of the texture (north): lighter toward its top, and a dark rim
            // along its lower edge, where it overlaps what lies below it.
            const down = Math.max(-1, Math.min(1, oy / r));
            const rim = Math.max(0, down) * Math.min(1, Math.max(0, 1 + sd / (r * 0.22)));
            const lit = Math.max(0, Math.min(1, t - SHADE * down - RIM * rim));
            tone[i] += (lit - tone[i]) * cover;
            const hh = Math.min(0.8, h + 0.15 * Math.min(1, -sd / (r * 0.5)));
            height[i] += (hh - height[i]) * cover;
            if (cover > 0.5) count[i] = Math.min(255, count[i] + 1);
          }
        }
      }
    }
  }
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    out[4 * i] = Math.round(tone[i] * 255);
    out[4 * i + 1] = Math.round(height[i] * 255);
    out[4 * i + 2] = count[i];
    out[4 * i + 3] = 255;
  }
  return out;
}

let cached: TextureValue | null = null;

/** The stamp texture as a material uniform, generated once. */
export function stampTexture(): TextureValue {
  cached ??= {
    texture: {
      key: `pp-stamps-${STAMP_TEXELS}`,
      width: STAMP_TEXELS,
      height: STAMP_TEXELS,
      data: stampPixels(),
    },
  };
  return cached;
}
