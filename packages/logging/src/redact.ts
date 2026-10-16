// Redaction: turning facts that could identify someone into facts that can't. Stack traces lose
// URL queries (draft and share ids) and home folders; a user agent becomes a browser family and
// main version number; a screen width becomes a size bucket.

/** Longest stack kept, in lines and characters. */
const STACK_LINES = 30;
const STACK_CHARS = 4000;

/** A stack trace with URL queries, fragments and home folders taken out, and its length capped. */
export function redactStack(stack: string): string {
  return stack
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#)]+)[?#][^\s):]*/gi, "$1")
    .replace(/(\/(?:Users|home)\/)[^/\s]+/g, "$1~")
    .replace(/([A-Z]:\\Users\\)[^\\\s]+/g, "$1~")
    .split("\n")
    .slice(0, STACK_LINES)
    .join("\n")
    .slice(0, STACK_CHARS);
}

export type BrowserFamily = "chrome" | "edge" | "firefox" | "safari" | "other";

/** The browser family and main version number from a user agent. Nothing else is kept. */
export function browserOf(userAgent: string): { family: BrowserFamily; version: number } {
  const rules: [BrowserFamily, RegExp][] = [
    ["edge", /Edg(?:e|A|iOS)?\/(\d+)/],
    ["firefox", /(?:Firefox|FxiOS)\/(\d+)/],
    ["chrome", /(?:Chrome|CriOS)\/(\d+)/],
    ["safari", /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//],
  ];
  for (const [family, pattern] of rules) {
    const match = pattern.exec(userAgent);
    if (match) return { family, version: Number(match[1]) };
  }
  return { family: "other", version: 0 };
}

export type ScreenBucket = "phone" | "tablet" | "desktop" | "wide";

/** A screen width in CSS pixels, as a size bucket. */
export function screenBucket(width: number): ScreenBucket {
  if (width < 600) return "phone";
  if (width < 1024) return "tablet";
  if (width < 1920) return "desktop";
  return "wide";
}
