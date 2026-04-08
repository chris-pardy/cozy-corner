import { describe, expect, test } from 'bun:test';
import { computeCacheKey, canonicalCacheString } from '../cache-key';
import type { CompositeInput } from '../types';
import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';

function makeInput(overrides?: Partial<CompositeInput>): CompositeInput {
    const emptyPixels: PixelBuffer = { id: 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
    return {
        base: { blobCid: 'bafybase', pixels: emptyPixels, layers: [] },
        baseTints: [],
        wearables: [],
        ...overrides,
    };
}

describe('canonicalCacheString', () => {
    test('same inputs produce same string', () => {
        const a = makeInput();
        const b = makeInput();
        expect(canonicalCacheString(a)).toBe(canonicalCacheString(b));
    });

    test('different base CID produces different string', () => {
        const a = makeInput({ base: { blobCid: 'cid1', pixels: makeInput().base.pixels, layers: [] } });
        const b = makeInput({ base: { blobCid: 'cid2', pixels: makeInput().base.pixels, layers: [] } });
        expect(canonicalCacheString(a)).not.toBe(canonicalCacheString(b));
    });

    test('tint order does not matter (sorted)', () => {
        const a = makeInput({
            baseTints: [
                { channel: 'hair', tint: '#ff0000' },
                { channel: 'skin', tint: '#00ff00' },
            ],
        });
        const b = makeInput({
            baseTints: [
                { channel: 'skin', tint: '#00ff00' },
                { channel: 'hair', tint: '#ff0000' },
            ],
        });
        expect(canonicalCacheString(a)).toBe(canonicalCacheString(b));
    });
});

describe('computeCacheKey', () => {
    test('returns a 32-char hex string', async () => {
        const key = await computeCacheKey(makeInput());
        expect(key).toMatch(/^[0-9a-f]{32}$/);
    });

    test('same inputs produce same key', async () => {
        const a = await computeCacheKey(makeInput());
        const b = await computeCacheKey(makeInput());
        expect(a).toBe(b);
    });

    test('different inputs produce different keys', async () => {
        const a = await computeCacheKey(makeInput());
        const b = await computeCacheKey(
            makeInput({ base: { blobCid: 'different', pixels: makeInput().base.pixels, layers: [] } }),
        );
        expect(a).not.toBe(b);
    });
});
