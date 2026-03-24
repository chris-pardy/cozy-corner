import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import { drawCheckerboard } from "./drawCheckerboard";
import { hexToRgba } from "./color-utils";
import {
  toolFootprint,
  bresenham,
  floodFill,
  scale2x,
} from "./sprite-drawing";
import {
  SpriteEditorProvider,
  createInitialState,
  useSpriteDispatch,
  useSpriteSelector,
  useSpriteStore,
  createCanvasOps,
  setCanvasW,
  setCanvasH,
  setGridSize,
  setZoom,
  setTool,
  setToolSize,
  setColor,
  addLayer,
  deleteLayer,
  setActiveLayerId,
  renameLayer,
  toggleLayerVisibility,
  setLayerTint,
  reorderLayers,
  addFrame,
  setCurrentFrame,
  setPreviewFps,
  toggleOnionPrev,
  toggleOnionNext,
  toggleShowBg,
  setTransformAllFrames,
  setRotAngle,
  setTransformRect,
  resetTransformRect,
  bumpVersion,
  type Tool,
  type LayerMeta,
  type CanvasOps,
} from "./store";
import "./editor.css";

// Re-export the Tool type so external consumers can still import it from here
export type { Tool };

/** Background image drawn behind all layers (e.g. base avatar under wearable). */
export type SpriteBackground = {
  image: CanvasImageSource;
  /** Only layers whose target matches will be drawn. */
  layers: AnimationLayer[];
};

/** Draw matching background layers for a given frame index. */
function drawBg(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bg: SpriteBackground,
  frame: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  ctx.globalAlpha = 0.4;
  for (const layer of bg.layers) {
    if (layer.frames.length === 0) continue;
    const f = frame % layer.frames.length;
    const fr = layer.frames[f];
    ctx.drawImage(bg.image, fr.x, fr.y, fr.width, fr.height, dx, dy, dw, dh);
  }
  ctx.globalAlpha = 1;
}

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "pencil", label: "Pencil", icon: "\u270F" },
  { id: "brush", label: "Brush", icon: "\u25CF" },
  { id: "fill", label: "Fill", icon: "\u25C6" },
  { id: "eraser", label: "Eraser", icon: "\u25FB" },
  { id: "move", label: "Move", icon: "\u271B" },
  { id: "scale", label: "Scale", icon: "\u2922" },
  { id: "rotate", label: "Rotate", icon: "\u21BB" },
];

const MOVE_HANDLE_SIZE = 8;
const MOVE_HIT_RADIUS = 10;



// ---------------------------------------------------------------------------
// Backing canvas layout:
//   width  = frameCount * canvasW   (frames are columns)
//   height = maxLayerId  * canvasH  (layers are rows, keyed by id)
//
// Cell for (frame f, layer id L) starts at (f * canvasW, L * canvasH).
// Layer order in the canvas is stable — reordering only changes the
// composite order stored in the layers[] array.
// ---------------------------------------------------------------------------

/** Grow a backing canvas to at least (w, h), preserving existing content. */
function ensureSize(canvas: OffscreenCanvas, w: number, h: number): OffscreenCanvas {
  if (canvas.width >= w && canvas.height >= h) return canvas;
  const next = new OffscreenCanvas(Math.max(canvas.width, w), Math.max(canvas.height, h));
  next.getContext("2d")!.drawImage(canvas, 0, 0);
  return next;
}

// ---------------------------------------------------------------------------
// LayerThumb — small preview of one layer for the current frame
// ---------------------------------------------------------------------------

function LayerThumb({
  backing,
  layerId,
  frame,
  w,
  h,
  version,
}: {
  backing: OffscreenCanvas;
  layerId: number;
  frame: number;
  w: number;
  h: number;
  version: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = 36;
    canvas.width = size;
    canvas.height = size;
    drawCheckerboard(ctx, size, size, Math.max(1, Math.floor(size / 8)));
    if (w === 0 || h === 0) return;
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(
      backing,
      frame * w, layerId * h, w, h,
      (size - dw) / 2, (size - dh) / 2, dw, dh,
    );
  }, [backing, layerId, frame, w, h, version]);
  return (
    <canvas
      ref={ref}
      style={{ width: 36, height: 36, imageRendering: "pixelated", display: "block" }}
    />
  );
}

// ---------------------------------------------------------------------------
// FrameThumb — small preview compositing all layers for one frame
// ---------------------------------------------------------------------------

function FrameThumb({
  backing,
  layers,
  frame,
  w,
  h,
  version,
  background,
}: {
  backing: OffscreenCanvas;
  layers: LayerMeta[];
  frame: number;
  w: number;
  h: number;
  version: number;
  background?: SpriteBackground;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    drawCheckerboard(ctx, size, size, Math.max(1, Math.floor(size / 8)));
    if (w === 0 || h === 0) return;
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    const xOff = frame * w;
    if (background) drawBg(ctx, background, frame, (size - dw) / 2, (size - dh) / 2, dw, dh);
    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.drawImage(
        backing,
        xOff, layer.id * h, w, h,
        (size - dw) / 2, (size - dh) / 2, dw, dh,
      );
    }
  }, [backing, layers, frame, w, h, version, background]);
  return <canvas ref={ref} style={{ width: 48, height: 48, imageRendering: "pixelated", display: "block" }} />;
}

// ---------------------------------------------------------------------------
// AnimatedPreview — cycles frames, composites visible layers with tint
// ---------------------------------------------------------------------------

function AnimatedPreview({
  backing,
  layers,
  frameCount,
  fps,
  w,
  h,
  version,
  background,
}: {
  backing: OffscreenCanvas;
  layers: LayerMeta[];
  frameCount: number;
  fps: number;
  w: number;
  h: number;
  version: number;
  background?: SpriteBackground;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const tempRef = useRef<OffscreenCanvas | null>(null);

  useEffect(() => {
    if (frameCount <= 1) {
      frameRef.current = 0;
      return;
    }
    const id = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % frameCount;
      draw();
    }, Math.round(1000 / fps));
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount, fps, layers, w, h, version]);

  const draw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas || w === 0 || h === 0) return;
    const size = 120;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    drawCheckerboard(ctx, size, size, Math.max(1, Math.floor(size / 8)));
    ctx.imageSmoothingEnabled = false;

    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    const xOff = frameRef.current * w;

    // Background (e.g. base avatar behind wearable)
    if (background) drawBg(ctx, background, frameRef.current, dx, dy, dw, dh);

    // Ensure temp canvas exists
    if (!tempRef.current || tempRef.current.width !== w || tempRef.current.height !== h) {
      tempRef.current = new OffscreenCanvas(w, h);
    }
    const temp = tempRef.current;
    const tempCtx = temp.getContext("2d")!;

    for (const layer of layers) {
      tempCtx.clearRect(0, 0, w, h);
      tempCtx.globalCompositeOperation = "source-over";
      tempCtx.drawImage(backing, xOff, layer.id * h, w, h, 0, 0, w, h);

      if (layer.tint) {
        tempCtx.globalCompositeOperation = "multiply";
        tempCtx.fillStyle = layer.tint;
        tempCtx.fillRect(0, 0, w, h);
        tempCtx.globalCompositeOperation = "destination-in";
        tempCtx.drawImage(backing, xOff, layer.id * h, w, h, 0, 0, w, h);
        tempCtx.globalCompositeOperation = "source-over";
      }

      ctx.drawImage(temp, 0, 0, w, h, dx, dy, dw, dh);
    }
  }, [backing, layers, w, h, background]);

  // Initial draw + redraw on version/frame count change
  useEffect(() => {
    frameRef.current = 0;
    draw();
  }, [draw, version, frameCount]);

  return (
    <canvas
      ref={ref}
      className="spe-preview-canvas"
      style={{ width: 120, height: 120, imageRendering: "pixelated", display: "block" }}
    />
  );
}

