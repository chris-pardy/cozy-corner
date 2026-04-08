import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import type { AnimationLayer, ChannelTint } from '@/atproto/generated/types/at/cozy-corner/defs';

/** A source spritesheet: decoded pixel data + animation layers that reference it. */
export interface SpriteSheetSource {
    /** CID of the blob (used for cache keying). */
    blobCid: string;
    /** Decoded pixel data (RGBA Uint32Array). */
    pixels: PixelBuffer;
    /** Animation layers from the record. */
    layers: AnimationLayer[];
}

/** Full input to the compositor -- everything needed for one avatar. */
export interface CompositeInput {
    base: SpriteSheetSource;
    baseTints: ChannelTint[];
    wearables: Array<{
        source: SpriteSheetSource;
        tints: ChannelTint[];
        /** Position in avatar's wearable list (determines sort priority within same zIndex). */
        equipOrder: number;
    }>;
}

/** The output of the compositing pipeline. */
export interface CompositeResult {
    /** The packed composite spritesheet. */
    pixels: PixelBuffer;
    /** Animation metadata pointing into the packed sheet. */
    layers: AnimationLayer[];
    /** Deterministic cache key for this composite. */
    cacheKey: string;
}
