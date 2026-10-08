// The model format (models.ts) as a zod schema, with a description on every field, for apps that
// read models from files or forms and for tools that show the format to people or AI models. It
// checks the shape of the data; modelProblems() checks that a model fits its footprint and limits.

import { z } from "zod";
import { FINISHES, type Model, type ModelPart } from "./models";

const vec3 = z.array(z.number()).length(3);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .describe("#rrggbb");

const placed = {
  at: vec3.describe("anchor [x, y, z]: x, z in tiles from the footprint's top-left, y in blocks"),
  rotate: vec3
    .optional()
    .describe("degrees about x, y, z through the anchor (three.js Euler order XYZ)"),
  name: z.string().optional().describe("a label, e.g. 'seat'"),
};
const painted = {
  color,
  finish: z
    .enum(FINISHES as [string, ...string[]])
    .optional()
    .describe("matte (default), glow (gives light, e.g. a lamp) or glass (see-through)"),
};
const sides = z
  .number()
  .int()
  .min(3)
  .max(32)
  .optional()
  .describe("flat sides instead of round (4 = square); radius reaches the corners");

const solids = [
  z
    .object({
      shape: z.literal("box"),
      ...placed,
      ...painted,
      size: vec3.describe("[width x, height y, depth z]: tiles, blocks, tiles; at = base center"),
      round: z.number().min(0).optional().describe("radius rounding every edge, in tiles"),
    })
    .describe("a box"),
  z
    .object({
      shape: z.literal("wedge"),
      ...placed,
      ...painted,
      size: vec3.describe("[width x, height y, depth z]; at = base center"),
    })
    .describe("a box whose top slopes from full height at the back (-z) to nothing at the front"),
  z
    .object({
      shape: z.literal("cylinder"),
      ...placed,
      ...painted,
      radius: z.number().positive().describe("tiles"),
      height: z.number().positive().describe("blocks"),
      top: z.number().min(0).optional().describe("radius at the top, default: radius"),
      sides,
    })
    .describe("a cylinder; at = base center"),
  z
    .object({
      shape: z.literal("cone"),
      ...placed,
      ...painted,
      radius: z.number().positive().describe("tiles"),
      height: z.number().positive().describe("blocks"),
      sides,
    })
    .describe("a cone; at = base center"),
  z
    .object({
      shape: z.literal("sphere"),
      ...placed,
      ...painted,
      radius: z.number().positive().describe("tiles"),
      squash: z.number().positive().optional().describe("vertical scale (0.55: a mushroom cap)"),
      half: z.boolean().optional().describe("only the top half, a dome with its base at `at`"),
    })
    .describe("a sphere; at = center"),
  z
    .object({
      shape: z.literal("torus"),
      ...placed,
      ...painted,
      radius: z.number().positive().describe("center to the middle of the tube, tiles"),
      tube: z.number().positive().describe("tube radius"),
      arc: z
        .number()
        .positive()
        .max(360)
        .optional()
        .describe("degrees of the ring (default 360), from +x counter-clockwise seen from above"),
    })
    .describe("a ring lying flat; at = center"),
  z
    .object({
      shape: z.literal("tube"),
      ...placed,
      ...painted,
      points: z
        .array(vec3)
        .min(2)
        .describe("points the tube runs through, around `at`: x, z in tiles, y in blocks"),
      radius: z.number().positive().describe("tiles; the tube stays round however it bends"),
      smooth: z
        .boolean()
        .optional()
        .describe("curve smoothly through the points (default) or run straight, bending at them"),
      closed: z.boolean().optional().describe("join the last point to the first: a loop"),
    })
    .describe("a round pipe along a curve: hoses, coils, rails, loops"),
  z
    .object({
      shape: z.literal("mesh"),
      ...placed,
      ...painted,
      vertices: z.array(z.number()).describe("x, y, z per vertex around the anchor"),
      faces: z
        .array(z.number().int().min(0))
        .describe("three vertex indices per triangle, counter-clockwise seen from outside"),
    })
    .describe("triangles of its own"),
] as const;

/** One part: a solid or a group. */
export const modelPartSchema: z.ZodType<ModelPart> = z.lazy(() =>
  z.discriminatedUnion("shape", [
    ...solids,
    z
      .object({
        shape: z.literal("group"),
        at: vec3.optional().describe("where the group's origin sits, default [0, 0, 0]"),
        rotate: placed.rotate,
        scale: z
          .union([z.number().positive(), vec3])
          .optional()
          .describe("size multiplier: a number or [x, y, z]"),
        mirror: z
          .array(z.enum(["x", "z"]))
          .optional()
          .describe("also mirrored across the group's own x = 0 and/or z = 0 plane"),
        repeat: z
          .object({
            count: z.number().int().min(1),
            step: vec3.describe(
              "each copy moves this far from the one before (tiles; y in blocks)",
            ),
            turn: vec3
              .optional()
              .describe("then turns this many degrees more: a ring, an arc or a spiral of copies"),
          })
          .optional()
          .describe("copies in a row"),
        name: placed.name,
        parts: z.array(modelPartSchema).min(1),
      })
      .describe("parts moved, turned, scaled, mirrored and repeated together"),
  ]),
) as unknown as z.ZodType<ModelPart>;

export const MODEL_HELP =
  "3D model made of parts, at rotation 0. x runs across the footprint (0..w tiles), z along its " +
  "depth (0..d tiles, top to bottom), y up in blocks. Solids: box/wedge (at = base center, size " +
  "[x, y, z], box round = edge radius), cylinder/cone (at = base center, radius, height; " +
  "cylinder top = top radius; sides = flat sides), sphere (at = center, radius, squash, half = " +
  "dome), torus (at = center, radius, tube, arc degrees), tube (points it runs through, radius, " +
  "smooth, closed), mesh (vertices, faces). Any part may have rotate " +
  "[x, y, z] degrees and a name; solids have color #rrggbb and finish matte/glow/glass. Groups " +
  "hold parts with at, rotate, scale, mirror ['x', 'z'] and repeat {count, step, turn}: each " +
  "copy is the one before moved by step, then turned by turn.";

export const modelSchema: z.ZodType<Model> = z
  .object({ parts: z.array(modelPartSchema).min(1) })
  .describe(MODEL_HELP) as unknown as z.ZodType<Model>;
