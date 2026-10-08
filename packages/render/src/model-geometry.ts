// Triangles for model parts (models.ts). Parts an engine cannot draw as a scaled unit primitive
// (rounded boxes, wedges, tapered or faceted cylinders, domes, tori, tubes, meshes) get their own
// geometry here, in part space and true proportions, ready to place with the leaf's frame.
// modelMesh() turns a whole model into plain meshes, one per finish, with each vertex's color and
// part: enough for any engine to draw an item on its own, e.g. a builder's preview, and to tell
// which part was clicked.

import { applyNormal, applyPoint, normalMatrix } from "./matrix";
import type { MeshArrays, V3 } from "./mesh";
import {
  FINISHES,
  flattenModel,
  instancedShape,
  type Finish,
  type Model,
  type ModelLeaf,
  type ModelOptions,
  type SolidPart,
} from "./models";

/** Triangles in part space: three numbers per position and normal, three indices per triangle. */
export interface PartGeometry {
  position: number[];
  normal: number[];
  index: number[];
}

/** Segments around round parts drawn from their own geometry. */
const AROUND = 16;
/** Steps over each rounded edge of a box, per half (so twice this over the whole quarter circle). */
const ROUND_STEPS = 3;

class Tris {
  readonly g: PartGeometry = { position: [], normal: [], index: [] };

  v(p: V3, n: V3): number {
    this.g.position.push(p[0], p[1], p[2]);
    this.g.normal.push(n[0], n[1], n[2]);
    return this.g.position.length / 3 - 1;
  }

  /** A triangle of vertex indices, wound to face `out`. */
  tri(a: number, b: number, c: number, out: V3): void {
    const P = this.g.position;
    const at = (i: number): V3 => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
    const [pa, pb, pc] = [at(a), at(b), at(c)];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const f =
      (u[1] * w[2] - u[2] * w[1]) * out[0] +
      (u[2] * w[0] - u[0] * w[2]) * out[1] +
      (u[0] * w[1] - u[1] * w[0]) * out[2];
    if (f >= 0) this.g.index.push(a, b, c);
    else this.g.index.push(a, c, b);
  }

  normalOf(i: number): V3 {
    const n = this.g.normal;
    return [n[3 * i], n[3 * i + 1], n[3 * i + 2]];
  }

  /** A quad of vertex indices in order around it, wound to face `out`. */
  quad(a: number, b: number, c: number, d: number, out: V3): void {
    this.tri(a, b, c, out);
    this.tri(a, c, d, out);
  }

  /** A flat polygon of points in order around it, one normal for all. */
  flat(points: V3[], n: V3): void {
    const ids = points.map((p) => this.v(p, n));
    for (let i = 1; i + 1 < ids.length; i++) this.tri(ids[0], ids[i], ids[i + 1], n);
  }
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Grid coordinates along one axis of a box with rounded edges: denser over the rounding. */
function roundedAxis(h: number, r: number): number[] {
  if (r <= 0) return [-h, h];
  const out: number[] = [];
  for (let j = ROUND_STEPS; j >= 0; j--)
    out.push(-h + r - r * Math.tan((Math.PI / 4) * (j / ROUND_STEPS)));
  for (let j = 0; j <= ROUND_STEPS; j++)
    out.push(h - r + r * Math.tan((Math.PI / 4) * (j / ROUND_STEPS)));
  return out.filter((v, i) => i === 0 || v - out[i - 1] > 1e-9);
}

/** A box `half` extents around (0, half y, 0), its edges rounded by r (0: sharp, flat faces). */
function box(t: Tris, half: V3, r: number): void {
  const [hx, hy, hz] = half;
  r = Math.max(0, Math.min(r, hx, hy, hz));
  const axes = [roundedAxis(hx, r), roundedAxis(hy, r), roundedAxis(hz, r)];
  const inner = [hx - r, hy - r, hz - r];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      const [u, w] = [0, 1, 2].filter((a) => a !== axis);
      const face: V3 = [0, 0, 0];
      face[axis] = sign;
      const ids: number[][] = [];
      for (const cu of axes[u]) {
        const row: number[] = [];
        for (const cw of axes[w]) {
          const p: V3 = [0, 0, 0];
          p[axis] = sign * half[axis];
          p[u] = cu;
          p[w] = cw;
          const core = p.map((c, a) => Math.max(-inner[a], Math.min(inner[a], c))) as V3;
          const n = r > 0 ? norm([p[0] - core[0], p[1] - core[1], p[2] - core[2]]) : face;
          const q: V3 = r > 0 ? [core[0] + n[0] * r, core[1] + n[1] * r, core[2] + n[2] * r] : p;
          row.push(t.v([q[0], q[1] + hy, q[2]], n));
        }
        ids.push(row);
      }
      for (let i = 0; i + 1 < ids.length; i++) {
        for (let j = 0; j + 1 < ids[i].length; j++) {
          t.quad(ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1], face);
        }
      }
    }
  }
}

