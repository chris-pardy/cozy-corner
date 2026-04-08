import { describe, expect, test } from 'bun:test';
import { createEditorStore, applyToolAtPoint, type AppDispatch } from './store';
import { selectTool, setRadius } from './tools-slice';
import { setCurrentFrame } from './canvas-slice';
import { setColor } from './palette-slice';
import { addLayer } from './canvas-slice';
import type { Layer } from './canvas/layer';
import type { PixelBuffer } from './canvas/pixel-buffer';

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function makeFrame(id: number, width: number, height: number): PixelBuffer {
    return { id, width, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(width * height) };
}

function makeLayer(id: number, frames: PixelBuffer[]): Layer {
    return { id, name: `Layer ${id}`, colorChannel: '', hidden: false, zIndex: 0, frames };
}

describe('store integration', () => {
    test('applyToolAtPoint paints with active colour and tool', () => {
        const store = createEditorStore();
        const GREEN = rgba(0, 255, 0, 255);

        store.dispatch(addLayer(makeLayer(1, [makeFrame(0, 16, 16)])));
        store.dispatch(selectTool('pencil'));
        store.dispatch(setRadius({ tool: 'pencil', radius: 1 }));
        store.dispatch(setColor(GREEN));
        (store.dispatch as AppDispatch)(applyToolAtPoint(5, 5));

        const px = store.getState().canvas.layers[0].frames[0].pixelData[5 * 16 + 5];
        expect(px).toBe(GREEN);
    });

    test('applyToolAtPoint uses correct frame', () => {
        const store = createEditorStore();
        const BLUE = rgba(0, 0, 255, 255);

        store.dispatch(
            addLayer(makeLayer(1, [makeFrame(0, 8, 8), makeFrame(1, 8, 8)])),
        );
        store.dispatch(setCurrentFrame(1));
        store.dispatch(setColor(BLUE));
        (store.dispatch as AppDispatch)(applyToolAtPoint(0, 0));

        // Frame 0 untouched
        expect(store.getState().canvas.layers[0].frames[0].pixelData[0]).toBe(0);
        // Frame 1 painted
        expect(store.getState().canvas.layers[0].frames[1].pixelData[0]).toBe(BLUE);
    });

    test('applyToolAtPoint is no-op for non-drawing tools', () => {
        const store = createEditorStore();
        store.dispatch(addLayer(makeLayer(1, [makeFrame(0, 8, 8)])));
        store.dispatch(selectTool('move'));
        (store.dispatch as AppDispatch)(applyToolAtPoint(0, 0));

        // Nothing painted
        expect(store.getState().canvas.layers[0].frames[0].pixelData[0]).toBe(0);
    });

    test('eraser clears pixels through thunk', () => {
        const store = createEditorStore();
        const RED = rgba(255, 0, 0, 255);

        store.dispatch(addLayer(makeLayer(1, [makeFrame(0, 8, 8)])));

        // Paint a pixel
        store.dispatch(selectTool('pencil'));
        store.dispatch(setColor(RED));
        (store.dispatch as AppDispatch)(applyToolAtPoint(3, 3));
        expect(store.getState().canvas.layers[0].frames[0].pixelData[3 * 8 + 3]).toBe(RED);

        // Erase it
        store.dispatch(selectTool('eraser'));
        store.dispatch(setRadius({ tool: 'eraser', radius: 1 }));
        (store.dispatch as AppDispatch)(applyToolAtPoint(3, 3));
        expect(store.getState().canvas.layers[0].frames[0].pixelData[3 * 8 + 3]).toBe(0);
    });

    test('fill tool flood-fills through thunk', () => {
        const store = createEditorStore();
        const BLUE = rgba(0, 0, 255, 255);

        // 4×4 blank canvas
        store.dispatch(addLayer(makeLayer(1, [makeFrame(0, 4, 4)])));
        store.dispatch(selectTool('fill'));
        store.dispatch(setColor(BLUE));
        (store.dispatch as AppDispatch)(applyToolAtPoint(0, 0));

        // All pixels should be filled
        const pd = store.getState().canvas.layers[0].frames[0].pixelData;
        for (let i = 0; i < pd.length; i++) {
            expect(pd[i]).toBe(BLUE);
        }
    });

    test('root state shape has all three slices', () => {
        const store = createEditorStore();
        const state = store.getState();
        expect(state).toHaveProperty('tools');
        expect(state).toHaveProperty('palette');
        expect(state).toHaveProperty('canvas');
    });
});
