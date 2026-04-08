import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Pack RGBA into a Uint32 (little-endian). */
function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export const PALETTE_SIZE = 8;

export interface PaletteState {
    /** MRU colour history. Index 0 is the active colour. Always length 8. */
    colors: number[];
}

const initialState: PaletteState = {
    colors: [
        rgba(0, 0, 0, 255),       // black
        rgba(255, 255, 255, 255), // white
        rgba(255, 0, 0, 255),     // red
        rgba(0, 255, 0, 255),     // green
        rgba(0, 0, 255, 255),     // blue
        rgba(255, 255, 0, 255),   // yellow
        rgba(0, 255, 255, 255),   // cyan
        rgba(255, 0, 255, 255),   // magenta
    ],
};

export const paletteSlice = createSlice({
    name: 'palette',
    initialState,
    reducers: {
        /**
         * Set the active colour. If the colour already exists in the history
         * it moves to position 0; otherwise it is inserted at 0 and the
         * oldest colour is dropped.
         */
        setColor(state, action: PayloadAction<number>) {
            const color = action.payload;
            const idx = state.colors.indexOf(color);
            if (idx >= 0) {
                state.colors.splice(idx, 1);
            } else {
                state.colors.pop();
            }
            state.colors.unshift(color);
        },
    },
    selectors: {
        selectActiveColor: (state) => state.colors[0],
        selectColors: (state) => state.colors,
    },
});

export const { setColor } = paletteSlice.actions;
export const { selectActiveColor, selectColors } = paletteSlice.selectors;