/** A wedge over half extents x, z and height h: full height at the back (-z), none at the front. */
function wedge(t: Tris, hx: number, h: number, hz: number): void {
  t.flat(
    [
      [-hx, 0, -hz],
      [hx, 0, -hz],
      [hx, 0, hz],
      [-hx, 0, hz],
    ],
    [0, -1, 0],
  );
  t.flat(
    [
      [-hx, 0, -hz],
      [hx, 0, -hz],
      [hx, h, -hz],
      [-hx, h, -hz],
    ],
    [0, 0, -1],
  );
  t.flat(
    [
      [-hx, h, -hz],
      [hx, h, -hz],
      [hx, 0, hz],
      [-hx, 0, hz],
    ],
    norm([0, 2 * hz, h]),
  );
  for (const s of [-1, 1]) {
    t.flat(
      [
        [s * hx, 0, -hz],
        [s * hx, 0, hz],
        [s * hx, h, -hz],
      ],
      [s, 0, 0],
    );
  }
}

/**
 * A cylinder, tapered to radius `top` (0: a cone) over height h. `sides` makes it flat-sided,
 * turned so a side faces each axis when it can; radius reaches the corners.
 */
function cylinder(t: Tris, radius: number, top: number, h: number, sides?: number): void {
  const n = sides ?? AROUND;
  const off = sides ? Math.PI / n : 0;
  const ang = (j: number) => off + (2 * Math.PI * j) / n;
  const ring = (r: number, y: number, j: number): V3 => [
    r * Math.cos(ang(j)),
    y,
    r * Math.sin(ang(j)),
  ];
  const slope = (radius - top) / h;
  for (let j = 0; j < n; j++) {
    const mid = ang(j + 0.5);
    const out = norm([Math.cos(mid), slope, Math.sin(mid)]);
    const nAt = (k: number): V3 =>
      sides ? out : norm([Math.cos(ang(k)), slope, Math.sin(ang(k))]);
    const a = t.v(ring(radius, 0, j), nAt(j));
    const b = t.v(ring(radius, 0, j + 1), nAt(j + 1));
    const c = t.v(ring(top, h, j + 1), nAt(j + 1));
    const d = t.v(ring(top, h, j), nAt(j));
    if (top > 0) t.quad(a, b, c, d, out);
    else t.tri(a, b, d, out);
  }
  const cap = (r: number, y: number, n2: V3) =>
    t.flat(
      Array.from({ length: n }, (_, j) => ring(r, y, j)),
      n2,
    );
  cap(radius, 0, [0, -1, 0]);
  if (top > 0) cap(top, h, [0, 1, 0]);
}

