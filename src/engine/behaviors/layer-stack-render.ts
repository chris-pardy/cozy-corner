import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import { type Event, RenderEvent } from "../event";
import { LAYERS, SPRITE_SHEET, TARGET, TARGET_START_TIME } from "../state/render";
import { TILE_SIZE } from "../state/tiles";

/**
 * Draws animation layers from a sprite sheet.
 * Reads LAYERS, SPRITE_SHEET, TARGET, TARGET_START_TIME from the entity.
 * Applies tints from the RenderEvent's tintMap using a temp canvas
 * (multiply tint, then destination-in to restore alpha).
 * Tints are looked up by the layer's colorChannel name.
 */
export class LayerStackRenderBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["render"]);

  private _tmp: OffscreenCanvas | null = null;
  private _tmpCtx: OffscreenCanvasRenderingContext2D | null = null;
  private _tmpW = 0;
  private _tmpH = 0;

  private ensureTmp(w: number, h: number) {
    if (!this._tmp || w > this._tmpW || h > this._tmpH) {
      this._tmpW = Math.max(w, this._tmpW);
      this._tmpH = Math.max(h, this._tmpH);
      this._tmp = new OffscreenCanvas(this._tmpW, this._tmpH);
      this._tmpCtx = this._tmp.getContext("2d")!;
      this._tmpCtx.imageSmoothingEnabled = false;
    }
    return { tmp: this._tmp!, tmpCtx: this._tmpCtx! };
  }

  handle(entity: Entity, event: Event): void {
    const renderEvent = event as RenderEvent;
    const layers = entity.get<AnimationLayer[]>(LAYERS);
    const spriteSheet = entity.get<CanvasImageSource>(SPRITE_SHEET);
    const target = entity.get<string>(TARGET);
    const targetStartTime = entity.get<number>(TARGET_START_TIME);

    if (!layers || !spriteSheet || !target || targetStartTime == null) return;

    const { ctx, time, tintMap } = renderEvent;
    const elapsedMS = time - targetStartTime;
    const tileSize = entity.find<number>(TILE_SIZE);

    for (const layer of layers) {
      if (layer.target !== target) continue;

      const frameIndex =
        Math.floor(elapsedMS / layer.frameRate) % layer.frames.length;
      const frame = layer.frames[frameIndex];
      const sx = frame.x;
      const sy = frame.y;
      const fw = frame.width;
      const fh = frame.height;

      // Scale sprite to tile grid: use the smallest frame dimension as the
      // native tile size so multi-tile sprites scale proportionally.
      const scale = tileSize ? tileSize / Math.min(fw, fh) : 1;
      const dw = fw * scale;
      const dh = fh * scale;

      const tint = layer.colorChannel ? tintMap.get(layer.colorChannel) : undefined;
      if (tint) {
        const { tmp, tmpCtx } = this.ensureTmp(fw, fh);
        tmpCtx.clearRect(0, 0, fw, fh);

        // 1. Draw the sprite frame
        tmpCtx.globalCompositeOperation = "source-over";
        tmpCtx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, fw, fh);

        // 2. Multiply with tint color
        tmpCtx.globalCompositeOperation = "multiply";
        tmpCtx.fillStyle = tint;
        tmpCtx.fillRect(0, 0, fw, fh);

        // 3. Restore original alpha (clip to sprite silhouette)
        tmpCtx.globalCompositeOperation = "destination-in";
        tmpCtx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, fw, fh);

        // 4. Stamp result onto main canvas
        ctx.drawImage(tmp, 0, 0, fw, fh, 0, 0, dw, dh);
      } else {
        ctx.drawImage(spriteSheet, sx, sy, fw, fh, 0, 0, dw, dh);
      }
    }
  }
}
