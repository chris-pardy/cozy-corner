import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import { pngCodec } from '../codec/png';

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

describe('pngCodec', () => {
    test('encode → decode roundtrip preserves pixels', async () => {
        const RED = rgba(255, 0, 0, 255);
        const GREEN = rgba(0, 255, 0, 255);
        const BLUE = rgba(0, 0, 255, 128);
        const T = 0;

        const original: PixelBuffer = {
            id: 0,
            width: 2,
            xOffset: 0,
            yOffset: 0,
            pixelData: new Uint32Array([RED, GREEN, BLUE, T]),
        };

        const encoded = await pngCodec.encode(original);
        expect(encoded[0]).toBe(137); // PNG signature first byte
        expect(encoded[1]).toBe(80);  // 'P'

        const decoded = await pngCodec.decode(encoded);
        expect(decoded.width).toBe(2);
        expect(decoded.pixelData.length).toBe(4);
        expect(decoded.pixelData[0]).toBe(RED);
        expect(decoded.pixelData[1]).toBe(GREEN);
        expect(decoded.pixelData[2]).toBe(BLUE);
        expect(decoded.pixelData[3]).toBe(T);
    });

    test('decodes a larger image correctly', async () => {
        const width = 16;
        const height = 16;
        const data = new Uint32Array(width * height);
        for (let i = 0; i < data.length; i++) {
            data[i] = rgba(i % 256, (i * 7) % 256, (i * 13) % 256, 255);
        }

        const original: PixelBuffer = {
            id: 0, width, xOffset: 0, yOffset: 0, pixelData: data,
        };

        const encoded = await pngCodec.encode(original);
        const decoded = await pngCodec.decode(encoded);

        expect(decoded.width).toBe(width);
        expect(decoded.pixelData.length).toBe(width * height);
        for (let i = 0; i < data.length; i++) {
            expect(decoded.pixelData[i]).toBe(data[i]);
        }
    });

    test('handles fully transparent image', async () => {
        const original: PixelBuffer = {
            id: 0, width: 4, xOffset: 0, yOffset: 0,
            pixelData: new Uint32Array(16), // all zeros
        };

        const encoded = await pngCodec.encode(original);
        const decoded = await pngCodec.decode(encoded);

        expect(decoded.width).toBe(4);
        for (const px of decoded.pixelData) {
            expect(px).toBe(0);
        }
    });

    test('throws on invalid data', async () => {
        expect(pngCodec.decode(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    });
});