/** An ellipsoid (r across, ry up) around the origin, or its top half on a flat base. */
function sphere(t: Tris, r: number, ry: number, half: boolean): void {
  const rows = half ? 6 : 12;
  const top = Math.PI / 2;
  const bottom = half ? 0 : -Math.PI / 2;
  const ids: number[][] = [];
  for (let i = 0; i <= rows; i++) {
    const lat = bottom + ((top - bottom) * i) / rows;
    const row: number[] = [];
    for (let j = 0; j <= AROUND; j++) {
      const lon = (2 * Math.PI * j) / AROUND;
      const p: V3 = [
        r * Math.cos(lat) * Math.cos(lon),
        ry * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon),
      ];
      row.push(t.v(p, norm([p[0] / (r * r), p[1] / (ry * ry), p[2] / (r * r)])));
    }
    ids.push(row);
  }
  const P = t.g.position;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < AROUND; j++) {
      const [a, b, c, d] = [ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]];
      const m = [a, b, c, d].map((k) => [P[3 * k], P[3 * k + 1], P[3 * k + 2]]);
      const out = norm([
        m[0][0] + m[2][0],
        (m[0][1] + m[2][1]) / (ry * ry || 1),
        m[0][2] + m[2][2],
      ]);
      // Rows at the poles collapse to a point: one triangle each.
      if (i === rows - 1) t.tri(a, b, d, out);
      else if (i === 0 && !half) t.tri(a, c, d, out);
      else t.quad(a, b, c, d, out);
    }
  }
  if (half) {
    t.flat(
      Array.from({ length: AROUND }, (_, j): V3 => {
        const lon = (2 * Math.PI * j) / AROUND;
        return [r * Math.cos(lon), 0, r * Math.sin(lon)];
      }),
      [0, -1, 0],
    );
  }
}

/**
 * A torus lying flat around the origin: ring radius R, tube radius `tube` across and `ty` up. Only
 * `arc` degrees of it, from +x counter-clockwise seen from above (toward -z), with flat ends.
 */
function torus(t: Tris, R: number, tube: number, ty: number, arc = 360): void {
  const full = arc >= 360;
  const sweep = (Math.min(arc, 360) * Math.PI) / 180;
  const around = Math.max(2, Math.ceil((24 * Math.min(arc, 360)) / 360));
  const rounds = 10;
  const ring = (u: number, v: number): V3 => {
    const rr = R + tube * Math.cos(v);
    return [rr * Math.cos(u), ty * Math.sin(v), -rr * Math.sin(u)];
  };
  const ids: number[][] = [];
  for (let i = 0; i <= around; i++) {
    const u = (sweep * i) / around;
    const row: number[] = [];
    for (let j = 0; j <= rounds; j++) {
      const v = (2 * Math.PI * j) / rounds;
      const n = norm([
        (Math.cos(v) * Math.cos(u)) / tube,
        Math.sin(v) / ty,
        (-Math.cos(v) * Math.sin(u)) / tube,
      ]);
      row.push(t.v(ring(u, v), n));
    }
    ids.push(row);
  }
  for (let i = 0; i < around; i++) {
    for (let j = 0; j < rounds; j++) {
      const u = (sweep * (i + 0.5)) / around;
      const v = (2 * Math.PI * (j + 0.5)) / rounds;
      const out = norm([Math.cos(v) * Math.cos(u), Math.sin(v), -Math.cos(v) * Math.sin(u)]);
      t.quad(ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1], out);
    }
  }
  if (full) return;
  // Flat ends, facing back along the ring at its start and forward at its end.
  for (const [u, dir] of [
    [0, -1],
    [sweep, 1],
  ]) {
    const n: V3 = [-Math.sin(u) * dir, 0, -Math.cos(u) * dir];
    t.flat(
      Array.from({ length: rounds }, (_, j) => ring(u, (2 * Math.PI * j) / rounds)),
      n,
    );
  }
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dist = (a: V3, b: V3) => Math.hypot(...sub(a, b));

/** Steps for a stretch of curve of length len around a tube of radius r: 2..16. */
const stepsFor = (len: number, r: number) => Math.max(2, Math.min(16, Math.ceil(len / (1.5 * r))));

/**
 * A centripetal Catmull-Rom curve through the points (no loops or cusps), as points along it. A
 * closed curve ends back at its start.
 */
