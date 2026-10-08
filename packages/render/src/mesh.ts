// Growable vertex buffers for pure geometry builders (games build meshes with this; the 3D host
// turns them into GPU buffers). Builders emit quads and flat polygons; this packs them into
// typed arrays with a winding that faces the given normal.

export type V3 = [number, number, number];

export interface MeshArrays {
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  /** Extra per-vertex attributes by name. */
  attributes: Record<string, { array: Float32Array; itemSize: number }>;
  vertexCount: number;
}

export class QuadBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private idx: number[] = [];
  private extra: Record<string, number[]> = {};

  constructor(private readonly sizes: Record<string, number>) {
    for (const k of Object.keys(sizes)) this.extra[k] = [];
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /**
   * Four corners in order around the quad, a normal, and per-vertex values for each extra
   * attribute: one number (or tuple) for all four corners, or an array of four. `normals`, when
   * given, are the corners' own (smooth) normals; `n` still decides the winding.
   */
  quad(
    c: [V3, V3, V3, V3],
    n: V3,
    attrs: Record<string, number | number[] | number[][]>,
    normals?: [V3, V3, V3, V3],
  ): void {
    const base = this.vertexCount;
    for (const p of c) this.pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < 4; i++) {
      const m = normals ? normals[i] : n;
      this.nor.push(m[0], m[1], m[2]);
    }
    for (const [name, size] of Object.entries(this.sizes)) {
      const v = attrs[name] ?? 0;
      const out = this.extra[name];
      for (let i = 0; i < 4; i++) {
        // number: all corners; number[][]: a tuple per corner; number[]: one value per corner
        // for scalar attributes, else one tuple shared by all corners.
        if (typeof v === "number") for (let k = 0; k < size; k++) out.push(v);
        else if (Array.isArray(v[0])) out.push(...(v as number[][])[i]);
        else if (size === 1) out.push((v as number[])[i]);
        else out.push(...(v as number[]));
      }
    }
    // Triangles (0,1,2) (0,2,3), flipped when their face normal points away from n.
    const [a, b, d] = [c[0], c[1], c[2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const facing = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2];
    if (facing >= 0) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  /**
   * A flat polygon (three or more points in order around it, convex or not, no holes), cut into
   * triangles by ear clipping in the plane facing n. Attributes as for quad(), with one value (or
   * tuple) per point.
   */
  polygon(c: V3[], n: V3, attrs: Record<string, number | number[] | number[][]>): void {
    const base = this.vertexCount;
    const count = c.length;
    for (const p of c) this.pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < count; i++) this.nor.push(n[0], n[1], n[2]);
    for (const [name, size] of Object.entries(this.sizes)) {
      const v = attrs[name] ?? 0;
      const out = this.extra[name];
      for (let i = 0; i < count; i++) {
        if (typeof v === "number") for (let k = 0; k < size; k++) out.push(v);
        else if (Array.isArray(v[0])) out.push(...(v as number[][])[i]);
        else if (size === 1) out.push((v as number[])[i]);
        else out.push(...(v as number[]));
      }
    }
    // Project onto the plane of the two axes other than n's largest component.
    const drop = [0, 1, 2].reduce((m, k) => (Math.abs(n[k]) > Math.abs(n[m]) ? k : m), 0);
    const [u, w] = [0, 1, 2].filter((k) => k !== drop);
    const pt = c.map((p) => [p[u], p[w]]);
    const cross = (a: number, b: number, d: number) =>
      (pt[b][0] - pt[a][0]) * (pt[d][1] - pt[a][1]) - (pt[b][1] - pt[a][1]) * (pt[d][0] - pt[a][0]);
    let area = 0;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      area += pt[i][0] * pt[j][1] - pt[j][0] * pt[i][1];
    }
    const sign = area >= 0 ? 1 : -1;
    const inside = (p: number, a: number, b: number, d: number) =>
      sign * cross(a, b, p) >= 0 && sign * cross(b, d, p) >= 0 && sign * cross(d, a, p) >= 0;
    const left = [...Array(count).keys()];
    const tris: [number, number, number][] = [];
    while (left.length > 3) {
      let cut = -1;
      for (let k = 0; k < left.length && cut < 0; k++) {
        const [a, b, d] = [
          left[(k + left.length - 1) % left.length],
          left[k],
          left[(k + 1) % left.length],
        ];
        if (sign * cross(a, b, d) <= 1e-12) continue;
        if (left.some((p) => p !== a && p !== b && p !== d && inside(p, a, b, d))) continue;
        cut = k;
      }
      // No ear (only collinear points left): fan the rest.
      if (cut < 0) break;
      const k = cut;
      tris.push([left[(k + left.length - 1) % left.length], left[k], left[(k + 1) % left.length]]);
      left.splice(k, 1);
    }
    for (let k = 1; k + 1 < left.length; k++) tris.push([left[0], left[k], left[k + 1]]);
    for (const [a, b, d] of tris) {
      const [pa, pb, pd] = [c[a], c[b], c[d]];
      const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      const e2 = [pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]];
      const f =
        (e1[1] * e2[2] - e1[2] * e2[1]) * n[0] +
        (e1[2] * e2[0] - e1[0] * e2[2]) * n[1] +
        (e1[0] * e2[1] - e1[1] * e2[0]) * n[2];
      if (f >= 0) this.idx.push(base + a, base + b, base + d);
      else this.idx.push(base + a, base + d, base + b);
    }
  }

  finish(): MeshArrays {
    const attributes: MeshArrays["attributes"] = {};
    for (const [name, size] of Object.entries(this.sizes)) {
      attributes[name] = { array: new Float32Array(this.extra[name]), itemSize: size };
    }
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nor),
      index: new Uint32Array(this.idx),
      attributes,
      vertexCount: this.vertexCount,
    };
  }
}
