/** Source rectangle and animation data for a tile in the sprite sheet. */
export interface TileFrame {
  /** Source x of the first frame. */
  sx: number;
  /** Source y. */
  sy: number;
  /** Source width. */
  sw: number;
  /** Source height. */
  sh: number;
  /** Number of animation frames (1 for static). */
  frameCount: number;
  /** Milliseconds per frame (ignored when frameCount is 1). */
  frameRate: number;
  /** Horizontal pixel stride between frames. */
  frameStride: number;
}

/** A tile placed on the room grid. */
export interface PlacedTile {
  /** Index into TILE_ATLAS for source rectangle lookup. */
  tile: number;
  /** Grid x position. */
  x: number;
  /** Grid y position. */
  y: number;
  /** 0 = background, 1 = foreground, 2 = overhead. */
  renderLayer: number;
  /**
   * Packed transform. Bits 0-1: rotation (0=0°, 1=90°, 2=180°, 3=270°).
   * Bit 2: horizontal mirror. Bit 3: vertical mirror.
   */
  transform: number;
}

/** Sprite sheet image for the room's tileset. */
export const TILE_SHEET = "engine:tileSheet";

/** Pre-computed source rectangles per tile index. */
export const TILE_ATLAS = "engine:tileAtlas";

/** All placed tiles in the room. */
export const TILE_POSITIONS = "engine:tilePositions";

/** Destination tile size in pixels (e.g. 32). */
export const TILE_SIZE = "engine:tileSize";

/** Mixin interface for entities with tile state. */
export interface TilesMixin {
  [TILE_SHEET]: CanvasImageSource;
  [TILE_ATLAS]: TileFrame[];
  [TILE_POSITIONS]: PlacedTile[];
  [TILE_SIZE]: number;
}
