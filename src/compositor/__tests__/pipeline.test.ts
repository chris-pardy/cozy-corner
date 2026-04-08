import { describe, expect, test } from 'bun:test';
import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import type { AnimationLayer } from '@/atproto/generated/types/at/cozy-corner/defs';
import type { CompositeInput } from '../types';
import { compositeAvatar } from '../pipeline';

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

const RED = rgba(255, 0, 0, 255);
const GREEN = rgba(0, 255, 0, 255);
const BLUE = rgba(0, 0, 255, 255);
const WHITE = rgba(255, 255, 255, 255);

/** Create a spritesheet PixelBuffer that is cols*frameW wide and rows*frameH tall. */
function makeSpriteSheet(
    frameW: number,
    frameH: number,
    fills: number[][],
): PixelBuffer {
    const rows = fills.length;
    const cols = fills[0].length;
    const width = cols * frameW;
    const height = rows * frameH;
    const data = new Uint32Array(width * height);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const fill = fills[r][c];
            for (let y = 0; y < frameH; y++) {
                for (let x = 0; x < frameW; x++) {
                    data[(r * frameH + y) * width + (c * frameW + x)] = fill;
                }
            }
        }
    }
    return { id: 0, width, xOffset: 0, yOffset: 0, pixelData: data };
}

function makeLayer(
    target: string,
    frameW: number,
    frameH: number,
    col: number,
    row: number,
    frameCount: number,
): AnimationLayer {
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
        frames.push({
            x: (col + i) * frameW,
            y: row * frameH,
            width: frameW,
            height: frameH,
        });
    }
    return { target, frames, frameRate: 100, zIndex: 0 };
}

describe('compositeAvatar', () => {
    test('base only — produces correct output', async () => {
        // 2 frames of 4x4 red pixels
        const sheet = makeSpriteSheet(4, 4, [[RED, GREEN]]);
        const input: CompositeInput = {
            base: {
                blobCid: 'base-cid',
                pixels: sheet,
                layers: [makeLayer('idle-south', 4, 4, 0, 0, 2)],
            },
            baseTints: [],
            wearables: [],
        };

        const result = await compositeAvatar(input);

        expect(result.layers).toHaveLength(1);
        expect(result.layers[0].target).toBe('idle-south');
        expect(result.layers[0].frames).toHaveLength(2);
        expect(result.cacheKey).toMatch(/^[0-9a-f]{32}$/);

        // First frame should be red, second green
        const f0 = result.layers[0].frames[0];
        const px0 = result.pixels.pixelData[f0.y * result.pixels.width + f0.x];
        expect(px0).toBe(RED);

        const f1 = result.layers[0].frames[1];
        const px1 = result.pixels.pixelData[f1.y * result.pixels.width + f1.x];
        expect(px1).toBe(GREEN);
    });

    test('base + wearable — wearable composites over base', async () => {
        const baseSheet = makeSpriteSheet(4, 4, [[BLUE]]);
        const wearSheet = makeSpriteSheet(4, 4, [[RED]]);

        const input: CompositeInput = {
            base: {
                blobCid: 'base',
                pixels: baseSheet,
                layers: [makeLayer('idle-south', 4, 4, 0, 0, 1)],
            },
            baseTints: [],
            wearables: [{
                source: {
                    blobCid: 'wear',
                    pixels: wearSheet,
                    layers: [makeLayer('idle-south', 4, 4, 0, 0, 1)],
                },
                tints: [],
                equipOrder: 0,
            }],
        };

        const result = await compositeAvatar(input);

        // Both are opaque, wearable (red) should be on top via alpha-over
        const f0 = result.layers[0].frames[0];
        const px = result.pixels.pixelData[f0.y * result.pixels.width + f0.x];
        expect(px).toBe(RED);
    });

    test('multiple targets produce multiple output layers', async () => {
        const sheet = makeSpriteSheet(4, 4, [[RED], [GREEN]]);

        const input: CompositeInput = {
            base: {
                blobCid: 'base',
                pixels: sheet,
                layers: [
                    makeLayer('idle-south', 4, 4, 0, 0, 1),
                    makeLayer('walk-south', 4, 4, 0, 1, 1),
                ],
            },
            baseTints: [],
            wearables: [],
        };

        const result = await compositeAvatar(input);
        expect(result.layers).toHaveLength(2);

        const targets = result.layers.map((l) => l.target).sort();
        expect(targets).toEqual(['idle-south', 'walk-south']);
    });

    test('tinting applies to matching colorChannel', async () => {
        const sheet = makeSpriteSheet(4, 4, [[WHITE]]);

        const input: CompositeInput = {
            base: {
                blobCid: 'base',
                pixels: sheet,
                layers: [{
                    ...makeLayer('idle-south', 4, 4, 0, 0, 1),
                    colorChannel: 'hair',
                }],
            },
            baseTints: [{ channel: 'hair', tint: '#ff0000' }],
            wearables: [],
        };

        const result = await compositeAvatar(input);
        const f0 = result.layers[0].frames[0];
        const px = result.pixels.pixelData[f0.y * result.pixels.width + f0.x];
        const [r, g, b] = unpack(px);
        expect(r).toBe(255);
        expect(g).toBe(0);
        expect(b).toBe(0);
    });

    test('zIndex sorts layers correctly', async () => {
        // Base has zIndex=1 (in front), wearable has zIndex=0 (behind)
        // With alpha-over, the zIndex=1 layer draws last and should win
        const baseSheet = makeSpriteSheet(4, 4, [[RED]]);
        const wearSheet = makeSpriteSheet(4, 4, [[BLUE]]);

        const input: CompositeInput = {
            base: {
                blobCid: 'base',
                pixels: baseSheet,
                layers: [{
                    ...makeLayer('idle-south', 4, 4, 0, 0, 1),
                    zIndex: 1,
                }],
            },
            baseTints: [],
            wearables: [{
                source: {
                    blobCid: 'wear',
                    pixels: wearSheet,
                    layers: [{
                        ...makeLayer('idle-south', 4, 4, 0, 0, 1),
                        zIndex: 0,
                    }],
                },
                tints: [],
                equipOrder: 0,
            }],
        };

        const result = await compositeAvatar(input);
        const f0 = result.layers[0].frames[0];
        const px = result.pixels.pixelData[f0.y * result.pixels.width + f0.x];
        // Base (zIndex=1) draws on top of wearable (zIndex=0)
        expect(px).toBe(RED);
    });
});
