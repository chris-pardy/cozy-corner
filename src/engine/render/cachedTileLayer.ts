import type { RenderContext } from "../event";
import { drawTile } from "../draw-tile";
import type { TileFrame, PlacedTile } from "../state/tiles";
import type { BlockingGrid } from "../state/blocking";

/**
 * Per-layer cache for tile rendering. Owns the OffscreenCanvas.
 */
export class TileLayerCache {
  private cache: OffscreenCanvas | null = null;
  private lastFrameKey = "";

  /**
   * Draw all tiles for the given render layer, using a cached OffscreenCanvas.
   * Rebuilds only when animated tile frame indices change.
   */
  draw(
    ctx: RenderContext,
    renderLayer: number,
    sheet: CanvasImageSource,
    atlas: TileFrame[],
    tiles: PlacedTile[],
    tileSize: number,
    grid: BlockingGrid,
    time: number,
  ): void {
    const canvasW = grid.width * tileSize;
    const canvasH = grid.height * tileSize;

    const frameKey = buildFrameKey(tiles, atlas, time, renderLayer);

    if (frameKey !== this.lastFrameKey || !this.cache) {
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
        if (tile.renderLayer !== renderLayer) continue;
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
}

function buildFrameKey(
  tiles: PlacedTile[],
  atlas: TileFrame[],
  time: number,
  renderLayer: number,
): string {
  let key = "";
  for (const tile of tiles) {
    if (tile.renderLayer !== renderLayer) continue;
    const frame = atlas[tile.tile];
    if (!frame || frame.frameCount <= 1) continue;
    const frameIndex = Math.floor(time / frame.frameRate) % frame.frameCount;
    key += `${tile.tile}:${frameIndex},`;
  }
  return key;
}
