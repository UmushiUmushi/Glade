// The themes Storybook can show, by id. Each game adds its theme (and its icons) here when its ui
// package exists.

import { petitPlanetIcons, petitPlanetTheme } from "@glade/petit-planet-ui";
import { gladeTheme, type GameIcons, type Theme } from "@glade/ui";
import "@glade/petit-planet-ui/fonts.css";

export const THEMES: Record<string, { theme: Theme; icons: GameIcons }> = {
  glade: { theme: gladeTheme, icons: {} },
  "petit-planet": { theme: petitPlanetTheme, icons: petitPlanetIcons },
};
