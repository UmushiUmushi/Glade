// The map contract, extended with a look. A map with a look is a RenderableMap.

import type { CatalogItem, Entity, MapDefinition } from "@glade/core";
import type { Model } from "./models";
import type { MapUI, MapViews } from "./render";
import type { StyleHooks } from "./style";

/** A map that also describes how it looks, in the views it can be seen in. */
export interface RenderableMap extends MapDefinition {
  style: StyleHooks;
  /** What every view shares: layer toggles, grids, hover text, click selection. */
  ui: MapUI;
  /** The views the map can be seen in (at least one). */
  views: MapViews;
  /**
   * An app's model for a placed thing, given the thing (its own fields, such as a state) and its
   * catalog entry; undefined keeps the entry's own. The map's renderers ask for every placed
   * thing, so an app can show states the game knows nothing about (an open window). Set it with
   * customizeLook.
   */
  itemModel?(thing: Entity, entry: CatalogItem | undefined): Model | undefined;
}
