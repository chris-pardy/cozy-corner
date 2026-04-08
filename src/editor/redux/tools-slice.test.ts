import { describe, expect, test } from 'bun:test';
import {
    toolsSlice,
    selectTool,
    setRadius,
    setOpacity,
    setZoom,
    type ToolsState,
} from './tools-slice';

const reducer = toolsSlice.reducer;
const initial = reducer(undefined, { type: '@@INIT' });

// ---------------------------------------------------------------------------
// initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
    test('defaults to pencil', () => {
        expect(initial.selected).toBe('pencil');
    });

    test('every tool has options with a radius', () => {
        const tools = ['brush', 'pencil', 'eraser', 'move', 'scale', 'rotate'] as const;
        for (const t of tools) {
            expect(initial.options[t].radius).toBeGreaterThan(0);
        }
    });

    test('drawing tools have larger default radius than pencil', () => {
        expect(initial.options.brush.radius).toBeGreaterThan(initial.options.pencil.radius);
        expect(initial.options.eraser.radius).toBeGreaterThan(initial.options.pencil.radius);
    });

    test('zoom defaults to 1', () => {
        expect(initial.zoom).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// selectTool
// ---------------------------------------------------------------------------

describe('selectTool', () => {
    test('changes the selected tool', () => {
        const state = reducer(initial, selectTool('brush'));
        expect(state.selected).toBe('brush');
    });

    test('can switch to every tool type', () => {
        const tools = ['brush', 'pencil', 'eraser', 'move', 'scale', 'rotate'] as const;
        for (const t of tools) {
            const state = reducer(initial, selectTool(t));
            expect(state.selected).toBe(t);
        }
    });

    test('does not affect options', () => {
        const state = reducer(initial, selectTool('eraser'));
        expect(state.options).toEqual(initial.options);
    });
});

// ---------------------------------------------------------------------------
// setRadius
// ---------------------------------------------------------------------------

describe('setRadius', () => {
    test('changes radius for a specific tool', () => {
        const state = reducer(initial, setRadius({ tool: 'brush', radius: 16 }));
        expect(state.options.brush.radius).toBe(16);
    });

    test('does not affect other tools', () => {
        const state = reducer(initial, setRadius({ tool: 'brush', radius: 16 }));
        expect(state.options.pencil.radius).toBe(initial.options.pencil.radius);
        expect(state.options.eraser.radius).toBe(initial.options.eraser.radius);
    });

    test('rounds to nearest integer', () => {
        const state = reducer(initial, setRadius({ tool: 'pencil', radius: 3.7 }));
        expect(state.options.pencil.radius).toBe(4);
    });

    test('clamps to minimum of 1', () => {
        const state = reducer(initial, setRadius({ tool: 'pencil', radius: 0 }));
        expect(state.options.pencil.radius).toBe(1);

        const state2 = reducer(initial, setRadius({ tool: 'pencil', radius: -5 }));
        expect(state2.options.pencil.radius).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// setOpacity
// ---------------------------------------------------------------------------

describe('setOpacity', () => {
    test('sets opacity for a specific tool', () => {
        const state = reducer(initial, setOpacity({ tool: 'brush', opacity: 0.3 }));
        expect(state.options.brush.opacity).toBe(0.3);
    });

    test('does not affect other tools', () => {
        const state = reducer(initial, setOpacity({ tool: 'brush', opacity: 0.2 }));
        expect(state.options.pencil.opacity).toBe(initial.options.pencil.opacity);
    });

    test('clamps to [0, 1]', () => {
        const low = reducer(initial, setOpacity({ tool: 'brush', opacity: -0.5 }));
        expect(low.options.brush.opacity).toBe(0);

        const high = reducer(initial, setOpacity({ tool: 'brush', opacity: 2 }));
        expect(high.options.brush.opacity).toBe(1);
    });

    test('brush defaults to 0.5 opacity', () => {
        expect(initial.options.brush.opacity).toBe(0.5);
    });

    test('non-brush tools default to 1 opacity', () => {
        expect(initial.options.pencil.opacity).toBe(1);
        expect(initial.options.eraser.opacity).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// setZoom
// ---------------------------------------------------------------------------

describe('setZoom', () => {
    test('sets the zoom level', () => {
        const state = reducer(initial, setZoom(4));
        expect(state.zoom).toBe(4);
    });

    test('accepts fractional values', () => {
        const state = reducer(initial, setZoom(0.5));
        expect(state.zoom).toBe(0.5);
    });

    test('clamps to minimum of 0.1', () => {
        const state = reducer(initial, setZoom(0));
        expect(state.zoom).toBe(0.1);

        const state2 = reducer(initial, setZoom(-2));
        expect(state2.zoom).toBe(0.1);
    });

    test('does not affect selected tool or options', () => {
        const state = reducer(initial, setZoom(8));
        expect(state.selected).toBe(initial.selected);
        expect(state.options).toEqual(initial.options);
    });
});

// ---------------------------------------------------------------------------
// selectors
// ---------------------------------------------------------------------------

describe('selectors', () => {
    const root = (s: ToolsState) => ({ tools: s });

    test('selectCurrentTool returns selected tool', () => {
        const state = reducer(initial, selectTool('rotate'));
        expect(toolsSlice.selectors.selectCurrentTool(root(state))).toBe('rotate');
    });

    test('selectToolOptions returns options for a given tool', () => {
        const state = reducer(initial, setRadius({ tool: 'brush', radius: 32 }));
        expect(toolsSlice.selectors.selectToolOptions(root(state), 'brush').radius).toBe(32);
    });

    test('selectCurrentToolOptions returns options for the active tool', () => {
        let state: ToolsState = reducer(initial, selectTool('brush'));
        state = reducer(state, setRadius({ tool: 'brush', radius: 24 }));
        expect(toolsSlice.selectors.selectCurrentToolOptions(root(state)).radius).toBe(24);
    });

    test('selectZoom returns current zoom level', () => {
        const state = reducer(initial, setZoom(4));
        expect(toolsSlice.selectors.selectZoom(root(state))).toBe(4);
    });
});
