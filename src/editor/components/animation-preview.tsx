import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { cn } from '@/lib/utils';
import type { AppDispatch } from '../redux/store';
import { selectLayers, selectCanvasSize, selectFrameRate, setFrameRate } from '../redux/canvas-slice';
import { drawPixels } from '../redux/canvas/draw-pixels';

const PREVIEW_SIZE = 128;

export function AnimationPreview() {
  const layers = useSelector(selectLayers);
  const canvasSize = useSelector(selectCanvasSize);
  const fps = useSelector(selectFrameRate);
  const dispatch = useDispatch<AppDispatch>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [displayFrame, setDisplayFrame] = useState(0);

  const visibleLayers = layers.filter((l) => !l.hidden);
  const frameCount = Math.max(
    1,
    ...visibleLayers.map((l) => l.frames.length),
  );

  // Clamp displayFrame to valid range when frameCount shrinks.
  const safeFrame = displayFrame % Math.max(1, frameCount);

  // Clip to canvas size so content outside the canvas isn't shown.
  const clipBounds = useMemo(
    () => ({ minX: 0, minY: 0, w: canvasSize.width, h: canvasSize.height }),
    [canvasSize.width, canvasSize.height],
  );

  useEffect(() => {
    if (!playing || frameCount <= 1) return;
    const interval = setInterval(() => {
      setDisplayFrame((prev) => (prev + 1) % frameCount);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [playing, fps, frameCount]);

  // Draw whenever the display frame or layers change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(PREVIEW_SIZE * dpr);
    canvas.height = Math.round(PREVIEW_SIZE * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.imageSmoothingEnabled = false;

    const { minX, minY, w, h } = clipBounds;
    const scale = Math.min(PREVIEW_SIZE / w, PREVIEW_SIZE / h);
    const ox = (PREVIEW_SIZE - w * scale) / 2;
    const oy = (PREVIEW_SIZE - h * scale) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    for (const layer of visibleLayers) {
      const f = layer.frames[safeFrame];
      if (!f || f.width === 0 || f.pixelData.length === 0) continue;
      ctx.save();
      ctx.translate(f.xOffset - minX, f.yOffset - minY);
      drawPixels(ctx, f.pixelData, f.width);
      ctx.restore();
    }

    ctx.restore();
  }, [safeFrame, visibleLayers, clipBounds]);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-surface-border bg-surface-deep/50 p-1.5">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10px] text-text-muted">
          Preview
        </span>
        <span className="font-heading text-[10px] text-text-muted">
          {safeFrame + 1}/{frameCount}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE}
        className="block w-full rounded-sm bg-surface-deep"
        style={{
          aspectRatio: '1',
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
        }}
      />

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying((p) => !p)}
          className={cn(
            'flex size-6 items-center justify-center rounded-sm transition-colors',
            'text-text-muted hover:text-text',
            playing && 'text-gold',
          )}
        >
          {playing ? (
            <Pause className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
        </button>
        <input
          type="range"
          min={1}
          max={30}
          value={fps}
          onChange={(e) => dispatch(setFrameRate(Number(e.target.value)))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-border accent-gold"
        />
        <span className="w-8 text-right font-heading text-[10px] text-text-muted">
          {fps}fps
        </span>
      </div>
    </div>
  );
}
