import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Layer } from './canvas/layer';
import { type PixelBuffer, scale as scaleBuffer, rotate as rotateBuffer, flip as flipBuffer } from './canvas/pixel-buffer';
import { floodFill } from './canvas/fill';
import type { DrawingTool } from './canvas/stamp';
import { generateStamp } from './canvas/stamp';
import { applyTool } from './canvas/tool';

export interface CanvasState {
    width: number;
    height: number;
    layers: Layer[];
    /** The primary layer — receives paint operations. */
    activeLayerId: number;
    /** All selected layer ids (always includes activeLayerId). */
    selectedLayerIds: number[];
    currentFrame: number;
    /** Animation frame rate in FPS. */
    frameRate: number;
}

const initialState: CanvasState = {
    width: 16,
    height: 16,
    layers: [],
    activeLayerId: -1,
    selectedLayerIds: [],
    currentFrame: 0,
    frameRate: 8,
};

export const canvasSlice = createSlice({
    name: 'canvas',
    initialState,
    reducers: {
        addLayer(state, action: PayloadAction<Layer>) {
            state.layers.push(action.payload);
            if (state.activeLayerId === -1) {
                state.activeLayerId = action.payload.id;
                state.selectedLayerIds = [action.payload.id];
            }
        },
        removeLayer(state, action: PayloadAction<number>) {
            state.layers = state.layers.filter((l) => l.id !== action.payload);
            state.selectedLayerIds = state.selectedLayerIds.filter((id) => id !== action.payload);
            if (state.activeLayerId === action.payload) {
                state.activeLayerId = state.selectedLayerIds[0] ?? state.layers[0]?.id ?? -1;
                if (state.selectedLayerIds.length === 0 && state.activeLayerId !== -1) {
                    state.selectedLayerIds = [state.activeLayerId];
                }
            }
        },
        /** Select a single layer (clears multi-select). */
        setActiveLayer(state, action: PayloadAction<number>) {
            state.activeLayerId = action.payload;
            state.selectedLayerIds = [action.payload];
        },
        /** Toggle a layer in/out of the selection. Cannot deselect the last one. */
        toggleLayerSelection(state, action: PayloadAction<number>) {
            const id = action.payload;
            const idx = state.selectedLayerIds.indexOf(id);
            if (idx >= 0) {
                if (state.selectedLayerIds.length <= 1) return;
                state.selectedLayerIds.splice(idx, 1);
                if (state.activeLayerId === id) {
                    state.activeLayerId = state.selectedLayerIds[0];
                }
            } else {
                state.selectedLayerIds.push(id);
                state.activeLayerId = id;
            }
        },
        renameLayer(state, action: PayloadAction<{ id: number; name: string }>) {
            const layer = state.layers.find((l) => l.id === action.payload.id);
            if (layer) layer.name = action.payload.name;
        },
        setLayerColorChannel(state, action: PayloadAction<{ id: number; colorChannel: string }>) {
            const layer = state.layers.find((l) => l.id === action.payload.id);
            if (layer) layer.colorChannel = action.payload.colorChannel;
        },
        setLayerZIndex(state, action: PayloadAction<{ id: number; zIndex: number }>) {
            const layer = state.layers.find((l) => l.id === action.payload.id);
            if (layer) layer.zIndex = action.payload.zIndex;
        },
        moveSelectedLayers(state, action: PayloadAction<{ dx: number; dy: number; frame: number; allFrames?: boolean }>) {
            const { dx, dy, frame, allFrames } = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer) continue;
                const indices = allFrames ? layer.frames.map((_, i) => i) : [frame];
                for (const fi of indices) {
                    const f = layer.frames[fi];
                    if (!f) continue;
                    f.xOffset += dx;
                    f.yOffset += dy;
                }
            }
        },
        scaleSelectedLayers(state, action: PayloadAction<{ factor: number; frame: number; allFrames?: boolean }>) {
            const { factor, frame, allFrames } = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer) continue;
                const indices = allFrames ? layer.frames.map((_, i) => i) : [frame];
                for (const fi of indices) {
                    const f = layer.frames[fi];
                    if (!f) continue;
                    layer.frames[fi] = scaleBuffer(f, factor);
                }
            }
        },
        scaleXYSelectedLayers(state, action: PayloadAction<{ sx: number; sy: number; frame: number; allFrames?: boolean }>) {
            const { sx, sy, frame, allFrames } = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer) continue;
                const indices = allFrames ? layer.frames.map((_, i) => i) : [frame];
                for (const fi of indices) {
                    const f = layer.frames[fi];
                    if (!f) continue;
                    layer.frames[fi] = scaleBuffer(f, sx, sy);
                }
            }
        },
        rotateSelectedLayers(state, action: PayloadAction<{ angle: number; frame: number; allFrames?: boolean }>) {
            const { angle, frame, allFrames } = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer) continue;
                const indices = allFrames ? layer.frames.map((_, i) => i) : [frame];
                for (const fi of indices) {
                    const f = layer.frames[fi];
                    if (!f) continue;
                    layer.frames[fi] = rotateBuffer(f, angle);
                }
            }
        },
        flipSelectedLayers(state, action: PayloadAction<{ direction: 'horizontal' | 'vertical'; frame: number; allFrames?: boolean }>) {
            const { direction, frame, allFrames } = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer) continue;
                const indices = allFrames ? layer.frames.map((_, i) => i) : [frame];
                for (const fi of indices) {
                    const f = layer.frames[fi];
                    if (!f) continue;
                    layer.frames[fi] = flipBuffer(f, direction);
                }
            }
        },
        addFrameToSelectedLayers(state, action: PayloadAction<{ canvasWidth: number; canvasHeight: number }>) {
            const { canvasWidth, canvasHeight } = action.payload;
            let maxFrames = 0;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer) continue;
                const nextId = layer.frames.length === 0
                    ? 0
                    : Math.max(...layer.frames.map((f) => f.id)) + 1;
                layer.frames.push({
                    id: nextId,
                    width: canvasWidth,
                    xOffset: 0,
                    yOffset: 0,
                    pixelData: new Uint32Array(canvasWidth * canvasHeight),
                });
                maxFrames = Math.max(maxFrames, layer.frames.length);
            }
            state.currentFrame = maxFrames - 1;
        },
        duplicateFrameToSelectedLayers(state) {
            let maxFrames = 0;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer || layer.frames.length === 0) continue;
                const src = layer.frames[state.currentFrame] ?? layer.frames[layer.frames.length - 1];
                const nextId = Math.max(...layer.frames.map((f) => f.id)) + 1;
                layer.frames.push({
                    id: nextId,
                    width: src.width,
                    xOffset: src.xOffset,
                    yOffset: src.yOffset,
                    pixelData: new Uint32Array(src.pixelData),
                });
                maxFrames = Math.max(maxFrames, layer.frames.length);
            }
            state.currentFrame = maxFrames - 1;
        },
        removeFrameFromSelectedLayers(state, action: PayloadAction<number>) {
            const frameIndex = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer || layer.frames.length <= 1) continue;
                if (frameIndex < layer.frames.length) {
                    layer.frames.splice(frameIndex, 1);
                }
            }
            const maxFrames = Math.max(1, ...state.layers.map((l) => l.frames.length));
            if (state.currentFrame >= maxFrames) {
                state.currentFrame = maxFrames - 1;
            }
        },
        reorderFrames(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
            const { fromIndex, toIndex } = action.payload;
            for (const id of state.selectedLayerIds) {
                const layer = state.layers.find((l) => l.id === id);
                if (!layer || fromIndex >= layer.frames.length || toIndex >= layer.frames.length) continue;
                const [moved] = layer.frames.splice(fromIndex, 1);
                layer.frames.splice(toIndex, 0, moved);
            }
            // Follow the moved frame
            if (state.currentFrame === fromIndex) {
                state.currentFrame = toIndex;
            } else if (fromIndex < state.currentFrame && toIndex >= state.currentFrame) {
                state.currentFrame--;
            } else if (fromIndex > state.currentFrame && toIndex <= state.currentFrame) {
                state.currentFrame++;
            }
        },
        toggleLayerVisibility(state, action: PayloadAction<number>) {
            const layer = state.layers.find((l) => l.id === action.payload);
            if (layer) layer.hidden = !layer.hidden;
        },
        setCanvasSize(state, action: PayloadAction<{ width: number; height: number }>) {
            state.width = Math.max(1, Math.round(action.payload.width));
            state.height = Math.max(1, Math.round(action.payload.height));
        },
        setFrameRate(state, action: PayloadAction<number>) {
            state.frameRate = Math.max(1, Math.min(60, action.payload));
        },
        setCurrentFrame(state, action: PayloadAction<number>) {
            state.currentFrame = Math.max(0, action.payload);
        },
        reorderLayers(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
            const { fromIndex, toIndex } = action.payload;
            const [moved] = state.layers.splice(fromIndex, 1);
            state.layers.splice(toIndex, 0, moved);
        },
        paintAtPoint(
            state,
            action: PayloadAction<{
                x: number;
                y: number;
                tool: DrawingTool;
                radius: number;
                color: number;
                opacity: number;
                frame: number;
            }>,
        ) {
            const { x, y, tool, radius, color, opacity, frame } = action.payload;
            const layer = state.layers.find(
                (l) => l.id === state.activeLayerId,
            );
            if (!layer || layer.hidden || frame >= layer.frames.length) return;

            const stamp = generateStamp(tool, radius, color, opacity);
            const mode = tool === 'brush' ? 'over' as const : 'set' as const;
            const half = ((stamp.width - 1) / 2) | 0;
            layer.frames[frame] = applyTool(layer.frames[frame], stamp, x - half, y - half, mode);
        },
        fillAtPoint(
            state,
            action: PayloadAction<{
                x: number;
                y: number;
                color: number;
                frame: number;
            }>,
        ) {
            const { x, y, color, frame } = action.payload;
            const layer = state.layers.find(
                (l) => l.id === state.activeLayerId,
            );
            if (!layer || layer.hidden || frame >= layer.frames.length) return;

            layer.frames[frame] = floodFill(layer.frames[frame], x, y, color);
        },
        appendFramesToActiveLayer(state, action: PayloadAction<PixelBuffer[]>) {
            const layer = state.layers.find((l) => l.id === state.activeLayerId);
            if (!layer) return;
            let nextId = layer.frames.length === 0
                ? 0
                : Math.max(...layer.frames.map((f) => f.id)) + 1;
            for (const frame of action.payload) {
                layer.frames.push({ ...frame, id: nextId++ });
            }
            state.currentFrame = layer.frames.length - 1;
        },
    },
    selectors: {
        selectCanvasSize: (state) => ({ width: state.width, height: state.height }),
        selectLayers: (state) => state.layers,
        selectActiveLayerId: (state) => state.activeLayerId,
        selectSelectedLayerIds: (state) => state.selectedLayerIds,
        selectCurrentFrame: (state) => state.currentFrame,
        selectActiveLayer: (state) =>
            state.layers.find((l) => l.id === state.activeLayerId),
        selectFrameRate: (state) => state.frameRate,
    },
});

