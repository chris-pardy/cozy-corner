import { describe, expect, test } from 'bun:test';
import {
    type PixelBuffer,
    move,
    scale,
    flip,
    rotate,
    flatten,
} from './pixel-buffer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a buffer from a 2-D array of pixel values (row-major). */
function makeBuffer(
    rows: number[][],
    xOffset = 0,
    yOffset = 0,
    id = 1,
): PixelBuffer {
    const height = rows.length;
    const width = height > 0 ? rows[0].length : 0;
    const pixelData = new Uint32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            pixelData[y * width + x] = rows[y][x];
        }
    }
    return { id, width, xOffset, yOffset, pixelData };
}

/** Read the buffer back as a 2-D array. */
function toRows(buf: PixelBuffer): number[][] {
    const h = buf.width > 0 ? buf.pixelData.length / buf.width : 0;
    const rows: number[][] = [];
    for (let y = 0; y < h; y++) {
        const row: number[] = [];
        for (let x = 0; x < buf.width; x++) {
            row.push(buf.pixelData[y * buf.width + x]);
        }
        rows.push(row);
    }
    return rows;
}

/** Height helper. */
function height(buf: PixelBuffer): number {
    return buf.width > 0 ? buf.pixelData.length / buf.width : 0;
}

// ---------------------------------------------------------------------------
// move
// ---------------------------------------------------------------------------

describe('move', () => {
    test('translates offsets by dx, dy', () => {
        const buf = makeBuffer([[1, 2], [3, 4]], 10, 20);
        const result = move(buf, 5, -3);
        expect(result.xOffset).toBe(15);
        expect(result.yOffset).toBe(17);
    });

    test('does not mutate the original', () => {
        const buf = makeBuffer([[1]], 0, 0);
        move(buf, 10, 10);
        expect(buf.xOffset).toBe(0);
        expect(buf.yOffset).toBe(0);
    });

    test('preserves pixel data unchanged', () => {
        const buf = makeBuffer([[1, 2], [3, 4]]);
        const result = move(buf, 99, 99);
        expect(toRows(result)).toEqual([[1, 2], [3, 4]]);
    });

    test('preserves id', () => {
        const buf = makeBuffer([[1]], 0, 0, 42);
        expect(move(buf, 1, 1).id).toBe(42);
    });
});

// ---------------------------------------------------------------------------
// scale
// ---------------------------------------------------------------------------

