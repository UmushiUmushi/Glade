// Petit Planet's look in Glade, as shared design tokens (docs/ui/README.md): warm cream cards on a
// tan tray, cocoa as the one dark fill, sun yellow for "selected", Baloo 2 and Nunito. Things
// that float on the map (cream, cocoa, sun) keep their colours in light and dark.

import type { Theme, ThemeColors } from "@glade/ui";

/** Colours that stay the same in light and dark. */
const FIXED = {
  selected: "#f9e260",
  onSelected: "#3d3632",
  strong: "#3d3632",
  onStrong: "#f5f0d1",
  float: "#efe9d4",
  onFloat: "#3d3632",
  floatPress: "#e2dcc4",
  danger: "#a8372a",
  onDanger: "#f5f0d1",
  scrim: "rgba(36,30,26,0.38)",
} satisfies Partial<ThemeColors>;

const light: ThemeColors = {
  ...FIXED,
  ground: "#e9e4cc",
  paper: "#fcf9e8",
  inset: "#efe9d4",
  line: "#d6cdaa",
  frame: "#d6cdaa",
  lip: "rgba(61,54,50,0.16)",
  pop: "#efe6c8",
  popLine: "#d6cdaa",
  ink: "#3d3632",
  inkTitle: "#614c32",
  inkMuted: "#6e6245",
  alert: "#a8372a",
  focus: "#3d3632",
};

const dark: ThemeColors = {
  ...FIXED,
  ground: "#0e0d0c",
  paper: "#1c1a19",
  inset: "#2a2725",
  line: "#3a3532",
  frame: "#2c2826",
  lip: "#3e3833",
  pop: "#2d2a27",
  popLine: "#45403b",
  ink: "#f5f0d1",
  inkTitle: "#e8dcb4",
  inkMuted: "#b5ada0",
  alert: "#ff9a85",
  focus: "#f5f0d1",
};

export const petitPlanetTheme: Theme = {
  id: "petit-planet",
  name: "Petit Planet",
  light,
  dark,
  shape: {
    radiusCard: "28px",
    radiusPop: "24px",
    radiusBox: "8px",
    borderCard: "3px",
    borderPop: "2px",
    gap: "12px",
    shadowChunk: "0 4px 0 rgba(61,54,50,0.22)",
    shadowFloat: "0 10px 28px rgba(36,30,20,0.22)",
    fontTitle: "'Baloo 2', 'Nunito', ui-rounded, system-ui, sans-serif",
    fontUi: "'Nunito', ui-rounded, system-ui, sans-serif",
    weightTitle: "800",
    weightUi: "800",
    weightStrong: "900",
  },
};
