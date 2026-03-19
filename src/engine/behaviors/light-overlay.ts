import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import type { RenderEvent } from "../event";
import { ATTRIBUTE_MAP, type AttributeMap } from "../state/attributes";
import {
  LIGHT_CANVAS,
  LIGHT_DIRTY,
  MAX_LIGHT,
  LIGHT_STEPS,
  LIGHT_RESOLUTION,
} from "../state/light";

/**
 * Draws a darkness overlay on the room based on the "light" attribute.
 *
 * On "emit-attributes": marks the light canvas as dirty.
 * On "render": if dirty, rebuilds an offscreen canvas at sub-tile
 * resolution with bilinear interpolation between tile values and
 * quantized alpha steps, then caches it. Draws scaled up with
 * nearest-neighbor for crisp pixel art.
 *
 * Place this behavior AFTER CompositeRenderBehavior in the room's
 * behavior list so it draws on top of all children.
 */
export class LightOverlayBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set([
    "emit-attributes",
    "render",
  ]);

  private readonly tileSize: number;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
  }

  handle(entity: Entity, event: Event): void {
    if (event.type === "emit-attributes") {
      entity.set(LIGHT_DIRTY, true);
      return;
    }
    this.handleRender(entity, event as RenderEvent);
  }

  private handleRender(entity: Entity, event: RenderEvent): void {
    const map = entity.get<AttributeMap>(ATTRIBUTE_MAP);
    if (!map) return;

    const { width, height } = map;
    if (width === 0 || height === 0) return;

    // No light attribute data → room doesn't use the lighting system; skip overlay.
    if (!map.has("light")) return;

    if (entity.get<boolean>(LIGHT_DIRTY)) {
      this.rebuildLightCanvas(entity, width, height);
      entity.set(LIGHT_DIRTY, false);
    }

    const lightCanvas = entity.get<OffscreenCanvas>(LIGHT_CANVAS);
    if (!lightCanvas) return;

    const { ctx } = event;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      lightCanvas,
      0,
      0,
      lightCanvas.width,
      lightCanvas.height,
      0,
      0,
      width * this.tileSize,
      height * this.tileSize,
    );
    ctx.restore();
  }

  private rebuildLightCanvas(
    entity: Entity,
    width: number,
    height: number,
  ): void {
    const map = entity.get<AttributeMap>(ATTRIBUTE_MAP)!;
    const res = LIGHT_RESOLUTION;
    const canvasW = width * res;
    const canvasH = height * res;

    let lightCanvas = entity.get<OffscreenCanvas>(LIGHT_CANVAS);
    if (
      !lightCanvas ||
      lightCanvas.width !== canvasW ||
      lightCanvas.height !== canvasH
    ) {
      lightCanvas = new OffscreenCanvas(canvasW, canvasH);
      entity.set(LIGHT_CANVAS, lightCanvas);
    }

    const imageData = new ImageData(canvasW, canvasH);
    const data = imageData.data;

    for (let py = 0; py < canvasH; py++) {
      for (let px = 0; px < canvasW; px++) {
        // Map sub-pixel center to tile-space coordinate
        const tx = (px + 0.5) / res - 0.5;
        const ty = (py + 0.5) / res - 0.5;

        const lightValue = sampleLight(map, tx, ty, width, height);
        const alpha = lightToAlpha(lightValue);
        data[(py * canvasW + px) * 4 + 3] = alpha;
      }
    }

    const offCtx = lightCanvas.getContext("2d")!;
    offCtx.clearRect(0, 0, canvasW, canvasH);
    offCtx.putImageData(imageData, 0, 0);
  }
}

/**
 * Bilinearly interpolate the "light" attribute at a fractional tile coordinate.
 * Samples the 4 surrounding tile centers and blends by distance.
 */
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

/**
 * Map a continuous light value to a quantized alpha step.
 * Produces discrete bands of darkness for a retro pixel art look.
 */
function lightToAlpha(lightValue: number): number {
  if (lightValue <= 0) return LIGHT_STEPS[0];
  if (lightValue >= MAX_LIGHT) return LIGHT_STEPS[LIGHT_STEPS.length - 1];
  const t = lightValue / MAX_LIGHT;
  const index = Math.floor(t * (LIGHT_STEPS.length - 1));
  return LIGHT_STEPS[index];
}
