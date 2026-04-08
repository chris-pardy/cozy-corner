import { describe, expect, test } from 'bun:test';
import { paletteSlice, setColor, PALETTE_SIZE } from './palette-slice';

const reducer = paletteSlice.reducer;
const initial = reducer(undefined, { type: '@@INIT' });

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

describe('initial state', () => {
    test('has exactly 8 colours', () => {
        expect(initial.colors.length).toBe(PALETTE_SIZE);
    });

    test('first colour is black', () => {
        expect(initial.colors[0]).toBe(rgba(0, 0, 0, 255));
    });
});

describe('setColor', () => {
    test('new colour goes to position 0', () => {
        const custom = rgba(42, 42, 42, 255);
        const state = reducer(initial, setColor(custom));
        expect(state.colors[0]).toBe(custom);
    });

    test('existing colours shift down', () => {
        const custom = rgba(42, 42, 42, 255);
        const state = reducer(initial, setColor(custom));
        expect(state.colors[1]).toBe(initial.colors[0]); // old active pushed down
    });

    test('palette stays at 8 colours', () => {
        const custom = rgba(42, 42, 42, 255);
        const state = reducer(initial, setColor(custom));
        expect(state.colors.length).toBe(PALETTE_SIZE);
    });

    test('oldest colour is dropped when adding new', () => {
        const custom = rgba(42, 42, 42, 255);
        const state = reducer(initial, setColor(custom));
        // Last colour of initial should be gone
        const last = initial.colors[PALETTE_SIZE - 1];
        expect(state.colors).not.toContain(last);
    });

    test('selecting existing colour moves it to front', () => {
        // Pick the 4th colour
        const target = initial.colors[3];
        const state = reducer(initial, setColor(target));
        expect(state.colors[0]).toBe(target);
        // No duplicates
        expect(state.colors.filter((c) => c === target).length).toBe(1);
        // Still 8 colours
        expect(state.colors.length).toBe(PALETTE_SIZE);
    });

    test('selecting active colour (already at 0) is a no-op reorder', () => {
        const active = initial.colors[0];
        const state = reducer(initial, setColor(active));
        expect(state.colors).toEqual(initial.colors);
    });

    test('MRU order after multiple picks', () => {
        let state = initial;
        const a = rgba(1, 0, 0, 255);
        const b = rgba(2, 0, 0, 255);
        const c = rgba(3, 0, 0, 255);

        state = reducer(state, setColor(a));
        state = reducer(state, setColor(b));
        state = reducer(state, setColor(c));

        expect(state.colors[0]).toBe(c);
        expect(state.colors[1]).toBe(b);
        expect(state.colors[2]).toBe(a);
    });
});

describe('selectors', () => {
    const root = (s: typeof initial) => ({ palette: s });

    test('selectActiveColor returns first colour', () => {
        const custom = rgba(99, 99, 99, 255);
        const state = reducer(initial, setColor(custom));
        expect(paletteSlice.selectors.selectActiveColor(root(state))).toBe(custom);
    });

    test('selectColors returns full array', () => {
        expect(paletteSlice.selectors.selectColors(root(initial))).toBe(initial.colors);
    });
});
