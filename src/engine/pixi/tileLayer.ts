import type { Container, Sprite, Texture } from "pixi.js";
import type { TileFrame, PlacedTile } from "../state/tiles";

export interface AnimatedTileEntry {
  sprite: Sprite;
  frame: TileFrame;
  baseTexture: Texture;
}

/**
 * Build a pixi Container of tile sprites for a specific render layer.
 *
 * Returns the container and an array of animated tile entries that need
 * per-frame texture updates.
 */
export async function buildTileLayerContainer(
  sheetImage: HTMLImageElement | ImageBitmap,
  atlas: TileFrame[],
  tiles: PlacedTile[],
  tileSize: number,
  renderLayer: number,
): Promise<{ container: Container; animated: AnimatedTileEntry[] }> {
  const { Container, Sprite, Texture, Rectangle } = await import("pixi.js");

  const container = new Container();
  const animated: AnimatedTileEntry[] = [];

  // Create a base texture from the sheet image
  const baseTexture = Texture.from(sheetImage);

  for (const placed of tiles) {
    if (placed.renderLayer !== renderLayer) continue;

    const frame = atlas[placed.tile];
    if (!frame) continue;

    // Create a sub-texture for this tile's current frame
    const tex = new Texture({
      source: baseTexture.source,
      frame: new Rectangle(frame.sx, frame.sy, frame.sw, frame.sh),
    });

    const sprite = new Sprite(tex);
    sprite.width = tileSize;
    sprite.height = tileSize;

    // Apply packed transform bits
    applyTileTransform(sprite, placed.transform, tileSize);

    // Position on grid
    sprite.x = placed.x * tileSize;
    sprite.y = placed.y * tileSize;

    container.addChild(sprite);

    // Track animated tiles for per-frame updates
    if (frame.frameCount > 1) {
      animated.push({ sprite, frame, baseTexture });
    }
  }

  // Cache static layers (only if no animated tiles)
  if (animated.length === 0) {
    container.cacheAsTexture(true);
  }

  return { container, animated };
}

/**
 * Apply packed tile transform bits to a pixi sprite.
 *
 * Transform layout:
 *   bits 0-1: rotation (0=0°, 1=90°, 2=180°, 3=270°)
 *   bit 2: horizontal mirror
 *   bit 3: vertical mirror
 */
function applyTileTransform(
  sprite: import("pixi.js").Sprite,
  transform: number,
  tileSize: number,
): void {
  if (transform === 0) return;

  const rotation = transform & 3;
  const hflip = (transform & 4) !== 0;
  const vflip = (transform & 8) !== 0;

  // Set pivot to center for rotation/flip
  sprite.anchor.set(0.5);
  sprite.x += tileSize / 2;
  sprite.y += tileSize / 2;

  if (rotation) {
    sprite.angle = rotation * 90;
  }
  if (hflip) {
    sprite.scale.x *= -1;
  }
  if (vflip) {
    sprite.scale.y *= -1;
  }
}

/**
 * Update animated tile textures for the current time.
 * Call this each frame for tile layers that contain animated tiles.
 * Returns true if any textures changed (for cache invalidation).
 */
export function updateAnimatedTiles(
  animated: AnimatedTileEntry[],
  time: number,
): boolean {
  let changed = false;

  for (const entry of animated) {
    const { sprite, frame, baseTexture } = entry;
    const frameIndex =
      Math.floor(time / frame.frameRate) % frame.frameCount;
    const sx = frame.sx + frameIndex * frame.frameStride;

    // Only update if the frame actually changed
    const currentFrame = sprite.texture.frame;
    if (currentFrame.x !== sx) {
      currentFrame.x = sx;
      currentFrame.y = frame.sy;
      currentFrame.width = frame.sw;
      currentFrame.height = frame.sh;
      sprite.texture.updateUvs();
      changed = true;
    }
  }

  return changed;
}

/**
 * Build tile row containers for foreground (layer 1) tiles, grouped by Y position.
 * Each row becomes a separate container for Y-sorting with entities.
 */
export async function buildForegroundTileRows(
  sheetImage: HTMLImageElement | ImageBitmap,
  atlas: TileFrame[],
  tiles: PlacedTile[],
  tileSize: number,
): Promise<{ y: number; container: Container; animated: AnimatedTileEntry[] }[]> {
  const { Container, Sprite, Texture, Rectangle } = await import("pixi.js");

  // Group layer-1 tiles by y position
  const rowMap = new Map<number, PlacedTile[]>();
  for (const placed of tiles) {
    if (placed.renderLayer !== 1) continue;
    const row = rowMap.get(placed.y);
    if (row) row.push(placed);
    else rowMap.set(placed.y, [placed]);
  }

  const baseTexture = Texture.from(sheetImage);
  const rows: { y: number; container: Container; animated: AnimatedTileEntry[] }[] = [];

  for (const [y, rowTiles] of rowMap) {
    const container = new Container();
    const animated: AnimatedTileEntry[] = [];

    for (const placed of rowTiles) {
      const frame = atlas[placed.tile];
      if (!frame) continue;

      const tex = new Texture({
        source: baseTexture.source,
        frame: new Rectangle(frame.sx, frame.sy, frame.sw, frame.sh),
      });

      const sprite = new Sprite(tex);
      sprite.width = tileSize;
      sprite.height = tileSize;
      applyTileTransform(sprite, placed.transform, tileSize);
      sprite.x = placed.x * tileSize;
      sprite.y = placed.y * tileSize;

      container.addChild(sprite);

      if (frame.frameCount > 1) {
        animated.push({ sprite, frame, baseTexture });
      }
    }

    rows.push({ y, container, animated });
  }

  return rows;
}
