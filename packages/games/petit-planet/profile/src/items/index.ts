// The item formula: how one catalog entry looks on its own, in 2D and 3D, with no map around it.
// Every map of the game draws its plants and items through it; each map adds what its own
// surroundings do. Item builders use it to show one item.

export { drawItem2D, frontMarker } from "./draw2d";
export {
  appModel,
  BLOCK_TILES,
  doorPart,
  frontSide,
  inclineModel,
  itemModel,
  itemSize,
  rotatedSize,
} from "./model";
