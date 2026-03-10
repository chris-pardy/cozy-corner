import { useState, useRef, useEffect, useCallback } from "react";
import type { AnimationFrames } from "../../models/animation";
import {
  renderSpriteSheet,
  spriteSheetDimensions,
} from "../../engine/renderers/spriteSheet";
import { drawCheckerboard } from "../../engine/renders/drawCheckerboard";

export type AnimationFramesEditorProps = {
  animationFrames: AnimationFrames;
  onChange: (animationFrames: AnimationFrames) => void;
};

const DIRECTIONS = [
  "horizontal",
  "horizontal-reverse",
  "vertical",
  "vertical-reverse",
] as const;

export function AnimationFramesEditor({
  animationFrames,
  onChange,
}: AnimationFramesEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(2);
  const [hoverCell, setHoverCell] = useState<{
    col: number;
    row: number;
  } | null>(null);

  const fw = animationFrames.frameWidth;
  const fh = animationFrames.frameHeight;
  const image = animationFrames.image;

  const imgWidth =
    "width" in image ? (image.width as number) : image.displayWidth;
  const imgHeight =
    "height" in image ? (image.height as number) : image.displayHeight;

  const gridCols = Math.floor(imgWidth / fw);
  const gridRows = Math.floor(imgHeight / fh);

  const update = useCallback(
    (patch: Partial<Omit<AnimationFrames, "image">>) => {
      onChange({ ...animationFrames, ...patch });
    },
    [animationFrames, onChange],
  );

  const eventToCell = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (canvas.width / rect.width);
      const py = (e.clientY - rect.top) * (canvas.height / rect.height);
      const col = Math.floor(px / (fw * zoom));
      const row = Math.floor(py / (fh * zoom));
      if (col >= 0 && col < gridCols && row >= 0 && row < gridRows)
        return { col, row };
      return null;
    },
    [fw, fh, zoom, gridCols, gridRows],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = eventToCell(e);
      if (!cell) return;
      update({
        sourceX: cell.col * fw,
        sourceY: cell.row * fh,
      });
    },
    [eventToCell, fw, fh, update],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setHoverCell(eventToCell(e));
    },
    [eventToCell],
  );

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = spriteSheetDimensions(image, zoom);
    canvas.width = width;
    canvas.height = height;

    drawCheckerboard(ctx, width, height, zoom);

    renderSpriteSheet({
      animationFrames,
      context: ctx,
      scale: zoom,
    });

    // Hover highlight
    if (hoverCell) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(
        hoverCell.col * fw * zoom,
        hoverCell.row * fh * zoom,
        fw * zoom,
        fh * zoom,
      );
    }
  }, [animationFrames, zoom, hoverCell, image, fw, fh]);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <FieldGroup label="Frame W">
          <NumInput
            value={fw}
            onChange={(v) => update({ frameWidth: v })}
            min={1}
            max={imgWidth}
          />
        </FieldGroup>

        <FieldGroup label="Frame H">
          <NumInput
            value={fh}
            onChange={(v) => update({ frameHeight: v })}
            min={1}
            max={imgHeight}
          />
        </FieldGroup>

        <FieldGroup label="Frames">
          <NumInput
            value={animationFrames.frameCount ?? 1}
            onChange={(v) => update({ frameCount: v })}
            min={1}
            max={Math.max(gridCols, gridRows)}
          />
        </FieldGroup>

        <FieldGroup label="Duration">
          <NumInput
            value={animationFrames.frameDuration ?? 100}
            onChange={(v) => update({ frameDuration: v })}
            min={1}
            max={10000}
          />
          <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>
            ms
          </span>
        </FieldGroup>

        <FieldGroup label="Direction">
          <select
            className="input input-sm"
            value={animationFrames.direction ?? "horizontal"}
            onChange={(e) =>
              update({
                direction: e.target.value as AnimationFrames["direction"],
              })
            }
            style={{ width: "auto" }}
          >
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </FieldGroup>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginLeft: "auto",
          }}
        >
          <span style={{ color: "var(--color-text-secondary)" }}>Zoom:</span>
          <button
            className="btn btn-sm"
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
          >
            -
          </button>
          <span
            style={{
              color: "var(--color-text-primary)",
              minWidth: 28,
              textAlign: "center",
            }}
          >
            {zoom}x
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setZoom((z) => Math.min(8, z + 1))}
          >
            +
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          {imgWidth}x{imgHeight}px
        </span>
        <span>
          {gridCols}x{gridRows} grid
        </span>
        <span>
          Origin: ({animationFrames.sourceX}, {animationFrames.sourceY})
        </span>
      </div>

      {/* Canvas */}
      <div
        style={{
          maxHeight: 500,
          overflow: "auto",
          borderRadius: 2,
          border: "2px solid var(--color-border)",
          background: "var(--color-bg-surface)",
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCell(null)}
          style={{
            display: "block",
            cursor: "crosshair",
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}

// -- Internal helpers --

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>
        {label}:
      </span>
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
      type="number"
      className="input input-sm"
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      min={min}
      max={max}
      style={{ width: 56, textAlign: "center" }}
    />
  );
}