function smoothPath(pts: V3[], closed: boolean, r: number): V3[] {
  const n = pts.length;
  const at = (i: number): V3 => {
    if (closed) return pts[((i % n) + n) % n];
    if (i < 0) return add(pts[0], sub(pts[0], pts[1]));
    if (i >= n) return add(pts[n - 1], sub(pts[n - 1], pts[n - 2]));
    return pts[i];
  };
  const out: V3[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const knot = (a: V3, b: V3) => Math.max(1e-6, Math.sqrt(dist(a, b)));
    const t1 = knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const lerp = (a: V3, b: V3, ta: number, tb: number, u: number): V3 =>
      add(a, sub(b, a), (u - ta) / (tb - ta));
    const steps = stepsFor(dist(p1, p2), r);
    for (let s = 0; s < steps; s++) {
      const u = t1 + ((t2 - t1) * s) / steps;
      const a1 = lerp(p0, p1, 0, t1, u);
      const a2 = lerp(p1, p2, t1, t2, u);
      const a3 = lerp(p2, p3, t2, t3, u);
      const b1 = lerp(a1, a2, 0, t2, u);
      const b2 = lerp(a2, a3, t1, t3, u);
      out.push(lerp(b1, b2, t1, t2, u));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Straight runs between the points, each corner bent round a short arc so the pipe stays round. */
function bentPath(pts: V3[], closed: boolean, r: number): V3[] {
  const n = pts.length;
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const corner = closed || (i > 0 && i < n - 1);
    if (!corner) {
      out.push(p);
      continue;
    }
    const [a, b] = [pts[(i - 1 + n) % n], pts[(i + 1) % n]];
    const [da, db] = [norm(sub(a, p)), norm(sub(b, p))];
    // Cut back from the corner along both runs, then a quadratic curve round it.
    const cut = Math.min(1.5 * r, dist(a, p) / 2, dist(b, p) / 2);
    if (cut < 1e-6 || dot(da, db) < -0.9999) {
      out.push(p);
      continue;
    }
    const [s, e] = [add(p, da, cut), add(p, db, cut)];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      out.push(add(add(s, sub(p, s), 2 * u * (1 - u) + u * u), sub(e, p), u * u));
    }
  }
  if (closed) out.push(out[0]);
  return out;
}

/**
 * A round pipe of radius r along a path (true space), its rings carried along without twisting
 * (and the twist a loop picks up spread round it). Open pipes get flat ends.
 */
function tube(t: Tris, points: V3[], r: number, smooth: boolean, closed: boolean): void {
  // Drop repeated points; a closed path does not repeat its first point at the end.
  let pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 1e-9);
  if (closed && pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 1e-9) pts = pts.slice(0, -1);
  let path = smooth && pts.length > 2 ? smoothPath(pts, closed, r) : bentPath(pts, closed, r);
  path = path.filter((p, i) => i === 0 || dist(p, path[i - 1]) > 1e-9);
  if (closed) {
    if (dist(path[0], path[path.length - 1]) < 1e-9) path = path.slice(0, -1);
    path.push(path[0]);
  }
  const m = path.length;
  if (m < 2) return;
  const tangent = (i: number): V3 => {
    if (closed && (i === 0 || i === m - 1)) return norm(sub(path[1], path[m - 2]));
    if (i === 0) return norm(sub(path[1], path[0]));
    if (i === m - 1) return norm(sub(path[m - 1], path[m - 2]));
    return norm(sub(path[i + 1], path[i - 1]));
  };
  const T = path.map((_, i) => tangent(i));
  // A first normal square to the first tangent, then carried along (projected, renormalized).
  const seed: V3 = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const N: V3[] = [norm(cross(cross(T[0], seed), T[0]))];
  for (let i = 1; i < m; i++) {
    const p = N[i - 1];
    let q = sub(p, [T[i][0] * dot(p, T[i]), T[i][1] * dot(p, T[i]), T[i][2] * dot(p, T[i])]);
    if (Math.hypot(...q) < 1e-9) q = norm(cross(cross(T[i], seed), T[i]));
    N.push(norm(q));
  }
  // A loop comes back turned: spread that turn evenly so its ends meet.
  let twist = 0;
  if (closed) {
    const [a, b] = [N[m - 1], N[0]];
    twist = Math.atan2(dot(cross(a, b), T[0]), dot(a, b));
  }
  const sides = 12;
  const rings: number[][] = [];
  for (let i = 0; i < m; i++) {
    const turn = (twist * i) / (m - 1);
    const B = cross(T[i], N[i]);
    const row: number[] = [];
    for (let j = 0; j <= sides; j++) {
      const a = (2 * Math.PI * j) / sides + turn;
      const n = add(
        [N[i][0] * Math.cos(a), N[i][1] * Math.cos(a), N[i][2] * Math.cos(a)],
        B,
        Math.sin(a),
      );
      row.push(t.v(add(path[i], n, r), n));
    }
    rings.push(row);
  }
  for (let i = 0; i + 1 < m; i++) {
    for (let j = 0; j < sides; j++) {
      const out = norm(add(t.normalOf(rings[i][j]), t.normalOf(rings[i + 1][j + 1])));
      t.quad(rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1], out);
    }
  }
  if (closed) return;
  const ringAt = (i: number) =>
    Array.from({ length: sides }, (_, j): V3 => {
      const P = t.g.position;
      const k = rings[i][j];
      return [P[3 * k], P[3 * k + 1], P[3 * k + 2]];
    });
  t.flat(ringAt(0), [-T[0][0], -T[0][1], -T[0][2]]);
  t.flat(ringAt(m - 1), T[m - 1]);
}

