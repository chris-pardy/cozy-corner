import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../redux/store';
import { applyToolAtPoint } from '../redux/store';
import {
  selectCanvasSize,
  selectLayers,
  selectSelectedLayerIds,
  selectCurrentFrame,
  moveSelectedLayers,
  scaleSelectedLayers,
  rotateSelectedLayers,
  selectTransformedLayers,
  type PendingTransform,
} from '../redux/canvas-slice';
import {
  selectZoom,
  selectCurrentTool,
  selectCurrentToolOptions,
  selectAllFrames,
  selectPending,
  updateDrag,
  commitDrag,
  resetPending,
} from '../redux/tools-slice';
import { drawPixels } from '../redux/canvas/draw-pixels';

const GRID_MIN_ZOOM = 4;
const GRID_COLOR = 'rgba(255, 255, 255, 0.08)';
const CANVAS_BORDER_COLOR = 'rgba(255, 255, 255, 0.25)';
const BOUNDING_BOX_COLOR = '#60a5fa';
const HANDLE_FILL = '#60a5fa';
const HANDLE_STROKE = '#1e3a5f';
const TOOL_PREVIEW_COLOR = 'rgba(255, 255, 255, 0.5)';
const HANDLE_SIZE = 6;

const PAINT_TOOLS = new Set(['brush', 'pencil', 'eraser', 'fill']);
const DRAG_TOOLS = new Set(['move', 'scale', 'rotate']);

const CURSOR_MAP: Record<string, string> = {
  pencil: 'crosshair',
  brush: 'crosshair',
  eraser: 'crosshair',
  fill: 'crosshair',
  move: 'move',
  scale: 'nwse-resize',
  rotate: 'grab',
};

const IDENTITY_TRANSFORM: PendingTransform = { rotation: 0, scale: 1 };

