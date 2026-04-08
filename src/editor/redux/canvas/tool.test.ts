import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from './pixel-buffer';
import { type ToolStamp, applyTool } from './tool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pack RGBA bytes into a single Uint32 (little-endian layout). */
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

function makeBuffer(
    rows: number[][],
    xOffset = 0,
    yOffset = 0,
    id = 1,
): PixelBuffer {
    const height = rows.length;
    const width = height > 0 ? rows[0].length : 0;
    const pixelData = new Uint32Array(width * height);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            pixelData[y * width + x] = rows[y][x];
    return { id, width, xOffset, yOffset, pixelData };
}

function toRows(buf: PixelBuffer): number[][] {
    const h = buf.width > 0 ? buf.pixelData.length / buf.width : 0;
    const rows: number[][] = [];
    for (let y = 0; y < h; y++) {
        const row: number[] = [];
        for (let x = 0; x < buf.width; x++) row.push(buf.pixelData[y * buf.width + x]);
        rows.push(row);
    }
    return rows;
}

/** Create a stamp. Default mask: 1 wherever a pixel value is provided. */
function makeStamp(
    rows: number[][],
    maskRows?: number[][],
): ToolStamp {
    const height = rows.length;
    const width = height > 0 ? rows[0].length : 0;
    const pixels = new Uint32Array(width * height);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            pixels[i] = rows[y][x];
            mask[i] = maskRows ? maskRows[y][x] : 1;
        }
    }
    return { width, pixels, mask };
}

const RED = rgba(255, 0, 0, 255);
const GREEN = rgba(0, 255, 0, 255);
const BLUE = rgba(0, 0, 255, 255);
const WHITE = rgba(255, 255, 255, 255);
const _ = 0; // transparent

// ---------------------------------------------------------------------------
// "set" mode
// ---------------------------------------------------------------------------

describe('applyTool — set mode', () => {
    test('overwrites destination pixels where mask is non-zero', () => {
        const buf = makeBuffer([
            [RED, RED],
            [RED, RED],
        ]);
        const stamp = makeStamp([[GREEN, GREEN]]);
        const result = applyTool(buf, stamp, 0, 0, 'set');
        expect(toRows(result)).toEqual([
            [GREEN, GREEN],
            [RED, RED],
        ]);
    });

    test('skips pixels where mask is 0', () => {
        const buf = makeBuffer([[RED, RED]]);
        const stamp = makeStamp(
            [[GREEN, GREEN]],
            [[1, 0]],
        );
        const result = applyTool(buf, stamp, 0, 0, 'set');
        expect(toRows(result)).toEqual([[GREEN, RED]]);
    });

    test('eraser: stamp pixels 0 sets destination to transparent', () => {
        const buf = makeBuffer([
            [RED, GREEN],
            [BLUE, WHITE],
        ]);
        const stamp = makeStamp(
            [[_, _], [_, _]],
            [[1, 1], [1, 1]],
        );
        const result = applyTool(buf, stamp, 0, 0, 'set');
        expect(toRows(result)).toEqual([
            [_, _],
            [_, _],
        ]);
    });

    test('set writes stamp alpha as-is (no blending)', () => {
        const buf = makeBuffer([[RED]]);
        const halfAlpha = rgba(0, 255, 0, 128);
        const stamp = makeStamp([[halfAlpha]]);
        const result = applyTool(buf, stamp, 0, 0, 'set');
        // Destination is replaced wholesale
        expect(result.pixelData[0]).toBe(halfAlpha);
    });

    test('stamp placed at world offset', () => {
        const buf = makeBuffer(
            [
                [_, _, _],
                [_, _, _],
                [_, _, _],
            ],
            10,
            20,
        );
        const stamp = makeStamp([[RED]]);
        const result = applyTool(buf, stamp, 11, 21, 'set');
        expect(toRows(result)).toEqual([
            [_, _, _],
            [_, RED, _],
            [_, _, _],
        ]);
    });

    test('stamp clipped when partially outside buffer', () => {
        const buf = makeBuffer([
            [_, _],
            [_, _],
        ]);
        const stamp = makeStamp([
            [RED, GREEN],
            [BLUE, WHITE],
        ]);
        const result = applyTool(buf, stamp, 1, 1, 'set');
        expect(toRows(result)).toEqual([
            [_, _],
            [_, RED],
        ]);
    });

    test('stamp fully outside buffer is a no-op', () => {
        const buf = makeBuffer([[RED]]);
        const stamp = makeStamp([[GREEN]]);
        const result = applyTool(buf, stamp, 99, 99, 'set');
        expect(toRows(result)).toEqual([[RED]]);
    });

    test('does not mutate the original buffer', () => {
        const buf = makeBuffer([[RED]]);
        const stamp = makeStamp([[GREEN]]);
        applyTool(buf, stamp, 0, 0, 'set');
        expect(buf.pixelData[0]).toBe(RED);
    });
});

