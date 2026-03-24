import type { Sprite, Texture } from "pixi.js";
import type { AttributeMap } from "../state/attributes";
import {
  MAX_LIGHT,
  LIGHT_STEPS,
  LIGHT_RESOLUTION,
} from "../state/light";

/**
 * Pixi-based light overlay. Maintains an OffscreenCanvas that gets
 * rebuilt when dirty, then pushed to a pixi Sprite texture.
 */
export class PixiLightOverlay {
  private canvas: OffscreenCanvas | null = null;
  private _sprite: Sprite | null = null;
  private _texture: Texture | null = null;
  dirty = true;

  /** Get or create the pixi sprite. Must be added to the scene. */
  async getSprite(): Promise<Sprite> {
    if (this._sprite) return this._sprite;

    const { Sprite: PixiSprite, Texture: PixiTexture } = await import("pixi.js");
    // Start with empty 1x1 texture; will be replaced on first update
    this._texture = PixiTexture.from(new OffscreenCanvas(1, 1));
    this._sprite = new PixiSprite(this._texture);
    return this._sprite;
  }

  /**
   * Update the overlay for the current frame.
   * Rebuilds the light canvas if dirty, then updates the sprite texture.
   */
  async update(
    map: AttributeMap,
    tileSize: number,
  ): Promise<void> {
    const { width, height } = map;
    if (width === 0 || height === 0) return;
    if (!map.has("light")) return;

    const sprite = await this.getSprite();

    if (this.dirty) {
      this.rebuild(map, width, height);
      this.dirty = false;

      if (this.canvas) {
        const { Texture } = await import("pixi.js");
        // Replace texture with the rebuilt canvas
        if (this._texture) this._texture.destroy();
        this._texture = Texture.from(this.canvas);
        sprite.texture = this._texture;
      }
    }

    // Scale to cover the room
    sprite.width = width * tileSize;
    sprite.height = height * tileSize;
    sprite.x = 0;
    sprite.y = 0;
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

  destroy(): void {
    if (this._texture) this._texture.destroy();
    if (this._sprite) this._sprite.destroy();
    this._texture = null;
    this._sprite = null;
    this.canvas = null;
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
