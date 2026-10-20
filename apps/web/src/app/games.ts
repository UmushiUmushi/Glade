// The game registry: the only file in the app that lists games (docs/architecture.md, What each
// game gives Glade). Each entry joins a game's packages up for the shared screens: its name, its
// look, and what its planner opens. Games not ready yet are listed by name only, so the home page
// and the game picker can show them as "Soon".

import { bind, type Bound, type Doc } from "@glade/core";
import { petitPlanet } from "@glade/petit-planet-profile";
import {
  islandLayers,
  islandSnowSeason,
  islandTimeStops,
  petitPlanetIcons,
  petitPlanetTheme,
  title as petitPlanetTitle,
} from "@glade/petit-planet-ui";
import type { LayerRow, TimeStopName } from "@glade/planner";
import "@glade/petit-planet-ui/fonts.css";
import type { RenderableMap } from "@glade/render";
import type { GameIcons, Theme } from "@glade/ui";

export interface GladeGame {
  /** The game's id, as in its URLs: /<id>/planner. */
  id: string;
  /** Its name: "Petit Planet". */
  title: string;
  /** Its look: tokens and fonts (null: Glade's own, for a game that isn't ready). */
  theme: Theme | null;
  /** Its own drawings, by icon id. */
  icons?: GameIcons;
  /** Its small logo's icon id, for the rail's game button. */
  logo?: string;
  /** What its planner opens; null for a game that isn't ready yet ("Soon"). */
  planner: GamePlanner | null;
}

export interface GamePlanner {
  /** The map a new plan starts on, bound to the game's catalog. */
  map: Bound<RenderableMap>;
  /** A new, empty map of it. */
  newDoc(): Doc;
  /** The side panel's layer rows for that map. */
  layers: readonly LayerRow[];
  /** The time of day's stops: a name and sky colour for each of the look's presets. */
  timeStops: readonly TimeStopName[];
  /** The look's season that Snow turns on; none for a map without one. */
  snowSeason?: string;
}

const island = bind(petitPlanet.maps[petitPlanet.defaultMap], {
  // The game's catalog package arrives in Phase 2; until then the planner opens with no items.
  entries: [],
});

export const games: readonly GladeGame[] = [
  {
    id: petitPlanet.id,
    title: petitPlanetTitle,
    theme: petitPlanetTheme,
    icons: petitPlanetIcons,
    logo: "planet",
    planner: {
      map: island,
      newDoc: () => island.newDoc("Island"),
      layers: islandLayers,
      timeStops: islandTimeStops,
      snowSeason: islandSnowSeason,
    },
  },
  { id: "palworld", title: "Palworld", theme: null, planner: null },
  { id: "stardew-valley", title: "Stardew Valley", theme: null, planner: null },
];