// ---------------------------------------------------------------------------
// "over" mode — source-over alpha compositing
// ---------------------------------------------------------------------------

describe('applyTool — over mode', () => {
    test('full-alpha stamp fully replaces destination', () => {
        const buf = makeBuffer([[rgba(100, 50, 25, 200)]]);
        const stamp = makeStamp([[rgba(100, 200, 50, 255)]]);
        const result = applyTool(buf, stamp, 0, 0, 'over');

        const [r, g, b, a] = unpack(result.pixelData[0]);
        // src_a=1.0 → out = src entirely
        expect(r).toBe(100);
        expect(g).toBe(200);
        expect(b).toBe(50);
        expect(a).toBe(255);
    });

    test('half-alpha stamp on transparent → stamp color at half alpha', () => {
        const buf = makeBuffer([[rgba(0, 0, 0, 0)]]);
        const stamp = makeStamp([[rgba(200, 100, 0, 128)]]);
        const result = applyTool(buf, stamp, 0, 0, 'over');

        const [r, g, b, a] = unpack(result.pixelData[0]);
        // src over transparent: out = src
        expect(r).toBe(200);
        expect(g).toBe(100);
        expect(b).toBe(0);
        expect(a).toBe(128);
    });

    test('zero-alpha stamp is a no-op', () => {
        const buf = makeBuffer([[RED]]);
        const stamp = makeStamp([[rgba(0, 255, 0, 0)]]);
        const result = applyTool(buf, stamp, 0, 0, 'over');
        expect(result.pixelData[0]).toBe(RED);
    });

    test('black brush darkens a colored pixel', () => {
        // Half-alpha black over full white should produce gray
        const buf = makeBuffer([[WHITE]]);
        const stamp = makeStamp([[rgba(0, 0, 0, 128)]]);
        const result = applyTool(buf, stamp, 0, 0, 'over');

        const [r, g, b, a] = unpack(result.pixelData[0]);
        // src_a ≈ 0.502, dst_a = 1.0
        // out_a = 0.502 + 1.0*(1-0.502) = 1.0
        // out_r = (0*0.502 + 255*1.0*0.498) / 1.0 ≈ 127
        expect(a).toBe(255);
        expect(r).toBeGreaterThan(120);
        expect(r).toBeLessThan(135);
        expect(g).toBe(r);
        expect(b).toBe(r);
    });

    test('repeated over builds up toward stamp color', () => {
        let buf = makeBuffer([[rgba(255, 255, 255, 255)]]);
        const stamp = makeStamp([[rgba(0, 0, 0, 64)]]);

        buf = applyTool(buf, stamp, 0, 0, 'over');
        const [r1] = unpack(buf.pixelData[0]);

        buf = applyTool(buf, stamp, 0, 0, 'over');
        const [r2] = unpack(buf.pixelData[0]);

        buf = applyTool(buf, stamp, 0, 0, 'over');
        const [r3] = unpack(buf.pixelData[0]);

        // Each stroke darkens further
        expect(r1).toBeLessThan(255);
        expect(r2).toBeLessThan(r1);
        expect(r3).toBeLessThan(r2);
    });

    test('repeated over never overflows', () => {
        let buf = makeBuffer([[rgba(0, 0, 0, 0)]]);
        const stamp = makeStamp([[rgba(200, 200, 200, 200)]]);

        for (let i = 0; i < 20; i++) {
            buf = applyTool(buf, stamp, 0, 0, 'over');
        }

        const [r, g, b, a] = unpack(buf.pixelData[0]);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeLessThanOrEqual(255);
        expect(a).toBeLessThanOrEqual(255);
    });

    test('blue tint on dark pixel shifts toward blue', () => {
        const buf = makeBuffer([[rgba(10, 10, 10, 255)]]);
        const stamp = makeStamp([[rgba(0, 0, 255, 30)]]);
        const result = applyTool(buf, stamp, 0, 0, 'over');

        const [r, g, b, a] = unpack(result.pixelData[0]);
        // Blue channel should increase, others should stay close to 10
        expect(b).toBeGreaterThan(10);
        expect(r).toBeLessThanOrEqual(10);
        expect(g).toBeLessThanOrEqual(10);
        expect(a).toBe(255);
    });

    test('mask 0 skips pixel even if stamp has alpha', () => {
        const buf = makeBuffer([[RED]]);
        const stamp = makeStamp([[GREEN]], [[0]]);
        const result = applyTool(buf, stamp, 0, 0, 'over');
        expect(result.pixelData[0]).toBe(RED);
    });

    test('applies at world offset', () => {
        const buf = makeBuffer(
            [
                [_, _],
                [_, _],
            ],
            5,
            5,
        );
        const stamp = makeStamp([[rgba(10, 20, 30, 255)]]);
        const result = applyTool(buf, stamp, 6, 6, 'over');

        // Only bottom-right pixel affected
        expect(result.pixelData[0]).toBe(_);
        expect(result.pixelData[1]).toBe(_);
        expect(result.pixelData[2]).toBe(_);
        expect(unpack(result.pixelData[3])).toEqual([10, 20, 30, 255]);
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('applyTool — edge cases', () => {
    test('empty buffer returns unchanged', () => {
        const empty: PixelBuffer = {
            id: 1, width: 0, xOffset: 0, yOffset: 0,
            pixelData: new Uint32Array(0),
        };
        const stamp = makeStamp([[RED]]);
        const result = applyTool(empty, stamp, 0, 0, 'set');
        expect(result.pixelData.length).toBe(0);
    });

    test('empty stamp returns copy of buffer', () => {
        const buf = makeBuffer([[RED]]);
        const stamp: ToolStamp = {
            width: 0,
            pixels: new Uint32Array(0),
            mask: new Uint8Array(0),
        };
        const result = applyTool(buf, stamp, 0, 0, 'set');
        expect(result.pixelData[0]).toBe(RED);
        // No change — pixelData is shared
        expect(result.pixelData).toBe(buf.pixelData);
    });

    test('large stamp clipped to buffer bounds', () => {
        const buf = makeBuffer([[_]], 0, 0);
        const stamp = makeStamp([
            [RED, GREEN, BLUE],
            [WHITE, RED, GREEN],
            [BLUE, WHITE, RED],
        ]);
        // Place at (-1, -1): only stamp pixel (2,2)=RED overlaps buf pixel (0,0)
        const result = applyTool(buf, stamp, -1, -1, 'set');
        expect(result.pixelData[0]).toBe(RED);
    });

    test('preserves buffer id and offsets', () => {
        const buf = makeBuffer([[_]], 7, 13, 42);
        const stamp = makeStamp([[RED]]);
        const result = applyTool(buf, stamp, 7, 13, 'set');
        expect(result.id).toBe(42);
        expect(result.xOffset).toBe(7);
        expect(result.yOffset).toBe(13);
    });
});
