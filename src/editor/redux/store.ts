import { configureStore } from '@reduxjs/toolkit';
import { toolsSlice } from './tools-slice';
import { paletteSlice } from './palette-slice';
import { canvasSlice, paintAtPoint, fillAtPoint } from './canvas-slice';
import type { DrawingTool } from './canvas/stamp';

export function createEditorStore() {
    return configureStore({
        reducer: {
            tools: toolsSlice.reducer,
            palette: paletteSlice.reducer,
            canvas: canvasSlice.reducer,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: false,
            }),
    });
}

export type EditorStore = ReturnType<typeof createEditorStore>;
export type RootState = ReturnType<EditorStore['getState']>;
export type AppDispatch = EditorStore['dispatch'];

const DRAWING_TOOLS = new Set<string>(['brush', 'pencil', 'eraser']);

/**
 * Thunk: gather tool, colour and frame from state, then dispatch the
 * appropriate canvas action. Handles drawing tools and fill.
 * No-op for transform tools (move / scale / rotate).
 */
export const applyToolAtPoint =
    (x: number, y: number) =>
    (dispatch: AppDispatch, getState: () => RootState) => {
        const state = getState();
        const tool = state.tools.selected;
        const color = state.palette.colors[0];
        const frame = state.canvas.currentFrame;

        if (tool === 'fill') {
            dispatch(fillAtPoint({ x, y, color, frame }));
            return;
        }

        if (!DRAWING_TOOLS.has(tool)) return;

        const { radius, opacity } = state.tools.options[tool];
        dispatch(
            paintAtPoint({
                x,
                y,
                tool: tool as DrawingTool,
                radius,
                color,
                opacity,
                frame,
            }),
        );
    };
