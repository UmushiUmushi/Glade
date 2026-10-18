// Which layout a screen gets (docs/planner/screen.md, Screen sizes): desktop from 1280 px wide,
// tablet (or a small laptop) from 900 px, phone below that or when less than 500 px tall. Settings
// can force one; Auto lets the size decide.

import { useEffect, useState } from "react";

export type ScreenLayout = "desktop" | "tablet" | "phone";

export const DESKTOP_MIN_WIDTH = 1280;
export const TABLET_MIN_WIDTH = 900;
export const PHONE_MAX_HEIGHT = 500;

/** The layout for a screen `width` x `height` CSS pixels. */
export function layoutFor(width: number, height: number): ScreenLayout {
  if (width < TABLET_MIN_WIDTH || height < PHONE_MAX_HEIGHT) return "phone";
  return width >= DESKTOP_MIN_WIDTH ? "desktop" : "tablet";
}

/** A forced layout (Settings: Desktop, Phone) or "auto": let the window's size decide. */
export type LayoutSetting = ScreenLayout | "auto";

/** The layout for the window, following resizes, unless `setting` forces one. */
export function useScreenLayout(setting: LayoutSetting = "auto"): ScreenLayout {
  const read = () =>
    typeof window === "undefined" ? "desktop" : layoutFor(window.innerWidth, window.innerHeight);
  const [measured, setMeasured] = useState<ScreenLayout>(read);
  useEffect(() => {
    if (setting !== "auto") return;
    const update = () => setMeasured(read());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setting]);
  return setting === "auto" ? measured : setting;
}
