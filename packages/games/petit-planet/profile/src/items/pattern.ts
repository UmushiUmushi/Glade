// The item formula for wallpaper and flooring: how one copy of a pattern looks, in 3D (a texture:
// the app's image, or its shapes painted on a small sheet) and in 2D. How copies are laid across a
// wall or a floor is the home's (maps/home/coverings.ts).

import type { TextureValue } from "@glade/render";
import type { Pattern } from "../catalog";

/** Texels across and up a painted sheet. */
const SHEET = 64;

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** A short stable name for a pattern, for texture and material keys. */
export function patternKey(p: Pattern): string {
  const text = JSON.stringify([p.color, p.image ?? null, p.shapes ?? []]);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** The color of a pattern at a point of the unit square (x right, y down). */
function colorAt(p: Pattern, x: number, y: number): string {
  let c = p.color;
  for (const s of p.shapes ?? []) {
    if ("rect" in s) {
      const [rx, ry, rw, rh] = s.rect;
      if (x >= rx && y >= ry && x < rx + rw && y < ry + rh) c = s.color;
    } else {
      const [cx, cy, r] = s.circle;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) c = s.color;
    }
  }
  return c;
}

/**
 * A pattern as a texture: the app's image by its URL, or its shapes painted on a 64 x 64 sheet. A
 * texture's v runs up, so the sheet's first row is the pattern's bottom. Texels are sRGB.
 */
export function patternTexture(p: Pattern): TextureValue {
  if (p.image) return { texture: { key: `pp-pattern-image ${p.image}`, url: p.image } };
  const data = new Uint8Array(SHEET * SHEET * 4);
  for (let row = 0; row < SHEET; row++) {
    const y = 1 - (row + 0.5) / SHEET;
    for (let col = 0; col < SHEET; col++) {
      const [r, g, b] = rgb(colorAt(p, (col + 0.5) / SHEET, y));
      data.set([r, g, b, 255], 4 * (row * SHEET + col));
    }
  }
  return { texture: { key: `pp-pattern ${patternKey(p)}`, width: SHEET, height: SHEET, data } };
}

// Images for 2D, loaded once each; a pattern shows its color until its image has loaded.
const images = new Map<string, HTMLImageElement>();

function imageOf(url: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/** One copy of a pattern, drawn to fill a rect on a canvas (its image once loaded, or its shapes). */
export function drawPattern(
  ctx: CanvasRenderingContext2D,
  p: Pattern,
  r: { x: number; y: number; w: number; h: number },
): void {
  const img = p.image ? imageOf(p.image) : null;
  if (img) {
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    return;
  }
  ctx.fillStyle = p.color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  for (const s of p.shapes ?? []) {
    ctx.fillStyle = s.color;
    if ("rect" in s) {
      const [x, y, w, h] = s.rect;
      ctx.fillRect(r.x + x * r.w, r.y + y * r.h, w * r.w, h * r.h);
    } else {
      const [x, y, rad] = s.circle;
      ctx.beginPath();
      ctx.ellipse(r.x + x * r.w, r.y + y * r.h, rad * r.w, rad * r.h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
