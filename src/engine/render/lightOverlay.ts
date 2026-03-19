import type { RenderContext } from "../event";
import type { AttributeMap } from "../state/attributes";
import {
  MAX_LIGHT,
  LIGHT_STEPS,
  LIGHT_RESOLUTION,
} from "../state/light";

/**
 * Cache for the light overlay canvas.
 */
export class LightOverlayCache {
  private canvas: OffscreenCanvas | null = null;
  dirty = true;

  /**
   * Rebuild the light overlay from the attribute map, then draw it.
   */
  draw(
    ctx: RenderContext,
    map: AttributeMap,
    tileSize: number,
  ): void {
    const { width, height } = map;
    if (width === 0 || height === 0) return;

    // No light attribute data — skip overlay
    if (!map.has("light")) return;

    if (this.dirty) {
      this.rebuild(map, width, height);
      this.dirty = false;
    }

    if (!this.canvas) return;

    ctx.save();
    (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = false;
    ctx.drawImage(
      this.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      0,
      0,
      width * tileSize,
      height * tileSize,
    );
    ctx.restore();
  }

  private rebuild(
    map: AttributeMap,
    width: number,
    height: number,
  ): void {
    const res = LIGHT_RESOLUTION;
    const canvasW = width * res;
    const canvasH = height * res;

    if (
      !this.canvas ||
      this.canvas.width !== canvasW ||
      this.canvas.height !== canvasH
    ) {
      this.canvas = new OffscreenCanvas(canvasW, canvasH);
    }

    const imageData = new ImageData(canvasW, canvasH);
    const data = imageData.data;

    for (let py = 0; py < canvasH; py++) {
      for (let px = 0; px < canvasW; px++) {
        const tx = (px + 0.5) / res - 0.5;
        const ty = (py + 0.5) / res - 0.5;

        const lightValue = sampleLight(map, tx, ty, width, height);
        const alpha = lightToAlpha(lightValue);
        data[(py * canvasW + px) * 4 + 3] = alpha;
      }
    }

    const offCtx = this.canvas.getContext("2d")!;
    offCtx.clearRect(0, 0, canvasW, canvasH);
    offCtx.putImageData(imageData, 0, 0);
  }
}

function sampleLight(
  map: AttributeMap,
  tx: number,
  ty: number,
  width: number,
  height: number,
): number {
  const x0 = Math.floor(tx);
  const y0 = Math.floor(ty);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = tx - x0;
  const fy = ty - y0;

  const v00 = safeGet(map, x0, y0, width, height);
  const v10 = safeGet(map, x1, y0, width, height);
  const v01 = safeGet(map, x0, y1, width, height);
  const v11 = safeGet(map, x1, y1, width, height);

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
}

function safeGet(
  map: AttributeMap,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  if (x < 0 || x >= width || y < 0 || y >= height) return 0;
  return map.get("light", x, y);
}

function lightToAlpha(lightValue: number): number {
  if (lightValue <= 0) return LIGHT_STEPS[0];
  if (lightValue >= MAX_LIGHT) return LIGHT_STEPS[LIGHT_STEPS.length - 1];
  const t = lightValue / MAX_LIGHT;
  const index = Math.floor(t * (LIGHT_STEPS.length - 1));
  return LIGHT_STEPS[index];
}
