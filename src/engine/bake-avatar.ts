import type {
  AnimationLayer,
  LayerTint,
  Transform,
} from "~/atproto/generated/types/at/cozy-corner/defs";

/**
 * One component of an avatar to bake (base avatar or a wearable).
 */
export interface AvatarLayerInput {
  image: CanvasImageSource;
  layers: AnimationLayer[];
  tints: LayerTint[];
  transform?: Transform;
}

/** A baked layer: sprite sheet with tints/transform pre-applied. */
export interface BakedLayer {
  spriteSheet: CanvasImageSource;
  layers: AnimationLayer[];
}

// ---------------------------------------------------------------------------
// Tint helpers
// ---------------------------------------------------------------------------

function buildTintMap(tints: LayerTint[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const { layerIndexes, tint } of tints) {
    for (const i of layerIndexes) map.set(i, tint);
  }
  return map;
}

/**
 * Draw a single sprite frame with a multiply tint onto `dest`.
 * Uses a temp canvas so the tint doesn't bleed into other pixels.
 */
function drawTinted(
  dest: OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  tint: string,
  tmp: OffscreenCanvas,
  tmpCtx: OffscreenCanvasRenderingContext2D,
): void {
  tmpCtx.clearRect(0, 0, sw, sh);

  // 1. Draw the sprite frame
  tmpCtx.globalCompositeOperation = "source-over";
  tmpCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  // 2. Multiply with tint color
  tmpCtx.globalCompositeOperation = "multiply";
  tmpCtx.fillStyle = tint;
  tmpCtx.fillRect(0, 0, sw, sh);

  // 3. Restore original alpha (clip to sprite silhouette)
  tmpCtx.globalCompositeOperation = "destination-in";
  tmpCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  // 4. Stamp result onto destination
  dest.drawImage(tmp, 0, 0, sw, sh, 0, 0, sw, sh);
}

// ---------------------------------------------------------------------------
// bakeLayer
// ---------------------------------------------------------------------------

/**
 * Pre-applies tints and transforms to a single avatar layer input.
 * If no tints or transform are needed, returns the original image unchanged.
 *
 * Use this instead of the old bakeAvatar: each base/wearable is baked
 * independently and gets its own entity in the scene tree. Cross-layer
 * compositing happens at render time via CompositeRenderBehavior.
 */
export function bakeLayer(input: AvatarLayerInput): BakedLayer {
  if (input.tints.length === 0 && !input.transform) {
    return { spriteSheet: input.image, layers: input.layers };
  }

  const { image, layers, tints, transform } = input;
  const tintMap = buildTintMap(tints);
  const hasTints = tintMap.size > 0;

  // Compute bounding box for all layer frames
  let sheetWidth = 0;
  let sheetHeight = 0;
  for (const layer of layers) {
    for (const frame of layer.frames) {
      const right = frame.x + frame.width;
      const bottom = frame.y + frame.height;
      if (right > sheetWidth) sheetWidth = right;
      if (bottom > sheetHeight) sheetHeight = bottom;
    }
  }

  if (sheetWidth === 0 || sheetHeight === 0) {
    return { spriteSheet: new OffscreenCanvas(1, 1), layers: [] };
  }

  const sheet = new OffscreenCanvas(sheetWidth, sheetHeight);
  const ctx = sheet.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // Reusable temp canvas for tinting
  let tmpW = 0;
  let tmpH = 0;
  let tmp: OffscreenCanvas | null = null;
  let tmpCtx: OffscreenCanvasRenderingContext2D | null = null;

  function ensureTmp(w: number, h: number) {
    if (!tmp || w > tmpW || h > tmpH) {
      tmpW = Math.max(w, tmpW);
      tmpH = Math.max(h, tmpH);
      tmp = new OffscreenCanvas(tmpW, tmpH);
      tmpCtx = tmp.getContext("2d")!;
      tmpCtx.imageSmoothingEnabled = false;
    }
  }

  // Redraw each layer's frames with tint/transform applied
  // Per-frame transforms are NOT baked — only the per-entity transform is applied
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const tint = tintMap.get(li);

    for (const frame of layer.frames) {
      const sx = frame.x;
      const sy = frame.y;
      const fw = frame.width;
      const fh = frame.height;

      ctx.save();
      ctx.translate(sx, sy);

      if (transform) {
        ctx.transform(
          transform.a / 1000,
          transform.b / 1000,
          transform.c / 1000,
          transform.d / 1000,
          transform.e / 1000,
          transform.f / 1000,
        );
      }

      if (tint && hasTints) {
        ensureTmp(fw, fh);
        drawTinted(
          ctx,
          image,
          sx,
          sy,
          fw,
          fh,
          tint,
          tmp!,
          tmpCtx!,
        );
      } else {
        ctx.drawImage(
          image,
          sx,
          sy,
          fw,
          fh,
          0,
          0,
          fw,
          fh,
        );
      }

      ctx.restore();
    }
  }

  // Layer coordinates stay the same — they reference the same positions
  return { spriteSheet: sheet, layers };
}
