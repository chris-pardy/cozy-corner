import { useState } from 'react';
import { ZoomIn, ZoomOut, ImagePlus } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { AppDispatch } from '../redux/store';
import { selectCanvasSize, setCanvasSize } from '../redux/canvas-slice';
import { selectZoom, setZoom } from '../redux/tools-slice';

const ZOOM_STEPS = [1, 2, 4, 8, 16, 24, 32, 48, 64];

export function EditorToolbar({ onImport }: { onImport: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const { width, height } = useSelector(selectCanvasSize);
  const zoom = useSelector(selectZoom);

  const [widthDraft, setWidthDraft] = useState(String(width));
  const [heightDraft, setHeightDraft] = useState(String(height));

  function commitSize() {
    const w = parseInt(widthDraft, 10);
    const h = parseInt(heightDraft, 10);
    if (w > 0 && h > 0 && (w !== width || h !== height)) {
      dispatch(setCanvasSize({ width: w, height: h }));
    }
    setWidthDraft(String(w > 0 ? w : width));
    setHeightDraft(String(h > 0 ? h : height));
  }

  function stepZoom(dir: 1 | -1) {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (idx === -1 ? ZOOM_STEPS.length - 1 : idx) + dir))];
    dispatch(setZoom(next));
  }

  return (
    <div className="flex items-center gap-2.5">
      {/* Import */}
      <button
        type="button"
        aria-label="Import sprite sheet"
        onClick={onImport}
        className="flex items-center gap-1 rounded-sm border border-surface-border px-1.5 py-0.5 font-heading text-[10px] text-text-muted transition-colors hover:border-text-muted hover:text-text"
      >
        <ImagePlus className="size-3" />
        Import
      </button>

      <div className="h-3 w-px bg-surface-border" />

      {/* Canvas size */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          value={widthDraft}
          onChange={(e) => setWidthDraft(e.target.value)}
          onBlur={commitSize}
          onKeyDown={(e) => e.key === 'Enter' && commitSize()}
          className="h-5 w-10 rounded-sm border border-surface-border bg-surface-deep px-1 text-center font-heading text-[10px] text-text outline-none focus:border-gold"
        />
        <span className="text-[10px] text-text-muted">&times;</span>
        <input
          type="number"
          min={1}
          value={heightDraft}
          onChange={(e) => setHeightDraft(e.target.value)}
          onBlur={commitSize}
          onKeyDown={(e) => e.key === 'Enter' && commitSize()}
          className="h-5 w-10 rounded-sm border border-surface-border bg-surface-deep px-1 text-center font-heading text-[10px] text-text outline-none focus:border-gold"
        />
      </div>

      <div className="h-3 w-px bg-surface-border" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => stepZoom(-1)}
          className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text"
        >
          <ZoomOut className="size-3" />
        </button>
        <span className="w-8 text-center font-heading text-[10px] text-text-muted">
          {zoom < 1 ? `${Math.round(zoom * 100)}%` : `${zoom}x`}
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => stepZoom(1)}
          className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text"
        >
          <ZoomIn className="size-3" />
        </button>
      </div>
    </div>
  );
}