/** A mesh part's own triangles, flat-shaded, wound as given (counter-clockwise from outside). */
function mesh(t: Tris, vertices: number[], faces: number[], k: number): void {
  const at = (i: number): V3 => [vertices[3 * i], vertices[3 * i + 1] * k, vertices[3 * i + 2]];
  for (let f = 0; f + 2 < faces.length; f += 3) {
    const [a, b, c] = [at(faces[f]), at(faces[f + 1]), at(faces[f + 2])];
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = norm([
      u[1] * w[2] - u[2] * w[1],
      u[2] * w[0] - u[0] * w[2],
      u[0] * w[1] - u[1] * w[0],
    ]);
    const ids = [a, b, c].map((p) => t.v(p, n));
    t.g.index.push(ids[0], ids[1], ids[2]);
  }
}

/**
 * A solid's triangles in part space (anchor at the origin, true proportions: y in tiles, each
 * block `blockSize` tiles). `mirrored` mirrors it across x = 0 with its faces still facing out:
 * place that with frame · mirror(x) so a mirrored leaf keeps a frame that does not mirror.
 */
export function partGeometry(p: SolidPart, blockSize = 1, mirrored = false): PartGeometry {
  const k = blockSize;
  const t = new Tris();
  switch (p.shape) {
    case "box":
      box(t, [p.size[0] / 2, (p.size[1] * k) / 2, p.size[2] / 2], p.round ?? 0);
      break;
    case "wedge":
      wedge(t, p.size[0] / 2, p.size[1] * k, p.size[2] / 2);
      break;
    case "cylinder":
      cylinder(t, p.radius, p.top ?? p.radius, p.height * k, p.sides);
      break;
    case "cone":
      cylinder(t, p.radius, 0, p.height * k, p.sides);
      break;
    case "sphere":
      sphere(t, p.radius, p.radius * (p.squash ?? 1) * k, !!p.half);
      break;
    case "torus":
      torus(t, p.radius, p.tube, p.tube * k, p.arc);
      break;
    case "tube":
      tube(
        t,
        p.points.map((q) => [q[0], q[1] * k, q[2]] as V3),
        p.radius,
        p.smooth !== false,
        !!p.closed,
      );
      break;
    case "mesh":
      mesh(t, p.vertices, p.faces, k);
      break;
  }
  const g = t.g;
  if (mirrored) {
    for (let i = 0; i < g.position.length; i += 3) {
      g.position[i] = -g.position[i];
      g.normal[i] = -g.normal[i];
    }
    for (let i = 0; i < g.index.length; i += 3) {
      [g.index[i + 1], g.index[i + 2]] = [g.index[i + 2], g.index[i + 1]];
    }
  }
  return g;
}

