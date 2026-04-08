import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { setActiveLayer, toggleLayerSelection, setCurrentFrame } from './canvas-slice';

export type ToolType = 'brush' | 'pencil' | 'eraser' | 'fill' | 'move' | 'scale' | 'rotate';

export interface ToolOptions {
    radius: number;
    opacity: number;
}

export interface PendingTransformState {
    /** Running total move offset. */
    dx: number;
    dy: number;
    /** Running product of committed scale factors. */
    totalScale: number;
    /** Running sum of committed rotation (radians). */
    totalRotation: number;
    /** Current drag's scale factor (live preview, uncommitted). */
    dragScale: number;
    /** Current drag's rotation (live preview, uncommitted). */
    dragRotation: number;
}

export interface ToolsState {
    selected: ToolType;
    options: Record<ToolType, ToolOptions>;
    zoom: number;
    allFrames: boolean;
    pending: PendingTransformState;
}

const defaults: Record<ToolType, ToolOptions> = {
    brush:  { radius: 8, opacity: 0.5 },
    pencil: { radius: 2, opacity: 1 },
    eraser: { radius: 8, opacity: 1 },
    fill:   { radius: 1, opacity: 1 },
    move:   { radius: 1, opacity: 1 },
    scale:  { radius: 1, opacity: 1 },
    rotate: { radius: 1, opacity: 1 },
};

function makeOptions(): Record<ToolType, ToolOptions> {
    return Object.fromEntries(
        Object.entries(defaults).map(([k, v]) => [k, { ...v }]),
    ) as Record<ToolType, ToolOptions>;
}

const PENDING_ZERO: PendingTransformState = {
    dx: 0, dy: 0,
    totalScale: 1, totalRotation: 0,
    dragScale: 1, dragRotation: 0,
};

const initialState: ToolsState = {
    selected: 'pencil',
    options: makeOptions(),
    zoom: 1,
    allFrames: false,
    pending: { ...PENDING_ZERO },
};

export const toolsSlice = createSlice({
    name: 'tools',
    initialState,
    reducers: {
        selectTool(state, action: PayloadAction<ToolType>) {
            state.selected = action.payload;
            state.pending = { ...PENDING_ZERO };
        },
        setRadius(state, action: PayloadAction<{ tool: ToolType; radius: number }>) {
            state.options[action.payload.tool].radius = Math.max(1, Math.round(action.payload.radius));
        },
        setOpacity(state, action: PayloadAction<{ tool: ToolType; opacity: number }>) {
            state.options[action.payload.tool].opacity = Math.max(0, Math.min(1, action.payload.opacity));
        },
        setZoom(state, action: PayloadAction<number>) {
            state.zoom = Math.max(0.1, action.payload);
        },
        setAllFrames(state, action: PayloadAction<boolean>) {
            state.allFrames = action.payload;
        },
        /** Update drag-time values (called during pointer move). */
        updateDrag(state, action: PayloadAction<Partial<Pick<PendingTransformState, 'dx' | 'dy' | 'dragScale' | 'dragRotation'>>>) {
            Object.assign(state.pending, action.payload);
        },
        /** Commit current drag values into running totals (called on pointer up). */
        commitDrag(state) {
            const p = state.pending;
            p.totalScale *= p.dragScale;
            p.totalRotation += p.dragRotation;
            p.dragScale = 1;
            p.dragRotation = 0;
        },
        resetPending(state) {
            state.pending = { ...PENDING_ZERO };
        },
    },
    extraReducers: (builder) => {
        // Reset running totals when layer selection or frame changes.
        builder.addCase(setActiveLayer, (state) => {
            state.pending = { ...PENDING_ZERO };
        });
        builder.addCase(toggleLayerSelection, (state) => {
            state.pending = { ...PENDING_ZERO };
        });
        builder.addCase(setCurrentFrame, (state) => {
            if (!state.allFrames) {
                state.pending = { ...PENDING_ZERO };
            }
        });
    },
    selectors: {
        selectCurrentTool: (state) => state.selected,
        selectToolOptions: (state, tool: ToolType) => state.options[tool],
        selectCurrentToolOptions: (state) => state.options[state.selected],
        selectZoom: (state) => state.zoom,
        selectAllFrames: (state) => state.allFrames,
        selectPending: (state) => state.pending,
    },
});

export const { selectTool, setRadius, setOpacity, setZoom, setAllFrames, updateDrag, commitDrag, resetPending } = toolsSlice.actions;
export const {
    selectCurrentTool,
    selectToolOptions,
    selectCurrentToolOptions,
    selectZoom,
    selectAllFrames,
    selectPending,
} = toolsSlice.selectors;