function selectionBounds(
  layers: { id: number; frames: { width: number; pixelData: Uint32Array; xOffset: number; yOffset: number }[] }[],
  selectedIds: number[],
  frame: number,
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of selectedIds) {
    const layer = layers.find((l) => l.id === id);
    if (!layer) continue;
    const f = layer.frames[frame];
    if (!f || f.width === 0 || f.pixelData.length === 0) continue;
    const fh = (f.pixelData.length / f.width) | 0;
    minX = Math.min(minX, f.xOffset);
    minY = Math.min(minY, f.yOffset);
    maxX = Math.max(maxX, f.xOffset + f.width);
    maxY = Math.max(maxY, f.yOffset + fh);
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const paintingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDragRef = useRef<{ x: number; y: number } | null>(null);
  const dragCenterRef = useRef<{ cx: number; cy: number } | null>(null);
  // Unit direction vector from center to drag start (for scale).
  const scaleDirRef = useRef<{ dx: number; dy: number } | null>(null);
  // Accumulate move totals in a ref to avoid stale closures.
  const moveTotalRef = useRef({ dx: 0, dy: 0 });

  const dispatch = useDispatch<AppDispatch>();
  const canvasState = useSelector((s: RootState) => s.canvas);
  const selectedLayerIds = useSelector(selectSelectedLayerIds);
  const currentFrame = useSelector(selectCurrentFrame);

  const canvasSize = useSelector(selectCanvasSize);
  const zoom = useSelector(selectZoom);
  const tool = useSelector(selectCurrentTool);
  const toolOptions = useSelector(selectCurrentToolOptions);
  const allFrames = useSelector(selectAllFrames);
  const pendingState = useSelector(selectPending);

  // Keep a ref to latest pending so pointerUp never reads stale values.
  const pendingRef = useRef(pendingState);
  pendingRef.current = pendingState;

  // Map Redux pending to the PendingTransform shape for canvas preview (current drag only).
  const pending: PendingTransform = { rotation: pendingState.dragRotation, scale: pendingState.dragScale };

  // Derive transformed layers for rendering.
  const layers = useMemo(
    () => selectTransformedLayers(canvasState, pending),
    [canvasState, pending],
  );

  const cssW = canvasSize.width * zoom;
  const cssH = canvasSize.height * zoom;

  const toPixel = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const pt = toPixel(e);

      if (DRAG_TOOLS.has(tool)) {
        dragStartRef.current = pt;
        lastDragRef.current = pt;
        // Snapshot current running totals for move accumulation
        moveTotalRef.current = { dx: pendingRef.current.dx, dy: pendingRef.current.dy };
        if (tool === 'rotate' || tool === 'scale') {
          const bounds = selectionBounds(layers, selectedLayerIds, currentFrame);
          dragCenterRef.current = bounds ? { cx: bounds.cx, cy: bounds.cy } : null;
          if (tool === 'scale' && bounds) {
            // Direction from center to click — defines the "away" axis
            const vx = pt.x - bounds.cx;
            const vy = pt.y - bounds.cy;
            const len = Math.sqrt(vx * vx + vy * vy);
            scaleDirRef.current = len > 0.001 ? { dx: vx / len, dy: vy / len } : { dx: 1, dy: 0 };
          } else {
            scaleDirRef.current = null;
          }
        }
        // Reset only the drag-time values, keep running totals
        dispatch(updateDrag({ dragScale: 1, dragRotation: 0 }));
        return;
      }

      if (!PAINT_TOOLS.has(tool)) return;
      paintingRef.current = true;
      dispatch(applyToolAtPoint(Math.floor(pt.x), Math.floor(pt.y)));
    },
    [dispatch, tool, toPixel, layers, selectedLayerIds, currentFrame],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = toPixel(e);
      setCursor({ x: Math.floor(pt.x), y: Math.floor(pt.y) });

      if (dragStartRef.current && lastDragRef.current && DRAG_TOOLS.has(tool)) {
        const start = dragStartRef.current;
        const last = lastDragRef.current;

        if (tool === 'move') {
          const ddx = Math.floor(pt.x) - Math.floor(last.x);
          const ddy = Math.floor(pt.y) - Math.floor(last.y);
          if (ddx !== 0 || ddy !== 0) {
            dispatch(moveSelectedLayers({ dx: ddx, dy: ddy, frame: currentFrame, allFrames }));
            lastDragRef.current = { x: last.x + ddx, y: last.y + ddy };
            moveTotalRef.current.dx += ddx;
            moveTotalRef.current.dy += ddy;
            dispatch(updateDrag({
              dx: moveTotalRef.current.dx,
              dy: moveTotalRef.current.dy,
            }));
          }
        } else if (tool === 'scale') {
          const dir = scaleDirRef.current;
          if (dir) {
            // Project drag delta onto the start direction (center → click)
            const moveX = pt.x - start.x;
            const moveY = pt.y - start.y;
            const projected = (moveX * dir.dx + moveY * dir.dy) * zoom;
            // Positive = away from center (scale up), negative = towards (scale down)
            const factor = Math.pow(2, projected / 100);
            dispatch(updateDrag({ dragScale: factor }));
          }
        } else if (tool === 'rotate') {
          const center = dragCenterRef.current;
          if (center) {
            const startAngle = Math.atan2(start.y - center.cy, start.x - center.cx);
            const curAngle = Math.atan2(pt.y - center.cy, pt.x - center.cx);
            dispatch(updateDrag({ dragRotation: curAngle - startAngle }));
          }
        }
        return;
      }

      if (paintingRef.current && PAINT_TOOLS.has(tool) && tool !== 'fill') {
        dispatch(applyToolAtPoint(Math.floor(pt.x), Math.floor(pt.y)));
      }
    },
    [dispatch, tool, currentFrame, zoom, toPixel, allFrames],
  );

  const onPointerUp = useCallback(() => {
    if (dragStartRef.current && (tool === 'scale' || tool === 'rotate')) {
      const p = pendingRef.current;
      // Commit drag to pixel data
      if (p.dragScale !== 1) {
        dispatch(scaleSelectedLayers({ factor: p.dragScale, frame: currentFrame, allFrames }));
      }
      if (p.dragRotation !== 0) {
        dispatch(rotateSelectedLayers({ angle: p.dragRotation, frame: currentFrame, allFrames }));
      }
      // Roll drag values into running totals
      dispatch(commitDrag());
    }

    paintingRef.current = false;
    dragStartRef.current = null;
    lastDragRef.current = null;
    dragCenterRef.current = null;
    scaleDirRef.current = null;
  }, [dispatch, tool, currentFrame, allFrames]);

  const onPointerLeave = useCallback(() => {
    setCursor(null);
    // Don't commit on leave — keep the drag going if pointer re-enters
  }, []);

  // Draw everything when inputs change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // ----- Layers (drawn in zoomed coordinate space) -----
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(zoom, zoom);

    for (const layer of layers) {
      if (layer.hidden) continue;
      const frame = layer.frames[currentFrame];
      if (!frame || frame.width === 0 || frame.pixelData.length === 0)
        continue;
      ctx.save();
      ctx.translate(frame.xOffset, frame.yOffset);
      drawPixels(ctx, frame.pixelData, frame.width);
      ctx.restore();
    }

    ctx.restore();

    // ----- Overlays (screen space) -----
    const cw = Math.round(cssW);
    const ch = Math.round(cssH);

    // Canvas area border.
    ctx.strokeStyle = CANVAS_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(-0.5, -0.5, cw + 1, ch + 1);

    // Bounding box + handles around selected layers.
    const bounds = selectionBounds(layers, selectedLayerIds, currentFrame);
    if (bounds) {
      const bx = Math.round(bounds.minX * zoom);
      const by = Math.round(bounds.minY * zoom);
      const bw = Math.round((bounds.maxX - bounds.minX) * zoom);
      const bh = Math.round((bounds.maxY - bounds.minY) * zoom);

      ctx.strokeStyle = BOUNDING_BOX_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
      ctx.setLineDash([]);

      const corners = [
        { x: bx, y: by },
        { x: bx + bw, y: by },
        { x: bx, y: by + bh },
        { x: bx + bw, y: by + bh },
      ];
      const hs = HANDLE_SIZE;
      const hh = hs / 2;
      ctx.fillStyle = HANDLE_FILL;
      ctx.strokeStyle = HANDLE_STROKE;
      ctx.lineWidth = 1;
      for (const c of corners) {
        ctx.fillRect(c.x - hh, c.y - hh, hs, hs);
        ctx.strokeRect(c.x - hh + 0.5, c.y - hh + 0.5, hs - 1, hs - 1);
      }
    }

    // Pixel grid.
    if (zoom >= GRID_MIN_ZOOM) {
      ctx.beginPath();
      for (let px = 1; px < canvasSize.width; px++) {
        const sx = Math.round(px * zoom) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, ch);
      }
      for (let py = 1; py < canvasSize.height; py++) {
        const sy = Math.round(py * zoom) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(cw, sy);
      }
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Tool preview.
    if (cursor && PAINT_TOOLS.has(tool)) {
      ctx.fillStyle = TOOL_PREVIEW_COLOR;

      if (tool === 'fill') {
        const sx = Math.round(cursor.x * zoom);
        const sy = Math.round(cursor.y * zoom);
        const sz = Math.round(zoom);
        ctx.fillRect(sx, sy, sz, sz);
      } else {
        const radius = toolOptions.radius;
        const size = Math.max(1, radius * 2 - 1);
        const half = (size - 1) / 2;
        const threshold = (radius - 0.5) * (radius - 0.5);
        const ox = cursor.x - half;
        const oy = cursor.y - half;

        for (let my = 0; my < size; my++) {
          for (let mx = 0; mx < size; mx++) {
            const dx = mx - half;
            const dy = my - half;
            if (dx * dx + dy * dy > threshold) continue;

            const px = ox + mx;
            const py = oy + my;
            const sx = Math.round(px * zoom);
            const sy = Math.round(py * zoom);
            const sw = Math.round((px + 1) * zoom) - sx;
            const sh = Math.round((py + 1) * zoom) - sy;
            ctx.fillRect(sx, sy, sw, sh);
          }
        }
      }
    }
  }, [layers, selectedLayerIds, currentFrame, canvasSize, zoom, cssW, cssH, cursor, tool, toolOptions, pending]);

  const cssCursor = CURSOR_MAP[tool] ?? 'default';

  return (
    <div
      className="relative inline-block"
      style={{
        width: cssW,
        height: cssH,
        backgroundImage:
          'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block"
        style={{ width: cssW, height: cssH, cursor: cssCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
    </div>
  );
}
