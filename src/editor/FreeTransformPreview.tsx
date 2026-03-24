import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type {
  AnimationLayer,
  ChannelTint,
  Transform,
} from "~/atproto/generated/types/at/cozy-corner/defs";
import { Entity } from "~/engine/entity";
import { RenderEvent } from "~/engine/event";
import { CompositeRenderBehavior } from "~/engine/behaviors/composite-render";
import { LayerStackRenderBehavior } from "~/engine/behaviors/layer-stack-render";
import {
  LAYERS,
  SPRITE_SHEET,
  TARGET,
  TARGET_START_TIME,
  CHILD_RENDER_CONFIG,
  type ChildRenderConfig,
} from "~/engine/state/render";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewLayer {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  tints: ChannelTint[];
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveTransform(t: Transform | undefined): Transform {
  return {
    a: t?.a ?? 1000,
    b: t?.b ?? 0,
    c: t?.c ?? 0,
    d: t?.d ?? 1000,
    e: t?.e ?? 0,
    f: t?.f ?? 0,
  };
}

const HANDLE_SIZE = 8;
const HANDLE_HIT_RADIUS = HANDLE_SIZE / 2 + 4;

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

type Corner = 0 | 1 | 2 | 3; // TL, TR, BL, BR
const OPPOSITE_CORNER: Record<Corner, Corner> = { 0: 3, 1: 2, 2: 1, 3: 0 };

function getCornerPositions(
  t: Transform,
  fw: number,
  fh: number,
  s: number,
): [number, number][] {
  const sx = t.a / 1000;
  const sy = t.d / 1000;
  const tx = t.e / 1000;
  const ty = t.f / 1000;
  const x1 = tx * s;
  const y1 = ty * s;
  const x2 = (tx + fw * sx) * s;
  const y2 = (ty + fh * sy) * s;
  return [
    [x1, y1],
    [x2, y1],
    [x1, y2],
    [x2, y2],
  ];
}

function hitTest(
  px: number,
  py: number,
  corners: [number, number][],
): { type: "handle"; corner: Corner } | { type: "body" } | null {
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners[i];
    if (
      Math.abs(px - cx) <= HANDLE_HIT_RADIUS &&
      Math.abs(py - cy) <= HANDLE_HIT_RADIUS
    ) {
      return { type: "handle", corner: i as Corner };
    }
  }

  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
    return { type: "body" };
  }

  return null;
}

const CURSOR_FOR_CORNER: Record<Corner, string> = {
  0: "nwse-resize",
  1: "nesw-resize",
  2: "nesw-resize",
  3: "nwse-resize",
};

// ---------------------------------------------------------------------------
// Drag state
// ---------------------------------------------------------------------------

interface DragState {
  type: "translate" | "scale";
  corner?: Corner;
  startX: number;
  startY: number;
  origTransform: Transform;
  anchorX: number; // sprite-space
  anchorY: number;
}

// ---------------------------------------------------------------------------
// FreeTransformPreview
// ---------------------------------------------------------------------------

