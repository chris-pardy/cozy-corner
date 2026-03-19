import type { RenderContext } from "../event";
import { drawTile } from "../draw-tile";
import type { TileFrame, PlacedTile } from "../state/tiles";

/**
 * Draw placed tiles from a single render layer directly to the canvas.
 * Used for foreground tile rows (layer 1) rendered as child entities.
 *
 * Extracted from TileLayerRenderBehavior — same logic, pure function.
 */
export function drawTileRow(
  ctx: RenderContext,
  tiles: PlacedTile[],
  renderLayer: number,
  sheet: CanvasImageSource,
  atlas: TileFrame[],
  tileSize: number,
  time: number,
): void {
  for (const tile of tiles) {
    if (tile.renderLayer !== renderLayer) continue;

    const frame = atlas[tile.tile];
    if (!frame) continue;

    drawTile(
      ctx,
      sheet,
      frame,
      time,
      tile.x * tileSize,
      tile.y * tileSize,
      tileSize,
      tile.transform,
    );
  }
}
