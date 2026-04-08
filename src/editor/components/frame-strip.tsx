import { useEffect, useRef } from 'react';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { cn } from '@/lib/utils';
import type { AppDispatch } from '../redux/store';
import type { PixelBuffer } from '../redux/canvas/pixel-buffer';
import { drawPixels } from '../redux/canvas/draw-pixels';
import {
  selectSelectedLayerIds,
  selectLayers,
  selectCanvasSize,
  addFrameToSelectedLayers,
  duplicateFrameToSelectedLayers,
  removeFrameFromSelectedLayers,
  reorderFrames,
  setCurrentFrame,
  selectCurrentFrame,
} from '../redux/canvas-slice';

const THUMB_SIZE = 32;

export function FrameStrip() {
  const layers = useSelector(selectLayers);
  const selectedIds = useSelector(selectSelectedLayerIds);
  const currentFrame = useSelector(selectCurrentFrame);
  const canvasSize = useSelector(selectCanvasSize);
  const dispatch = useDispatch<AppDispatch>();

  const selectedLayers = layers.filter((l) => selectedIds.includes(l.id));
  const frameCount = Math.max(1, ...selectedLayers.map((l) => l.frames.length));
  const frameIndices = Array.from({ length: frameCount }, (_, i) => i);

  return (
    <div className="flex items-center gap-1 border-t border-surface-border bg-surface px-2 py-1">
      <span className="shrink-0 font-heading text-[10px] text-text-muted">
        Frames
      </span>
      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!source || !target) return;
          const fromIndex = Number(source.id);
          const toIndex = Number(target.id);
          if (fromIndex !== toIndex) {
            dispatch(reorderFrames({ fromIndex, toIndex }));
          }
        }}
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {frameIndices.map((i) => (
            <FrameThumb
              key={i}
              index={i}
              active={i === currentFrame}
              layers={selectedLayers}
              onSelect={() => dispatch(setCurrentFrame(i))}
            />
          ))}
          <button
            type="button"
            aria-label="Duplicate frame"
            title="Duplicate current frame"
            onClick={() => dispatch(duplicateFrameToSelectedLayers())}
            className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-surface-border text-text-muted transition-colors hover:border-text-muted hover:text-text"
          >
            <Copy className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Remove current frame"
            title="Remove current frame"
            disabled={frameCount <= 1}
            onClick={() => dispatch(removeFrameFromSelectedLayers(currentFrame))}
            className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-surface-border text-text-muted transition-colors hover:border-text-muted hover:text-text disabled:opacity-30"
          >
            <Trash2 className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Add blank frame"
            title="Add blank frame"
            onClick={() =>
              dispatch(
                addFrameToSelectedLayers({
                  canvasWidth: canvasSize.width,
                  canvasHeight: canvasSize.height,
                }),
              )
            }
            className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-surface-border text-text-muted transition-colors hover:border-text-muted hover:text-text"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </DragDropProvider>
    </div>
  );
}

function FrameThumb({
  index,
  active,
  layers,
  onSelect,
}: {
  index: number;
  active: boolean;
  layers: { frames: PixelBuffer[] }[];
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref, isDragging } = useSortable({
    id: String(index),
    index,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.imageSmoothingEnabled = false;

    for (const layer of layers) {
      const frame = layer.frames[index];
      if (!frame || frame.width === 0 || frame.pixelData.length === 0)
        continue;
      const height = (frame.pixelData.length / frame.width) | 0;
      const scale = Math.min(
        THUMB_SIZE / frame.width,
        THUMB_SIZE / height,
      );

      ctx.save();
      ctx.translate(
        (THUMB_SIZE - frame.width * scale) / 2,
        (THUMB_SIZE - height * scale) / 2,
      );
      ctx.scale(scale, scale);
      drawPixels(ctx, frame.pixelData, frame.width);
      ctx.restore();
    }
  }, [layers, index]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Frame ${index + 1}`}
      onClick={onSelect}
      className={cn(
        'relative shrink-0 rounded-sm border transition-colors',
        active
          ? 'border-gold ring-1 ring-gold/40'
          : 'border-surface-border hover:border-text-muted',
        isDragging && 'opacity-50',
      )}
    >
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        className="block rounded-[1px] bg-surface-deep"
      />
      <span className="absolute bottom-0 right-0.5 font-heading text-[8px] text-text-muted">
        {index + 1}
      </span>
    </button>
  );
}