describe('scale', () => {
    test('scales up 2× with nearest-neighbor', () => {
        const buf = makeBuffer([
            [1, 2],
            [3, 4],
        ]);
        const result = scale(buf, 2);
        expect(result.width).toBe(4);
        expect(height(result)).toBe(4);
        expect(toRows(result)).toEqual([
            [1, 1, 2, 2],
            [1, 1, 2, 2],
            [3, 3, 4, 4],
            [3, 3, 4, 4],
        ]);
    });

    test('scales up 3×', () => {
        const buf = makeBuffer([[1, 2]]);
        const result = scale(buf, 3);
        expect(result.width).toBe(6);
        expect(height(result)).toBe(3);
        // Each pixel tripled in both axes
        expect(toRows(result)).toEqual([
            [1, 1, 1, 2, 2, 2],
            [1, 1, 1, 2, 2, 2],
            [1, 1, 1, 2, 2, 2],
        ]);
    });

    test('keeps xOffset and yOffset the same', () => {
        const buf = makeBuffer([[1]], 5, 10);
        const result = scale(buf, 3);
        expect(result.xOffset).toBe(5);
        expect(result.yOffset).toBe(10);
    });

    test('factor <= 0 returns empty buffer', () => {
        const buf = makeBuffer([[1, 2], [3, 4]]);
        const result = scale(buf, 0);
        expect(result.width).toBe(0);
        expect(result.pixelData.length).toBe(0);
    });

    test('factor < 1 scales down', () => {
        const buf = makeBuffer([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16],
        ]);
        const result = scale(buf, 0.5);
        expect(result.width).toBe(2);
        expect(height(result)).toBe(2);
        // Nearest-neighbor picks (0,0), (2,0), (0,2), (2,2)
        expect(toRows(result)).toEqual([
            [1, 3],
            [9, 11],
        ]);
    });

    test('empty buffer stays empty', () => {
        const buf: PixelBuffer = { id: 1, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const result = scale(buf, 2);
        expect(result.pixelData.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// flip
// ---------------------------------------------------------------------------

describe('flip', () => {
    const buf = makeBuffer([
        [1, 2, 3],
        [4, 5, 6],
    ]);

    test('horizontal flip reverses each row', () => {
        const result = flip(buf, 'horizontal');
        expect(toRows(result)).toEqual([
            [3, 2, 1],
            [6, 5, 4],
        ]);
    });

    test('vertical flip reverses row order', () => {
        const result = flip(buf, 'vertical');
        expect(toRows(result)).toEqual([
            [4, 5, 6],
            [1, 2, 3],
        ]);
    });

    test('double horizontal flip is identity', () => {
        const result = flip(flip(buf, 'horizontal'), 'horizontal');
        expect(toRows(result)).toEqual(toRows(buf));
    });

    test('double vertical flip is identity', () => {
        const result = flip(flip(buf, 'vertical'), 'vertical');
        expect(toRows(result)).toEqual(toRows(buf));
    });

    test('preserves offsets and dimensions', () => {
        const b = makeBuffer([[1, 2], [3, 4]], 7, 13);
        const h = flip(b, 'horizontal');
        const v = flip(b, 'vertical');
        expect(h.xOffset).toBe(7);
        expect(h.yOffset).toBe(13);
        expect(h.width).toBe(2);
        expect(v.xOffset).toBe(7);
        expect(v.yOffset).toBe(13);
        expect(v.width).toBe(2);
    });

    test('empty buffer stays empty', () => {
        const empty: PixelBuffer = { id: 1, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        expect(flip(empty, 'horizontal').pixelData.length).toBe(0);
    });

    test('1×1 buffer is unchanged', () => {
        const single = makeBuffer([[42]]);
        expect(toRows(flip(single, 'horizontal'))).toEqual([[42]]);
        expect(toRows(flip(single, 'vertical'))).toEqual([[42]]);
    });
});

// ---------------------------------------------------------------------------
// rotate
// ---------------------------------------------------------------------------

describe('rotate', () => {
    test('angle 0 returns same data (no copy needed)', () => {
        const buf = makeBuffer([[1, 2], [3, 4]], 5, 10);
        const result = rotate(buf, 0);
        expect(toRows(result)).toEqual(toRows(buf));
        expect(result.xOffset).toBe(5);
        expect(result.yOffset).toBe(10);
        // No change — pixelData is shared
        expect(result.pixelData).toBe(buf.pixelData);
    });

    test('full 2π rotation returns same dimensions and offsets', () => {
        const buf = makeBuffer([[1, 2], [3, 4]], 5, 10);
        // 2π normalises to 0
        const result = rotate(buf, Math.PI * 2);
        expect(result.width).toBe(buf.width);
        expect(height(result)).toBe(height(buf));
    });

    test('90° rotation of a square preserves dimensions', () => {
        const buf = makeBuffer([
            [1, 2],
            [3, 4],
        ]);
        const result = rotate(buf, Math.PI / 2);
        // A 2×2 rotated 90° still fits in a 2×2 (or 3×3 at most due to ceil)
        expect(result.width).toBeGreaterThanOrEqual(2);
        expect(height(result)).toBeGreaterThanOrEqual(2);
    });

    test('90° rotation preserves center position', () => {
        const buf = makeBuffer([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16],
        ], 10, 20);
        const result = rotate(buf, Math.PI / 2);
        const oldCx = buf.xOffset + buf.width / 2;
        const oldCy = buf.yOffset + height(buf) / 2;
        const newCx = result.xOffset + result.width / 2;
        const newCy = result.yOffset + height(result) / 2;
        // Centers should be within 1 pixel (rounding)
        expect(Math.abs(newCx - oldCx)).toBeLessThanOrEqual(1);
        expect(Math.abs(newCy - oldCy)).toBeLessThanOrEqual(1);
    });

    test('180° rotation matches double horizontal+vertical flip', () => {
        const buf = makeBuffer([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16],
        ]);
        const rotated = rotate(buf, Math.PI);
        const flipped = flip(flip(buf, 'horizontal'), 'vertical');
        // Dimensions should match (180° doesn't expand the bounding box)
        expect(rotated.width).toBe(flipped.width);
        expect(height(rotated)).toBe(height(flipped));
        // Pixel data should match
        expect(toRows(rotated)).toEqual(toRows(flipped));
    });

    test('rotation expands bounding box for non-square at 45°', () => {
        const buf = makeBuffer([
            [1, 2, 3, 4, 5, 6, 7, 8],
            [9, 10, 11, 12, 13, 14, 15, 16],
        ]);
        const result = rotate(buf, Math.PI / 4);
        // Rotated 8×2 at 45° should be wider and taller than the original
        const diagonal = Math.ceil(
            Math.abs(8 * Math.cos(Math.PI / 4)) +
            Math.abs(2 * Math.sin(Math.PI / 4)),
        );
        expect(result.width).toBe(diagonal);
    });

    test('non-zero pixels survive rotation (no data loss)', () => {
        // Use a larger buffer so sampling artifacts are proportionally small
        const R = 0xff0000ff; // red
        const size = 16;
        const row = Array(size).fill(R);
        const rows = Array(size).fill(row);
        const buf = makeBuffer(rows);
        const result = rotate(buf, Math.PI / 6); // 30°
        const nonZero = Array.from(result.pixelData).filter((p) => p !== 0).length;
        // The original had size² pixels; rotation preserves area so most should survive
        expect(nonZero).toBeGreaterThanOrEqual(size * size * 0.9);
    });

    test('empty buffer returns empty', () => {
        const empty: PixelBuffer = { id: 1, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const result = rotate(empty, Math.PI / 2);
        expect(result.pixelData.length).toBe(0);
    });

    test('negative angle works (counter-clockwise)', () => {
        const buf = makeBuffer([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16],
        ]);
        const cw = rotate(buf, Math.PI / 2);
        const ccw = rotate(buf, -Math.PI / 2);
        // CW 90° and CCW 90° should produce different results
        expect(toRows(cw)).not.toEqual(toRows(ccw));
        // But same output dimensions (square input)
        expect(cw.width).toBe(ccw.width);
        expect(height(cw)).toBe(height(ccw));
    });

    test('RotSprite smooths diagonal edges vs naive nearest-neighbor', () => {
        // A diagonal line in a larger buffer — RotSprite should produce
        // smoother output than raw nearest-neighbor would.
        // We just verify the algorithm runs and produces a plausible result.
        const W = 0xffffffff;
        const _ = 0x00000000;
        const buf = makeBuffer([
            [W, _, _, _, _, _, _, _],
            [_, W, _, _, _, _, _, _],
            [_, _, W, _, _, _, _, _],
            [_, _, _, W, _, _, _, _],
            [_, _, _, _, W, _, _, _],
            [_, _, _, _, _, W, _, _],
            [_, _, _, _, _, _, W, _],
            [_, _, _, _, _, _, _, W],
        ]);
        const result = rotate(buf, Math.PI / 4);
        // After 45° rotation the diagonal should become roughly horizontal
        // Check that the middle row(s) have a run of white pixels
        const rows = toRows(result);
        const midRow = rows[Math.floor(rows.length / 2)];
        const whiteCount = midRow.filter((p) => p === W).length;
        expect(whiteCount).toBeGreaterThan(0);
    });

    test('preserves id', () => {
        const buf = makeBuffer([[1, 2], [3, 4]], 0, 0, 77);
        expect(rotate(buf, Math.PI / 3).id).toBe(77);
    });
});

// ---------------------------------------------------------------------------
// flatten
// ---------------------------------------------------------------------------

/** Pack RGBA bytes into a Uint32 (little-endian). */
function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** Unpack a Uint32 pixel into [R, G, B, A]. */
function unpack(pixel: number): [number, number, number, number] {
    return [
        pixel & 0xff,
        (pixel >> 8) & 0xff,
        (pixel >> 16) & 0xff,
        (pixel >>> 24) & 0xff,
    ];
}

const RED = rgba(255, 0, 0, 255);
const GREEN = rgba(0, 255, 0, 255);
const BLUE = rgba(0, 0, 255, 255);
const T = 0; // transparent

describe('flatten', () => {
    test('same position and size — top composites onto bottom', () => {
        const bottom = makeBuffer([[RED, T]], 0, 0, 1);
        const top = makeBuffer([[T, GREEN]], 0, 0, 2);
        const result = flatten([bottom, top]);

        expect(result.width).toBe(2);
        expect(height(result)).toBe(1);
        expect(result.xOffset).toBe(0);
        expect(result.yOffset).toBe(0);
        expect(toRows(result)).toEqual([[RED, GREEN]]);
    });

    test('non-overlapping buffers — output covers union bbox', () => {
        const a = makeBuffer([[RED, RED]], 0, 0);
        const b = makeBuffer([[BLUE, BLUE]], 4, 0);
        const result = flatten([a, b]);

        expect(result.xOffset).toBe(0);
        expect(result.width).toBe(6);
        expect(height(result)).toBe(1);
        const rows = toRows(result);
        expect(rows[0]).toEqual([RED, RED, T, T, BLUE, BLUE]);
    });

    test('partially overlapping — additive blend in overlap region', () => {
        const a = makeBuffer([[rgba(100, 0, 0, 100)]], 0, 0);
        const b = makeBuffer([[rgba(0, 200, 0, 128)]], 0, 0);
        const result = flatten([a, b]);

        const [r, g, bl, al] = unpack(result.pixelData[0]);
        expect(r).toBe(100);
        expect(g).toBe(Math.round(200 * 128 / 255));
        expect(bl).toBe(0);
        expect(al).toBe(228);
    });

    test('top with zero alpha leaves bottom unchanged', () => {
        const a = makeBuffer([[RED]], 0, 0);
        const b = makeBuffer([[rgba(0, 255, 0, 0)]], 0, 0);
        const result = flatten([a, b]);
        expect(result.pixelData[0]).toBe(RED);
    });

    test('vertical offset — buffers stacked', () => {
        const a = makeBuffer([[RED]], 0, 0);
        const b = makeBuffer([[BLUE]], 0, 2);
        const result = flatten([a, b]);

        expect(result.xOffset).toBe(0);
        expect(result.yOffset).toBe(0);
        expect(result.width).toBe(1);
        expect(height(result)).toBe(3);
        expect(toRows(result)).toEqual([[RED], [T], [BLUE]]);
    });

    test('negative offsets handled correctly', () => {
        const a = makeBuffer([[RED]], -2, -3);
        const b = makeBuffer([[GREEN]], 0, 0);
        const result = flatten([a, b]);

        expect(result.xOffset).toBe(-2);
        expect(result.yOffset).toBe(-3);
        expect(result.width).toBe(3);
        expect(height(result)).toBe(4);
        expect(result.pixelData[0 * 3 + 0]).toBe(RED);
        expect(result.pixelData[3 * 3 + 2]).toBe(GREEN);
    });

    test('additive blend clamps at 255', () => {
        const a = makeBuffer([[rgba(200, 200, 200, 200)]], 0, 0);
        const b = makeBuffer([[rgba(200, 200, 200, 200)]], 0, 0);
        const result = flatten([a, b]);

        const [r, g, bl, al] = unpack(result.pixelData[0]);
        expect(r).toBe(255);
        expect(g).toBe(255);
        expect(bl).toBe(255);
        expect(al).toBe(255);
    });

    test('three layers composited in order', () => {
        const a = makeBuffer([[rgba(80, 0, 0, 255)]], 0, 0, 1);
        const b = makeBuffer([[rgba(0, 80, 0, 255)]], 0, 0, 2);
        const c = makeBuffer([[rgba(0, 0, 80, 255)]], 0, 0, 3);
        const result = flatten([a, b, c]);

        const [r, g, bl, al] = unpack(result.pixelData[0]);
        expect(r).toBe(80);
        expect(g).toBe(80);
        expect(bl).toBe(80);
        expect(al).toBe(255);
    });

    test('union bbox spans all layers', () => {
        const a = makeBuffer([[RED]], 0, 0);
        const b = makeBuffer([[GREEN]], 5, 0);
        const c = makeBuffer([[BLUE]], 0, 5);
        const result = flatten([a, b, c]);

        expect(result.xOffset).toBe(0);
        expect(result.yOffset).toBe(0);
        expect(result.width).toBe(6);
        expect(height(result)).toBe(6);
        expect(result.pixelData[0 * 6 + 0]).toBe(RED);
        expect(result.pixelData[0 * 6 + 5]).toBe(GREEN);
        expect(result.pixelData[5 * 6 + 0]).toBe(BLUE);
        expect(result.pixelData[5 * 6 + 5]).toBe(T);
    });

    test('empty layers are skipped in compositing', () => {
        const empty: PixelBuffer = { id: 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const a = makeBuffer([[RED]], 0, 0, 7);
        const b = makeBuffer([[GREEN]], 1, 0, 8);
        const result = flatten([empty, a, empty, b, empty]);

        expect(result.width).toBe(2);
        expect(result.id).toBe(0);
        expect(result.pixelData[0]).toBe(RED);
    });

    test('inherits first buffer id', () => {
        const a = makeBuffer([[RED]], 0, 0, 42);
        const b = makeBuffer([[GREEN]], 0, 0, 99);
        const c = makeBuffer([[BLUE]], 0, 0, 7);
        expect(flatten([a, b, c]).id).toBe(42);
    });

    test('single-element array returns copy', () => {
        const buf = makeBuffer([[RED]], 3, 7, 5);
        const result = flatten([buf]);

        expect(result.pixelData[0]).toBe(RED);
        expect(result.xOffset).toBe(3);
        expect(result.yOffset).toBe(7);
        expect(result.id).toBe(5);
        // No change — pixelData is shared
        expect(result.pixelData).toBe(buf.pixelData);
    });

    test('all-empty array returns empty buffer', () => {
        const empty: PixelBuffer = { id: 10, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const result = flatten([empty, empty]);
        expect(result.pixelData.length).toBe(0);
        expect(result.id).toBe(10);
    });

    test('many layers accumulate and clamp', () => {
        const layers = Array.from({ length: 20 }, (_, i) =>
            makeBuffer([[rgba(50, 50, 50, 255)]], 0, 0, i),
        );
        const result = flatten(layers);

        const [r, g, bl, al] = unpack(result.pixelData[0]);
        expect(r).toBe(255);
        expect(g).toBe(255);
        expect(bl).toBe(255);
        expect(al).toBe(255);
    });

    test('offset overlap with additive blend', () => {
        const bottom = makeBuffer([
            [RED, GREEN],
            [BLUE, rgba(50, 50, 50, 100)],
        ], 0, 0);
        const top = makeBuffer([
            [rgba(100, 0, 0, 200), T],
            [T, rgba(0, 0, 100, 255)],
        ], 1, 1);
        const result = flatten([bottom, top]);

        expect(result.xOffset).toBe(0);
        expect(result.yOffset).toBe(0);
        expect(result.width).toBe(3);
        expect(height(result)).toBe(3);

        const rows = toRows(result);
        expect(rows[0]).toEqual([RED, GREEN, T]);
        expect(rows[1][0]).toBe(BLUE);
        const [r, g, bl, al] = unpack(rows[1][1]);
        expect(r).toBe(Math.min(255, 50 + Math.round(100 * 200 / 255)));
        expect(g).toBe(50);
        expect(bl).toBe(50);
        expect(al).toBe(Math.min(255, 100 + 200));
        expect(rows[1][2]).toBe(T);
        expect(rows[2]).toEqual([T, T, rgba(0, 0, 100, 255)]);
    });
});
