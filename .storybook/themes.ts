// The themes Storybook can show, by id. Each game adds its theme here when its ui package exists.

import { gladeTheme, type Theme } from "@glade/ui";

export const THEMES: Record<string, { theme: Theme; icons: Record<string, string> }> = {
  glade: { theme: gladeTheme, icons: {} },
};
