// Every game profile, with samples for each of its maps: the made-up items a map's sample maps use
// (profiles ship no items) and those maps. The contract tests and the render goldens read this
// list. Add a game here when it is added under packages/games/, and samples for each new map.

import {
  bind,
  loadMap,
  type Bound,
  type CatalogItem,
  type Doc,
  type GameProfile,
} from "@glade/core";
import { fixture } from "@glade/fixture-profile";
import { maps as fixtureMaps, things } from "@glade/fixture-profile/samples";
import { petitPlanet, type Catalog } from "@glade/petit-planet-profile";
import {
  demoCatalog,
  homeCatalog,
  maps,
  modelsCatalog,
  showroomMap,
} from "@glade/petit-planet-profile/samples";
import type { RenderableMap } from "@glade/render";

/** A map bound to a catalog: what the tests and the render goldens work with. */
export type Shown = Bound<RenderableMap>;

export interface MapSamples {
  /** Made-up items the demo map uses. */
  items: CatalogItem[];
  /** The demo map, for the map bound to a catalog with `items`. */
  demo(map: Shown): Doc;
  /** The showroom: made-up items to show, and a map laying out a catalog. */
  showroom?: { items: CatalogItem[]; map: (map: Shown) => Doc };
}

export interface GameSamples {
  /** The game as its profile exports it: kinds and maps, no catalog. */
  game: GameProfile<RenderableMap>;
  /** Samples for each of the game's maps, by map id. */
  maps: Record<string, MapSamples>;
}

export const games: Record<string, GameSamples> = {
  "petit-planet": {
    game: petitPlanet,
    maps: {
      planet: {
        items: demoCatalog.entries,
        demo: () => loadMap(maps.demo, petitPlanet),
        showroom: {
          items: modelsCatalog.entries,
          map: (map) => showroomMap(map.catalog as Catalog),
        },
      },
      interior_home_1_10: {
        items: homeCatalog.entries,
        demo: () => loadMap(maps.interior_home_1_10, petitPlanet),
      },
      interior_home_1_8: {
        items: homeCatalog.entries,
        demo: () => loadMap(maps.interior_home_1_8, petitPlanet),
      },
    },
  },
  _fixture: {
    game: fixture,
    maps: {
      board: { items: things.entries, demo: () => loadMap(fixtureMaps.demo, fixture) },
      sheet: { items: things.entries, demo: () => loadMap(fixtureMaps.sheet, fixture) },
    },
  },
};

/** Every map of every game, with its samples. */
export function allMaps(): {
  game: GameProfile<RenderableMap>;
  map: RenderableMap;
  samples: MapSamples;
}[] {
  return Object.values(games).flatMap(({ game, maps }) =>
    Object.values(game.maps).map((map) => ({ game, map, samples: maps[map.id] })),
  );
}

/** A map bound to its sample items, plus any others. */
export function bound(map: RenderableMap, samples: MapSamples, extra: CatalogItem[] = []): Shown {
  return bind(map, { entries: [...samples.items, ...extra] });
}
