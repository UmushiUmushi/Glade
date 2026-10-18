// The theme root: wraps a screen, sets the theme's tokens as CSS custom properties for light or
// dark (or the system's choice), hands the game's own icons down to every <Icon>, and has popups
// open inside it, so they wear the same theme.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import { IconProvider, type GameIcons } from "../icons";
import { cssVars, type ColorMode, type Theme } from "./tokens";
import "./base.css";

export type ModeSetting = ColorMode | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Whether the system asks for dark, following changes. */
export function usePrefersDark(): boolean {
  const query = typeof window !== "undefined" ? window.matchMedia?.(DARK_QUERY) : undefined;
  const [dark, setDark] = useState(() => query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const update = () => setDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [query]);
  return dark;
}

export interface ThemeRootProps {
  theme: Theme;
  mode?: ModeSetting;
  /** Turn off moving extras (Settings → Reduce motion), on top of the system setting. */
  reduceMotion?: boolean;
  /** The game's own drawings, by icon id. Every other icon comes from the shared set. */
  icons?: GameIcons;
  /** Settings → Interface size: 1 is 100 % (70 % to 130 %). */
  interfaceSize?: number;
  className?: string;
  children: ReactNode;
}

export function ThemeRoot(props: ThemeRootProps) {
  const prefersDark = usePrefersDark();
  const setting = props.mode ?? "system";
  const mode: ColorMode = setting === "system" ? (prefersDark ? "dark" : "light") : setting;
  const root = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={root}
      className={["glade-root", props.className].filter(Boolean).join(" ")}
      data-theme={props.theme.id}
      data-mode={mode}
      data-reduce-motion={props.reduceMotion ? "" : undefined}
      style={cssVars(props.theme, mode, props.interfaceSize)}
    >
      {/* Popups (menus, tooltips, dialogs) open inside this root, so they wear its theme too. */}
      <UNSAFE_PortalProvider getContainer={() => root.current}>
        <IconProvider icons={props.icons ?? {}}>{props.children}</IconProvider>
      </UNSAFE_PortalProvider>
    </div>
  );
}
