import { describe, expect, test } from 'bun:test';
import { generateStamp } from './stamp';

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function unpackAlpha(pixel: number): number {
    return (pixel >>> 24) & 0xff;
}

const RED = rgba(255, 0, 0, 255);

// ---------------------------------------------------------------------------
// stamp dimensions
// ---------------------------------------------------------------------------

describe('stamp dimensions', () => {
    test('radius 1 produces 1×1 stamp', () => {
        const s = generateStamp('pencil', 1, RED);
        expect(s.width).toBe(1);
        expect(s.pixels.length).toBe(1);
        expect(s.mask.length).toBe(1);
    });

    test('radius 2 produces 3×3 stamp', () => {
        const s = generateStamp('pencil', 2, RED);
        expect(s.width).toBe(3);
        expect(s.pixels.length).toBe(9);
    });

    test('radius 4 produces 7×7 stamp', () => {
        const s = generateStamp('pencil', 4, RED);
        expect(s.width).toBe(7);
        expect(s.pixels.length).toBe(49);
    });
});

// ---------------------------------------------------------------------------
// pencil
// ---------------------------------------------------------------------------

describe('pencil stamp', () => {
    test('radius 1: single pixel with the given colour', () => {
        const s = generateStamp('pencil', 1, RED);
        expect(s.pixels[0]).toBe(RED);
        expect(s.mask[0]).toBe(1);
    });

    test('radius 2: all 9 pixels filled (small circle covers full grid)', () => {
        const s = generateStamp('pencil', 2, RED);
        const filled = Array.from(s.mask).filter((m) => m !== 0).length;
        expect(filled).toBe(9);
        for (let i = 0; i < 9; i++) {
            expect(s.pixels[i]).toBe(RED);
        }
    });

    test('larger radius has unfilled corners (circular shape)', () => {
        const s = generateStamp('pencil', 5, RED);
        // Corner distance for 9×9 grid: sqrt(4²+4²) = 5.66 > 4.5 threshold
        expect(s.mask[0]).toBe(0); // top-left corner
        // Centre should be filled
        const cx = 4;
        expect(s.mask[cx * s.width + cx]).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// eraser
// ---------------------------------------------------------------------------

describe('eraser stamp', () => {
    test('all pixels are 0 (transparent)', () => {
        const s = generateStamp('eraser', 3, RED);
        const filled = Array.from(s.mask).filter((m) => m !== 0).length;
        expect(filled).toBeGreaterThan(0);
        for (let i = 0; i < s.pixels.length; i++) {
            if (s.mask[i]) expect(s.pixels[i]).toBe(0);
        }
    });

    test('mask shape matches pencil of same radius', () => {
        const pencil = generateStamp('pencil', 4, RED);
        const eraser = generateStamp('eraser', 4, RED);
        expect(Array.from(eraser.mask)).toEqual(Array.from(pencil.mask));
    });
});

// ---------------------------------------------------------------------------
// brush
// ---------------------------------------------------------------------------

describe('brush stamp', () => {
    test('centre pixel has full alpha', () => {
        const s = generateStamp('brush', 3, RED);
        const cx = 2;
        const alpha = unpackAlpha(s.pixels[cx * s.width + cx]);
        expect(alpha).toBe(255);
    });

    test('edge pixels have lower alpha than centre', () => {
        const s = generateStamp('brush', 5, RED);
        const cx = 4;
        const centreAlpha = unpackAlpha(s.pixels[cx * s.width + cx]);
        // A pixel one step from the edge
        const edgeAlpha = unpackAlpha(s.pixels[cx * s.width + (s.width - 2)]);
        expect(edgeAlpha).toBeLessThan(centreAlpha);
        expect(edgeAlpha).toBeGreaterThan(0);
    });

    test('mask shape matches pencil of same radius', () => {
        const pencil = generateStamp('pencil', 4, RED);
        const brush = generateStamp('brush', 4, RED);
        expect(Array.from(brush.mask)).toEqual(Array.from(pencil.mask));
    });

    test('preserves RGB channels from colour', () => {
        const color = rgba(100, 150, 200, 255);
        const s = generateStamp('brush', 1, color);
        // Single pixel, centre = full alpha → should equal input colour
        expect(s.pixels[0]).toBe(color);
    });

    test('opacity scales centre alpha', () => {
        const s = generateStamp('brush', 1, RED, 0.5);
        const alpha = unpackAlpha(s.pixels[0]);
        // 255 * 1.0 (falloff at centre) * 0.5 (opacity) = 128
        expect(alpha).toBe(128);
    });

    test('opacity 0 produces fully transparent brush', () => {
        const s = generateStamp('brush', 3, RED, 0);
        for (let i = 0; i < s.pixels.length; i++) {
            if (s.mask[i]) expect(unpackAlpha(s.pixels[i])).toBe(0);
        }
    });

    test('opacity does not affect pencil or eraser', () => {
        const pencilFull = generateStamp('pencil', 1, RED, 1);
        const pencilHalf = generateStamp('pencil', 1, RED, 0.5);
        // Pencil ignores opacity — stamps identical
        expect(pencilFull.pixels[0]).toBe(pencilHalf.pixels[0]);

        const eraserFull = generateStamp('eraser', 1, RED, 1);
        const eraserHalf = generateStamp('eraser', 1, RED, 0.5);
        expect(eraserFull.pixels[0]).toBe(eraserHalf.pixels[0]);
    });
});
