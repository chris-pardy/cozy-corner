import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SerializedLayer } from '../types';
import { deserializeLayers } from '../serialization';
import { drawPixels } from '../../editor/redux/canvas/draw-pixels';
import type { Layer } from '../../editor/redux/canvas/layer';

const PREVIEW_SIZE = 192;

interface EditorPreviewProps {
  /** Serialized layers to render. */
  layerData: SerializedLayer[];
  canvasWidth: number;
  canvasHeight: number;
  frameRate: number;
  /** Optional additional layers rendered behind the main layerData (e.g. base avatar). */
  backgroundLayers?: SerializedLayer[];
  /** Caption shown below the preview. */
  caption?: string;
}

export function EditorPreview({
  layerData,
  canvasWidth,
  canvasHeight,
  frameRate,
  backgroundLayers,
  caption,
}: EditorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [displayFrame, setDisplayFrame] = useState(0);

  const mainLayers = useMemo(
    () => (layerData.length ? deserializeLayers(layerData) : []),
    [layerData],
  );

  const bgLayers = useMemo(
    () => (backgroundLayers?.length ? deserializeLayers(backgroundLayers) : []),
    [backgroundLayers],
  );

  // Split main layers by zIndex for compositing around background
  const behindLayers = mainLayers.filter((l) => !l.hidden && l.zIndex === 0);
  const frontLayers = mainLayers.filter((l) => !l.hidden && l.zIndex !== 0);
  const visibleBg = bgLayers.filter((l) => !l.hidden);

  // If no background layers, just render all main layers in order
  const allVisible: Layer[] = visibleBg.length > 0
    ? [...behindLayers, ...visibleBg, ...frontLayers]
    : mainLayers.filter((l) => !l.hidden);

  const frameCount = Math.max(1, ...allVisible.map((l) => l.frames.length));
  const fps = frameRate || 8;
  const safeFrame = displayFrame % Math.max(1, frameCount);

  useEffect(() => {
    if (!playing || frameCount <= 1) return;
    const interval = setInterval(() => {
      setDisplayFrame((prev) => (prev + 1) % frameCount);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [playing, fps, frameCount]);

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

    if (allVisible.length === 0) return;

    const scale = Math.min(PREVIEW_SIZE / canvasWidth, PREVIEW_SIZE / canvasHeight);
    const ox = (PREVIEW_SIZE - canvasWidth * scale) / 2;
    const oy = (PREVIEW_SIZE - canvasHeight * scale) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);
    ctx.clip();

    for (const layer of allVisible) {
      const f = layer.frames[safeFrame];
      if (!f || f.width === 0 || f.pixelData.length === 0) continue;
      ctx.save();
      ctx.translate(f.xOffset, f.yOffset);
      drawPixels(ctx, f.pixelData, f.width);
      ctx.restore();
    }

    ctx.restore();
  }, [safeFrame, allVisible, canvasWidth, canvasHeight]);

  const hasContent = layerData.length > 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE}
        className="rounded-sm border border-surface-border bg-surface-deep"
        style={{
          width: PREVIEW_SIZE,
          height: PREVIEW_SIZE,
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
        }}
      />

      {hasContent && (
        <div className="flex items-center gap-2">
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
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          </button>
          <span className="font-heading text-[10px] text-text-muted">
            {safeFrame + 1}/{frameCount}
          </span>
          <span className="font-heading text-[10px] text-text-muted">
            {fps}fps
          </span>
        </div>
      )}

      {!hasContent && !backgroundLayers?.length && (
        <span className="font-heading text-[10px] text-text-muted">
          Select a target to preview
        </span>
      )}

      {caption && (
        <span className="font-heading text-[9px] text-text-muted">
          {caption}
        </span>
      )}
    </div>
  );
}
