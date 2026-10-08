// Customizing a map's look. The look a profile ships is a default: an app can patch the style (colors,
// light, presets, the walk camera), give placed things models of its own (for states), or replace
// parts of the 2D and 3D rendering with its own.

import type { MapUI, PlanView, Render3D } from "./render";
import { mergeStyle, type Style } from "./style";
import type { RenderableMap } from "./game";

export interface LookCustomization {
  /** Merged into the game's default style, key by key (e.g. one preset's sky color). */
  style?: unknown;
  /** Parts of the map's UI to replace (e.g. your own hover text). */
  ui?: Partial<MapUI>;
  /** Parts of the plan view to replace (e.g. your own draw). */
  plan?: Partial<PlanView>;
  /** Parts of the 3D view to replace (e.g. your own materials). */
  scene?: Partial<Render3D>;
  /** Models for placed things (RenderableMap.itemModel), e.g. by a state of the app's own. */
  itemModel?: RenderableMap["itemModel"];
}

/** The map with a look customization applied. The map itself is not changed. */
export function customizeLook<G extends RenderableMap>(game: G, c: LookCustomization): G {
  return {
    ...game,
    itemModel: c.itemModel ?? game.itemModel,
    style: c.style
      ? { ...game.style, defaults: mergeStyle<Style>(game.style.defaults, c.style) }
      : game.style,
    ui: c.ui ? { ...game.ui, ...c.ui } : game.ui,
    views: {
      ...game.views,
      ...(c.plan && game.views.plan ? { plan: { ...game.views.plan, ...c.plan } } : {}),
      ...(c.scene && game.views.scene ? { scene: { ...game.views.scene, ...c.scene } } : {}),
    },
  };
}
