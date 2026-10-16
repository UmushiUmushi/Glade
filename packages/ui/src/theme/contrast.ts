// Colour contrast (WCAG 2.2): every text colour a theme uses must reach 4.5 : 1 on the colour it
// sits on, in light and dark. Every game's theme is checked by the contract tests.

import type { ColorMode, Theme, ThemeColors } from "./tokens";

/** The text-on-background pairs shared screens use. */
export const TEXT_PAIRS: readonly [text: keyof ThemeColors, on: keyof ThemeColors][] = [
  ["ink", "paper"],
  ["ink", "inset"],
  ["ink", "ground"],
  ["ink", "pop"],
  ["inkTitle", "paper"],
  ["inkTitle", "pop"],
  ["inkMuted", "paper"],
  ["inkMuted", "inset"],
  ["inkMuted", "pop"],
  ["alert", "paper"],
  ["alert", "pop"],
  ["onSelected", "selected"],
  ["onStrong", "strong"],
  ["onFloat", "float"],
  ["onFloat", "floatPress"],
  ["onDanger", "danger"],
];

export const MIN_TEXT_CONTRAST = 4.5;

/** A #rgb or #rrggbb colour as [r, g, b] from 0 to 255, or null for anything else. */
export function parseHex(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The contrast ratio of two hex colours, from 1 to 21, or null if either isn't a hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const [ca, cb] = [parseHex(a), parseHex(b)];
  if (!ca || !cb) return null;
  const [la, lb] = [luminance(ca), luminance(cb)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every text pair under 4.5 : 1, or not written as a hex colour, in either mode. */
export function contrastProblems(theme: Theme): string[] {
  const out: string[] = [];
  for (const mode of ["light", "dark"] as ColorMode[]) {
    for (const [text, on] of TEXT_PAIRS) {
      const ratio = contrastRatio(theme[mode][text], theme[mode][on]);
      if (ratio === null) out.push(`${mode}: ${text} on ${on} must be hex colours`);
      else if (ratio < MIN_TEXT_CONTRAST)
        out.push(`${mode}: ${text} on ${on} is ${ratio.toFixed(2)} : 1, under 4.5 : 1`);
    }
  }
  return out;
}
