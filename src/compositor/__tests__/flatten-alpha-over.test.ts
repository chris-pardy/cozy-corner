import { describe, expect, test } from 'bun:test';
import { type PixelBuffer, flattenAlphaOver } from '@/editor/redux/canvas/pixel-buffer';

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

const RED = rgba(255, 0, 0, 255);
const GREEN = rgba(0, 255, 0, 255);
const BLUE = rgba(0, 0, 255, 255);
const T = 0; // transparent

describe('flattenAlphaOver', () => {
    test('fully opaque source replaces destination', () => {
        const bottom = makeBuffer([[RED]], 0, 0);
        const top = makeBuffer([[GREEN]], 0, 0);
        const result = flattenAlphaOver([bottom, top]);
        expect(result.pixelData[0]).toBe(GREEN);
    });

    test('transparent source leaves destination unchanged', () => {
        const bottom = makeBuffer([[RED]], 0, 0);
        const top = makeBuffer([[T]], 0, 0);
        const result = flattenAlphaOver([bottom, top]);
        expect(result.pixelData[0]).toBe(RED);
    });

    test('semi-transparent source blends over destination', () => {
        const bottom = makeBuffer([[rgba(0, 0, 255, 255)]], 0, 0);
        const top = makeBuffer([[rgba(255, 0, 0, 128)]], 0, 0);
        const result = flattenAlphaOver([bottom, top]);
        const [r, g, b, a] = unpack(result.pixelData[0]);
        // outA = 128 + 255 * (1 - 128/255) ≈ 255
        expect(a).toBe(255);
        // outR = (255*128 + 0*255*(1-128/255)) / 255 ≈ 128
        expect(r).toBeGreaterThan(100);
        expect(r).toBeLessThan(160);
        // outB = (0*128 + 255*255*(1-128/255)) / 255 ≈ 127
        expect(b).toBeGreaterThan(100);
        expect(b).toBeLessThan(160);
    });

    test('non-overlapping buffers fill union bbox', () => {
        const a = makeBuffer([[RED]], 0, 0);
        const b = makeBuffer([[BLUE]], 2, 0);
        const result = flattenAlphaOver([a, b]);
        expect(result.width).toBe(3);
        expect(result.xOffset).toBe(0);
        expect(result.pixelData[0]).toBe(RED);
        expect(result.pixelData[1]).toBe(T);
        expect(result.pixelData[2]).toBe(BLUE);
    });

    test('three layers composited in order', () => {
        // Bottom: blue, middle: green (opaque), top: red (opaque)
        // Result should be red (last opaque layer wins)
        const a = makeBuffer([[BLUE]], 0, 0);
        const b = makeBuffer([[GREEN]], 0, 0);
        const c = makeBuffer([[RED]], 0, 0);
        const result = flattenAlphaOver([a, b, c]);
        expect(result.pixelData[0]).toBe(RED);
    });

    test('single layer returns copy', () => {
        const buf = makeBuffer([[RED]], 3, 7, 5);
        const result = flattenAlphaOver([buf]);
        expect(result.pixelData[0]).toBe(RED);
        expect(result.xOffset).toBe(3);
        expect(result.yOffset).toBe(7);
        expect(result.id).toBe(5);
    });

    test('empty layers are skipped', () => {
        const empty: PixelBuffer = { id: 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const a = makeBuffer([[RED]], 0, 0);
        const result = flattenAlphaOver([empty, a, empty]);
        expect(result.pixelData[0]).toBe(RED);
    });

    test('all-empty returns empty buffer', () => {
        const empty: PixelBuffer = { id: 10, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const result = flattenAlphaOver([empty, empty]);
        expect(result.pixelData.length).toBe(0);
    });

    test('50% alpha over 50% alpha', () => {
        const bottom = makeBuffer([[rgba(0, 0, 200, 128)]], 0, 0);
        const top = makeBuffer([[rgba(200, 0, 0, 128)]], 0, 0);
        const result = flattenAlphaOver([bottom, top]);
        const [r, , b, a] = unpack(result.pixelData[0]);
        // outA = 128 + 128*(1-128/255) ≈ 192
        expect(a).toBeGreaterThan(180);
        expect(a).toBeLessThan(200);
        // Red should dominate since it's on top
        expect(r).toBeGreaterThan(b);
    });
});
