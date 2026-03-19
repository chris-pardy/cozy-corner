import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import { type Event, RenderEvent } from "../event";
import { drawTile } from "../draw-tile";
import {
  TILE_SHEET,
  TILE_ATLAS,
  TILE_POSITIONS,
  TILE_SIZE,
  type TileFrame,
  type PlacedTile,
} from "../state/tiles";
import { BLOCKING_GRID, type BlockingGrid } from "../state/blocking";

/**
 * Pre-renders all tiles for a single render layer onto an OffscreenCanvas
 * and blits the cached image each frame. Re-renders only when an animated
 * tile's frame index changes.
 *
 * Use for background (layer 0) and overhead (layer 2) tiles where the
 * tile set is static per frame. The cache is owned by the behavior
 * instance since no other behavior needs it.
 */
export class CachedTileRenderBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["render"]);

  private readonly renderLayer: number;

  private cache: OffscreenCanvas | null = null;
  private lastFrameKey = "";

  constructor(renderLayer: number) {
    this.renderLayer = renderLayer;
  }

  handle(entity: Entity, event: Event): void {
    const { ctx, time } = event as RenderEvent;
    const sheet = entity.find<CanvasImageSource>(TILE_SHEET);
    const atlas = entity.find<TileFrame[]>(TILE_ATLAS);
    const tiles = entity.get<PlacedTile[]>(TILE_POSITIONS);
    const tileSize = entity.find<number>(TILE_SIZE);

    if (!sheet || !atlas || !tiles || !tileSize) return;

    // Determine room dimensions from blocking grid
    const grid = entity.find<BlockingGrid>(BLOCKING_GRID);
    if (!grid) return;

    const canvasW = grid.width * tileSize;
    const canvasH = grid.height * tileSize;

    // Build frame key from animated tile frame indices
    const frameKey = this.buildFrameKey(tiles, atlas, time);

    if (frameKey !== this.lastFrameKey || !this.cache) {
      // Rebuild cache
      if (
        !this.cache ||
        this.cache.width !== canvasW ||
        this.cache.height !== canvasH
      ) {
        this.cache = new OffscreenCanvas(canvasW, canvasH);
      }

      const offCtx = this.cache.getContext("2d")!;
      offCtx.clearRect(0, 0, canvasW, canvasH);
      offCtx.imageSmoothingEnabled = false;

      for (const tile of tiles) {
        if (tile.renderLayer !== this.renderLayer) continue;
        const frame = atlas[tile.tile];
        if (!frame) continue;

        drawTile(
          offCtx,
          sheet,
          frame,
          time,
          tile.x * tileSize,
          tile.y * tileSize,
          tileSize,
          tile.transform,
        );
      }

      this.lastFrameKey = frameKey;
    }

    ctx.drawImage(this.cache, 0, 0);
  }

  /**
   * Build a string key from the current frame indices of all animated tiles
   * on this render layer. Static tiles (frameCount <= 1) don't contribute.
   */
  private buildFrameKey(
    tiles: { tile: number; renderLayer: number }[],
    atlas: { frameCount: number; frameRate: number }[],
    time: number,
  ): string {
    let key = "";
    for (const tile of tiles) {
      if (tile.renderLayer !== this.renderLayer) continue;
      const frame = atlas[tile.tile];
      if (!frame || frame.frameCount <= 1) continue;
      const frameIndex = Math.floor(time / frame.frameRate) % frame.frameCount;
      key += `${tile.tile}:${frameIndex},`;
    }
    return key;
  }
}
