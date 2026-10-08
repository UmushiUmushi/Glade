// Geometry from the render format: a mesh's typed arrays as a three.js geometry, and the unit
// primitives instances are scaled from.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
} from "three";
import type { MeshArrays, Primitive } from "@glade/render";

/** A mesh's arrays (positions, normals, indices and any extra attributes) as a geometry. */
export function geometryOf(a: MeshArrays): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(a.position, 3));
  g.setAttribute("normal", new BufferAttribute(a.normal, 3));
  for (const [name, attr] of Object.entries(a.attributes)) {
    g.setAttribute(name, new BufferAttribute(attr.array, attr.itemSize));
  }
  g.setIndex(new BufferAttribute(a.index, 1));
  return g;
}

/**
 * Unit primitives, scaled per instance to world size: a 1x1x1 box and radius-1, height-1
 * cylinder and cone with their base at y = 0, and a radius-1 sphere around the origin.
 */
export function unitGeometry(p: Primitive): BufferGeometry {
  switch (p) {
    case "box":
      return new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    case "cylinder":
      return new CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0);
    case "cone":
      return new ConeGeometry(1, 1, 14).translate(0, 0.5, 0);
    case "sphere":
      return new SphereGeometry(1, 16, 12);
    case "quad":
      return new PlaneGeometry(2, 2);
  }
}
