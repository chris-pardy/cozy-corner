import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import { packSpritesheet, type PackInput } from '../pack';

function rgba(r: number, g: number, b: number, a: number): number {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function makeFrame(width: number, height: number, fill: number): PixelBuffer {
    return {
        id: 0,
        width,
        xOffset: 0,
        yOffset: 0,
        pixelData: new Uint32Array(width * height).fill(fill),
    };
}

const RED = rgba(255, 0, 0, 255);
const GREEN = rgba(0, 255, 0, 255);
const BLUE = rgba(0, 0, 255, 255);

describe('packSpritesheet', () => {
    test('single target with 2 frames packs horizontally', () => {
        const input: PackInput = {
            target: 'idle-south',
            frameRate: 100,
            zIndex: 0,
            frames: [makeFrame(4, 4, RED), makeFrame(4, 4, GREEN)],
        };

        const { pixels, layers } = packSpritesheet([input]);

        expect(pixels.width).toBe(8); // 4 * 2
        expect(pixels.pixelData.length / pixels.width).toBe(4); // height = 4
        expect(layers).toHaveLength(1);
        expect(layers[0].target).toBe('idle-south');
        expect(layers[0].frames).toHaveLength(2);
        expect(layers[0].frames[0]).toEqual({ x: 0, y: 0, width: 4, height: 4 });
        expect(layers[0].frames[1]).toEqual({ x: 4, y: 0, width: 4, height: 4 });
    });

    test('two targets stack vertically', () => {
        const inputs: PackInput[] = [
            {
                target: 'idle-south',
                frameRate: 100,
                zIndex: 0,
                frames: [makeFrame(4, 4, RED)],
            },
            {
                target: 'walk-south',
                frameRate: 200,
                zIndex: 0,
                frames: [makeFrame(4, 6, BLUE)],
            },
        ];

        const { pixels, layers } = packSpritesheet(inputs);

        expect(pixels.width).toBe(4);
        expect(pixels.pixelData.length / pixels.width).toBe(10); // 4 + 6

        expect(layers[0].frames[0]).toEqual({ x: 0, y: 0, width: 4, height: 4 });
        expect(layers[1].frames[0]).toEqual({ x: 0, y: 4, width: 4, height: 6 });
    });

    test('empty inputs returns empty result', () => {
        const { pixels, layers } = packSpritesheet([]);
        expect(pixels.pixelData.length).toBe(0);
        expect(layers).toHaveLength(0);
    });

    test('pixel data is correctly placed', () => {
        const inputs: PackInput[] = [
            {
                target: 'a',
                frameRate: 100,
                zIndex: 0,
                frames: [makeFrame(2, 2, RED), makeFrame(2, 2, GREEN)],
            },
        ];

        const { pixels } = packSpritesheet(inputs);
        // Row 0: RED RED GREEN GREEN
        expect(pixels.pixelData[0]).toBe(RED);
        expect(pixels.pixelData[1]).toBe(RED);
        expect(pixels.pixelData[2]).toBe(GREEN);
        expect(pixels.pixelData[3]).toBe(GREEN);
    });

    test('preserves frameRate and zIndex in output layers', () => {
        const input: PackInput = {
            target: 'dance',
            frameRate: 250,
            zIndex: 1,
            frames: [makeFrame(2, 2, RED)],
        };

        const { layers } = packSpritesheet([input]);
        expect(layers[0].frameRate).toBe(250);
        expect(layers[0].zIndex).toBe(1);
    });
});
