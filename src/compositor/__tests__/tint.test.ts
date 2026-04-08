import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import { applyTint } from '../tint';

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function unpack(pixel: number): [number, number, number, number] {
    return [
        pixel & 0xff,
        (pixel >> 8) & 0xff,
        (pixel >> 16) & 0xff,
        (pixel >>> 24) & 0xff,
    ];
}

function makeBuffer(pixels: number[], width: number): PixelBuffer {
    return { id: 0, width, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(pixels) };
}

describe('applyTint', () => {
    test('white pixel tinted red becomes red', () => {
        const buf = makeBuffer([rgba(255, 255, 255, 255)], 1);
        const result = applyTint(buf, '#ff0000');
        const [r, g, b, a] = unpack(result.pixelData[0]);
        expect(r).toBe(255);
        expect(g).toBe(0);
        expect(b).toBe(0);
        expect(a).toBe(255);
    });

    test('black pixel stays black regardless of tint', () => {
        const buf = makeBuffer([rgba(0, 0, 0, 255)], 1);
        const result = applyTint(buf, '#ff8800');
        const [r, g, b, a] = unpack(result.pixelData[0]);
        expect(r).toBe(0);
        expect(g).toBe(0);
        expect(b).toBe(0);
        expect(a).toBe(255);
    });

    test('alpha is preserved', () => {
        const buf = makeBuffer([rgba(128, 128, 128, 64)], 1);
        const result = applyTint(buf, '#ffffff');
        const [, , , a] = unpack(result.pixelData[0]);
        expect(a).toBe(64);
    });

    test('50% gray tinted with #808080 gives ~25% intensity', () => {
        const buf = makeBuffer([rgba(128, 128, 128, 255)], 1);
        const result = applyTint(buf, '#808080');
        const [r, g, b] = unpack(result.pixelData[0]);
        // 128 * 128 / 255 ≈ 64
        expect(r).toBeGreaterThan(60);
        expect(r).toBeLessThan(68);
        expect(g).toBe(r);
        expect(b).toBe(r);
    });

    test('does not mutate original buffer', () => {
        const buf = makeBuffer([rgba(200, 200, 200, 255)], 1);
        const original = buf.pixelData[0];
        applyTint(buf, '#ff0000');
        expect(buf.pixelData[0]).toBe(original);
    });

    test('handles short hex format (#RGB)', () => {
        const buf = makeBuffer([rgba(255, 255, 255, 255)], 1);
        const result = applyTint(buf, '#f00');
        const [r, g, b] = unpack(result.pixelData[0]);
        expect(r).toBe(255);
        expect(g).toBe(0);
        expect(b).toBe(0);
    });
});
