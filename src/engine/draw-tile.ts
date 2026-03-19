import type { RenderContext } from "./event";
import type { TileFrame } from "./state/tiles";

/**
 * Draw a single tile from a sprite sheet, handling animation and transform.
 *
 * Transform is a packed integer:
 *   bits 0-1: rotation (0=0°, 1=90°, 2=180°, 3=270°)
 *   bit 2: horizontal mirror
 *   bit 3: vertical mirror
 */
export function drawTile(
  ctx: RenderContext,
  sheet: CanvasImageSource,
  frame: TileFrame,
  time: number,
  dx: number,
  dy: number,
  tileSize: number,
  transform: number,
): void {
  let sx = frame.sx;
  if (frame.frameCount > 1) {
    const frameIndex =
      Math.floor(time / frame.frameRate) % frame.frameCount;
    sx += frameIndex * frame.frameStride;
  }

  if (transform === 0) {
    ctx.drawImage(
      sheet,
      sx,
      frame.sy,
      frame.sw,
      frame.sh,
      dx,
      dy,
      tileSize,
      tileSize,
    );
  } else {
    const rotation = transform & 3;
    const hflip = (transform & 4) !== 0;
    const vflip = (transform & 8) !== 0;

    ctx.save();
    ctx.translate(dx + tileSize / 2, dy + tileSize / 2);
    if (hflip || vflip) ctx.scale(hflip ? -1 : 1, vflip ? -1 : 1);
    if (rotation) ctx.rotate((rotation * Math.PI) / 2);
    ctx.drawImage(
      sheet,
      sx,
      frame.sy,
      frame.sw,
      frame.sh,
      -tileSize / 2,
      -tileSize / 2,
      tileSize,
      tileSize,
    );
    ctx.restore();
  }
}
