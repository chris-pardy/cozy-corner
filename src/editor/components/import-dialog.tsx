import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, ArrowRight, ArrowDown } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../redux/store';
import { addLayer, appendFramesToActiveLayer, selectLayers } from '../redux/canvas-slice';
import { extractFrames, type FrameRect } from '../redux/canvas/extract-frames';
import type { Layer } from '../redux/canvas/layer';

type Direction = 'horizontal' | 'vertical';
type ImportMode = 'layer' | 'frames';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;
const PADDING = 32;

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const layers = useSelector(selectLayers);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [selection, setSelection] = useState<FrameRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [direction, setDirection] = useState<Direction>('horizontal');
  const [frameCount, setFrameCount] = useState(1);
  const [mode, setMode] = useState<ImportMode>('layer');

  const [viewZoom, setViewZoom] = useState(1);

  // Selection drag state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ── File loading ──
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setImage(img);

      const offscreen = new OffscreenCanvas(img.width, img.height);
      const ctx = offscreen.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      setImageData(ctx.getImageData(0, 0, img.width, img.height));

      setSelection({ x: 0, y: 0, w: img.width, h: img.height });
      setFrameCount(1);

      // Fit to view
      requestAnimationFrame(() => {
        const container = scrollRef.current;
        if (!container) return;
        const cw = container.clientWidth - PADDING * 2;
        const ch = container.clientHeight - PADDING * 2;
        setViewZoom(Math.min(cw / img.width, ch / img.height, MAX_ZOOM));
      });
    };
    img.src = URL.createObjectURL(file);
  }

  // ── Keyboard ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // ── Canvas drawing ──
  const canvasW = image ? image.width * viewZoom : 0;
  const canvasH = image ? image.height * viewZoom : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasW * dpr);
    canvas.height = Math.round(canvasH * dpr);

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.scale(viewZoom, viewZoom);

    // Checkerboard behind image
    drawCheckerboard(ctx, image.width, image.height, viewZoom);

    // Image
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);

    // Selection overlay — dim everything outside all frames
    const allFrames = getFrameRects(selection, direction, frameCount);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, image.width, image.height);
    for (const frame of allFrames) {
      ctx.clearRect(frame.x, frame.y, frame.w, frame.h);
    }
    // Re-draw image in frame regions
    for (const frame of allFrames) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.w, frame.h);
      ctx.clip();
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }

    // Frame outlines and numbers
    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      ctx.strokeStyle = i === 0 ? '#fbbf24' : '#60a5fa';
      ctx.lineWidth = 2 / viewZoom;
      ctx.setLineDash(i === 0 ? [] : [4 / viewZoom, 4 / viewZoom]);
      ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

      const fontSize = Math.max(10, 14 / viewZoom);
      ctx.font = `bold ${fontSize}px "Pixelify Sans", monospace`;
      ctx.fillStyle = i === 0 ? '#fbbf24' : '#60a5fa';
      ctx.fillText(String(i + 1), frame.x + 2 / viewZoom, frame.y + fontSize + 2 / viewZoom);
    }
    ctx.setLineDash([]);

    ctx.restore();
  }, [image, viewZoom, canvasW, canvasH, selection, direction, frameCount]);

  // ── Pointer interactions ──
  function screenToImage(clientX: number, clientY: number) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / viewZoom,
      y: (clientY - rect.top) / viewZoom,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!image || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const pt = screenToImage(e.clientX, e.clientY);
    setDragStart(pt);
    setSelection({ x: Math.round(pt.x), y: Math.round(pt.y), w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const pt = screenToImage(e.clientX, e.clientY);
    const x = Math.round(Math.min(dragStart.x, pt.x));
    const y = Math.round(Math.min(dragStart.y, pt.y));
    const w = Math.round(Math.abs(pt.x - dragStart.x));
    const h = Math.round(Math.abs(pt.y - dragStart.y));
    setSelection({ x, y, w: Math.max(1, w), h: Math.max(1, h) });
  }

  function onPointerUp() {
    setDragging(false);
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return; // Only zoom on ctrl/cmd+scroll
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setViewZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * zoomFactor)));
  }

  // ── Import ──
  function handleImport() {
    if (!imageData || selection.w <= 0 || selection.h <= 0) return;

    const frames = extractFrames(imageData, selection, direction, frameCount);
    if (frames.length === 0) return;

    if (mode === 'layer') {
      const nextId = layers.length === 0 ? 1 : Math.max(...layers.map((l) => l.id)) + 1;
      const layer: Layer = {
        id: nextId,
        name: `Import ${nextId}`,
        colorChannel: '#60a5fa',
        hidden: false,
        zIndex: 0,
        frames,
      };
      dispatch(addLayer(layer));
    } else {
      dispatch(appendFramesToActiveLayer(frames));
    }

    onClose();
  }

  // ── Number input helpers ──
  function updateSelection(field: keyof FrameRect, value: string) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setSelection((s) => ({ ...s, [field]: field === 'w' || field === 'h' ? Math.max(1, n) : n }));
  }

  const hasSelection = selection.w > 0 && selection.h > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-deep/95">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border bg-surface px-4 py-2">
        <span className="font-heading text-sm tracking-wide text-gold">
          Import Sprite Sheet
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-sm text-text-muted hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Scrollable canvas area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-surface-deep"
          onWheel={onWheel}
        >
          {!image ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <Upload className="size-10 opacity-50" />
              <span className="font-heading text-sm">Choose a file to get started</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-sm border border-surface-border bg-surface px-3 py-1.5 font-heading text-xs text-gold transition-colors hover:border-gold"
              >
                Browse...
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: PADDING,
                display: 'inline-block',
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{ width: canvasW, height: canvasH, cursor: 'crosshair' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-surface-border bg-surface p-3">
          {/* File picker */}
          <div>
            <label className="mb-1 block font-heading text-[10px] uppercase tracking-wider text-text-muted">
              Source
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-sm border border-surface-border bg-surface-deep px-2 py-1.5 text-left font-body text-xs text-text transition-colors hover:border-text-muted"
            >
              {image ? `${image.width} x ${image.height}` : 'Choose file...'}
            </button>
          </div>

          {/* Zoom */}
          {image && (
            <div>
              <label className="mb-1 block font-heading text-[10px] uppercase tracking-wider text-text-muted">
                Zoom
              </label>
              <span className="font-heading text-[10px] text-text">
                {viewZoom < 1 ? `${Math.round(viewZoom * 100)}%` : `${viewZoom.toFixed(1)}x`}
              </span>
              <span className="ml-1 font-heading text-[10px] text-text-muted">
                (Ctrl+Scroll)
              </span>
            </div>
          )}

          {/* Selection */}
          <fieldset disabled={!image}>
            <legend className="mb-1 font-heading text-[10px] uppercase tracking-wider text-text-muted">
              Selection
            </legend>
            <div className="grid grid-cols-2 gap-1.5">
              {(['x', 'y', 'w', 'h'] as const).map((f) => (
                <div key={f} className="flex items-center gap-1">
                  <span className="w-3 text-right font-heading text-[10px] uppercase text-text-muted">
                    {f}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={selection[f]}
                    onChange={(e) => updateSelection(f, e.target.value)}
                    className="h-5 w-full rounded-sm border border-surface-border bg-surface-deep px-1 text-center font-heading text-[10px] text-text outline-none focus:border-gold disabled:opacity-40"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          {/* Direction */}
          <fieldset disabled={!image}>
            <legend className="mb-1 font-heading text-[10px] uppercase tracking-wider text-text-muted">
              Direction
            </legend>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDirection('horizontal')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-sm border px-2 py-1 font-heading text-[10px] transition-colors ${
                  direction === 'horizontal'
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-surface-border text-text-muted hover:text-text'
                }`}
              >
                <ArrowRight className="size-3" /> Horiz
              </button>
              <button
                type="button"
                onClick={() => setDirection('vertical')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-sm border px-2 py-1 font-heading text-[10px] transition-colors ${
                  direction === 'vertical'
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-surface-border text-text-muted hover:text-text'
                }`}
              >
                <ArrowDown className="size-3" /> Vert
              </button>
            </div>
          </fieldset>

          {/* Frame count */}
          <fieldset disabled={!image}>
            <legend className="mb-1 font-heading text-[10px] uppercase tracking-wider text-text-muted">
              Frames
            </legend>
            <input
              type="number"
              min={1}
              value={frameCount}
              onChange={(e) => setFrameCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="h-5 w-full rounded-sm border border-surface-border bg-surface-deep px-1 text-center font-heading text-[10px] text-text outline-none focus:border-gold disabled:opacity-40"
            />
          </fieldset>

          {/* Import mode */}
          <fieldset disabled={!image}>
            <legend className="mb-1 font-heading text-[10px] uppercase tracking-wider text-text-muted">
              Import as
            </legend>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setMode('layer')}
                className={`rounded-sm border px-2 py-1 text-left font-heading text-[10px] transition-colors ${
                  mode === 'layer'
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-surface-border text-text-muted hover:text-text'
                }`}
              >
                New Layer
              </button>
              <button
                type="button"
                onClick={() => setMode('frames')}
                className={`rounded-sm border px-2 py-1 text-left font-heading text-[10px] transition-colors ${
                  mode === 'frames'
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-surface-border text-text-muted hover:text-text'
                }`}
              >
                Add Frames
              </button>
            </div>
          </fieldset>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-sm border border-surface-border px-2 py-1.5 font-heading text-[10px] text-text-muted transition-colors hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!hasSelection || !imageData}
              className="flex-1 rounded-sm border border-gold bg-gold/10 px-2 py-1.5 font-heading text-[10px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-40"
            >
              Import
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Helpers ──

function getFrameRects(
  selection: FrameRect,
  direction: Direction,
  count: number,
): FrameRect[] {
  const rects: FrameRect[] = [];
  for (let i = 0; i < count; i++) {
    rects.push({
      x: selection.x + (direction === 'horizontal' ? i * selection.w : 0),
      y: selection.y + (direction === 'vertical' ? i * selection.h : 0),
      w: selection.w,
      h: selection.h,
    });
  }
  return rects;
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
) {
  const tileSize = Math.max(1, Math.round(8 / zoom));
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isLight ? '#2a2a3e' : '#1a1a2e';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }
}
