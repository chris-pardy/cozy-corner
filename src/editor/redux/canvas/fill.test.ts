import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from './pixel-buffer';
import { floodFill } from './fill';

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function makeBuffer(
    rows: number[][],
    xOffset = 0,
    yOffset = 0,
): PixelBuffer {
    const height = rows.length;
    const width = height > 0 ? rows[0].length : 0;
    const pixelData = new Uint32Array(width * height);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            pixelData[y * width + x] = rows[y][x];
    return { id: 1, width, xOffset, yOffset, pixelData };
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

const R = rgba(255, 0, 0, 255);
const G = rgba(0, 255, 0, 255);
const B = rgba(0, 0, 255, 255);
const _ = 0;

describe('floodFill', () => {
    test('fills a uniform region', () => {
        const buf = makeBuffer([
            [_, _, _],
            [_, _, _],
            [_, _, _],
        ]);
        const result = floodFill(buf, 1, 1, R);
        expect(toRows(result)).toEqual([
            [R, R, R],
            [R, R, R],
            [R, R, R],
        ]);
    });

    test('fills only the connected region', () => {
        const buf = makeBuffer([
            [_, R, _],
            [R, R, R],
            [_, R, _],
        ]);
        // Fill the top-left transparent corner
        const result = floodFill(buf, 0, 0, G);
        expect(toRows(result)).toEqual([
            [G, R, _],
            [R, R, R],
            [_, R, _],
        ]);
    });

    test('does not cross colour boundaries', () => {
        // Two transparent regions separated by a red wall
        const buf = makeBuffer([
            [_, _, R, _, _],
            [_, _, R, _, _],
            [_, _, R, _, _],
        ]);
        const result = floodFill(buf, 0, 0, G);
        expect(toRows(result)).toEqual([
            [G, G, R, _, _],
            [G, G, R, _, _],
            [G, G, R, _, _],
        ]);
    });

    test('fills the clicked colour, not just transparent', () => {
        const buf = makeBuffer([
            [R, R, R],
            [R, R, R],
        ]);
        const result = floodFill(buf, 0, 0, B);
        expect(toRows(result)).toEqual([
            [B, B, B],
            [B, B, B],
        ]);
    });

    test('no-op when fill colour equals target colour', () => {
        const buf = makeBuffer([[R, R], [R, R]]);
        const result = floodFill(buf, 0, 0, R);
        // Same pixelData reference — no change
        expect(result.pixelData).toBe(buf.pixelData);
    });

    test('no-op when point is out of bounds', () => {
        const buf = makeBuffer([[R]]);
        expect(floodFill(buf, -1, 0, G).pixelData).toBe(buf.pixelData);
        expect(floodFill(buf, 0, -1, G).pixelData).toBe(buf.pixelData);
        expect(floodFill(buf, 1, 0, G).pixelData).toBe(buf.pixelData);
        expect(floodFill(buf, 0, 1, G).pixelData).toBe(buf.pixelData);
    });

    test('handles world-space offsets', () => {
        const buf = makeBuffer([[_, _], [_, _]], 10, 20);
        const result = floodFill(buf, 10, 20, R);
        expect(toRows(result)).toEqual([[R, R], [R, R]]);
    });

    test('single pixel fill', () => {
        const buf = makeBuffer([[_, R], [R, R]]);
        const result = floodFill(buf, 0, 0, G);
        expect(toRows(result)).toEqual([[G, R], [R, R]]);
    });

    test('L-shaped region', () => {
        const buf = makeBuffer([
            [_, _, R],
            [_, R, R],
            [_, _, R],
        ]);
        const result = floodFill(buf, 0, 0, G);
        // 4-connected: (0,0)→(1,0)→(0,1) then (0,2)→(1,2)
        expect(toRows(result)).toEqual([
            [G, G, R],
            [G, R, R],
            [G, G, R],
        ]);
    });

    test('does not fill diagonally', () => {
        const buf = makeBuffer([
            [_, R],
            [R, _],
        ]);
        // Top-left and bottom-right are not 4-connected
        const result = floodFill(buf, 0, 0, G);
        expect(toRows(result)).toEqual([
            [G, R],
            [R, _],
        ]);
    });

    test('empty buffer returns unchanged', () => {
        const empty: PixelBuffer = { id: 1, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
        const result = floodFill(empty, 0, 0, R);
        expect(result.pixelData.length).toBe(0);
    });

    test('does not mutate original', () => {
        const buf = makeBuffer([[_, _], [_, _]]);
        floodFill(buf, 0, 0, R);
        expect(buf.pixelData[0]).toBe(_);
    });
});
