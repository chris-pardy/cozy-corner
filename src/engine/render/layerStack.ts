import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { RenderContext } from "../event";

/**
 * Draw animation layers from a sprite sheet onto the canvas.
 *
 * Extracted from LayerStackRenderBehavior — same logic, pure function.
 */
export function drawLayerStack(
  ctx: RenderContext,
  layers: AnimationLayer[],
  spriteSheet: CanvasImageSource,
  target: string,
  targetStartTime: number,
  time: number,
  tileSize: number | undefined,
  tintMap: ReadonlyMap<number, string>,
  ensureTmp: (w: number, h: number) => { tmp: OffscreenCanvas; tmpCtx: OffscreenCanvasRenderingContext2D },
): void {
  const elapsedMS = time - targetStartTime;

  layers.forEach((layer, index) => {
    if (layer.target !== target) return;

    const frameIndex =
      Math.floor(elapsedMS / layer.frameRate) % layer.frames.length;
    const frame = layer.frames[frameIndex];
    const sx = frame.x;
    const sy = frame.y;
    const fw = frame.width;
    const fh = frame.height;

    const scale = tileSize ? tileSize / Math.min(fw, fh) : 1;
    const dw = fw * scale;
    const dh = fh * scale;

    const drawFrame = (destCtx: RenderContext, dx: number, dy: number, destW: number, destH: number) => {
      if (frame.transform) {
        const { a = 1000, b = 0, c = 0, d = 1000, e = 0, f = 0 } = frame.transform;
        destCtx.save();
        destCtx.translate(dx + destW / 2, dy + destH / 2);
        destCtx.transform(a / 1000, b / 1000, c / 1000, d / 1000, e / 1000, f / 1000);
        destCtx.translate(-destW / 2, -destH / 2);
        destCtx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, destW, destH);
        destCtx.restore();
      } else {
        destCtx.drawImage(spriteSheet, sx, sy, fw, fh, dx, dy, destW, destH);
      }
    };

    const tint = tintMap.get(index);
    if (tint) {
      const { tmp, tmpCtx } = ensureTmp(fw, fh);
      tmpCtx.clearRect(0, 0, fw, fh);

      tmpCtx.globalCompositeOperation = "source-over";
      tmpCtx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, fw, fh);

      tmpCtx.globalCompositeOperation = "multiply";
      tmpCtx.fillStyle = tint;
      tmpCtx.fillRect(0, 0, fw, fh);

      tmpCtx.globalCompositeOperation = "destination-in";
      tmpCtx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, fw, fh);

      if (frame.transform) {
        const { a = 1000, b = 0, c = 0, d = 1000, e = 0, f = 0 } = frame.transform;
        ctx.save();
        ctx.translate(dw / 2, dh / 2);
        ctx.transform(a / 1000, b / 1000, c / 1000, d / 1000, e / 1000, f / 1000);
        ctx.translate(-dw / 2, -dh / 2);
        ctx.drawImage(tmp, 0, 0, fw, fh, 0, 0, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(tmp, 0, 0, fw, fh, 0, 0, dw, dh);
      }
    } else {
      drawFrame(ctx, 0, 0, dw, dh);
    }
  });
}
