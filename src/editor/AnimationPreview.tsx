import { useRef, useEffect, useMemo } from "react";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import { Entity } from "~/engine/entity";
import { RenderEvent } from "~/engine/event";
import { LayerStackRenderBehavior } from "~/engine/behaviors/layer-stack-render";
import { LAYERS, SPRITE_SHEET, TARGET, TARGET_START_TIME } from "~/engine/state/render";
import { drawCheckerboard } from "./drawCheckerboard";

export type AnimationPreviewProps = {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  /** Which animation target to preview. */
  target: string;
  /** Max dimension in px for the preview canvas. Default 128. */
  size?: number;
};

export function AnimationPreview({
  image,
  layers,
  target,
  size = 128,
}: AnimationPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entityRef = useRef<Entity | null>(null);
  const rafRef = useRef<number>(0);

  // Compute frame size from the matching layers for this target.
  const frameSize = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const layer of layers) {
      if (layer.target === target && layer.frames.length > 0) {
        w = Math.max(w, layer.frames[0].width);
        h = Math.max(h, layer.frames[0].height);
      }
    }
    return { w: w || 1, h: h || 1 };
  }, [layers, target]);

  // Create entity once, update state when props change.
  useEffect(() => {
    if (!entityRef.current) {
      entityRef.current = new Entity([new LayerStackRenderBehavior()]);
    }
    const entity = entityRef.current;
    entity.set(LAYERS, layers);
    entity.set(SPRITE_SHEET, image);
    entity.set(TARGET, target);
    entity.set(TARGET_START_TIME, performance.now());
  }, [image, layers, target]);

  // Fit frame into size, rounding scale to nearest integer.
  const scale = Math.max(1, Math.floor(size / Math.max(frameSize.w, frameSize.h)));
  const cw = frameSize.w * scale;
  const ch = frameSize.h * scale;

  // rAF render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const entity = entityRef.current;
    if (!canvas || !entity) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cw;
    canvas.height = ch;

    function draw(time: number) {
      if (!ctx || !entity) return;

      ctx.clearRect(0, 0, cw, ch);
      drawCheckerboard(ctx, cw, ch, scale);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.scale(scale, scale);

      const renderEvent = new RenderEvent(ctx, time);
      entity.emit(renderEvent);

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cw, ch, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="ale-preview-canvas"
    />
  );
}
