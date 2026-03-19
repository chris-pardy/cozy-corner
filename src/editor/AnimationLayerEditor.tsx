import { useState, useRef, useEffect, useCallback } from "react";
import type { AnimationLayer, AnimationFrame } from "~/atproto/generated/types/at/cozy-corner/defs";
import { drawCheckerboard } from "./drawCheckerboard";
import { hexToRgba } from "./color-utils";
import { AnimationPreview } from "./AnimationPreview";
import "./editor.css";

export type LayerEvent =
  | { type: "add"; layer: AnimationLayer }
  | { type: "update"; index: number; patch: Partial<AnimationLayer> }
  | { type: "move"; fromIndex: number; toIndex: number }
  | { type: "delete"; index: number };

export type AnimationLayerEditorProps = {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  target: string;
  /** Index into `layers` for the currently active layer. */
  activeLayer: number | null;
  onChangeActiveLayer: (index: number | null) => void;
  onLayerEvent: (event: LayerEvent) => void;
};

type ALETool = "position" | "resize" | "rotation";
type Scope = "selected" | "all";

const ACTIVE_COLOR = "#22d3ee";
const SELECTED_FRAME_COLOR = "#f6ad55";

export function AnimationLayerEditor({
  image,
  layers,
  target,
  activeLayer,
  onChangeActiveLayer,
  onLayerEvent,
}: AnimationLayerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(2);
  const [hoverCell, setHoverCell] = useState<{
    col: number;
    row: number;
  } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [activeTool, setActiveTool] = useState<ALETool>("position");
  const [scope, setScope] = useState<Scope>("selected");

  const imgWidth = image.naturalWidth;
  const imgHeight = image.naturalHeight;
  const canvasWidth = imgWidth * zoom;
  const canvasHeight = imgHeight * zoom;

  const active = activeLayer != null ? layers[activeLayer] ?? null : null;
  const activeFrame = active
    ? active.frames[Math.min(selectedFrameIdx, active.frames.length - 1)] ?? null
    : null;

  // Reset selected frame when switching layers
  useEffect(() => {
    queueMicrotask(() => setSelectedFrameIdx(0));
  }, [activeLayer]);

  const updateLayer = useCallback(
    (index: number, patch: Partial<AnimationLayer>) => {
      onLayerEvent({ type: "update", index, patch });
    },
    [onLayerEvent],
  );

  const updateFrame = useCallback(
    (layerIndex: number, frameIndex: number, framePatch: Partial<AnimationFrame>) => {
      const layer = layers[layerIndex];
      if (!layer) return;
      const newFrames = layer.frames.map((f, i) =>
        i === frameIndex ? { ...f, ...framePatch } : f,
      );
      updateLayer(layerIndex, { frames: newFrames });
    },
    [layers, updateLayer],
  );

  const updateAllFrames = useCallback(
    (layerIndex: number, patch: Partial<AnimationFrame>) => {
      const layer = layers[layerIndex];
      if (!layer) return;
      updateLayer(layerIndex, {
        frames: layer.frames.map((f) => ({ ...f, ...patch })),
      });
    },
    [layers, updateLayer],
  );

  /** Apply a frame patch respecting the current scope. */
  const applyToScope = useCallback(
    (layerIndex: number, frameIndex: number, patch: Partial<AnimationFrame>) => {
      if (scope === "all") {
        updateAllFrames(layerIndex, patch);
      } else {
        updateFrame(layerIndex, frameIndex, patch);
      }
    },
    [scope, updateAllFrames, updateFrame],
  );

  // Grid geometry — cells use the selected frame's W/H.
  const gridOf = useCallback(
    (frame: AnimationFrame) => {
      const fw = frame.width * zoom;
      const fh = frame.height * zoom;
      const ox = frame.x * zoom;
      const oy = frame.y * zoom;

      const startX = ox - Math.ceil(ox / fw) * fw;
      const startY = oy - Math.ceil(oy / fh) * fh;

      const cols = Math.floor((canvasWidth - startX) / fw);
      const rows = Math.floor((canvasHeight - startY) / fh);

      return { fw, fh, ox, oy, startX, startY, cols, rows };
    },
    [zoom, canvasWidth, canvasHeight],
  );

  // Pixel position from mouse event
  const eventToPx = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        px: (e.clientX - rect.left) * (canvas.width / rect.width),
        py: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    },
    [],
  );

  const eventToCell = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeFrame) return null;
      const pos = eventToPx(e);
      if (!pos) return null;
      const { px, py } = pos;

      const { fw, fh, startX, startY, cols, rows } = gridOf(activeFrame);
      const col = Math.floor((px - startX) / fw);
      const row = Math.floor((py - startY) / fh);
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        return { col, row };
      }
      return null;
    },
    [activeFrame, gridOf, eventToPx],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool === "position") {
        setHoverCell(eventToCell(e));
      } else {
        setHoverCell(null);
      }
    },
    [activeTool, eventToCell],
  );

  // Click on canvas: only active for Position tool.
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool !== "position") return;
      if (activeLayer == null || !active || !activeFrame) return;
      const cell = eventToCell(e);
      if (!cell) return;
      const { startX, startY, fw, fh } = gridOf(activeFrame);
      const newX = (startX + cell.col * fw) / zoom;
      const newY = (startY + cell.row * fh) / zoom;
      const fi = Math.min(selectedFrameIdx, active.frames.length - 1);
      applyToScope(activeLayer, fi, { x: newX, y: newY });
    },
    [activeTool, activeLayer, active, activeFrame, eventToCell, gridOf, zoom, selectedFrameIdx, applyToScope],
  );

  // -- Layer drag-and-drop reorder --
  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx == null || idx === dragIdx) return;
      setDragOverIdx(idx);
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (idx: number) => {
      if (dragIdx == null || dragIdx === idx) return;
      onLayerEvent({ type: "move", fromIndex: dragIdx, toIndex: idx });
      if (activeLayer != null) {
        if (activeLayer === dragIdx) {
          onChangeActiveLayer(idx);
        } else if (dragIdx < activeLayer && idx >= activeLayer) {
          onChangeActiveLayer(activeLayer - 1);
        } else if (dragIdx > activeLayer && idx <= activeLayer) {
          onChangeActiveLayer(activeLayer + 1);
        }
      }
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, activeLayer, onLayerEvent, onChangeActiveLayer],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  // -- Draw canvas --
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. Checkerboard
    drawCheckerboard(ctx, canvasWidth, canvasHeight, zoom);

    // 2. Sprite sheet
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    // 3. Active layer grid + frame highlights
    if (active && activeFrame) {
      const { fw, fh, startX, startY, cols, rows } = gridOf(activeFrame);

      // Highlight all frames in the layer
      ctx.fillStyle = hexToRgba(ACTIVE_COLOR, 0.15);
      for (const frame of active.frames) {
        const fx = frame.x * zoom;
        const fy = frame.y * zoom;
        const ffw = frame.width * zoom;
        const ffh = frame.height * zoom;
        if (fx + ffw <= canvasWidth && fy + ffh <= canvasHeight) {
          ctx.fillRect(fx, fy, ffw, ffh);
        }
      }

      // Highlight selected frame more prominently
      const fi = Math.min(selectedFrameIdx, active.frames.length - 1);
      const selFrame = active.frames[fi];
      if (selFrame) {
        ctx.fillStyle = hexToRgba(SELECTED_FRAME_COLOR, 0.25);
        ctx.fillRect(selFrame.x * zoom, selFrame.y * zoom, selFrame.width * zoom, selFrame.height * zoom);
        ctx.strokeStyle = hexToRgba(SELECTED_FRAME_COLOR, 0.8);
        ctx.lineWidth = 2;
        ctx.strokeRect(selFrame.x * zoom, selFrame.y * zoom, selFrame.width * zoom, selFrame.height * zoom);
      }

      // Grid lines
      ctx.strokeStyle = hexToRgba(ACTIVE_COLOR, 0.4);
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
    }

    // 4. Hover highlight (only with position tool)
    if (hoverCell && activeFrame) {
      const { fw, fh, startX, startY } = gridOf(activeFrame);
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(
        startX + hoverCell.col * fw,
        startY + hoverCell.row * fh,
        fw,
        fh,
      );
    }
  }, [image, active, activeFrame, zoom, canvasWidth, canvasHeight, hoverCell, gridOf, selectedFrameIdx]);

  const handleAddLayer = useCallback(() => {
    const defaultW = activeFrame?.width ?? 48;
    const defaultH = activeFrame?.height ?? 48;
    const newLayer: AnimationLayer = {
      target,
      frames: [{ x: 0, y: 0, width: defaultW, height: defaultH }],
      frameRate: active?.frameRate ?? 100,
    };
    onLayerEvent({ type: "add", layer: newLayer });
    onChangeActiveLayer(layers.length);
  }, [layers.length, target, active, activeFrame, onLayerEvent, onChangeActiveLayer]);

  return (
    <div className="ale-root">
      {/* Left: preview + layer list */}
      <div className="ale-sidebar">
        {/* Animation preview */}
        <div className="ale-label">Preview</div>
        <div className="ale-preview-frame">
          <AnimationPreview
            image={image}
            layers={layers}
            target={target}
          />
        </div>

        {/* Layer list */}
        <div className="ale-layer-header">
          <span className="ale-label">Layers</span>
          <button
            className="ale-icon-btn"
            onClick={handleAddLayer}
            title="Add layer"
          >
            +
          </button>
        </div>
        {layers.map((layer, idx) => (
          <div
            key={idx}
            className="ale-layer"
            draggable={editingName !== idx}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            onClick={() => {
              if (editingName !== idx) {
                onChangeActiveLayer(activeLayer === idx ? null : idx);
              }
            }}
            onDoubleClick={() => setEditingName(idx)}
            data-active={activeLayer === idx}
            data-dragover={dragOverIdx === idx}
            data-dragging={dragIdx === idx}
          >
            {/* Per-layer animated thumbnail */}
            <div className="ale-layer-thumb">
              <AnimationPreview
                image={image}
                layers={[layer]}
                target={target}
                size={36}
              />
            </div>

            {/* Name */}
            <div className="ale-layer-name">
              {editingName === idx ? (
                <input
                  className="ale-layer-name-input"
                  autoFocus
                  value={layer.layerName ?? ""}
                  placeholder={`Layer ${idx}`}
                  onChange={(e) =>
                    updateLayer(idx, {
                      layerName: e.target.value || undefined,
                    })
                  }
                  onBlur={() => setEditingName(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingName(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                layer.layerName || `Layer ${idx}`
              )}
            </div>

            {/* Delete button */}
            <button
              className="ale-icon-btn ale-icon-btn--danger"
              onClick={(e) => {
                e.stopPropagation();
                onLayerEvent({ type: "delete", index: idx });
                if (activeLayer === idx) {
                  onChangeActiveLayer(null);
                } else if (activeLayer != null && activeLayer > idx) {
                  onChangeActiveLayer(activeLayer - 1);
                }
              }}
              title="Delete layer"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Center: canvas + controls */}
      <div className="ale-main">
        {/* Zoom controls */}
        <div className="ale-toolbar">
          <button
            className="ale-zoom-btn"
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
          >
            &minus;
          </button>
          <span className="ale-zoom-display">{zoom}x</span>
          <button
            className="ale-zoom-btn"
            onClick={() => setZoom((z) => Math.min(8, z + 1))}
          >
            +
          </button>
        </div>

        {/* Canvas */}
        <div className="ale-viewport">
          <canvas
            ref={canvasRef}
            className="ale-canvas"
            style={{ cursor: activeTool === "position" ? "crosshair" : "default" }}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverCell(null)}
          />
        </div>

        {/* Info bar */}
        <div className="ale-info">
          <span>
            {imgWidth}&times;{imgHeight}px
          </span>
          <span className="ale-info-sep" />
          <span>{zoom}x zoom</span>
          {hoverCell && (
            <>
              <span className="ale-info-sep" />
              <span>
                ({hoverCell.col}, {hoverCell.row})
              </span>
            </>
          )}
        </div>

        {/* Active layer properties */}
        {activeLayer != null && active && (
          <LayerProperties
            layer={active}
            imgWidth={imgWidth}
            imgHeight={imgHeight}
            selectedFrameIdx={selectedFrameIdx}
            onSelectFrame={setSelectedFrameIdx}
            activeTool={activeTool}
            onChangeTool={setActiveTool}
            scope={scope}
            onChangeScope={setScope}
            onChange={(patch) => updateLayer(activeLayer, patch)}
            onApplyToScope={(fi, patch) => applyToScope(activeLayer, fi, patch)}
          />
        )}
      </div>
    </div>
  );
}

// -- Tool definitions --

const TOOLS: { id: ALETool; icon: string; label: string }[] = [
  { id: "position", icon: "\u271B", label: "Position" },
  { id: "resize", icon: "\u2922", label: "Resize" },
  { id: "rotation", icon: "\u21BB", label: "Rotation" },
];

// -- Layer property controls --

function LayerProperties({
  layer,
  imgWidth,
  imgHeight,
  selectedFrameIdx,
  onSelectFrame,
  activeTool,
  onChangeTool,
  scope,
  onChangeScope,
  onChange,
  onApplyToScope,
}: {
  layer: AnimationLayer;
  imgWidth: number;
  imgHeight: number;
  selectedFrameIdx: number;
  onSelectFrame: (idx: number) => void;
  activeTool: ALETool;
  onChangeTool: (tool: ALETool) => void;
  scope: Scope;
  onChangeScope: (scope: Scope) => void;
  onChange: (patch: Partial<AnimationLayer>) => void;
  onApplyToScope: (frameIndex: number, patch: Partial<AnimationFrame>) => void;
}) {
  const fi = Math.min(selectedFrameIdx, layer.frames.length - 1);
  const frame = layer.frames[fi];

  const addFrame = useCallback(() => {
    const last = layer.frames[layer.frames.length - 1];
    const newFrame: AnimationFrame = last
      ? { ...last, transform: undefined }
      : { x: 0, y: 0, width: 48, height: 48 };
    onChange({ frames: [...layer.frames, newFrame] });
    onSelectFrame(layer.frames.length);
  }, [layer.frames, onChange, onSelectFrame]);

  const duplicateFrame = useCallback(() => {
    if (!frame) return;
    const newFrames = [...layer.frames];
    newFrames.splice(fi + 1, 0, { ...frame });
    onChange({ frames: newFrames });
    onSelectFrame(fi + 1);
  }, [frame, fi, layer.frames, onChange, onSelectFrame]);

  const deleteFrame = useCallback(() => {
    if (layer.frames.length <= 1) return;
    const newFrames = layer.frames.filter((_, i) => i !== fi);
    onChange({ frames: newFrames });
    onSelectFrame(Math.min(fi, newFrames.length - 1));
  }, [fi, layer.frames, onChange, onSelectFrame]);

  // Rotation: extract degrees from transform
  const frameRotation = frame?.transform
    ? Math.round(Math.atan2(frame.transform.b ?? 0, frame.transform.a ?? 1000) * (180 / Math.PI))
    : 0;

  const setRotation = useCallback(
    (deg: number) => {
      if (deg === 0) {
        onApplyToScope(fi, { transform: undefined });
      } else {
        const rad = (deg * Math.PI) / 180;
        onApplyToScope(fi, {
          transform: {
            a: Math.round(Math.cos(rad) * 1000),
            b: Math.round(Math.sin(rad) * 1000),
            c: Math.round(-Math.sin(rad) * 1000),
            d: Math.round(Math.cos(rad) * 1000),
            e: 0,
            f: 0,
          },
        });
      }
    },
    [fi, onApplyToScope],
  );

  return (
    <div className="ale-props">
      {/* Tool bar + scope toggle */}
      <div className="ale-tool-bar">
        <div className="ale-tool-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`ale-tool${activeTool === t.id ? " ale-tool--active" : ""}`}
              onClick={() => onChangeTool(t.id)}
            >
              <span className="ale-tool-icon">{t.icon}</span>
              <span className="ale-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          className={`ale-scope-btn${scope === "all" ? " ale-scope-btn--active" : ""}`}
          onClick={() => onChangeScope(scope === "selected" ? "all" : "selected")}
        >
          {scope === "all" ? "All frames" : "This frame"}
        </button>
      </div>

      {/* Tool-specific fields */}
      {frame && activeTool === "position" && (
        <div className="ale-tool-fields">
          <Field label="X">
            <NumInput
              value={frame.x}
              onChange={(v) => onApplyToScope(fi, { x: v })}
              min={0}
              max={imgWidth - 1}
            />
            <span className="ale-field-unit">px</span>
          </Field>
          <Field label="Y">
            <NumInput
              value={frame.y}
              onChange={(v) => onApplyToScope(fi, { y: v })}
              min={0}
              max={imgHeight - 1}
            />
            <span className="ale-field-unit">px</span>
          </Field>
        </div>
      )}
      {frame && activeTool === "resize" && (
        <div className="ale-tool-fields">
          <Field label="W">
            <NumInput
              value={frame.width}
              onChange={(v) => onApplyToScope(fi, { width: v })}
              min={1}
              max={imgWidth}
            />
          </Field>
          <Field label="H">
            <NumInput
              value={frame.height}
              onChange={(v) => onApplyToScope(fi, { height: v })}
              min={1}
              max={imgHeight}
            />
          </Field>
        </div>
      )}
      {frame && activeTool === "rotation" && (
        <div className="ale-tool-fields">
          <Field label="Deg">
            <NumInput
              value={frameRotation}
              onChange={setRotation}
              min={-360}
              max={360}
            />
            <span className="ale-field-unit">deg</span>
          </Field>
        </div>
      )}

      {/* FPS (always visible, layer-level) */}
      <div className="ale-fps-row">
        <Field label="FPS">
          <NumInput
            value={Math.round(1000 / layer.frameRate)}
            onChange={(v) => onChange({ frameRate: Math.round(1000 / v) })}
            min={1}
            max={60}
          />
        </Field>
      </div>

      {/* Frame list */}
      <div className="ale-frame-list-header">
        <span className="ale-field-label">Frames ({layer.frames.length})</span>
        <button className="ale-icon-btn" onClick={addFrame} title="Add frame">+</button>
        <button className="ale-icon-btn" onClick={duplicateFrame} title="Duplicate frame">&#x2398;</button>
        {layer.frames.length > 1 && (
          <button className="ale-icon-btn ale-icon-btn--danger" onClick={deleteFrame} title="Delete frame">&times;</button>
        )}
      </div>
      <div className="ale-frame-list">
        {layer.frames.map((f, i) => (
          <button
            key={i}
            className="ale-frame-item"
            data-selected={i === fi}
            onClick={() => onSelectFrame(i)}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ale-field">
      <span className="ale-field-label">{label}</span>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      className="ale-num-input"
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      min={min}
      max={max}
    />
  );
}
