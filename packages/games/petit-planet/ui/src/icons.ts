// Petit Planet's own icon drawings: SVG files in theme/icons/, by icon id. They replace the shared
// set's icon with the same id (grab, pointer, lasso…) and add the game's own (modes, layers, items).
// Generic icons (close, undo, eye, search) come from the shared set (docs/ui/README.md).
// Replace a drawing by saving over its file; the id stays the same.

import type { GameIcons } from "@glade/ui";
import brush from "../theme/icons/Brush.svg?raw";
import cut from "../theme/icons/Cut.svg?raw";
import cutClip from "../theme/icons/CutClip.svg?raw";
import cutRound from "../theme/icons/CutRound.svg?raw";
import eraser from "../theme/icons/Eraser.svg?raw";
import fill from "../theme/icons/Fill.svg?raw";
import grab from "../theme/icons/Grab.svg?raw";
import ground from "../theme/icons/Ground.svg?raw";
import itemBench from "../theme/icons/ItemBench.svg?raw";
import itemDesk from "../theme/icons/ItemDesk.svg?raw";
import itemFence from "../theme/icons/ItemFence.svg?raw";
import itemHedge from "../theme/icons/ItemHedge.svg?raw";
import itemLamp from "../theme/icons/ItemLamp.svg?raw";
import itemLantern from "../theme/icons/ItemLantern.svg?raw";
import itemMailbox from "../theme/icons/ItemMailbox.svg?raw";
import itemRug from "../theme/icons/ItemRug.svg?raw";
import itemStool from "../theme/icons/ItemStool.svg?raw";
import itemTable from "../theme/icons/ItemTable.svg?raw";
import lasso from "../theme/icons/Lasso.svg?raw";
import layerArea from "../theme/icons/LayerArea.svg?raw";
import layerBuildings from "../theme/icons/LayerBuildings.svg?raw";
import layerFurniture from "../theme/icons/LayerFurniture.svg?raw";
import layerGrid from "../theme/icons/LayerGrid.svg?raw";
import layerPaths from "../theme/icons/LayerPaths.svg?raw";
import layerPlants from "../theme/icons/LayerPlants.svg?raw";
import magic from "../theme/icons/Magic.svg?raw";
import modeCliffs from "../theme/icons/ModeCliffs.svg?raw";
import modeItems from "../theme/icons/ModeItems.svg?raw";
import modePaths from "../theme/icons/ModePaths.svg?raw";
import modeWater from "../theme/icons/ModeWater.svg?raw";
import planet from "../theme/icons/Planet.svg?raw";
import pointer from "../theme/icons/Pointer.svg?raw";
import raise from "../theme/icons/Raise.svg?raw";
import selectAdd from "../theme/icons/SelectAdd.svg?raw";
import selectCircle from "../theme/icons/SelectCircle.svg?raw";
import selectRect from "../theme/icons/SelectRect.svg?raw";
import selectSet from "../theme/icons/SelectSet.svg?raw";
import selectSubtract from "../theme/icons/SelectSubtract.svg?raw";
import snow from "../theme/icons/Snow.svg?raw";
import timeDawn from "../theme/icons/TimeDawn.svg?raw";
import timeDay from "../theme/icons/TimeDay.svg?raw";
import timeDusk from "../theme/icons/TimeDusk.svg?raw";
import timeNight from "../theme/icons/TimeNight.svg?raw";
import waterBadge from "../theme/icons/WaterBadge.svg?raw";

export const petitPlanetIcons: GameIcons = {
  // Cursor tools
  grab: grab,
  pointer: pointer,
  // Select tools and select modes
  lasso: lasso,
  "select-rect": selectRect,
  "select-circle": selectCircle,
  magic: magic,
  "select-set": selectSet,
  "select-add": selectAdd,
  "select-subtract": selectSubtract,
  // Paint tools and cut shapes
  brush: brush,
  eraser: eraser,
  fill: fill,
  cut: cut,
  "cut-round": cutRound,
  "cut-clip": cutClip,
  // Viewport modes (the island)
  "mode-items": modeItems,
  "mode-paths": modePaths,
  "mode-cliffs": modeCliffs,
  "mode-water": modeWater,
  // Layers (the island)
  "layer-buildings": layerBuildings,
  "layer-furniture": layerFurniture,
  "layer-plants": layerPlants,
  "layer-paths": layerPaths,
  "layer-grid": layerGrid,
  "layer-area": layerArea,
  // Environment
  "time-dawn": timeDawn,
  "time-day": timeDay,
  "time-dusk": timeDusk,
  "time-night": timeNight,
  snow: snow,
  // Terrain actions
  raise: raise,
  ground: ground,
  // Items: stand-ins on toolbox tiles until the catalog has thumbnails
  "item-bench": itemBench,
  "item-stool": itemStool,
  "item-table": itemTable,
  "item-desk": itemDesk,
  "item-lantern": itemLantern,
  "item-lamp": itemLamp,
  "item-hedge": itemHedge,
  "item-fence": itemFence,
  "item-mailbox": itemMailbox,
  "item-rug": itemRug,
  // The game, and the water decor badge
  planet: planet,
  "water-badge": waterBadge,
};
