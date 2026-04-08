import { describe, expect, test } from 'bun:test';
import {
    canvasSlice,
    addLayer,
    removeLayer,
    setActiveLayer,
    paintAtPoint,
    fillAtPoint,
} from './canvas-slice';
import type { Layer } from './canvas/layer';
import type { PixelBuffer } from './canvas/pixel-buffer';

const reducer = canvasSlice.reducer;
const initial = reducer(undefined, { type: '@@INIT' });

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function makeFrame(id: number, width: number, height: number): PixelBuffer {
    return {
        id,
        width,
        xOffset: 0,
        yOffset: 0,
        pixelData: new Uint32Array(width * height),
    };
}

function makeLayer(id: number, frames: PixelBuffer[]): Layer {
    return {
        id,
        name: `Layer ${id}`,
        colorChannel: '',
        hidden: false,
        zIndex: 0,
        frames,
    };
}

// ---------------------------------------------------------------------------
// initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
    test('starts with no layers', () => {
        expect(initial.layers.length).toBe(0);
    });

    test('activeLayerId is -1', () => {
        expect(initial.activeLayerId).toBe(-1);
    });
});

// ---------------------------------------------------------------------------
// addLayer / removeLayer / setActiveLayer
// ---------------------------------------------------------------------------

describe('layer management', () => {
    test('addLayer appends and auto-selects first layer', () => {
        const layer = makeLayer(1, [makeFrame(0, 4, 4)]);
        const state = reducer(initial, addLayer(layer));
        expect(state.layers.length).toBe(1);
        expect(state.activeLayerId).toBe(1);
    });

    test('addLayer does not change active when one already set', () => {
        let state = reducer(initial, addLayer(makeLayer(1, [])));
        state = reducer(state, addLayer(makeLayer(2, [])));
        expect(state.activeLayerId).toBe(1);
    });

    test('removeLayer drops the layer', () => {
        let state = reducer(initial, addLayer(makeLayer(1, [])));
        state = reducer(state, addLayer(makeLayer(2, [])));
        state = reducer(state, removeLayer(1));
        expect(state.layers.length).toBe(1);
        expect(state.layers[0].id).toBe(2);
    });

    test('removeLayer resets active if removed was active', () => {
        let state = reducer(initial, addLayer(makeLayer(1, [])));
        state = reducer(state, addLayer(makeLayer(2, [])));
        state = reducer(state, removeLayer(1));
        expect(state.activeLayerId).toBe(2);
    });

    test('removeLayer last layer sets active to -1', () => {
        let state = reducer(initial, addLayer(makeLayer(1, [])));
        state = reducer(state, removeLayer(1));
        expect(state.activeLayerId).toBe(-1);
    });

    test('setActiveLayer updates activeLayerId', () => {
        let state = reducer(initial, addLayer(makeLayer(1, [])));
        state = reducer(state, addLayer(makeLayer(2, [])));
        state = reducer(state, setActiveLayer(2));
        expect(state.activeLayerId).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// paintAtPoint
// ---------------------------------------------------------------------------

const RED = rgba(255, 0, 0, 255);

describe('paintAtPoint', () => {
    function stateWithLayer() {
        const frame = makeFrame(0, 8, 8);
        const layer = makeLayer(1, [frame]);
        return reducer(initial, addLayer(layer));
    }

    test('pencil paints at the given coordinates', () => {
        const state = stateWithLayer();
        const result = reducer(
            state,
            paintAtPoint({ x: 3, y: 3, tool: 'pencil', radius: 1, color: RED, opacity: 1, frame: 0 }),
        );

        const px = result.layers[0].frames[0].pixelData[3 * 8 + 3];
        expect(px).toBe(RED);
    });

    test('eraser sets pixels to transparent', () => {
        // First paint, then erase
        let state = stateWithLayer();
        state = reducer(
            state,
            paintAtPoint({ x: 3, y: 3, tool: 'pencil', radius: 1, color: RED, opacity: 1, frame: 0 }),
        );
        expect(state.layers[0].frames[0].pixelData[3 * 8 + 3]).toBe(RED);

        state = reducer(
            state,
            paintAtPoint({ x: 3, y: 3, tool: 'eraser', radius: 1, color: RED, opacity: 1, frame: 0 }),
        );
        expect(state.layers[0].frames[0].pixelData[3 * 8 + 3]).toBe(0);
    });

    test('brush uses source-over compositing', () => {
        // Brush with partial alpha should blend, not overwrite
        let state = stateWithLayer();
        const halfAlpha = rgba(255, 0, 0, 128);
        state = reducer(
            state,
            paintAtPoint({ x: 3, y: 3, tool: 'brush', radius: 1, color: halfAlpha, opacity: 1, frame: 0 }),
        );
        const px = state.layers[0].frames[0].pixelData[3 * 8 + 3];
        // Alpha should be 128 (added to 0)
        expect((px >>> 24) & 0xff).toBe(128);
    });

    test('no-op on hidden layer', () => {
        let state = stateWithLayer();
        // Hide the layer
        state = { ...state, layers: [{ ...state.layers[0], hidden: true }] };
        const before = state.layers[0].frames[0].pixelData[0];
        state = reducer(
            state,
            paintAtPoint({ x: 0, y: 0, tool: 'pencil', radius: 1, color: RED, opacity: 1, frame: 0 }),
        );
        expect(state.layers[0].frames[0].pixelData[0]).toBe(before);
    });

    test('no-op when frame out of range', () => {
        const state = stateWithLayer();
        const result = reducer(
            state,
            paintAtPoint({ x: 0, y: 0, tool: 'pencil', radius: 1, color: RED, opacity: 1, frame: 99 }),
        );
        // State should be unchanged
        expect(result.layers[0].frames[0].pixelData[0]).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// fillAtPoint
// ---------------------------------------------------------------------------

describe('fillAtPoint', () => {
    function stateWithData(rows: number[][]) {
        const width = rows[0].length;
        const height = rows.length;
        const pixelData = new Uint32Array(width * height);
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++)
                pixelData[y * width + x] = rows[y][x];
        const frame: PixelBuffer = { id: 0, width, xOffset: 0, yOffset: 0, pixelData };
        const layer = makeLayer(1, [frame]);
        return reducer(initial, addLayer(layer));
    }

    test('fills connected region with active colour', () => {
        const state = stateWithData([
            [0, 0, RED],
            [0, RED, RED],
            [0, 0, RED],
        ]);
        const result = reducer(
            state,
            fillAtPoint({ x: 0, y: 0, color: rgba(0, 0, 255, 255), frame: 0 }),
        );
        const pd = result.layers[0].frames[0].pixelData;
        const B = rgba(0, 0, 255, 255);
        // Transparent region filled
        expect(pd[0]).toBe(B);
        expect(pd[1]).toBe(B);
        expect(pd[3]).toBe(B);
        expect(pd[6]).toBe(B);
        expect(pd[7]).toBe(B);
        // Red boundary untouched
        expect(pd[2]).toBe(RED);
        expect(pd[4]).toBe(RED);
        expect(pd[5]).toBe(RED);
        expect(pd[8]).toBe(RED);
    });

    test('no-op on hidden layer', () => {
        let state = stateWithData([[0, 0], [0, 0]]);
        state = { ...state, layers: [{ ...state.layers[0], hidden: true }] };
        state = reducer(state, fillAtPoint({ x: 0, y: 0, color: RED, frame: 0 }));
        expect(state.layers[0].frames[0].pixelData[0]).toBe(0);
    });

    test('no-op when frame out of range', () => {
        const state = stateWithData([[0]]);
        const result = reducer(state, fillAtPoint({ x: 0, y: 0, color: RED, frame: 5 }));
        expect(result.layers[0].frames[0].pixelData[0]).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// selectors
// ---------------------------------------------------------------------------

describe('selectors', () => {
    const root = (s: typeof initial) => ({ canvas: s });

    test('selectActiveLayer returns the active layer', () => {
        let state = reducer(initial, addLayer(makeLayer(1, [])));
        state = reducer(state, addLayer(makeLayer(2, [])));
        const layer = canvasSlice.selectors.selectActiveLayer(root(state));
        expect(layer?.id).toBe(1);
    });

    test('selectActiveLayer returns undefined when no layers', () => {
        expect(
            canvasSlice.selectors.selectActiveLayer(root(initial)),
        ).toBeUndefined();
    });
});
