import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from './pixel-buffer';
import { type Layer, getFrame, resizeFrames } from './layer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function frame(id: number): PixelBuffer {
    // A distinguishable non-empty frame
    return { id, width: 1, xOffset: 0, yOffset: 0, pixelData: new Uint32Array([id]) };
}

function makeLayer(frameIds: number[], overrides?: Partial<Layer>): Layer {
    return {
        id: 1,
        name: 'test',
        colorChannel: '',
        hidden: false,
        zIndex: 0,
        frames: frameIds.map(frame),
        ...overrides,
    };
}

function ids(layer: Layer): number[] {
    return layer.frames.map((f) => f.id);
}

/** Extract the pixel "payload" we stashed in each frame (the first Uint32). */
function data(layer: Layer): number[] {
    return layer.frames.map((f) => (f.pixelData.length > 0 ? f.pixelData[0] : -1));
}

// Shorthand options
const opts = (grow: 'blank' | 'loop' | 'extend' | 'duplicate', shrink: 'drop' | 'trim') =>
    ({ grow, shrink });

// ---------------------------------------------------------------------------
// getFrame
// ---------------------------------------------------------------------------

describe('getFrame', () => {
    test('returns frame at valid offset', () => {
        const layer = makeLayer([10, 20, 30]);
        expect(getFrame(layer, 0)?.id).toBe(10);
        expect(getFrame(layer, 1)?.id).toBe(20);
        expect(getFrame(layer, 2)?.id).toBe(30);
    });

    test('returns undefined for out-of-range offset', () => {
        const layer = makeLayer([10, 20]);
        expect(getFrame(layer, -1)).toBeUndefined();
        expect(getFrame(layer, 2)).toBeUndefined();
        expect(getFrame(layer, 100)).toBeUndefined();
    });

    test('returns undefined for empty layer', () => {
        const layer = makeLayer([]);
        expect(getFrame(layer, 0)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// resizeFrames — same count / no-op
// ---------------------------------------------------------------------------

describe('resizeFrames — no-op', () => {
    test('same count returns same layer', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 3, opts('blank', 'trim'));
        expect(result).toBe(layer);
    });

    test('negative count returns same layer', () => {
        const layer = makeLayer([1, 2]);
        const result = resizeFrames(layer, -1, opts('blank', 'trim'));
        expect(result).toBe(layer);
    });
});

// ---------------------------------------------------------------------------
// resizeFrames — grow
// ---------------------------------------------------------------------------

describe('resizeFrames — grow: blank', () => {
    test('appends blank frames', () => {
        const layer = makeLayer([1, 2]);
        const result = resizeFrames(layer, 5, opts('blank', 'trim'));

        expect(result.frames.length).toBe(5);
        // Originals preserved
        expect(result.frames[0].id).toBe(1);
        expect(result.frames[1].id).toBe(2);
        // New frames are blank (width 0, empty data)
        for (let i = 2; i < 5; i++) {
            expect(result.frames[i].width).toBe(0);
            expect(result.frames[i].pixelData.length).toBe(0);
        }
    });

    test('blank frame ids are sequential after max existing id', () => {
        const layer = makeLayer([5, 10]);
        const result = resizeFrames(layer, 5, opts('blank', 'trim'));
        expect(result.frames[2].id).toBe(11);
        expect(result.frames[3].id).toBe(12);
        expect(result.frames[4].id).toBe(13);
    });

    test('empty layer grows to all-blank frames', () => {
        const layer = makeLayer([]);
        const result = resizeFrames(layer, 3, opts('blank', 'trim'));
        expect(result.frames.length).toBe(3);
        expect(result.frames.every((f) => f.width === 0)).toBe(true);
    });
});

describe('resizeFrames — grow: loop', () => {
    test('cycles pixel data from existing frames', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 7, opts('loop', 'trim'));
        expect(data(result)).toEqual([1, 2, 3, 1, 2, 3, 1]);
    });

    test('original positions keep original frames', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 7, opts('loop', 'trim'));
        expect(result.frames[0]).toBe(layer.frames[0]);
        expect(result.frames[1]).toBe(layer.frames[1]);
        expect(result.frames[2]).toBe(layer.frames[2]);
    });

    test('new positions have new ids and cloned data', () => {
        const layer = makeLayer([10, 20]);
        const result = resizeFrames(layer, 4, opts('loop', 'trim'));
        // New frames have unique ids, different from originals
        const newIds = ids(result).slice(2);
        expect(newIds.every((id) => id > 20)).toBe(true);
        // But carry the same pixel data
        expect(data(result)).toEqual([10, 20, 10, 20]);
        // Distinct frame objects, but pixelData is shared (copy-on-write)
        expect(result.frames[2]).not.toBe(result.frames[0]);
        expect(result.frames[2].pixelData).toBe(result.frames[0].pixelData);
    });
});

describe('resizeFrames — grow: extend', () => {
    test('extends with cloned last frame data', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 6, opts('extend', 'trim'));
        expect(data(result)).toEqual([1, 2, 3, 3, 3, 3]);
    });

    test('preserves original frames at original positions', () => {
        const layer = makeLayer([10, 20]);
        const result = resizeFrames(layer, 4, opts('extend', 'trim'));
        expect(result.frames[0]).toBe(layer.frames[0]);
        expect(result.frames[1]).toBe(layer.frames[1]);
    });

    test('extended frames have new ids and cloned data', () => {
        const layer = makeLayer([10, 20]);
        const result = resizeFrames(layer, 4, opts('extend', 'trim'));
        // New frames get unique ids > max existing
        expect(result.frames[2].id).toBeGreaterThan(20);
        expect(result.frames[3].id).toBeGreaterThan(result.frames[2].id);
        // New frame object, pixelData shared (copy-on-write)
        expect(result.frames[2]).not.toBe(layer.frames[1]);
        expect(result.frames[2].pixelData).toBe(layer.frames[1].pixelData);
    });
});