export const { addLayer, removeLayer, renameLayer, setLayerColorChannel, setLayerZIndex, moveSelectedLayers, scaleSelectedLayers, scaleXYSelectedLayers, rotateSelectedLayers, flipSelectedLayers, addFrameToSelectedLayers, duplicateFrameToSelectedLayers, removeFrameFromSelectedLayers, reorderFrames, setActiveLayer, toggleLayerSelection, setCanvasSize, setFrameRate, setCurrentFrame, toggleLayerVisibility, reorderLayers, paintAtPoint, fillAtPoint, appendFramesToActiveLayer } =
    canvasSlice.actions;
export const { selectCanvasSize, selectLayers, selectActiveLayerId, selectSelectedLayerIds, selectCurrentFrame, selectActiveLayer, selectFrameRate } =
    canvasSlice.selectors;

export interface PendingTransform {
    rotation: number;   // radians
    scale: number;      // factor (1 = no change)
}

/**
 * Return layers with a pending transform applied to selected layers' current frame.
 * This is a pure function — no state mutation, just a derived view for rendering.
 */
export function selectTransformedLayers(
    state: CanvasState,
    pending: PendingTransform,
): Layer[] {
    if (pending.rotation === 0 && pending.scale === 1) return state.layers;

    const selected = new Set(state.selectedLayerIds);
    const frame = state.currentFrame;

    return state.layers.map((layer) => {
        if (!selected.has(layer.id)) return layer;
        const f = layer.frames[frame];
        if (!f || f.width === 0 || f.pixelData.length === 0) return layer;

        let transformed = f;
        if (pending.scale !== 1) {
            transformed = scaleBuffer(transformed, pending.scale);
        }
        if (pending.rotation !== 0) {
            transformed = rotateBuffer(transformed, pending.rotation);
        }

        const newFrames = [...layer.frames];
        newFrames[frame] = transformed;
        return { ...layer, frames: newFrames };
    });
}