export function FreeTransformPreview({
  previewLayers,
  transforms,
  selectedIndex,
  onTransformChange,
  size = 192,
  baseTargets,
}: {
  previewLayers: PreviewLayer[];
  transforms: (Transform | undefined)[];
  selectedIndex: number;
  onTransformChange: (index: number, transform: Transform) => void;
  size?: number;
  /** When provided, use these as the selectable animation targets instead of deriving from all layers. */
  baseTargets?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<Entity | null>(null);
  const rafRef = useRef<number>(0);
  const [activeTarget, setActiveTarget] = useState("idle-south");
  // eslint-disable-next-line react-hooks/purity
  const startTimeRef = useRef(performance.now());
  const dragRef = useRef<DragState | null>(null);

  // Overall frame size (max across all layers for active target)
  const frameSize = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const layer of previewLayers) {
      for (const l of layer.layers) {
        if (l.target === activeTarget && l.frames.length > 0) {
          w = Math.max(w, l.frames[0].width);
          h = Math.max(h, l.frames[0].height);
        }
      }
    }
    return { w: w || 32, h: h || 32 };
  }, [previewLayers, activeTarget]);

  // Selected layer's frame size (for scale snapping)
  const selectedFrameSize = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= previewLayers.length)
      return { w: 32, h: 32 };
    const selected = previewLayers[selectedIndex];
    for (const l of selected.layers) {
      if (l.target === activeTarget && l.frames.length > 0) {
        return { w: l.frames[0].width, h: l.frames[0].height };
      }
    }
    if (selected.layers.length > 0 && selected.layers[0].frames.length > 0) {
      return {
        w: selected.layers[0].frames[0].width,
        h: selected.layers[0].frames[0].height,
      };
    }
    return { w: 32, h: 32 };
  }, [previewLayers, selectedIndex, activeTarget]);

  const canvasScale = Math.max(
    1,
    Math.floor(size / Math.max(frameSize.w, frameSize.h)),
  );
  const cw = frameSize.w * canvasScale;
  const ch = frameSize.h * canvasScale;

  // Selected transform (resolved to non-undefined)
  const selectedTransform = useMemo(
    () =>
      selectedIndex >= 0 ? resolveTransform(transforms[selectedIndex]) : null,
    [transforms, selectedIndex],
  );

  // Build entity tree whenever structure or transforms change
  useEffect(() => {
    const root = new Entity([new CompositeRenderBehavior()]);
    const configMap = new Map<Entity, ChildRenderConfig>();

    previewLayers.forEach((layer, i) => {
      const child = new Entity([new LayerStackRenderBehavior()]);
      child.set(LAYERS, layer.layers);
      child.set(SPRITE_SHEET, layer.image);
      child.set(TARGET, activeTarget);
      child.set(TARGET_START_TIME, startTimeRef.current);
      root.addChild(child);

      configMap.set(child, {
        tints: layer.tints,
        transform: transforms[i],
      });
    });

    root.set(CHILD_RENDER_CONFIG, configMap);
    rootRef.current = root;
  }, [previewLayers, activeTarget, transforms]);

  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [activeTarget]);

  // rAF draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = cw;
    canvas.height = ch;

    const sel = selectedTransform;
    const sfw = selectedFrameSize.w;
    const sfh = selectedFrameSize.h;
    const cs = canvasScale;

    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, cw, ch);

      // Checkerboard
      const checkSize = cs * 4;
      for (let cy = 0; cy < ch; cy += checkSize) {
        for (let cx = 0; cx < cw; cx += checkSize) {
          ctx.fillStyle =
            (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0
              ? "#1a2035"
              : "#141a2e";
          ctx.fillRect(cx, cy, checkSize, checkSize);
        }
      }

      // Entity tree
      const root = rootRef.current;
      if (root) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.scale(cs, cs);
        root.emit(new RenderEvent(ctx, time));
        ctx.restore();
      }

      // Selection overlay
      if (sel) {
        const corners = getCornerPositions(sel, sfw, sfh, cs);
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;

        // Dashed outline
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        ctx.setLineDash([]);

        // Corner handles
        ctx.fillStyle = "#22d3ee";
        for (const [hx, hy] of corners) {
          ctx.fillRect(
            hx - HANDLE_SIZE / 2,
            hy - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE,
          );
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cw, ch, canvasScale, selectedTransform, selectedFrameSize]);

  // -------------------------------------------------------------------------
  // Pointer handlers
  // -------------------------------------------------------------------------

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (selectedIndex < 0 || !selectedTransform) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const corners = getCornerPositions(
        selectedTransform,
        selectedFrameSize.w,
        selectedFrameSize.h,
        canvasScale,
      );

      const hit = hitTest(px, py, corners);
      if (!hit) return;

      if (hit.type === "handle") {
        const opp = OPPOSITE_CORNER[hit.corner];
        const [ax, ay] = corners[opp];
        dragRef.current = {
          type: "scale",
          corner: hit.corner,
          startX: px,
          startY: py,
          origTransform: { ...selectedTransform },
          anchorX: ax / canvasScale,
          anchorY: ay / canvasScale,
        };
      } else {
        dragRef.current = {
          type: "translate",
          startX: px,
          startY: py,
          origTransform: { ...selectedTransform },
          anchorX: 0,
          anchorY: 0,
        };
      }

      canvasRef.current!.setPointerCapture(e.pointerId);
    },
    [selectedIndex, selectedTransform, selectedFrameSize, canvasScale],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const drag = dragRef.current;

      // Cursor update when not dragging
      if (!drag) {
        if (selectedIndex >= 0 && selectedTransform) {
          const corners = getCornerPositions(
            selectedTransform,
            selectedFrameSize.w,
            selectedFrameSize.h,
            canvasScale,
          );
          const hit = hitTest(px, py, corners);
          if (hit?.type === "handle") {
            canvas.style.cursor = CURSOR_FOR_CORNER[hit.corner];
          } else if (hit?.type === "body") {
            canvas.style.cursor = "move";
          } else {
            canvas.style.cursor = "default";
          }
        } else {
          canvas.style.cursor = "default";
        }
        return;
      }

      // Active drag
      const fw = selectedFrameSize.w;
      const fh = selectedFrameSize.h;

      if (drag.type === "translate") {
        const dxSprite = (px - drag.startX) / canvasScale;
        const dySprite = (py - drag.startY) / canvasScale;
        const newE =
          Math.round(drag.origTransform.e / 1000 + dxSprite) * 1000;
        const newF =
          Math.round(drag.origTransform.f / 1000 + dySprite) * 1000;
        onTransformChange(selectedIndex, {
          ...drag.origTransform,
          e: newE,
          f: newF,
        });
      } else if (drag.type === "scale") {
        const psx = px / canvasScale;
        const psy = py / canvasScale;

        // Raw distance from anchor to pointer
        let rawW = psx - drag.anchorX;
        let rawH = psy - drag.anchorY;

        // Invert based on which corner is dragged
        // TL(0) and BL(2) → pointer is left of anchor → invert X
        // TL(0) and TR(1) → pointer is above anchor → invert Y
        const corner = drag.corner!;
        const invertX = corner === 0 || corner === 2;
        const invertY = corner === 0 || corner === 1;
        if (invertX) rawW = -rawW;
        if (invertY) rawH = -rawH;

        // Snap to pixel boundaries: rendered pixels = round(rawScale * fw)
        const desiredPxW = Math.max(1, Math.round(rawW));
        const desiredPxH = Math.max(1, Math.round(rawH));
        const snappedSx = desiredPxW / fw;
        const snappedSy = desiredPxH / fh;

        // Translate to keep anchor corner fixed
        let newTx: number;
        let newTy: number;
        if (invertX) {
          newTx = drag.anchorX - fw * snappedSx;
        } else {
          newTx = drag.anchorX;
        }
        if (invertY) {
          newTy = drag.anchorY - fh * snappedSy;
        } else {
          newTy = drag.anchorY;
        }

        onTransformChange(selectedIndex, {
          ...drag.origTransform,
          a: Math.round(snappedSx * 1000),
          d: Math.round(snappedSy * 1000),
          e: Math.round(newTx) * 1000,
          f: Math.round(newTy) * 1000,
        });
      }
    },
    [
      selectedIndex,
      selectedTransform,
      selectedFrameSize,
      canvasScale,
      onTransformChange,
    ],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Available animation targets — derived from baseTargets prop or all layers
  const availableTargets = useMemo(() => {
    if (baseTargets && baseTargets.length > 0) return baseTargets;
    const targetSet = new Set<string>();
    for (const layer of previewLayers) {
      for (const l of layer.layers) {
        targetSet.add(l.target);
      }
    }
    return Array.from(targetSet);
  }, [baseTargets, previewLayers]);

  // Reset activeTarget when available targets change and current is invalid
  useEffect(() => {
    if (availableTargets.length > 0 && !availableTargets.includes(activeTarget)) {
      setActiveTarget(availableTargets[0]);
    }
  }, [availableTargets, activeTarget]);

  return (
    <div>
      <div className="border-2 border-border rounded-sm bg-bg-panel p-4 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            display: "block",
            imageRendering: "pixelated",
            width: cw,
            height: ch,
            touchAction: "none",
          }}
        />
      </div>

      {availableTargets.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {availableTargets.map((target) => (
            <button
              key={target}
              onClick={() => setActiveTarget(target)}
              className={`font-heading text-[10px] px-2.5 py-1.5 rounded-sm border-2 cursor-pointer ${
                activeTarget === target
                  ? "bg-accent-primary/15 border-accent-primary text-accent-primary"
                  : "bg-bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary"
              }`}
            >
              {target}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