describe('resizeFrames — grow: duplicate', () => {
    test('spreads pixel data evenly across new length', () => {
        const layer = makeLayer([1, 2]);
        const result = resizeFrames(layer, 4, opts('duplicate', 'trim'));
        expect(data(result)).toEqual([1, 1, 2, 2]);
    });

    test('first occurrence of each source keeps original frame', () => {
        const layer = makeLayer([1, 2]);
        const result = resizeFrames(layer, 4, opts('duplicate', 'trim'));
        expect(result.frames[0]).toBe(layer.frames[0]);
        expect(result.frames[2]).toBe(layer.frames[1]);
    });

    test('duplicate positions have new ids and cloned data', () => {
        const layer = makeLayer([1, 2]);
        const result = resizeFrames(layer, 4, opts('duplicate', 'trim'));
        // Positions 1 and 3 are duplicates
        expect(result.frames[1].id).toBeGreaterThan(2);
        expect(result.frames[3].id).toBeGreaterThan(result.frames[1].id);
        expect(result.frames[1]).not.toBe(result.frames[0]);
        expect(result.frames[1].pixelData).toBe(result.frames[0].pixelData);
    });

    test('3 frames → 9: each tripled', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 9, opts('duplicate', 'trim'));
        expect(data(result)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    });

    test('2 frames → 3: first gets extra', () => {
        const layer = makeLayer([1, 2]);
        const result = resizeFrames(layer, 3, opts('duplicate', 'trim'));
        expect(data(result)).toEqual([1, 1, 2]);
    });

    test('all ids are unique', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 9, opts('duplicate', 'trim'));
        const allIds = ids(result);
        expect(new Set(allIds).size).toBe(allIds.length);
    });
});

// ---------------------------------------------------------------------------
// resizeFrames — shrink
// ---------------------------------------------------------------------------

describe('resizeFrames — shrink: trim', () => {
    test('keeps first N frames', () => {
        const layer = makeLayer([1, 2, 3, 4, 5]);
        const result = resizeFrames(layer, 3, opts('blank', 'trim'));
        expect(ids(result)).toEqual([1, 2, 3]);
    });

    test('shrink to 1 keeps first frame', () => {
        const layer = makeLayer([10, 20, 30]);
        const result = resizeFrames(layer, 1, opts('blank', 'trim'));
        expect(ids(result)).toEqual([10]);
    });

    test('shrink to 0 returns empty', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 0, opts('blank', 'trim'));
        expect(result.frames.length).toBe(0);
    });
});

describe('resizeFrames — shrink: drop', () => {
    test('evenly samples frames', () => {
        // 6 → 3: picks frames at indices 0, 2, 4
        const layer = makeLayer([1, 2, 3, 4, 5, 6]);
        const result = resizeFrames(layer, 3, opts('blank', 'drop'));
        expect(ids(result)).toEqual([1, 3, 5]);
    });

    test('6 → 2: picks first and middle', () => {
        const layer = makeLayer([1, 2, 3, 4, 5, 6]);
        const result = resizeFrames(layer, 2, opts('blank', 'drop'));
        // floor(0*6/2)=0, floor(1*6/2)=3
        expect(ids(result)).toEqual([1, 4]);
    });

    test('4 → 3: drops one', () => {
        const layer = makeLayer([1, 2, 3, 4]);
        const result = resizeFrames(layer, 3, opts('blank', 'drop'));
        // floor(0*4/3)=0, floor(1*4/3)=1, floor(2*4/3)=2
        expect(ids(result)).toEqual([1, 2, 3]);
    });

    test('shrink to 1 keeps first frame', () => {
        const layer = makeLayer([10, 20, 30, 40]);
        const result = resizeFrames(layer, 1, opts('blank', 'drop'));
        expect(ids(result)).toEqual([10]);
    });

    test('shrink to 0 returns empty', () => {
        const layer = makeLayer([1, 2, 3]);
        const result = resizeFrames(layer, 0, opts('blank', 'drop'));
        expect(result.frames.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// resizeFrames — preserves other layer fields
// ---------------------------------------------------------------------------

describe('resizeFrames — layer fields', () => {
    test('preserves id, name, colorChannel, active, hidden', () => {
        const layer = makeLayer([1, 2], {
            id: 42,
            name: 'Background',
            colorChannel: 'red',
            active: false,
            hidden: true,
        });
        const result = resizeFrames(layer, 4, opts('blank', 'trim'));
        expect(result.id).toBe(42);
        expect(result.name).toBe('Background');
        expect(result.colorChannel).toBe('red');
        expect(result.active).toBe(false);
        expect(result.hidden).toBe(true);
    });

    test('does not mutate original layer', () => {
        const layer = makeLayer([1, 2]);
        resizeFrames(layer, 5, opts('blank', 'trim'));
        expect(layer.frames.length).toBe(2);
    });
});