/**
 * A key that names a solid's geometry: two parts with the same key have the same triangles, so an
 * engine can build them once and instance them.
 */
export function geometryKey(p: SolidPart, blockSize = 1, mirrored = false): string {
  const { at: _at, rotate: _rotate, name: _name, color: _color, finish: _finish, ...shape } = p;
  return JSON.stringify([shape, blockSize, mirrored]);
}

/** Triangles each unit primitive has in the viewer (three.js segment counts). */
const UNIT_TRIANGLES = { box: 12, cylinder: 56, cone: 28, sphere: 352 };

/** How many triangles a solid is drawn with. */
export function partTriangles(p: SolidPart): number {
  const unit = instancedShape(p);
  if (unit) return UNIT_TRIANGLES[unit];
  if (p.shape === "mesh") return Math.floor(p.faces.length / 3);
  return partGeometry(p).index.length / 3;
}

/** "#rrggbb" -> [r, g, b], 0..1 (sRGB, as written). */
export function hexRgb(hex: string): V3 {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as V3;
}

export interface ModelMesh {
  /**
   * One mesh per finish that has parts, in true space (tiles on every axis; model space with y
   * times blockSize). Attributes: `color` (sRGB 0..1, three per vertex) and `part` (the vertex's
   * index into `leaves`).
   */
  meshes: Partial<Record<Finish, MeshArrays>>;
  leaves: ModelLeaf[];
}

/**
 * A whole model as plain meshes, for drawing an item on its own in any engine: a builder's
 * preview, a thumbnail. Read `part` at a picked vertex and `leaves[part].path` names the part.
 */
export function modelMesh(model: Model, opts: ModelOptions = {}): ModelMesh {
  const k = opts.blockSize ?? 1;
  const leaves = flattenModel(model, opts);
  const acc = new Map<
    Finish,
    { p: number[]; n: number[]; i: number[]; c: number[]; part: number[] }
  >();
  leaves.forEach((leaf, li) => {
    const finish = leaf.part.finish ?? "matte";
    let a = acc.get(finish);
    if (!a) acc.set(finish, (a = { p: [], n: [], i: [], c: [], part: [] }));
    const g = partGeometry(leaf.part, k);
    const base = a.p.length / 3;
    const nm = normalMatrix(leaf.frame);
    const rgb = hexRgb(leaf.part.color);
    for (let v = 0; v < g.position.length; v += 3) {
      const p = applyPoint(leaf.frame, [g.position[v], g.position[v + 1], g.position[v + 2]]);
      const n = applyNormal(nm, [g.normal[v], g.normal[v + 1], g.normal[v + 2]]);
      a.p.push(...p);
      a.n.push(...n);
      a.c.push(...rgb);
      a.part.push(li);
    }
    for (let t = 0; t < g.index.length; t += 3) {
      const [x, y, z] = [g.index[t], g.index[t + 1], g.index[t + 2]];
      // A mirroring frame turns faces inside out: wind them back.
      if (leaf.mirrored) a.i.push(base + x, base + z, base + y);
      else a.i.push(base + x, base + y, base + z);
    }
  });
  const meshes: ModelMesh["meshes"] = {};
  for (const f of FINISHES) {
    const a = acc.get(f);
    if (!a) continue;
    meshes[f] = {
      position: new Float32Array(a.p),
      normal: new Float32Array(a.n),
      index: new Uint32Array(a.i),
      attributes: {
        color: { array: new Float32Array(a.c), itemSize: 3 },
        part: { array: new Float32Array(a.part), itemSize: 1 },
      },
      vertexCount: a.p.length / 3,
    };
  }
  return { meshes, leaves };
}
