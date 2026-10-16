// The bodies of Glade's API (docs/server/README.md, "API"), shared so the web app and the server
// can't disagree. Each schema says which route it is for. Routes arrive with the server (Phase 6);
// `/health` comes first.

import { z } from "zod";
import { packRefSchema } from "../map-file";

export const API_BASE = "/api/v1";

const id = z.string().min(1);
const time = z.string().min(1);
const fileKind = z.enum(["map", "pack"]);

/** GET /health: 200 when every check is "ok", 503 otherwise. */
export const healthSchema = z.object({
  status: z.enum(["ok", "down"]),
  version: z.string(),
  checks: z.record(z.string(), z.enum(["ok", "down"])),
});

/** GET /drafts: one entry per draft. Names and badges, no contents. */
export const draftSummarySchema = z.object({
  id,
  kind: fileKind,
  game: id,
  mapType: z.string().optional(),
  name: z.string(),
  revision: z.number().int().positive(),
  updatedAt: time,
  /** Set once the draft has been shared. */
  shareId: id.optional(),
  /** The share and version this draft was copied from. */
  copiedFrom: z.object({ shareId: id, version: z.number().int().positive() }).optional(),
  thumb: z.string().optional(),
});

/** POST /drafts: a new draft, blank or from a file. Answers `{ id, revision: 1 }`. */
export const newDraftSchema = z.object({
  kind: fileKind,
  game: id,
  mapType: z.string().optional(),
  name: z.string().min(1).max(80),
  file: z.record(z.string(), z.unknown()).optional(),
});

/** GET /drafts/:id, for its owner: the file and its revision. */
export const draftSchema = z.object({
  id,
  revision: z.number().int().positive(),
  file: z.record(z.string(), z.unknown()),
});

/** GET /drafts/:id, for anyone else: the share to show, when there is one. */
export const draftElsewhereSchema = z.object({ shareId: id });

/** PUT /drafts/:id with `If-Match: <revision>`: the new file. Answers `{ revision }`. */
export const saveDraftSchema = z.object({ file: z.record(z.string(), z.unknown()) });
export const savedSchema = z.object({ revision: z.number().int().positive() });

/** GET /shares/:id (or ?v=3): a frozen snapshot and the pack versions it uses. */
export const shareSchema = z.object({
  id,
  kind: fileKind,
  version: z.number().int().positive(),
  sharedAt: time,
  file: z.record(z.string(), z.unknown()),
  packs: z.array(packRefSchema),
});

/** GET /shares/:id/versions. */
export const shareVersionsSchema = z.array(
  z.object({ version: z.number().int().positive(), sharedAt: time, bytes: z.number().int() }),
);

/** PATCH /shares/:id: private, or public again on the same link with the same version. */
export const sharePatchSchema = z.object({ public: z.boolean() });

export type Health = z.infer<typeof healthSchema>;
export type DraftSummary = z.infer<typeof draftSummarySchema>;
export type NewDraft = z.infer<typeof newDraftSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Share = z.infer<typeof shareSchema>;
export type ShareVersions = z.infer<typeof shareVersionsSchema>;
export type SharePatch = z.infer<typeof sharePatchSchema>;
