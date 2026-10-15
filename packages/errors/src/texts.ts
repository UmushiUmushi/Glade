// The plain-language messages users see for errors. Each says what happened, whether their work is
// safe, and what to do (docs/logging/errors.md, rule 5). Several error codes can share one text.

/** A button the error offers. The screens that show the error decide how each one looks. */
export type ErrorAction = "report" | "retry" | "log-in" | "find-pack" | "reload-part" | "details";

export interface UserText {
  /** What happened, in a few words. May hold `{name}` slots filled from the error's detail. */
  what: string;
  /** Whether the user's work is safe. Left out only when nothing was at risk. */
  safe?: string;
  /** What to do next, when there is something to do. */
  next?: string;
  actions: readonly ErrorAction[];
}

export const USER_TEXTS = {
  "safe-failure": {
    what: "Something went wrong.",
    safe: "Your map is safe.",
    actions: ["report"],
  },
  "editor-restarted": {
    what: "Restarted the editor. Undo history was reset.",
    safe: "Your map is safe.",
    actions: ["report"],
  },
  "view-paused": {
    what: "3D view paused.",
    safe: "Your map is safe.",
    next: "Try again, or keep working in 2D.",
    actions: ["retry"],
  },
  "storage-unavailable": {
    what: "This browser can't keep changes on this device.",
    safe: "Changes go straight to the server instead.",
    actions: [],
  },
  "changes-waiting": {
    what: "Can't reach Glade's server. Changes waiting.",
    safe: "Your changes are kept on this device and sent when the server is back.",
    actions: [],
  },
  "changed-elsewhere": {
    what: "This map changed on another device. Loaded the latest version.",
    safe: "Changes made here after the last save were not kept.",
    actions: [],
  },
  "logged-out": {
    what: "You were logged out.",
    safe: "Your changes wait on this device until you log in again.",
    actions: ["log-in"],
  },
  "not-a-glade-file": {
    what: "This isn't a Glade file.",
    safe: "Nothing was changed.",
    actions: ["details"],
  },
  "wrong-game": {
    what: "This file is for another game.",
    safe: "Nothing was changed.",
    next: "Open it from that game's planner.",
    actions: ["details"],
  },
  "file-too-new": {
    what: "This file was made by a newer version of Glade.",
    safe: "Nothing was changed.",
    next: "Reload the page to get the newest Glade.",
    actions: ["details"],
  },
  "missing-pack": {
    what: "{count} items need the pack “{pack}”.",
    safe: "They are kept in your map and drawn as grey placeholders.",
    actions: ["find-pack"],
  },
  "part-stopped": {
    what: "This part stopped working.",
    safe: "The rest of Glade still works. Your map is safe.",
    actions: ["reload-part", "report"],
  },
} as const satisfies Record<string, UserText>;

export type TextKey = keyof typeof USER_TEXTS;

/** Fill a text's `{name}` slots from an error's detail. A slot with no value stays as it is. */
export function fillSlots(text: string, detail: Record<string, string | number | boolean>): string {
  return text.replace(/\{(\w+)\}/g, (slot, name: string) =>
    name in detail ? String(detail[name]) : slot,
  );
}
