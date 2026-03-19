import { useRef, useEffect, useMemo } from "react";
import type { SpriteEditorResult } from "./SpritePixelEditor";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import { drawCheckerboard } from "./drawCheckerboard";

/**
 * TargetPreview — cycles frames from a target's sprite strip.
 *
 * Supports three modes:
 * - Plain: just the sprite on a cleared canvas (checkerboard omitted)
 * - Checkerboard: draws a checkerboard background before the sprite
 * - Base layers: draws checkerboard, then base avatar layers, then sprite
 *
 * The `checkerboardScale` prop controls the checkerboard tile size.
 * Pass a number to enable checkerboard, or omit/set to undefined to disable.
 *
 * For wearable previews, pass `baseImage` and `baseLayers` to composite
 * the base avatar underneath the sprite. The `target` prop is required
 * when using base layers to filter matching animation layers.
 */

export interface TargetPreviewProps {
  sprite: SpriteEditorResult;
  size?: number;
  /** Checkerboard scale factor. Omit or set to undefined to skip checkerboard. */
  checkerboardScale?: number;
  /** Base avatar sprite sheet image (for wearable previews). */
  baseImage?: HTMLImageElement;
  /** Base avatar animation layers (for wearable previews). */
  baseLayers?: AnimationLayer[];
  /** Target name used to filter baseLayers (required when baseLayers is set). */
  target?: string;
}

export function TargetPreview({
  sprite,
  size = 80,
  checkerboardScale,
  baseImage,
  baseLayers,
  target,
}: TargetPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  const matchingBaseLayers = useMemo(
    () =>
      baseLayers && target
        ? baseLayers.filter((l) => l.target === target)
        : [],
    [baseLayers, target],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;

    const draw = () => {
      const f = frameRef.current % sprite.frameCount;
      const scale = Math.min(
        size / sprite.frameWidth,
        size / sprite.frameHeight,
      );
      const dw = sprite.frameWidth * scale;
      const dh = sprite.frameHeight * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;

      ctx.clearRect(0, 0, size, size);

      if (checkerboardScale != null) {
        drawCheckerboard(ctx, size, size, checkerboardScale);
      }

      // Draw base avatar layers underneath (for wearable previews)
      if (baseImage && matchingBaseLayers.length > 0) {
        for (const layer of matchingBaseLayers) {
          if (layer.frames.length === 0) continue;
          const bf = f % layer.frames.length;
          const frame = layer.frames[bf];
          ctx.drawImage(
            baseImage,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            dx,
            dy,
            dw,
            dh,
          );
        }
      }

      // Draw the sprite
      ctx.drawImage(
        sprite.image,
        f * sprite.frameWidth,
        0,
        sprite.frameWidth,
        sprite.frameHeight,
        dx,
        dy,
        dw,
        dh,
      );
    };

    draw();

    if (sprite.frameCount <= 1) return;

    const interval = setInterval(() => {
      frameRef.current++;
      draw();
    }, 1000 / sprite.fps);

    return () => clearInterval(interval);
  }, [sprite, size, checkerboardScale, baseImage, matchingBaseLayers]);

  return (
    <canvas
      ref={ref}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}
