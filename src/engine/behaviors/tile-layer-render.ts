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

/**
 * Renders placed tiles from a single render layer.
 *
 * On the room entity: renders background (0) or overhead (2) tiles.
 * On a row child entity: renders foreground (1) tiles for that row,
 * inheriting TILE_SHEET, TILE_ATLAS, and TILE_SIZE from the room
 * via entity.find().
 *
 * Reads TILE_POSITIONS from the entity itself (local tiles).
 * Finds TILE_SHEET, TILE_ATLAS, and TILE_SIZE by walking up the
 * entity tree so child entities can inherit from their parent.
 */
export class TileLayerRenderBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["render"]);

  private readonly renderLayer: number;

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

    for (const tile of tiles) {
      if (tile.renderLayer !== this.renderLayer) continue;

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
}
