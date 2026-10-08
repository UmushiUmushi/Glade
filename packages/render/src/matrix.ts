// 4x4 matrices as 16 numbers, column by column (the layout three.js and WebGL use), for placing
// model parts. Only what models need: build, multiply, apply.

import type { V3 } from "./mesh";

export type Mat4 = number[];

export const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export const translation = (x: number, y: number, z: number): Mat4 => [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  x,
  y,
  z,
  1,
];

export const scaling = (x: number, y: number, z: number): Mat4 => [
  x,
  0,
  0,
  0,
  0,
  y,
  0,
  0,
  0,
  0,
  z,
  0,
  0,
  0,
  0,
  1,
];

/** a · b: b's transform first, then a's. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** a · b · c · ... */
export const chain = (...ms: Mat4[]): Mat4 => ms.reduce((a, b) => multiply(a, b));

/**
 * Rotation by [x, y, z] degrees about each axis, right-handed, as a three.js Euler in order "XYZ"
 * (Rx · Ry · Rz: z is applied first).
 */
export function rotation([x, y, z]: V3): Mat4 {
  const r = Math.PI / 180;
  const [a, b, c] = [Math.cos(x * r), Math.cos(y * r), Math.cos(z * r)];
  const [d, e, f] = [Math.sin(x * r), Math.sin(y * r), Math.sin(z * r)];
  // three.js Matrix4.makeRotationFromEuler, order XYZ, written column by column.
  return [
    b * c,
    a * f + d * e * c,
    d * f - a * e * c,
    0,
    -b * f,
    a * c - d * e * f,
    d * c + a * e * f,
    0,
    e,
    -d * b,
    a * b,
    0,
    0,
    0,
    0,
    1,
  ];
}

export function applyPoint(m: Mat4, [x, y, z]: V3): V3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Determinant of the 3x3 part: negative when the matrix mirrors. */
export function det3(m: Mat4): number {
  return (
    m[0] * (m[5] * m[10] - m[9] * m[6]) -
    m[4] * (m[1] * m[10] - m[9] * m[2]) +
    m[8] * (m[1] * m[6] - m[5] * m[2])
  );
}

/** The matrix that turns normals: the inverse transpose of the 3x3 part, as 9 numbers by column. */
export function normalMatrix(m: Mat4): number[] {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  // Cofactors of [[a d g] [b e h] [c f i]], which are the inverse transpose times the determinant;
  // normals are normalized after, so the scale does not matter, but the sign must stay.
  const det = det3(m) || 1;
  const s = 1 / det;
  return [
    (e * i - h * f) * s,
    (g * f - d * i) * s,
    (d * h - g * e) * s,
    (h * c - b * i) * s,
    (a * i - g * c) * s,
    (g * b - a * h) * s,
    (b * f - e * c) * s,
    (d * c - a * f) * s,
    (a * e - d * b) * s,
  ];
}

export function applyNormal(n9: number[], [x, y, z]: V3): V3 {
  const v: V3 = [
    n9[0] * x + n9[3] * y + n9[6] * z,
    n9[1] * x + n9[4] * y + n9[7] * z,
    n9[2] * x + n9[5] * y + n9[8] * z,
  ];
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