// ---------------------------------------------------------------------------
// ImportModal — select frames from a loaded image and map to backing canvas
// ---------------------------------------------------------------------------

type ImportStrategy = "extend" | "loop" | "interpolate";
type ImportSizeMode = "scale" | "center";

type ImportResult = {
  image: HTMLImageElement;
  frames: Array<{ sx: number; sy: number; sw: number; sh: number }>;
  newFrameCount: number;
  sizeMode: ImportSizeMode;
};

function ImportModal({
  image,
  canvasW,
  canvasH,
  currentFrameCount,
  onImport,
  onClose,
}: {
  image: HTMLImageElement;
  canvasW: number;
  canvasH: number;
  currentFrameCount: number;
  onImport: (result: ImportResult) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;

  const [zoom, setZoom] = useState(() =>
    Math.max(1, Math.min(8, Math.floor(480 / imgW))),
  );
  const [frameW, setFrameW] = useState(canvasW);
  const [frameH, setFrameH] = useState(canvasH);
  const [originX, setOriginX] = useState(0);
  const [originY, setOriginY] = useState(0);
  const [importFrameCount, setImportFrameCount] = useState(() =>
    Math.max(1, Math.floor(imgW / canvasW)),
  );
  const [strategy, setStrategy] = useState<ImportStrategy>("extend");
  const [sizeMode, setSizeMode] = useState<ImportSizeMode>("scale");
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const hasSizeMismatch = frameW !== canvasW || frameH !== canvasH;

  const scaledW = imgW * zoom;
  const scaledH = imgH * zoom;

  // Grid geometry (same pattern as AnimationLayerEditor)
  const grid = useMemo(() => {
    const fw = frameW * zoom;
    const fh = frameH * zoom;
    const ox = originX * zoom;
    const oy = originY * zoom;
    if (fw <= 0 || fh <= 0)
      return { fw: 0, fh: 0, ox: 0, oy: 0, startX: 0, startY: 0, cols: 0, rows: 0 };
    const startX = ox - Math.ceil(ox / fw) * fw;
    const startY = oy - Math.ceil(oy / fh) * fh;
    const cols = Math.floor((scaledW - startX) / fw);
    const rows = Math.floor((scaledH - startY) / fh);
    return { fw, fh, ox, oy, startX, startY, cols, rows };
  }, [frameW, frameH, originX, originY, zoom, scaledW, scaledH]);

  const maxFrames = frameW > 0 ? Math.max(1, Math.floor((imgW - originX) / frameW)) : 1;
  const hasMismatch = importFrameCount !== currentFrameCount;

  const eventToCell = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || grid.fw === 0 || grid.fh === 0) return null;
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (canvas.width / rect.width);
      const py = (e.clientY - rect.top) * (canvas.height / rect.height);
      const col = Math.floor((px - grid.startX) / grid.fw);
      const row = Math.floor((py - grid.startY) / grid.fh);
      if (col >= 0 && col < grid.cols && row >= 0 && row < grid.rows) return { col, row };
      return null;
    },
    [grid],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = eventToCell(e);
      if (!cell) return;
      const newX = (grid.startX + cell.col * grid.fw) / zoom;
      const newY = (grid.startY + cell.row * grid.fh) / zoom;
      setOriginX(Math.max(0, newX));
      setOriginY(Math.max(0, newY));
    },
    [eventToCell, grid, zoom],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => setHoverCell(eventToCell(e)),
    [eventToCell],
  );

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = scaledW;
    canvas.height = scaledH;

    drawCheckerboard(ctx, scaledW, scaledH, zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, scaledW, scaledH);

    const { fw, fh, ox, oy, startX, startY, cols, rows } = grid;
    if (fw > 0 && fh > 0) {
      // Highlight selected frames
      ctx.fillStyle = "rgba(34, 211, 238, 0.2)";
      for (let f = 0; f < importFrameCount; f++) {
        const fx = ox + f * fw;
        if (fx + fw <= scaledW + 1 && oy + fh <= scaledH + 1) {
          ctx.fillRect(fx, oy, fw, fh);
        }
      }

      // Grid lines
      ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const x = startX + c * fw;
        ctx.moveTo(x + 0.5, startY);
        ctx.lineTo(x + 0.5, startY + rows * fh);
      }
      for (let r = 0; r <= rows; r++) {
        const y = startY + r * fh;
        ctx.moveTo(startX, y + 0.5);
        ctx.lineTo(startX + cols * fw, y + 0.5);
      }
      ctx.stroke();

      // Hover highlight
      if (hoverCell) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(
          startX + hoverCell.col * fw,
          startY + hoverCell.row * fh,
          fw,
          fh,
        );
      }
    }
  }, [image, zoom, scaledW, scaledH, grid, importFrameCount, hoverCell]);

  const handleImport = useCallback(() => {
    const sourceFrames: Array<{ sx: number; sy: number; sw: number; sh: number }> = [];
    for (let f = 0; f < importFrameCount; f++) {
      sourceFrames.push({
        sx: originX + f * frameW,
        sy: originY,
        sw: frameW,
        sh: frameH,
      });
    }

    const N = importFrameCount;
    const newFrameCount = Math.max(N, currentFrameCount);
    const resultFrames: typeof sourceFrames = [];

    for (let i = 0; i < newFrameCount; i++) {
      let srcIdx: number;
      if (!hasMismatch) {
        srcIdx = i;
      } else if (strategy === "extend") {
        srcIdx = Math.min(i, N - 1);
      } else if (strategy === "loop") {
        srcIdx = i % N;
      } else {
        // interpolate: evenly distribute
        srcIdx = Math.min(Math.floor((i * N) / newFrameCount), N - 1);
      }
      resultFrames.push(sourceFrames[srcIdx]);
    }

    onImport({ image, frames: resultFrames, newFrameCount, sizeMode: hasSizeMismatch ? sizeMode : "scale" });
  }, [
    image, originX, originY, frameW, frameH,
    importFrameCount, currentFrameCount, hasMismatch, strategy, sizeMode, hasSizeMismatch, onImport,
  ]);

  return (
    <div className="bae-overlay" onClick={onClose}>
      <div className="bae-modal spe-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bae-modal-header">
          <span className="ale-label" style={{ margin: 0 }}>Import Frames</span>
          <button className="ale-icon-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="bae-modal-body">
          <div className="spe-import-layout">
            {/* Canvas */}
            <div className="spe-import-canvas-area">
              <div className="ale-toolbar">
                <button className="ale-zoom-btn" onClick={() => setZoom((z) => Math.max(1, z - 1))}>
                  &minus;
                </button>
                <span className="ale-zoom-display">{zoom}x</span>
                <button className="ale-zoom-btn" onClick={() => setZoom((z) => Math.min(16, z + 1))}>
                  +
                </button>
                <span style={{ flex: 1 }} />
                <span className="ale-info" style={{ alignSelf: "center" }}>
                  {imgW}&times;{imgH}px
                </span>
              </div>
              <div className="ale-viewport" style={{ maxHeight: 420 }}>
                <canvas
                  ref={canvasRef}
                  className="ale-canvas"
                  style={{ width: scaledW, height: scaledH }}
                  onClick={handleCanvasClick}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverCell(null)}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="spe-import-controls">
              <span className="ale-label">Frame Size</span>
              <div className="spe-field-row">
                <div className="ale-field">
                  <span className="ale-field-label">W</span>
                  <input
                    className="ale-num-input"
                    type="number"
                    value={frameW}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1 && v <= imgW) setFrameW(v);
                    }}
                    min={1}
                    max={imgW}
                  />
                </div>
                <div className="ale-field">
                  <span className="ale-field-label">H</span>
                  <input
                    className="ale-num-input"
                    type="number"
                    value={frameH}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1 && v <= imgH) setFrameH(v);
                    }}
                    min={1}
                    max={imgH}
                  />
                </div>
              </div>

              <span className="ale-label" style={{ marginTop: 10 }}>Origin</span>
              <div className="spe-field-row">
                <div className="ale-field">
                  <span className="ale-field-label">X</span>
                  <input
                    className="ale-num-input"
                    type="number"
                    value={frameW > 0 ? originX % frameW : originX}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 0 && v < frameW) {
                        const cell = Math.floor(originX / frameW) * frameW;
                        setOriginX(cell + v);
                      }
                    }}
                    min={0}
                    max={Math.max(0, frameW - 1)}
                  />
                  <span className="ale-field-unit">px</span>
                </div>
                <div className="ale-field">
                  <span className="ale-field-label">Y</span>
                  <input
                    className="ale-num-input"
                    type="number"
                    value={frameH > 0 ? originY % frameH : originY}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 0 && v < frameH) {
                        const cell = Math.floor(originY / frameH) * frameH;
                        setOriginY(cell + v);
                      }
                    }}
                    min={0}
                    max={Math.max(0, frameH - 1)}
                  />
                  <span className="ale-field-unit">px</span>
                </div>
              </div>

              <span className="ale-label" style={{ marginTop: 10 }}>Frames</span>
              <div className="ale-field">
                <span className="ale-field-label">Count</span>
                <input
                  className="ale-num-input"
                  type="number"
                  value={importFrameCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1 && v <= maxFrames) setImportFrameCount(v);
                  }}
                  min={1}
                  max={maxFrames}
                />
                <span className="ale-field-unit">/ {maxFrames}</span>
              </div>

              {hasSizeMismatch && (
                <>
                  <span className="ale-label" style={{ marginTop: 10 }}>Size Mismatch</span>
                  <div className="ale-info" style={{ marginBottom: 4 }}>
                    <span>
                      {frameW}&times;{frameH} &rarr; {canvasW}&times;{canvasH}
                    </span>
                  </div>
                  <div className="spe-import-strategies">
                    {(["scale", "center"] as ImportSizeMode[]).map((s) => (
                      <button
                        key={s}
                        className={`spe-toggle-btn${sizeMode === s ? " spe-toggle-btn--active" : ""}`}
                        onClick={() => setSizeMode(s)}
                      >
                        {s === "scale" ? "Scale" : "Keep Source"}
                      </button>
                    ))}
                  </div>
                  <div className="ale-info" style={{ marginTop: 4 }}>
                    {sizeMode === "scale" && <span>Scale frames to fit {canvasW}&times;{canvasH}</span>}
                    {sizeMode === "center" && <span>Center frames at original size</span>}
                  </div>
                </>
              )}

              {hasMismatch && (
                <>
                  <span className="ale-label" style={{ marginTop: 10 }}>Frame Mismatch</span>
                  <div className="ale-info" style={{ marginBottom: 4 }}>
                    <span>
                      {importFrameCount} imported &rarr; {currentFrameCount} in sprite
                    </span>
                  </div>
                  <div className="spe-import-strategies">
                    {(["extend", "loop", "interpolate"] as ImportStrategy[]).map((s) => (
                      <button
                        key={s}
                        className={`spe-toggle-btn${strategy === s ? " spe-toggle-btn--active" : ""}`}
                        onClick={() => setStrategy(s)}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="ale-info" style={{ marginTop: 4 }}>
                    {strategy === "extend" && <span>Last frame fills remaining slots</span>}
                    {strategy === "loop" && <span>Frames cycle to fill all slots</span>}
                    {strategy === "interpolate" && <span>Frames distributed evenly</span>}
                  </div>
                </>
              )}

              <button className="spe-import-confirm" onClick={handleImport} style={{ marginTop: 16 }}>
                Import{" "}
                {hasMismatch
                  ? `${Math.max(importFrameCount, currentFrameCount)} frames`
                  : `${importFrameCount} frame${importFrameCount > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpritePixelEditor — public API
// ---------------------------------------------------------------------------

export type SpriteEditorResult = {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
};

export type SpritePixelEditorProps = {
  onDone?: (result: SpriteEditorResult) => void;
  onCancel?: () => void;
  initial?: SpriteEditorResult;
  /** Optional background drawn behind all layers (e.g. base avatar under a wearable). */
  background?: SpriteBackground;
};

export function SpritePixelEditor({ onDone, onCancel, initial, background }: SpritePixelEditorProps = {}) {
  const initialState = useMemo(
    () =>
      createInitialState(
        initial
          ? {
              frameWidth: initial.frameWidth,
              frameHeight: initial.frameHeight,
              frameCount: initial.frameCount,
              fps: initial.fps,
            }
          : undefined,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <SpriteEditorProvider initialState={initialState}>
      <SpritePixelEditorInner
        onDone={onDone}
        onCancel={onCancel}
        initial={initial}
        background={background}
      />
    </SpriteEditorProvider>
  );
}

// ---------------------------------------------------------------------------
// SpritePixelEditorInner — uses Redux store
// ---------------------------------------------------------------------------

function SpritePixelEditorInner({
  onDone,
  onCancel,
  initial,
  background,
}: SpritePixelEditorProps) {
  const dispatch = useSpriteDispatch();
  const store = useSpriteStore();

  // Select state slices
  const canvasW = useSpriteSelector((s) => s.editor.canvasW);
  const canvasH = useSpriteSelector((s) => s.editor.canvasH);
  const gridSize = useSpriteSelector((s) => s.editor.gridSize);
  const zoom = useSpriteSelector((s) => s.editor.zoom);
  const tool = useSpriteSelector((s) => s.editor.tool);
  const toolSize = useSpriteSelector((s) => s.editor.toolSize);
  const color = useSpriteSelector((s) => s.editor.color);
  const layers = useSpriteSelector((s) => s.editor.layers);
  const activeLayerId = useSpriteSelector((s) => s.editor.activeLayerId);
  const nextLayerId = useSpriteSelector((s) => s.editor.nextLayerId);
  const frameCount = useSpriteSelector((s) => s.editor.frameCount);
  const currentFrame = useSpriteSelector((s) => s.editor.currentFrame);
  const previewFps = useSpriteSelector((s) => s.editor.previewFps);
  const onionPrev = useSpriteSelector((s) => s.editor.onionPrev);
  const onionNext = useSpriteSelector((s) => s.editor.onionNext);
  const showBg = useSpriteSelector((s) => s.editor.showBg);
  const transformAllFrames = useSpriteSelector((s) => s.editor.transformAllFrames);
  const rotAngle = useSpriteSelector((s) => s.editor.rotAngle);
  const tfX = useSpriteSelector((s) => s.editor.tfX);
  const tfY = useSpriteSelector((s) => s.editor.tfY);
  const tfW = useSpriteSelector((s) => s.editor.tfW);
  const tfH = useSpriteSelector((s) => s.editor.tfH);
  const version = useSpriteSelector((s) => s.editor.version);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Ephemeral UI state (stays local)
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [importImage, setImportImage] = useState<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Painting refs
  const paintingRef = useRef(false);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);

  // Move tool drag state
  const moveDragRef = useRef<{
    type: "translate" | "scale";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  // Backing OffscreenCanvas: columns = frames, rows = layers (by id)
  const initW = initial ? initial.frameCount * initial.frameWidth : 32;
  const initH = initial ? initial.frameHeight : 32;
  const backingRef = useRef<OffscreenCanvas>(new OffscreenCanvas(Math.max(initW, 1), Math.max(initH, 1)));

  // Load initial image into backing canvas (runs once during first render)
  const initialLoadedRef = useRef(false);
  // eslint-disable-next-line react-hooks/refs
  if (initial && !initialLoadedRef.current) {
    initialLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/refs
    const ctx = backingRef.current.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(initial.image, 0, 0);
  }

  // Full reset when pixel dimensions change
  const prevSizeRef = useRef({ w: canvasW, h: canvasH });
  /* eslint-disable react-hooks/refs */
  if (prevSizeRef.current.w !== canvasW || prevSizeRef.current.h !== canvasH) {
    backingRef.current = new OffscreenCanvas(
      Math.max(frameCount * canvasW, 1),
      Math.max(nextLayerId * canvasH, 1),
    );
    prevSizeRef.current = { w: canvasW, h: canvasH };
  }

  // Grow backing if needed (new frames / layers added)
  backingRef.current = ensureSize(
    backingRef.current,
    frameCount * canvasW,
    nextLayerId * canvasH,
  );

  // Canvas operations (backed by store + backingRef)
  const canvasOpsRef = useRef<CanvasOps | null>(null);
  if (!canvasOpsRef.current) {
    canvasOpsRef.current = createCanvasOps(store, backingRef);
  }
  const ops = canvasOpsRef.current;
  /* eslint-enable react-hooks/refs */

  const scaledW = canvasW * zoom;
  const scaledH = canvasH * zoom;

  // ── RotSprite preview cache ──
  // Pre-compute the pixel-art rotation so the canvas draw just blits it.
  const rotPreviewRef = useRef<OffscreenCanvas | null>(null);
  useEffect(() => {
    if (tool !== "rotate" || rotAngle === 0) {
      rotPreviewRef.current = null;
      return;
    }
    const backing = backingRef.current;
    const ctx = backing.getContext("2d")!;
    const xOff = currentFrame * canvasW;
    const yOff = activeLayerId * canvasH;

    // Extract the active layer cell
    let imgData = ctx.getImageData(xOff, yOff, canvasW, canvasH);

    // 8x upscale via 3 rounds of Scale2x
    for (let i = 0; i < 3; i++) imgData = scale2x(imgData);
    const uw = canvasW * 8;
    const uh = canvasH * 8;

    const upCanvas = new OffscreenCanvas(uw, uh);
    upCanvas.getContext("2d")!.putImageData(imgData, 0, 0);

    // Rotate at high res
    const rotCanvas = new OffscreenCanvas(uw, uh);
    const rotCtx = rotCanvas.getContext("2d")!;
    rotCtx.translate(uw / 2, uh / 2);
    rotCtx.rotate((rotAngle * Math.PI) / 180);
    rotCtx.imageSmoothingEnabled = false;
    rotCtx.drawImage(upCanvas, -uw / 2, -uh / 2);

    // Downscale back to original size
    const result = new OffscreenCanvas(canvasW, canvasH);
    const rCtx = result.getContext("2d")!;
    rCtx.imageSmoothingEnabled = false;
    rCtx.drawImage(rotCanvas, 0, 0, canvasW, canvasH);

    rotPreviewRef.current = result;
  }, [tool, rotAngle, currentFrame, activeLayerId, canvasW, canvasH, version]);

  // ── Scale preview cache ──
  // Pre-compute nearest-neighbor scaled image for the scale tool.
  const scalePreviewRef = useRef<OffscreenCanvas | null>(null);
  useEffect(() => {
    if (tool !== "scale" || (tfX === 0 && tfY === 0 && tfW === canvasW && tfH === canvasH)) {
      scalePreviewRef.current = null;
      return;
    }
    const backing = backingRef.current;
    const xOff = currentFrame * canvasW;
    const yOff = activeLayerId * canvasH;

    const result = new OffscreenCanvas(canvasW, canvasH);
    const rCtx = result.getContext("2d")!;
    rCtx.imageSmoothingEnabled = false;
    rCtx.drawImage(
      backing,
      xOff, yOff, canvasW, canvasH,
      tfX, tfY, tfW, tfH,
    );

    scalePreviewRef.current = result;
  }, [tool, tfX, tfY, tfW, tfH, currentFrame, activeLayerId, canvasW, canvasH, version]);

  // ── Coordinate helpers ──

  const eventToPixel = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvasW);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvasH);
      if (x >= 0 && x < canvasW && y >= 0 && y < canvasH) return { x, y };
      return null;
    },
    [canvasW, canvasH],
  );

  // ── Drawing — writes to the active layer's cell for the current frame ──
  // stampAt reads from store.getState() for hot-path performance

  const stampAt = useCallback(
    (px: number, py: number) => {
      const state = store.getState().editor;
      const backing = backingRef.current;
      const ctx = backing.getContext("2d")!;
      const framesToPaint = state.transformAllFrames
        ? Array.from({ length: state.frameCount }, (_, i) => i)
        : [state.currentFrame];

      for (const frame of framesToPaint) {
        const xOff = frame * state.canvasW;
        const yOff = state.activeLayerId * state.canvasH;

        if (state.tool === "fill") {
          const imgData = ctx.getImageData(xOff, yOff, state.canvasW, state.canvasH);
          const [r, g, b, a] = hexToRgba(state.color);
          floodFill(imgData.data, state.canvasW, state.canvasH, px, py, r, g, b, a);
          ctx.putImageData(imgData, xOff, yOff);
          continue;
        }

        const pts = toolFootprint(state.tool, px, py, state.toolSize, state.canvasW, state.canvasH);
        if (state.tool === "eraser") {
          for (const p of pts) ctx.clearRect(xOff + p.x, yOff + p.y, 1, 1);
        } else {
          ctx.fillStyle = state.color;
          for (const p of pts) ctx.fillRect(xOff + p.x, yOff + p.y, 1, 1);
        }
      }
    },
    [store],
  );

  // ── Mouse handlers ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const currentTool = store.getState().editor.tool;
      if (currentTool === "move" || currentTool === "scale" || currentTool === "rotate") return;
      const p = eventToPixel(e);
      if (!p) return;
      paintingRef.current = true;
      lastPixelRef.current = p;
      stampAt(p.x, p.y);
      dispatch(bumpVersion());
    },
    [eventToPixel, stampAt, dispatch, store],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const moveTool = store.getState().editor.tool;
      if (moveTool === "move" || moveTool === "scale" || moveTool === "rotate") return;
      const p = eventToPixel(e);
      setHoverPixel(p);
      if (!paintingRef.current || !p) return;
      const last = lastPixelRef.current;
      if (last && (last.x !== p.x || last.y !== p.y)) {
        if (store.getState().editor.tool !== "fill") {
          for (const pt of bresenham(last.x, last.y, p.x, p.y)) stampAt(pt.x, pt.y);
        }
      }
      lastPixelRef.current = p;
      dispatch(bumpVersion());
    },
    [eventToPixel, stampAt, dispatch, store],
  );

  const stopPainting = useCallback(() => {
    paintingRef.current = false;
    lastPixelRef.current = null;
  }, []);

  // ── Rotate tool state ──
  const rotDragRef = useRef<{ startAngle: number; startRot: number } | null>(null);

  /** Get angle in degrees from canvas center to a screen point. */
  const screenToAngle = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    },
    [],
  );

  const handleRotatePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool !== "rotate" || e.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const angle = screenToAngle(e.clientX, e.clientY);
      rotDragRef.current = { startAngle: angle, startRot: rotAngle };
      canvas.setPointerCapture(e.pointerId);
    },
    [tool, screenToAngle, rotAngle],
  );

  const handleRotatePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool !== "rotate") return;
      const drag = rotDragRef.current;
      if (!drag) return;
      const angle = screenToAngle(e.clientX, e.clientY);
      const delta = angle - drag.startAngle;
      let next = Math.round(drag.startRot + delta);
      // Normalize to -180..180
      while (next > 180) next -= 360;
      while (next < -180) next += 360;
      dispatch(setRotAngle(next));
    },
    [tool, screenToAngle, dispatch],
  );

  const handleRotatePointerUp = useCallback(() => {
    rotDragRef.current = null;
  }, []);

  // ── Move tool pointer handlers (use pointer capture for drags beyond canvas) ──

  // ── Move tool: translate only ──

  const handleMovePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool !== "move" || e.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      moveDragRef.current = {
        type: "translate", startX: e.clientX, startY: e.clientY,
        origX: tfX, origY: tfY, origW: tfW, origH: tfH,
        anchorX: 0, anchorY: 0,
      };
      canvas.setPointerCapture(e.pointerId);
    },
    [tool, tfX, tfY, tfW, tfH],
  );

  const handleMovePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool !== "move") return;
      const drag = moveDragRef.current;
      if (!drag) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ss = canvas.getBoundingClientRect().width / canvasW;
      const nx = drag.origX + Math.round((e.clientX - drag.startX) / ss);
      const ny = drag.origY + Math.round((e.clientY - drag.startY) / ss);
      dispatch(setTransformRect({ x: nx, y: ny, w: drag.origW, h: drag.origH }));
    },
    [tool, canvasW, dispatch],
  );

  const handleMovePointerUp = useCallback(() => {
    moveDragRef.current = null;
  }, []);

  // ── Scale tool: corner-drag resize ──

  const scaleDragRef = useRef<{
    startX: number; startY: number;
    anchorX: number; anchorY: number;
  } | null>(null);

  const handleScalePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool !== "scale" || e.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const ss = rect.width / canvasW;

      const corners: [number, number][] = [
        [tfX * ss, tfY * ss],
        [(tfX + tfW) * ss, tfY * ss],
        [tfX * ss, (tfY + tfH) * ss],
        [(tfX + tfW) * ss, (tfY + tfH) * ss],
      ];
      const OPP = [3, 2, 1, 0];

      for (let i = 0; i < 4; i++) {
        if (Math.abs(sx - corners[i][0]) <= MOVE_HIT_RADIUS && Math.abs(sy - corners[i][1]) <= MOVE_HIT_RADIUS) {
          const oi = OPP[i];
          scaleDragRef.current = {
            startX: sx, startY: sy,
            anchorX: corners[oi][0] / ss, anchorY: corners[oi][1] / ss,
          };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    },
    [tool, canvasW, tfX, tfY, tfW, tfH],
  );

  const handleScalePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool !== "scale") return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const ss = rect.width / canvasW;

      const drag = scaleDragRef.current;
      if (drag) {
        const spriteX = sx / ss;
        const spriteY = sy / ss;
        let nw = Math.round(spriteX - drag.anchorX);
        let nh = Math.round(spriteY - drag.anchorY);
        let nx = Math.round(drag.anchorX);
        let ny = Math.round(drag.anchorY);
        if (nw < 0) { nx += nw; nw = -nw; }
        if (nh < 0) { ny += nh; nh = -nh; }
        dispatch(setTransformRect({ x: nx, y: ny, w: Math.max(1, nw), h: Math.max(1, nh) }));
        return;
      }
      // Cursor update
      const corners: [number, number][] = [
        [tfX * ss, tfY * ss],
        [(tfX + tfW) * ss, tfY * ss],
        [tfX * ss, (tfY + tfH) * ss],
        [(tfX + tfW) * ss, (tfY + tfH) * ss],
      ];
      let cursor = "default";
      for (let i = 0; i < 4; i++) {
        if (Math.abs(sx - corners[i][0]) <= MOVE_HIT_RADIUS && Math.abs(sy - corners[i][1]) <= MOVE_HIT_RADIUS) {
          cursor = (i === 0 || i === 3) ? "nwse-resize" : "nesw-resize";
          break;
        }
      }
      canvas.style.cursor = cursor;
    },
    [tool, canvasW, tfX, tfY, tfW, tfH, dispatch],
  );

  const handleScalePointerUp = useCallback(() => {
    scaleDragRef.current = null;
  }, []);

  // ── Zoom ──

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const state = store.getState().editor;
      const next = Math.max(1, Math.min(64, state.zoom + (e.deltaY < 0 ? 1 : -1)));
      dispatch(setZoom(next));
    }
  }, [dispatch, store]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => vp.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Layer drag-reorder ──
  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx != null && idx !== dragIdx) setDragOverIdx(idx);
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (idx: number) => {
      if (dragIdx == null || dragIdx === idx) return;
      dispatch(reorderLayers({ fromIdx: dragIdx, toIdx: idx }));
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, dispatch],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  // ── Import ──

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setImportImage(img);
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  }, []);

  const performImport = useCallback(
    (result: ImportResult) => {
      ops.performImport(result, ensureSize);
      setImportImage(null);
    },
    [ops],
  );

  // ── Composite helper: draw all layers for a given frame onto ctx ──

  const compositeFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      frame: number,
      dstX: number,
      dstY: number,
      dstW: number,
      dstH: number,
    ) => {
      const backing = backingRef.current;
      const xOff = frame * canvasW;
      for (const layer of layers) {
        if (!layer.visible) continue;
        ctx.drawImage(
          backing,
          xOff, layer.id * canvasH, canvasW, canvasH,
          dstX, dstY, dstW, dstH,
        );
      }
    },
    [layers, canvasW, canvasH],
  );

  // ── Done: flatten to sprite sheet and hand off ──

  const handleDone = useCallback(() => {
    if (!onDone) return;
    const state = store.getState().editor;

    const out = document.createElement("canvas");
    out.width = frameCount * canvasW;
    out.height = canvasH;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    for (let f = 0; f < frameCount; f++) {
      compositeFrame(ctx, f, f * canvasW, 0, canvasW, canvasH);
    }
    const img = new Image();
    img.onload = () => onDone({ image: img, frameWidth: canvasW, frameHeight: canvasH, frameCount, fps: previewFps });
    img.src = out.toDataURL("image/png");
  }, [onDone, frameCount, canvasW, canvasH, previewFps, compositeFrame, store, ops]);

  // ── Draw display canvas ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = scaledW;
    canvas.height = scaledH;

    // 1. Checkerboard
    drawCheckerboard(ctx, scaledW, scaledH, zoom);

    ctx.imageSmoothingEnabled = false;

    // 1b. Background (e.g. base avatar behind wearable)
    if (background && showBg) drawBg(ctx, background, currentFrame, 0, 0, scaledW, scaledH);

    // 2. Onion skin — previous frame
    if (onionPrev && currentFrame > 0) {
      ctx.globalAlpha = 0.2;
      compositeFrame(ctx, currentFrame - 1, 0, 0, scaledW, scaledH);
      ctx.globalAlpha = 1;
    }

    // 3. Onion skin — next frame
    if (onionNext && currentFrame < frameCount - 1) {
      ctx.globalAlpha = 0.2;
      compositeFrame(ctx, currentFrame + 1, 0, 0, scaledW, scaledH);
      ctx.globalAlpha = 1;
    }

    // 4. Current frame (all layers bottom→top)
    if (tool === "move") {
      // Move tool: active layer translated, others normal
      const backing = backingRef.current;
      const xOff = currentFrame * canvasW;
      for (const layer of layers) {
        if (!layer.visible) continue;
        if (layer.id === activeLayerId) {
          ctx.drawImage(
            backing,
            xOff, layer.id * canvasH, canvasW, canvasH,
            tfX * zoom, tfY * zoom, canvasW * zoom, canvasH * zoom,
          );
        } else {
          ctx.drawImage(
            backing,
            xOff, layer.id * canvasH, canvasW, canvasH,
            0, 0, scaledW, scaledH,
          );
        }
      }
      // Dashed outline showing layer position
      ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(tfX * zoom + 0.5, tfY * zoom + 0.5, canvasW * zoom, canvasH * zoom);
      ctx.setLineDash([]);
    } else if (tool === "scale") {
      // Scale tool: active layer scaled via nearest-neighbor preview
      const backing = backingRef.current;
      const xOff = currentFrame * canvasW;
      for (const layer of layers) {
        if (!layer.visible) continue;
        if (layer.id === activeLayerId) {
          const preview = scalePreviewRef.current;
          if (preview) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(preview, 0, 0, canvasW, canvasH, 0, 0, scaledW, scaledH);
          } else {
            ctx.drawImage(
              backing,
              xOff, layer.id * canvasH, canvasW, canvasH,
              0, 0, scaledW, scaledH,
            );
          }
        } else {
          ctx.drawImage(
            backing,
            xOff, layer.id * canvasH, canvasW, canvasH,
            0, 0, scaledW, scaledH,
          );
        }
      }
      // Selection outline + corner handles
      const bx = tfX * zoom;
      const by = tfY * zoom;
      const bw = tfW * zoom;
      const bh = tfH * zoom;
      ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
      ctx.setLineDash([]);
      ctx.fillStyle = "#22d3ee";
      const HS = MOVE_HANDLE_SIZE;
      for (const [hx, hy] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) {
        ctx.fillRect(hx - HS / 2, hy - HS / 2, HS, HS);
      }
    } else if (tool === "rotate") {
      // Rotate tool: active layer shown via RotSprite preview
      const backing = backingRef.current;
      const xOff = currentFrame * canvasW;
      for (const layer of layers) {
        if (!layer.visible) continue;
        if (layer.id === activeLayerId) {
          const preview = rotPreviewRef.current;
          if (preview) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(preview, 0, 0, canvasW, canvasH, 0, 0, scaledW, scaledH);
          } else {
            // rotAngle === 0: draw unrotated
            ctx.drawImage(
              backing,
              xOff, layer.id * canvasH, canvasW, canvasH,
              0, 0, scaledW, scaledH,
            );
          }
        } else {
          ctx.drawImage(
            backing,
            xOff, layer.id * canvasH, canvasW, canvasH,
            0, 0, scaledW, scaledH,
          );
        }
      }
      // Rotation guide: center dot + angle line
      const cx = scaledW / 2;
      const cy = scaledH / 2;
      const radius = Math.min(scaledW, scaledH) * 0.4;
      ctx.strokeStyle = "rgba(34, 211, 238, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      const rad = (rotAngle * Math.PI) / 180;
      ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
      ctx.stroke();
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      compositeFrame(ctx, currentFrame, 0, 0, scaledW, scaledH);
    }

    // 5. Grid lines
    if (gridSize >= 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = gridSize * zoom;
      for (let x = 0; x <= scaledW; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, scaledH);
      }
      for (let y = 0; y <= scaledH; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(scaledW, y + 0.5);
      }
      ctx.stroke();
    }

    // 6. Hover footprint (not for move tool)
    if (hoverPixel && tool !== "move" && tool !== "scale" && tool !== "rotate") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      for (const p of toolFootprint(tool, hoverPixel.x, hoverPixel.y, toolSize, canvasW, canvasH)) {
        ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
      }
    }
  }, [
    canvasW, canvasH, gridSize, zoom, scaledW, scaledH,
    hoverPixel, version, tool, toolSize, layers, activeLayerId,
    currentFrame, frameCount, onionPrev, onionNext, compositeFrame, background, showBg,
    tfX, tfY, tfW, tfH, rotAngle,
  ]);

  // ── Render ──

  const activeIdx = layers.findIndex((l: LayerMeta) => l.id === activeLayerId);
  const showSize = tool !== "fill" && tool !== "move" && tool !== "scale" && tool !== "rotate";
  const frames = Array.from({ length: frameCount }, (_, i) => i);

  return (
    <div className="spe-root">
      {/* ── Left sidebar: settings + tools ── */}
      <div className="spe-sidebar">
        <span className="ale-label">Canvas</span>
        <div className="spe-field-row">
          <div className="ale-field">
            <span className="ale-field-label">W</span>
            <input
              className="ale-num-input"
              type="number"
              value={canvasW}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= 512) dispatch(setCanvasW(v));
              }}
              min={1}
              max={512}
            />
            <span className="ale-field-unit">px</span>
          </div>
          <div className="ale-field">
            <span className="ale-field-label">H</span>
            <input
              className="ale-num-input"
              type="number"
              value={canvasH}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= 512) dispatch(setCanvasH(v));
              }}
              min={1}
              max={512}
            />
            <span className="ale-field-unit">px</span>
          </div>
        </div>

        <span className="ale-label" style={{ marginTop: 12 }}>Grid</span>
        <div className="ale-field">
          <span className="ale-field-label">Size</span>
          <input
            className="ale-num-input"
            type="number"
            value={gridSize}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1 && v <= Math.max(canvasW, canvasH)) dispatch(setGridSize(v));
            }}
            min={1}
            max={Math.max(canvasW, canvasH)}
          />
          <span className="ale-field-unit">px</span>
        </div>

        <span className="ale-label" style={{ marginTop: 12 }}>Tools</span>
        <div className="spe-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`spe-tool${tool === t.id ? " spe-tool--active" : ""}`}
              onClick={() => dispatch(setTool(t.id))}
              title={t.label}
            >
              <span className="spe-tool-icon">{t.icon}</span>
              <span className="spe-tool-label">{t.label}</span>
            </button>
          ))}
        </div>

        {showSize && (
          <div className="ale-field" style={{ marginTop: 4 }}>
            <span className="ale-field-label">Size</span>
            <input
              className="ale-num-input"
              type="number"
              value={toolSize}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= 64) dispatch(setToolSize(v));
              }}
              min={1}
              max={64}
            />
            <span className="ale-field-unit">px</span>
          </div>
        )}

        <div className="spe-frame-scope">
          <button
            className={`spe-toggle-btn${transformAllFrames ? " spe-toggle-btn--active" : ""}`}
            onClick={() => dispatch(setTransformAllFrames())}
            title={transformAllFrames ? "Apply to all frames" : "Apply to current frame only"}
          >
            {transformAllFrames ? "All frames" : "This frame"}
          </button>
        </div>

        <span className="ale-label" style={{ marginTop: 12 }}>Color</span>
        <div className="spe-color-row">
          <div className="spe-color-swatch" style={{ backgroundColor: color }} />
          <input
            className="spe-color-input"
            type="color"
            value={color}
            onChange={(e) => dispatch(setColor(e.target.value))}
          />
          <span className="spe-color-hex">{color}</span>
        </div>

        <span className="ale-label" style={{ marginTop: 12 }}>Transform</span>
        <div className="spe-transform-grid">
          <button className="spe-transform-btn" onClick={() => ops.rotateCCW()} title="Rotate 90\u00b0 counter-clockwise">
            <span className="spe-transform-icon">{"\u21BA"}</span>
            <span className="spe-tool-label">CCW</span>
          </button>
          <button className="spe-transform-btn" onClick={() => ops.rotateCW()} title="Rotate 90\u00b0 clockwise">
            <span className="spe-transform-icon">{"\u21BB"}</span>
            <span className="spe-tool-label">CW</span>
          </button>
          <button className="spe-transform-btn" onClick={() => ops.flipH()} title="Mirror horizontally">
            <span className="spe-transform-icon">{"\u2194"}</span>
            <span className="spe-tool-label">Flip H</span>
          </button>
          <button className="spe-transform-btn" onClick={() => ops.flipV()} title="Mirror vertically">
            <span className="spe-transform-icon">{"\u2195"}</span>
            <span className="spe-tool-label">Flip V</span>
          </button>
        </div>

        {/* Rotate tool controls */}
        {tool === "rotate" && (
          <>
            <div className="spe-rotate-row">
              <input
                className="ale-num-input"
                type="number"
                value={rotAngle}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) dispatch(setRotAngle(v));
                }}
                style={{ width: 52 }}
                title="Rotation angle in degrees"
              />
              <span className="ale-field-unit">deg</span>
            </div>
            <div className="spe-transform-actions">
              <button
                className="spe-transform-btn"
                onClick={() => { ops.rotspriteRotate(); dispatch(setRotAngle(0)); }}
                title={`Apply ${rotAngle}\u00b0 rotation (RotSprite)`}
              >
                Apply
              </button>
              <button
                className="spe-transform-btn"
                onClick={() => dispatch(setRotAngle(0))}
                title="Reset angle to 0"
              >
                Reset
              </button>
            </div>
          </>
        )}

        {/* Move tool controls */}
        {tool === "move" && (
          <>
            <div className="spe-field-row" style={{ marginTop: 4 }}>
              <div className="ale-field">
                <span className="ale-field-label">X</span>
                <input
                  className="ale-num-input"
                  type="number"
                  value={tfX}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) dispatch(setTransformRect({ x: v, y: tfY, w: tfW, h: tfH })); }}
                />
                <span className="ale-field-unit">px</span>
              </div>
              <div className="ale-field">
                <span className="ale-field-label">Y</span>
                <input
                  className="ale-num-input"
                  type="number"
                  value={tfY}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) dispatch(setTransformRect({ x: tfX, y: v, w: tfW, h: tfH })); }}
                />
                <span className="ale-field-unit">px</span>
              </div>
            </div>
            <div className="spe-transform-actions">
              <button className="spe-transform-btn" onClick={() => ops.applyTransform()} title="Apply position">
                Apply
              </button>
              <button className="spe-transform-btn" onClick={() => dispatch(resetTransformRect())} title="Reset position">
                Reset
              </button>
            </div>
          </>
        )}

        {/* Scale tool controls */}
        {tool === "scale" && (
          <>
            <div className="spe-field-row" style={{ marginTop: 4 }}>
              <div className="ale-field">
                <span className="ale-field-label">W</span>
                <input
                  className="ale-num-input"
                  type="number"
                  value={tfW}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) dispatch(setTransformRect({ x: tfX, y: tfY, w: v, h: tfH })); }}
                  min={1}
                />
                <span className="ale-field-unit">px</span>
              </div>
              <div className="ale-field">
                <span className="ale-field-label">H</span>
                <input
                  className="ale-num-input"
                  type="number"
                  value={tfH}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) dispatch(setTransformRect({ x: tfX, y: tfY, w: tfW, h: v })); }}
                  min={1}
                />
                <span className="ale-field-unit">px</span>
              </div>
            </div>
            <div className="spe-transform-actions">
              <button className="spe-transform-btn" onClick={() => ops.applyTransform()} title="Apply scale">
                Apply
              </button>
              <button className="spe-transform-btn" onClick={() => dispatch(resetTransformRect())} title="Reset scale">
                Reset
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Center: canvas + frames ── */}
      <div className="ale-main">
        {/* Toolbar: zoom + onion skin */}
        <div className="ale-toolbar">
          <button className="ale-zoom-btn" onClick={() => dispatch(setZoom(Math.max(1, zoom - 1)))}>
            &minus;
          </button>
          <span className="ale-zoom-display">{zoom}x</span>
          <button className="ale-zoom-btn" onClick={() => dispatch(setZoom(Math.min(64, zoom + 1)))}>
            +
          </button>

          <span style={{ flex: 1 }} />

          {background && (
            <button
              className={`spe-toggle-btn${showBg ? " spe-toggle-btn--active" : ""}`}
              onClick={() => dispatch(toggleShowBg())}
              title="Toggle background"
            >
              BG
            </button>
          )}

          <button
            className={`spe-toggle-btn${onionPrev ? " spe-toggle-btn--active" : ""}`}
            onClick={() => dispatch(toggleOnionPrev())}
            title="Onion skin: previous frame"
          >
            &laquo; Onion
          </button>
          <button
            className={`spe-toggle-btn${onionNext ? " spe-toggle-btn--active" : ""}`}
            onClick={() => dispatch(toggleOnionNext())}
            title="Onion skin: next frame"
          >
            Onion &raquo;
          </button>

          <button
            className="spe-toggle-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
        </div>

        {/* Canvas viewport */}
        <div className="spe-viewport" ref={viewportRef}>
          <div style={{ position: "relative", width: scaledW, height: scaledH }}>
            <canvas
              ref={canvasRef}
              className="ale-canvas"
              style={{
                width: scaledW,
                height: scaledH,
                touchAction: tool === "move" || tool === "scale" || tool === "rotate" ? "none" : undefined,
                cursor: tool === "rotate" ? "grab" : tool === "move" ? "move" : undefined,
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopPainting}
              onMouseLeave={() => {
                setHoverPixel(null);
                stopPainting();
                if (canvasRef.current) canvasRef.current.style.cursor =
                  tool === "rotate" ? "grab" : tool === "move" ? "move" : "default";
              }}
              onPointerDown={(e) => {
                handleMovePointerDown(e);
                handleScalePointerDown(e);
                handleRotatePointerDown(e);
              }}
              onPointerMove={(e) => {
                handleMovePointerMove(e);
                handleScalePointerMove(e);
                handleRotatePointerMove(e);
              }}
              onPointerUp={() => {
                handleMovePointerUp();
                handleScalePointerUp();
                handleRotatePointerUp();
              }}
            />
          </div>
        </div>

        {/* Frame strip */}
          <div className="spe-frame-strip">
            {/* eslint-disable-next-line react-hooks/refs */}
            {frames.map((f) => (
              <div
                key={f}
                className={`spe-frame-cell${f === currentFrame ? " spe-frame-cell--active" : ""}`}
                onClick={() => dispatch(setCurrentFrame(f))}
              >
                <FrameThumb
                  backing={backingRef.current}
                  layers={layers}
                  frame={f}
                  w={canvasW}
                  h={canvasH}
                  version={version}
                  background={background}
                />
                <span className="spe-frame-num">{f + 1}</span>
                {frameCount > 1 && (
                  <button
                    className="spe-frame-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      ops.deleteFrame(f);
                    }}
                    title="Delete frame"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button className="spe-frame-add" onClick={() => dispatch(addFrame())} title="Add frame">
              +
            </button>
            {frameCount > 1 && (
              <>
                <button
                  className="spe-toggle-btn"
                  onClick={() => ops.copyPrevFrame()}
                  disabled={currentFrame <= 0}
                  title="Copy previous frame (active layer only)"
                  style={{ marginLeft: 4, alignSelf: "center" }}
                >
                  Copy prev
                </button>
                <button
                  className="spe-toggle-btn"
                  onClick={() => ops.copyPrevFrameAll()}
                  disabled={currentFrame <= 0}
                  title="Copy previous frame (all layers)"
                  style={{ alignSelf: "center" }}
                >
                  Copy all prev
                </button>
              </>
            )}
          </div>

        {/* Info bar */}
        <div className="ale-info">
          <span>
            {canvasW}&times;{canvasH}px
          </span>
          <span className="ale-info-sep" />
          <span>{zoom}x zoom</span>
          <span className="ale-info-sep" />
          <span>grid {gridSize}px</span>
          <span className="ale-info-sep" />
          <span>
            frame {currentFrame + 1}/{frameCount}
          </span>
          {hoverPixel && (
            <>
              <span className="ale-info-sep" />
              <span>
                ({hoverPixel.x}, {hoverPixel.y})
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Right sidebar: preview + layers ── */}
      <div className="spe-layers">
        {/* Animated preview */}
        <span className="ale-label">Preview</span>
        <div className="spe-preview-frame">
          {/* eslint-disable react-hooks/refs */}
          <AnimatedPreview
            backing={backingRef.current}
            layers={layers}
            frameCount={frameCount}
            fps={previewFps}
            w={canvasW}
            h={canvasH}
            version={version}
            background={background}
          />
          {/* eslint-enable react-hooks/refs */}
        </div>

        <div className="ale-field" style={{ marginTop: 4 }}>
          <span className="ale-field-label">FPS</span>
          <input
            className="ale-num-input"
            type="number"
            value={previewFps}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1 && v <= 60) dispatch(setPreviewFps(v));
            }}
            min={1}
            max={60}
          />
        </div>

        <div className="ale-layer-header">
          <span className="ale-label">Layers</span>
          <button className="ale-icon-btn" onClick={() => dispatch(addLayer())} title="Add layer">
            +
          </button>
        </div>

        {/* Render top-to-bottom: highest index (front) first */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {[...layers].reverse().map((layer) => {
          const idx = layers.indexOf(layer);
          return (
            <div
              key={layer.id}
              className="ale-layer"
              draggable={editingName !== idx}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                if (editingName !== idx) dispatch(setActiveLayerId(layer.id));
              }}
              onDoubleClick={() => setEditingName(idx)}
              data-active={layer.id === activeLayerId}
              data-hidden={!layer.visible}
              data-dragover={dragOverIdx === idx}
              data-dragging={dragIdx === idx}
            >
              <div className="ale-layer-thumb">
                <LayerThumb
                  backing={backingRef.current}
                  layerId={layer.id}
                  frame={currentFrame}
                  w={canvasW}
                  h={canvasH}
                  version={version}
                />
              </div>

              <button
                className={`spe-vis-btn${layer.visible ? "" : " spe-vis-btn--hidden"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(toggleLayerVisibility(idx));
                }}
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? "\u25C9" : "\u25CE"}
              </button>

              {/* Tint picker */}
              <div className="spe-tint" onClick={(e) => e.stopPropagation()}>
                <div
                  className="spe-tint-swatch"
                  style={{ backgroundColor: layer.tint ?? "transparent" }}
                  title={layer.tint ? `Tint: ${layer.tint}` : "No tint"}
                  onClick={() => {
                    const input = document.getElementById(`tint-${layer.id}`) as HTMLInputElement;
                    input?.click();
                  }}
                >
                  {!layer.tint && <span className="spe-tint-none">&ndash;</span>}
                </div>
                <input
                  id={`tint-${layer.id}`}
                  className="spe-tint-input"
                  type="color"
                  value={layer.tint ?? "#ffffff"}
                  onChange={(e) => dispatch(setLayerTint({ idx, tint: e.target.value }))}
                />
                {layer.tint && (
                  <button
                    className="spe-tint-clear"
                    onClick={() => dispatch(setLayerTint({ idx, tint: null }))}
                    title="Clear tint"
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="ale-layer-name">
                {editingName === idx ? (
                  <input
                    className="ale-layer-name-input"
                    autoFocus
                    value={layer.name}
                    placeholder={`Layer ${idx}`}
                    onChange={(e) => dispatch(renameLayer({ idx, name: e.target.value }))}
                    onBlur={() => setEditingName(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setEditingName(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  layer.name || `Layer ${idx}`
                )}
              </div>

              <button
                className="ale-icon-btn ale-icon-btn--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(deleteLayer(idx));
                }}
                title="Delete layer"
              >
                &times;
              </button>
            </div>
          );
        })}

        {activeIdx >= 0 && (
          <div className="ale-info" style={{ marginTop: 6 }}>
            <span>
              layer {activeIdx + 1}/{layers.length}
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Import modal */}
      {importImage && (
        <ImportModal
          image={importImage}
          canvasW={canvasW}
          canvasH={canvasH}
          currentFrameCount={frameCount}
          onImport={performImport}
          onClose={() => setImportImage(null)}
        />
      )}

      {/* Action bar */}
      {(onDone || onCancel) && (
        <div className="spe-done-bar">
          {onCancel && (
            <button className="spe-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          {onDone && (
            <button className="spe-done-btn" onClick={handleDone}>
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
